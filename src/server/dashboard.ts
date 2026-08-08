// CORE-ALIGN-002 — Agregaciones de SOLO LECTURA para el Dashboard Ejecutivo.
//
// No modifica ningún backend de módulo: reutiliza funciones ya exportadas y hace
// consultas de lectura con `getPrisma()` (filtrando por organización, como el
// resto del panel). Todos los valores provienen de datos reales; si no hay dato,
// se devuelve null/vacío para que la UI muestre un estado honesto.

import { getPrisma } from './db';
import { listDiagnostics, getPreviewResult } from './diagnostics';
import { loadUnifiedEvents } from './analytics';

/** Timestamp de la actividad más reciente del sistema (o null). */
export async function getLastActivity(organizationId: string): Promise<Date | null> {
  const rows = await getPrisma().$queryRaw<{ ts: Date | null }[]>`
    SELECT MAX(ts) AS ts FROM (
      SELECT MAX(COALESCE(updated_at, created_at)) AS ts FROM tasks WHERE organization_id = ${organizationId}::uuid
      UNION ALL SELECT MAX(COALESCE(updated_at, created_at)) FROM capas WHERE organization_id = ${organizationId}::uuid
      UNION ALL SELECT MAX(COALESCE(updated_at, created_at)) FROM documents WHERE organization_id = ${organizationId}::uuid
      UNION ALL SELECT MAX(COALESCE(updated_at, created_at)) FROM audits WHERE organization_id = ${organizationId}::uuid
      UNION ALL SELECT MAX(COALESCE(updated_at, created_at)) FROM quality_events WHERE organization_id = ${organizationId}::uuid
    ) x`;
  return rows[0]?.ts ?? null;
}

export interface NextAudit {
  folio: string;
  title: string;
  date: string;
}

/** Próxima auditoría planeada (folio + título + fecha), o null. */
export async function getNextAudit(organizationId: string): Promise<NextAudit | null> {
  const today = new Date().toISOString().slice(0, 10);
  const audit = await getPrisma().audit.findFirst({
    where: {
      organizationId,
      status: { in: ['planned', 'ready'] },
      plannedDate: { gte: new Date(`${today}T00:00:00.000Z`) },
    },
    orderBy: { plannedDate: 'asc' },
    select: { folio: true, title: true, plannedDate: true },
  });
  if (!audit?.plannedDate) return null;
  return {
    folio: audit.folio,
    title: audit.title,
    date: audit.plannedDate.toISOString().slice(0, 10),
  };
}

/** Esquemas/normas activos de la organización (nombres). */
export async function getActiveSchemes(organizationId: string): Promise<string[]> {
  const rows = await getPrisma().assessmentFramework.findMany({
    where: { organizationId, deletedAt: null },
    select: { name: true },
    orderBy: { name: 'asc' },
  });
  return rows.map((r) => r.name.replace(/\s*\(.*\)$/, ''));
}

export interface SystemStatus {
  diagnosticId: string;
  name: string;
  scheme: string;
  status: string;
  percentage: number;
  riskLevel: string;
  updatedAt: string;
}

/** Evaluación vigente = enviada o revisada (resultado final, no en captura). */
export function isValidEvaluation(status: string): boolean {
  return status === 'submitted' || status === 'reviewed';
}

/**
 * Estado del sistema a partir de la evaluación más reciente (preferente
 * enviada/revisada; si no, la más reciente en curso). El porcentaje es el mismo
 * resultado real que muestra la página del diagnóstico; el estado (`status`)
 * permite a la UI etiquetarlo como vigente o en progreso. null si no hay ninguno.
 */
export async function getSystemStatus(organizationId: string): Promise<SystemStatus | null> {
  const items = await listDiagnostics(organizationId);
  if (items.length === 0) return null;
  const preferred = items.find((d) => isValidEvaluation(d.status)) ?? items[0]!;
  const result = await getPreviewResult(organizationId, preferred.id).catch(() => null);
  if (!result) return null;
  return {
    diagnosticId: preferred.id,
    name: preferred.name,
    scheme: preferred.frameworkName,
    status: preferred.status,
    percentage: result.percentage,
    riskLevel: result.riskLevel,
    updatedAt: preferred.updatedAt.toISOString().slice(0, 10),
  };
}

export interface SchemeCompliance {
  scheme: string;
  diagnosticId: string;
  percentage: number;
  riskLevel: string;
  status: string;
}

/** Cumplimiento por esquema (última evaluación por esquema; `status` etiqueta). */
export async function getSchemeCompliance(organizationId: string): Promise<SchemeCompliance[]> {
  const items = await listDiagnostics(organizationId);
  const latestByScheme = new Map<string, (typeof items)[number]>();
  for (const d of items) {
    if (!latestByScheme.has(d.frameworkName)) latestByScheme.set(d.frameworkName, d);
  }
  const out: SchemeCompliance[] = [];
  for (const [scheme, d] of [...latestByScheme].slice(0, 5)) {
    const result = await getPreviewResult(organizationId, d.id).catch(() => null);
    if (!result) continue;
    out.push({
      scheme,
      diagnosticId: d.id,
      percentage: result.percentage,
      riskLevel: result.riskLevel,
      status: d.status,
    });
  }
  return out.sort((a, b) => b.percentage - a.percentage);
}

export interface GanttRow {
  id: string;
  label: string;
  folio: string | null;
  start: string;
  end: string;
  progress: number | null;
  overdue: boolean;
  href: string;
  milestones: { label: string; date: string; overdue: boolean }[];
}

/** Filas para el mini-Gantt ejecutivo (proyectos activos con fechas + hitos). */
export async function getGanttRows(organizationId: string): Promise<GanttRow[]> {
  const prisma = getPrisma();
  const projects = await prisma.project.findMany({
    where: { organizationId, status: { in: ['planned', 'active', 'on_hold', 'under_review'] } },
    orderBy: [{ targetDate: 'asc' }],
    take: 6,
    select: {
      id: true,
      folio: true,
      name: true,
      progress: true,
      startDate: true,
      targetDate: true,
    },
  });
  const withDates = projects.filter((p) => p.startDate || p.targetDate);
  if (withDates.length === 0) return [];

  const ids = withDates.map((p) => p.id);
  const milestones = await prisma.projectMilestone.findMany({
    where: { organizationId, projectId: { in: ids }, targetDate: { not: null } },
    select: { projectId: true, name: true, targetDate: true, status: true },
  });
  const today = new Date().toISOString().slice(0, 10);
  const msByProject = new Map<string, GanttRow['milestones']>();
  for (const m of milestones) {
    if (!m.targetDate) continue;
    const date = m.targetDate.toISOString().slice(0, 10);
    const arr = msByProject.get(m.projectId) ?? [];
    arr.push({
      label: m.name,
      date,
      overdue: m.status !== 'reached' && m.status !== 'cancelled' && date < today,
    });
    msByProject.set(m.projectId, arr);
  }

  return withDates.map((p) => {
    const start = (p.startDate ?? p.targetDate)!.toISOString().slice(0, 10);
    const end = (p.targetDate ?? p.startDate)!.toISOString().slice(0, 10);
    return {
      id: p.id,
      label: p.name,
      folio: p.folio,
      start,
      end,
      progress: p.progress,
      overdue: !!p.targetDate && end < today,
      href: `/dashboard/projects/${p.id}`,
      milestones: msByProject.get(p.id) ?? [],
    };
  });
}

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}
export interface QualityTrend {
  months: string[];
  series: TrendSeries[];
  hasData: boolean;
}

/** Tendencia 12 meses de eventos de calidad, CAPA y hallazgos (datos reales). */
export async function getQualityTrend(organizationId: string): Promise<QualityTrend> {
  const events = await loadUnifiedEvents(organizationId);
  // Ventana de 12 meses hasta el mes actual.
  const now = new Date();
  const months: string[] = [];
  const index = new Map<string, number>();
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const label = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    index.set(label, months.length);
    months.push(label);
  }
  const mk = () => new Array<number>(12).fill(0);
  const eventsSeries = mk();
  const capaSeries = mk();
  const findingSeries = mk();
  for (const ev of events) {
    const label = ev.eventDate.slice(0, 7);
    const i = index.get(label);
    if (i === undefined) continue;
    if (ev.source === 'quality_event') eventsSeries[i]! += 1;
    else if (ev.source === 'capa') capaSeries[i]! += 1;
    else if (ev.source === 'audit_finding') findingSeries[i]! += 1;
  }
  const series: TrendSeries[] = [
    { key: 'events', label: 'Eventos de calidad', color: '#2563eb', values: eventsSeries },
    { key: 'capa', label: 'CAPA', color: '#d97706', values: capaSeries },
    { key: 'findings', label: 'Hallazgos', color: '#dc2626', values: findingSeries },
  ];
  const hasData = series.some((s) => s.values.some((v) => v > 0));
  return { months, series, hasData };
}
