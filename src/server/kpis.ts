// TASK-011 — Servidor de KPI: definiciones y resultados.
//
// Las definiciones se configuran (sin código ejecutable) y los resultados se
// CALCULAN en servidor sobre el dataset unificado con el motor puro `computeKpi`.
// `kpi_results` es una caché recalculable (upsert por kpi+periodo), no una segunda
// fuente de verdad. Escrituras bajo RLS.

import type { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';
import { loadUnifiedEvents, loadUnifiedEventsTx } from './analytics';
import {
  computeKpi,
  type EventFilter,
  type KpiConfig,
  type KpiMeasure,
  type KpiPeriod,
  type MetricField,
  type DesiredDirection,
} from '@/features/analytics/kpi-engine';
import { computeTrend, type TrendResult } from '@/features/analytics/pareto-trends';
import type { UnifiedEvent, UnifiedSource } from '@/features/analytics/unified-events';

type Tx = Prisma.TransactionClient;

export class KpiError extends Error {}
export class KpiPermissionError extends KpiError {}
export class KpiValidationError extends KpiError {
  constructor(public readonly errors: string[]) {
    super(errors.join(' '));
  }
}

export const KPI_SOURCES = [
  'quality_events',
  'capa',
  'audits',
  'findings',
  'tasks',
  'projects',
  'documents',
] as const;
export const KPI_MEASURES: KpiMeasure[] = [
  'count',
  'sum',
  'average',
  'median',
  'percentage',
  'rate',
  'proportion',
  'avg_duration',
  'compliance',
  'recurrence',
];
export const KPI_PERIODS: KpiPeriod[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

/** Traduce el `source` de la definición al filtro de fuentes del dataset. */
const SOURCE_TO_UNIFIED: Record<string, UnifiedSource[]> = {
  quality_events: ['quality_event'],
  capa: ['capa', 'capa_action'],
  audits: ['audit_finding'],
  findings: ['audit_finding'],
  tasks: ['task'],
  projects: ['project'],
  documents: [],
};

function asFilter(value: Prisma.JsonValue | null): EventFilter | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as EventFilter;
  return undefined;
}

type KpiDefinitionRow = Prisma.KpiDefinitionGetPayload<Record<string, never>>;

/** Construye la configuración pura de cálculo a partir de una definición. */
export function buildKpiConfig(def: KpiDefinitionRow): KpiConfig {
  const stored = asFilter(def.filters) ?? {};
  const sourceFilter = SOURCE_TO_UNIFIED[def.source] ?? [];
  const filters: EventFilter = { ...stored };
  if (sourceFilter.length > 0 && !filters.source) filters.source = sourceFilter;
  return {
    measure: def.measure as KpiMeasure,
    measureField: (def.measureField as MetricField | null) ?? undefined,
    filters,
    numeratorFilter: asFilter(def.numeratorFilter),
    denominatorFilter: asFilter(def.denominatorFilter),
    rateMultiplier: def.rateMultiplier ? Number(def.rateMultiplier) : undefined,
    period: def.period as KpiPeriod,
    target: def.target !== null ? Number(def.target) : null,
    warningThreshold: def.warningThreshold !== null ? Number(def.warningThreshold) : null,
    criticalThreshold: def.criticalThreshold !== null ? Number(def.criticalThreshold) : null,
    desiredDirection: (def.desiredDirection as DesiredDirection) ?? 'lower',
  };
}

async function memberRole(organizationId: string, userId: string): Promise<string> {
  const m = await getPrisma().membership.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!m) throw new KpiPermissionError('No perteneces a esta organización.');
  return m.role;
}

function canManage(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

async function nextKpiCode(tx: Tx, organizationId: string): Promise<string> {
  const rows = await tx.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO kpi_folio_counters ("organization_id", "last_seq")
    VALUES (${organizationId}::uuid, 1)
    ON CONFLICT ("organization_id")
    DO UPDATE SET "last_seq" = kpi_folio_counters."last_seq" + 1
    RETURNING "last_seq"`;
  const seq = rows[0]?.last_seq ?? 1;
  return `KPI-${String(seq).padStart(4, '0')}`;
}

export interface KpiDefinitionInput {
  name: string;
  description?: string | null;
  category?: string | null;
  source: string;
  measure: string;
  measureField?: string | null;
  period: string;
  unit?: string | null;
  target?: number | null;
  warningThreshold?: number | null;
  criticalThreshold?: number | null;
  desiredDirection?: string;
  filters?: EventFilter | null;
  numeratorFilter?: EventFilter | null;
  responsibleUserId?: string | null;
}

export async function createKpiDefinition(
  organizationId: string,
  actorId: string,
  input: KpiDefinitionInput,
): Promise<string> {
  const role = await memberRole(organizationId, actorId);
  if (!canManage(role)) throw new KpiPermissionError('Solo owner/admin pueden crear KPI.');
  const errors: string[] = [];
  if (!input.name?.trim()) errors.push('El nombre es obligatorio.');
  if (!(KPI_SOURCES as readonly string[]).includes(input.source)) errors.push('Fuente inválida.');
  if (!(KPI_MEASURES as string[]).includes(input.measure)) errors.push('Medida inválida.');
  if (!(KPI_PERIODS as string[]).includes(input.period)) errors.push('Periodo inválido.');
  const needsField = ['sum', 'average', 'median', 'avg_duration'].includes(input.measure);
  if (needsField && input.measure !== 'avg_duration' && !input.measureField) {
    errors.push('Esta medida requiere un campo métrico.');
  }
  if (errors.length > 0) throw new KpiValidationError(errors);

  return withOrgContext(organizationId, async (tx) => {
    const code = await nextKpiCode(tx, organizationId);
    const def = await tx.kpiDefinition.create({
      data: {
        organizationId,
        code,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        category: input.category?.trim() || null,
        source: input.source,
        measure: input.measure,
        measureField: input.measureField || null,
        period: input.period,
        unit: input.unit?.trim() || null,
        target: input.target ?? null,
        warningThreshold: input.warningThreshold ?? null,
        criticalThreshold: input.criticalThreshold ?? null,
        desiredDirection: input.desiredDirection || 'lower',
        filters: (input.filters ?? undefined) as Prisma.InputJsonValue | undefined,
        numeratorFilter: (input.numeratorFilter ?? undefined) as Prisma.InputJsonValue | undefined,
        responsibleUserId: input.responsibleUserId || null,
        status: 'active',
        createdBy: actorId,
      },
    });
    return def.id;
  });
}

export async function listKpiDefinitions(organizationId: string) {
  return getPrisma().kpiDefinition.findMany({
    where: { organizationId },
    orderBy: [{ status: 'asc' }, { code: 'asc' }],
  });
}

export async function getKpiDefinition(organizationId: string, kpiId: string) {
  return getPrisma().kpiDefinition.findFirst({ where: { id: kpiId, organizationId } });
}

export interface KpiWithComputation {
  definition: KpiDefinitionRow;
  computation: ReturnType<typeof computeKpi>;
  trend: TrendResult;
}

/** Calcula (sin persistir) un KPI con su serie y tendencia sobre el dataset. */
export function computeKpiView(def: KpiDefinitionRow, events: UnifiedEvent[]): KpiWithComputation {
  const config = buildKpiConfig(def);
  return {
    definition: def,
    computation: computeKpi(events, config),
    trend: computeTrend(events, config),
  };
}

/** Lista definiciones activas ya calculadas para el tablero. */
export async function listKpisWithComputation(
  organizationId: string,
): Promise<KpiWithComputation[]> {
  const [defs, events] = await Promise.all([
    getPrisma().kpiDefinition.findMany({
      where: { organizationId, status: 'active' },
      orderBy: [{ code: 'asc' }],
    }),
    loadUnifiedEvents(organizationId),
  ]);
  return defs.map((d) => computeKpiView(d, events));
}

/**
 * Recalcula y PERSISTE los resultados por periodo de un KPI (o de todos los
 * activos). Upsert por (kpi, periodo): la caché nunca es una segunda fuente.
 */
export async function recomputeKpiResults(organizationId: string, kpiId?: string): Promise<number> {
  return withOrgContext(organizationId, async (tx) => {
    const events = await loadUnifiedEventsTx(tx);
    const defs = await tx.kpiDefinition.findMany({
      where: { organizationId, status: 'active', ...(kpiId ? { id: kpiId } : {}) },
    });
    let written = 0;
    for (const def of defs) {
      const config = buildKpiConfig(def);
      const result = computeKpi(events, config);
      for (const period of result.series) {
        await tx.kpiResult.upsert({
          where: { kpiId_periodLabel: { kpiId: def.id, periodLabel: period.label } },
          create: {
            organizationId,
            kpiId: def.id,
            periodLabel: period.label,
            periodStart: new Date(`${period.start}T00:00:00.000Z`),
            periodEnd: new Date(`${period.end}T00:00:00.000Z`),
            value: period.value,
            numerator: period.numerator,
            denominator: period.denominator,
            target: period.target,
            status: period.status,
            definitionVersion: def.definitionVersion,
            computation: { count: period.count } as Prisma.InputJsonValue,
          },
          update: {
            value: period.value,
            numerator: period.numerator,
            denominator: period.denominator,
            target: period.target,
            status: period.status,
            definitionVersion: def.definitionVersion,
            computedAt: new Date(),
            computation: { count: period.count } as Prisma.InputJsonValue,
          },
        });
        written += 1;
      }
    }
    return written;
  });
}
