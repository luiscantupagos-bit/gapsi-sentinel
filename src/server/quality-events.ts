// TASK-011 — Servidor de eventos de calidad NATIVOS y catálogos.
//
// `quality_events` es fuente de verdad solo para eventos manuales/nativos/
// convertidos. Escrituras bajo `withOrgContext` (RLS) con historial append-only y
// folio atómico EVT-AAAA-####. Los datos de otros módulos NO se escriben aquí: se
// agregan en vivo (ver src/server/analytics.ts).

import type { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';

type Tx = Prisma.TransactionClient;

export class QualityEventError extends Error {}
export class QualityEventPermissionError extends QualityEventError {}
export class QualityEventValidationError extends QualityEventError {
  constructor(public readonly errors: string[]) {
    super(errors.join(' '));
  }
}

export const EVENT_TYPES = [
  'deviation',
  'failure',
  'complaint',
  'nonconforming',
  'incident',
  'noncompliance',
  'observation',
  'improvement',
  'other',
] as const;

export const EVENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export const EVENT_STATUSES = ['open', 'in_progress', 'closed', 'cancelled'] as const;

export const EVENT_TYPE_LABEL: Record<string, string> = {
  capa: 'Acción correctiva',
  audit_finding: 'Hallazgo de auditoría',
  deviation: 'Desviación',
  failure: 'Falla',
  complaint: 'Queja/reclamo',
  nonconforming: 'Producto no conforme',
  incident: 'Incidente',
  noncompliance: 'Incumplimiento',
  observation: 'Observación',
  improvement: 'Mejora',
  other: 'Otro',
};

function inSet<T extends string>(set: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (set as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function memberRole(organizationId: string, userId: string): Promise<string> {
  const m = await getPrisma().membership.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!m) throw new QualityEventPermissionError('No perteneces a esta organización.');
  return m.role;
}

function canWrite(role: string): boolean {
  return role === 'owner' || role === 'admin' || role === 'evaluator';
}

async function nextEventFolio(tx: Tx, organizationId: string, year: number): Promise<string> {
  const rows = await tx.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO quality_event_folio_counters ("organization_id", "year", "last_seq")
    VALUES (${organizationId}::uuid, ${year}, 1)
    ON CONFLICT ("organization_id", "year")
    DO UPDATE SET "last_seq" = quality_event_folio_counters."last_seq" + 1
    RETURNING "last_seq"`;
  const seq = rows[0]?.last_seq ?? 1;
  return `EVT-${year}-${String(seq).padStart(4, '0')}`;
}

export interface QualityEventInput {
  title: string;
  description?: string | null;
  eventType?: string;
  eventDate?: string;
  severity?: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  area?: string | null;
  process?: string | null;
  productText?: string | null;
  machineText?: string | null;
  shiftText?: string | null;
  supplierText?: string | null;
  lotText?: string | null;
  quantityAffected?: number | null;
  unitsProduced?: number | null;
  cost?: number | null;
  durationHours?: number | null;
  responsibleUserId?: string | null;
  siteId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
}

export async function createQualityEvent(
  organizationId: string,
  actorId: string,
  input: QualityEventInput,
): Promise<string> {
  const role = await memberRole(organizationId, actorId);
  if (!canWrite(role))
    throw new QualityEventPermissionError('No tienes permiso para registrar eventos.');
  const errors: string[] = [];
  if (!input.title?.trim()) errors.push('El título es obligatorio.');
  const eventDate = parseDate(input.eventDate) ?? new Date();
  if (input.categoryId) {
    const cat = await getPrisma().qualityEventCategory.findFirst({
      where: { id: input.categoryId, organizationId },
      select: { id: true },
    });
    if (!cat) errors.push('La categoría no pertenece a la organización.');
  }
  if (errors.length > 0) throw new QualityEventValidationError(errors);

  const year = eventDate.getUTCFullYear();
  return withOrgContext(organizationId, async (tx) => {
    const folio = await nextEventFolio(tx, organizationId, year);
    const event = await tx.qualityEvent.create({
      data: {
        organizationId,
        folio,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        eventType: inSet(EVENT_TYPES, input.eventType, 'deviation'),
        eventDate,
        severity: inSet(EVENT_SEVERITIES, input.severity, 'medium'),
        status: 'open',
        categoryId: input.categoryId || null,
        subcategoryId: input.subcategoryId || null,
        area: input.area?.trim() || null,
        process: input.process?.trim() || null,
        productText: input.productText?.trim() || null,
        machineText: input.machineText?.trim() || null,
        shiftText: input.shiftText?.trim() || null,
        supplierText: input.supplierText?.trim() || null,
        lotText: input.lotText?.trim() || null,
        quantityAffected: input.quantityAffected ?? null,
        unitsProduced: input.unitsProduced ?? null,
        cost: input.cost ?? null,
        durationHours: input.durationHours ?? null,
        responsibleUserId: input.responsibleUserId || null,
        siteId: input.siteId || null,
        sourceType: input.sourceType || null,
        sourceId: input.sourceId || null,
        createdBy: actorId,
      },
    });
    await tx.qualityEventHistory.create({
      data: {
        organizationId,
        eventId: event.id,
        event: 'event.created',
        toStatus: 'open',
        actorUserId: actorId,
      },
    });
    return event.id;
  });
}

export interface QualityEventListItem {
  id: string;
  folio: string;
  title: string;
  eventType: string;
  eventDate: Date;
  severity: string;
  status: string;
  area: string | null;
  process: string | null;
  categoryName: string | null;
}

export async function listQualityEvents(
  organizationId: string,
  opts: { search?: string; status?: string; eventType?: string } = {},
): Promise<QualityEventListItem[]> {
  const where: Prisma.QualityEventWhereInput = { organizationId };
  if (opts.status) where.status = opts.status;
  if (opts.eventType) where.eventType = opts.eventType;
  if (opts.search) {
    where.OR = [
      { title: { contains: opts.search, mode: 'insensitive' } },
      { folio: { contains: opts.search, mode: 'insensitive' } },
    ];
  }
  const rows = await getPrisma().qualityEvent.findMany({
    where,
    orderBy: [{ eventDate: 'desc' }, { folio: 'desc' }],
    take: 200,
    include: { category: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    folio: r.folio,
    title: r.title,
    eventType: r.eventType,
    eventDate: r.eventDate,
    severity: r.severity,
    status: r.status,
    area: r.area,
    process: r.process,
    categoryName: r.category?.name ?? null,
  }));
}

export async function getQualityEvent(organizationId: string, eventId: string) {
  return getPrisma().qualityEvent.findFirst({
    where: { id: eventId, organizationId },
    include: {
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      relations: true,
    },
  });
}

export async function listEventCategories(organizationId: string) {
  return getPrisma().qualityEventCategory.findMany({
    where: { organizationId, active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, code: true, name: true, eventType: true },
  });
}

export function canWriteRole(role: string): boolean {
  return canWrite(role);
}
