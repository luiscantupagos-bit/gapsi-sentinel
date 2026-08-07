// TASK-011 — Capa común de eventos de calidad (dataset unificado).
//
// Estrategia HÍBRIDA EN VIVO: `quality_events` es la fuente de verdad de eventos
// NATIVOS (manuales/convertidos, con source_type/source_id). Los registros de los
// módulos existentes (CAPA, acciones, hallazgos, tareas, proyectos, AMEF,
// análisis) se AGREGAN EN VIVO desde su fuente original — no se copian ni se hace
// backfill. Este módulo es PURO (sin Prisma): recibe filas ya consultadas y las
// proyecta a un `UnifiedEvent` común, deduplicando para no contar dos veces el
// mismo hecho. KPI, Pareto, tendencias y estadística consumen este dataset único.
//
// Precisión: las fechas DATE se interpretan en UTC (medianoche) para evitar
// corrimientos de zona horaria; las métricas ausentes quedan como `null` (no 0)
// para no sesgar promedios ni sumas.

export const UNIFIED_STATUSES = ['open', 'in_progress', 'closed', 'cancelled'] as const;
export type UnifiedStatus = (typeof UNIFIED_STATUSES)[number];

/// Origen del registro dentro del dataset unificado.
export type UnifiedSource =
  | 'quality_event' // nativo
  | 'capa'
  | 'capa_action'
  | 'audit_finding'
  | 'task'
  | 'project'
  | 'fmea_row'
  | 'analysis';

/// Cómo llegó el registro al dataset.
export type UnifiedOrigin = 'native' | 'aggregated' | 'converted';

export interface UnifiedEvent {
  /** Clave estable de deduplicación: `${source}:${sourceId}`. */
  key: string;
  source: UnifiedSource;
  sourceLabel: string;
  origin: UnifiedOrigin;
  /** id del registro en su módulo de origen. */
  sourceId: string;
  /** id del quality_event nativo cuando aplica (para navegar/convertir). */
  nativeEventId: string | null;
  organizationId: string;
  siteId: string | null;
  folio: string | null;
  /** Ruta para navegar al módulo original. */
  href: string;
  title: string;
  /** Tipo de evento normalizado para agrupar en KPI/Pareto. */
  eventType: string;
  category: string | null;
  subcategory: string | null;
  status: UnifiedStatus;
  /** Estado crudo del módulo (para trazabilidad). */
  rawStatus: string;
  severity: string | null;
  // Dimensiones analíticas textuales (provisionales).
  area: string | null;
  process: string | null;
  product: string | null;
  machine: string | null;
  shift: string | null;
  supplier: string | null;
  responsibleUserId: string | null;
  // Métricas (null = ausente, nunca 0 por defecto).
  quantityAffected: number | null;
  unitsProduced: number | null;
  cost: number | null;
  durationHours: number | null;
  npr: number | null;
  // Fechas ISO (YYYY-MM-DD para fechas, ISO completo para timestamps).
  eventDate: string; // marca temporal analítica principal
  detectedAt: string | null;
  dueDate: string | null;
  closedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Normalizadores
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<string, UnifiedStatus> = {
  // abierto
  draft: 'open',
  reported: 'open',
  open: 'open',
  pending: 'open',
  planned: 'open',
  scheduled: 'open',
  // en progreso
  containment: 'in_progress',
  under_investigation: 'in_progress',
  action_plan: 'in_progress',
  in_implementation: 'in_progress',
  effectiveness_review: 'in_progress',
  correction_in_progress: 'in_progress',
  capa_open: 'in_progress',
  pending_verification: 'in_progress',
  in_progress: 'in_progress',
  blocked: 'in_progress',
  under_review: 'in_progress',
  in_review: 'in_progress',
  active: 'in_progress',
  on_hold: 'in_progress',
  not_effective: 'in_progress',
  submitted: 'in_progress',
  changes_requested: 'in_progress',
  at_risk: 'in_progress',
  rescheduled: 'in_progress',
  overdue: 'in_progress',
  // cerrado
  closed: 'closed',
  completed: 'closed',
  effective: 'closed',
  approved: 'closed',
  reviewed: 'closed',
  reached: 'closed',
  executed: 'closed',
  archived: 'closed',
  obsolete: 'closed',
  // cancelado
  cancelled: 'cancelled',
  discarded: 'cancelled',
  rejected: 'cancelled',
  expired: 'cancelled',
  suspended: 'cancelled',
};

export function normalizeStatus(raw: string | null | undefined): UnifiedStatus {
  if (!raw) return 'open';
  return STATUS_MAP[raw] ?? 'open';
}

/** Convierte un valor DATE/Timestamp a `YYYY-MM-DD` (UTC). */
export function toISODate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

/** Convierte a ISO completo (UTC). */
export function toISO(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Severidad derivada del NPR de AMEF (documentada, determinista). */
export function severityFromNpr(npr: number | null): string | null {
  if (npr === null) return null;
  if (npr >= 200) return 'critical';
  if (npr >= 120) return 'high';
  if (npr >= 60) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Filas de entrada (subconjuntos de los modelos Prisma, ya consultadas)
// ---------------------------------------------------------------------------

export interface NativeEventRow {
  id: string;
  organizationId: string;
  siteId: string | null;
  folio: string;
  eventDate: Date | string;
  eventType: string;
  categoryName: string | null;
  subcategoryName: string | null;
  title: string;
  status: string;
  severity: string | null;
  area: string | null;
  process: string | null;
  productText: string | null;
  machineText: string | null;
  shiftText: string | null;
  supplierText: string | null;
  responsibleUserId: string | null;
  quantityAffected: unknown;
  unitsProduced: unknown;
  cost: unknown;
  durationHours: unknown;
  sourceType: string | null;
  sourceId: string | null;
  detectedAt?: Date | string | null;
  createdAt: Date | string;
}

export interface CapaRow {
  id: string;
  organizationId: string;
  siteId: string | null;
  folio: string;
  title: string;
  status: string;
  severity: string | null;
  sourceType: string | null;
  area: string | null;
  process: string | null;
  product: string | null;
  responsibleUserId: string | null;
  detectedAt: Date | string | null;
  targetDate: Date | string | null;
  closedAt: Date | string | null;
  createdAt: Date | string;
}

export interface CapaActionRow {
  id: string;
  organizationId: string;
  capaId: string;
  description: string;
  status: string;
  priority: string | null;
  responsibleUserId: string | null;
  startDate: Date | string | null;
  dueDate: Date | string | null;
  closedAt: Date | string | null;
  createdAt: Date | string;
}

export interface FindingRow {
  id: string;
  organizationId: string;
  siteId: string | null;
  auditId: string;
  folio: string;
  title: string;
  process: string | null;
  classification: string;
  severity: string | null;
  status: string;
  responsibleUserId: string | null;
  detectedAt: Date | string | null;
  committedDate: Date | string | null;
  closedAt: Date | string | null;
  createdAt: Date | string;
}

export interface TaskRow {
  id: string;
  organizationId: string;
  siteId: string | null;
  folio: string;
  title: string;
  taskType: string;
  status: string;
  priority: string | null;
  responsibleUserId: string | null;
  startDate: Date | string | null;
  targetDate: Date | string | null;
  closedAt: Date | string | null;
  createdAt: Date | string;
}

export interface ProjectRow {
  id: string;
  organizationId: string;
  siteId: string | null;
  folio: string;
  name: string;
  status: string;
  priority: string | null;
  responsibleUserId: string | null;
  actualCost: unknown;
  startDate: Date | string | null;
  targetDate: Date | string | null;
  closedAt: Date | string | null;
  createdAt: Date | string;
}

export interface FmeaRowRow {
  id: string;
  organizationId: string;
  analysisId: string;
  capaId: string; // vía análisis
  requirement: string | null;
  effect: string | null;
  status: string;
  actionPriority: string | null;
  npr: number;
  responsibleUserId: string | null;
  dueDate: Date | string | null;
  createdAt: Date | string;
}

export interface AnalysisRow {
  id: string;
  organizationId: string;
  capaId: string;
  type: string;
  title: string;
  status: string;
  responsibleUserId: string | null;
  startedAt: Date | string | null;
  approvedAt: Date | string | null;
  createdAt: Date | string;
}

// ---------------------------------------------------------------------------
// Mappers puros
// ---------------------------------------------------------------------------

export function mapNativeEvent(r: NativeEventRow): UnifiedEvent {
  const origin: UnifiedOrigin = r.sourceType && r.sourceId ? 'converted' : 'native';
  return {
    key: `quality_event:${r.id}`,
    source: 'quality_event',
    sourceLabel: 'Evento de calidad',
    origin,
    sourceId: r.id,
    nativeEventId: r.id,
    organizationId: r.organizationId,
    siteId: r.siteId,
    folio: r.folio,
    href: `/dashboard/quality-events/${r.id}`,
    title: r.title,
    eventType: r.eventType,
    category: r.categoryName,
    subcategory: r.subcategoryName,
    status: normalizeStatus(r.status),
    rawStatus: r.status,
    severity: r.severity,
    area: r.area,
    process: r.process,
    product: r.productText,
    machine: r.machineText,
    shift: r.shiftText,
    supplier: r.supplierText,
    responsibleUserId: r.responsibleUserId,
    quantityAffected: toNumber(r.quantityAffected),
    unitsProduced: toNumber(r.unitsProduced),
    cost: toNumber(r.cost),
    durationHours: toNumber(r.durationHours),
    npr: null,
    eventDate: toISODate(r.eventDate) ?? toISODate(r.createdAt)!,
    detectedAt: toISODate(r.detectedAt ?? null),
    dueDate: null,
    closedAt: null,
    createdAt: toISO(r.createdAt)!,
  };
}

export function mapCapa(r: CapaRow): UnifiedEvent {
  return {
    key: `capa:${r.id}`,
    source: 'capa',
    sourceLabel: 'Acción correctiva (CAPA)',
    origin: 'aggregated',
    sourceId: r.id,
    nativeEventId: null,
    organizationId: r.organizationId,
    siteId: r.siteId,
    folio: r.folio,
    href: `/dashboard/capa/${r.id}`,
    title: r.title,
    eventType: 'capa',
    category: r.sourceType,
    subcategory: null,
    status: normalizeStatus(r.status),
    rawStatus: r.status,
    severity: r.severity,
    area: r.area,
    process: r.process,
    product: r.product,
    machine: null,
    shift: null,
    supplier: null,
    responsibleUserId: r.responsibleUserId,
    quantityAffected: null,
    unitsProduced: null,
    cost: null,
    durationHours: null,
    npr: null,
    eventDate: toISODate(r.detectedAt) ?? toISODate(r.createdAt)!,
    detectedAt: toISODate(r.detectedAt),
    dueDate: toISODate(r.targetDate),
    closedAt: toISODate(r.closedAt),
    createdAt: toISO(r.createdAt)!,
  };
}

export function mapCapaAction(r: CapaActionRow): UnifiedEvent {
  return {
    key: `capa_action:${r.id}`,
    source: 'capa_action',
    sourceLabel: 'Acción CAPA',
    origin: 'aggregated',
    sourceId: r.id,
    nativeEventId: null,
    organizationId: r.organizationId,
    siteId: null,
    folio: null,
    href: `/dashboard/capa/${r.capaId}`,
    title: r.description,
    eventType: 'capa_action',
    category: null,
    subcategory: null,
    status: normalizeStatus(r.status),
    rawStatus: r.status,
    severity: null,
    area: null,
    process: null,
    product: null,
    machine: null,
    shift: null,
    supplier: null,
    responsibleUserId: r.responsibleUserId,
    quantityAffected: null,
    unitsProduced: null,
    cost: null,
    durationHours: null,
    npr: null,
    eventDate: toISODate(r.startDate) ?? toISODate(r.createdAt)!,
    detectedAt: null,
    dueDate: toISODate(r.dueDate),
    closedAt: toISODate(r.closedAt),
    createdAt: toISO(r.createdAt)!,
  };
}

export function mapFinding(r: FindingRow): UnifiedEvent {
  return {
    key: `audit_finding:${r.id}`,
    source: 'audit_finding',
    sourceLabel: 'Hallazgo de auditoría',
    origin: 'aggregated',
    sourceId: r.id,
    nativeEventId: null,
    organizationId: r.organizationId,
    siteId: r.siteId,
    folio: r.folio,
    href: `/dashboard/audits/findings/${r.id}`,
    title: r.title,
    eventType: 'audit_finding',
    category: r.classification,
    subcategory: null,
    status: normalizeStatus(r.status),
    rawStatus: r.status,
    severity: r.severity,
    area: null,
    process: r.process,
    product: null,
    machine: null,
    shift: null,
    supplier: null,
    responsibleUserId: r.responsibleUserId,
    quantityAffected: null,
    unitsProduced: null,
    cost: null,
    durationHours: null,
    npr: null,
    eventDate: toISODate(r.detectedAt) ?? toISODate(r.createdAt)!,
    detectedAt: toISODate(r.detectedAt),
    dueDate: toISODate(r.committedDate),
    closedAt: toISODate(r.closedAt),
    createdAt: toISO(r.createdAt)!,
  };
}

export function mapTask(r: TaskRow): UnifiedEvent {
  return {
    key: `task:${r.id}`,
    source: 'task',
    sourceLabel: 'Tarea',
    origin: 'aggregated',
    sourceId: r.id,
    nativeEventId: null,
    organizationId: r.organizationId,
    siteId: r.siteId,
    folio: r.folio,
    href: `/dashboard/tasks/${r.id}`,
    title: r.title,
    eventType: 'task',
    category: r.taskType,
    subcategory: null,
    status: normalizeStatus(r.status),
    rawStatus: r.status,
    severity: null,
    area: null,
    process: null,
    product: null,
    machine: null,
    shift: null,
    supplier: null,
    responsibleUserId: r.responsibleUserId,
    quantityAffected: null,
    unitsProduced: null,
    cost: null,
    durationHours: null,
    npr: null,
    eventDate: toISODate(r.startDate) ?? toISODate(r.createdAt)!,
    detectedAt: null,
    dueDate: toISODate(r.targetDate),
    closedAt: toISODate(r.closedAt),
    createdAt: toISO(r.createdAt)!,
  };
}

export function mapProject(r: ProjectRow): UnifiedEvent {
  return {
    key: `project:${r.id}`,
    source: 'project',
    sourceLabel: 'Proyecto',
    origin: 'aggregated',
    sourceId: r.id,
    nativeEventId: null,
    organizationId: r.organizationId,
    siteId: r.siteId,
    folio: r.folio,
    href: `/dashboard/projects/${r.id}`,
    title: r.name,
    eventType: 'project',
    category: null,
    subcategory: null,
    status: normalizeStatus(r.status),
    rawStatus: r.status,
    severity: null,
    area: null,
    process: null,
    product: null,
    machine: null,
    shift: null,
    supplier: null,
    responsibleUserId: r.responsibleUserId,
    quantityAffected: null,
    unitsProduced: null,
    cost: toNumber(r.actualCost),
    durationHours: null,
    npr: null,
    eventDate: toISODate(r.startDate) ?? toISODate(r.createdAt)!,
    detectedAt: null,
    dueDate: toISODate(r.targetDate),
    closedAt: toISODate(r.closedAt),
    createdAt: toISO(r.createdAt)!,
  };
}

export function mapFmeaRow(r: FmeaRowRow): UnifiedEvent {
  return {
    key: `fmea_row:${r.id}`,
    source: 'fmea_row',
    sourceLabel: 'Renglón AMEF',
    origin: 'aggregated',
    sourceId: r.id,
    nativeEventId: null,
    organizationId: r.organizationId,
    siteId: null,
    folio: null,
    href: `/dashboard/capa/${r.capaId}`,
    title: r.requirement ?? r.effect ?? 'Renglón AMEF',
    eventType: 'fmea_action',
    category: r.actionPriority,
    subcategory: null,
    status: normalizeStatus(r.status),
    rawStatus: r.status,
    severity: severityFromNpr(r.npr),
    area: null,
    process: null,
    product: null,
    machine: null,
    shift: null,
    supplier: null,
    responsibleUserId: r.responsibleUserId,
    quantityAffected: null,
    unitsProduced: null,
    cost: null,
    durationHours: null,
    npr: r.npr,
    eventDate: toISODate(r.createdAt)!,
    detectedAt: null,
    dueDate: toISODate(r.dueDate),
    closedAt: null,
    createdAt: toISO(r.createdAt)!,
  };
}

export function mapAnalysis(r: AnalysisRow): UnifiedEvent {
  return {
    key: `analysis:${r.id}`,
    source: 'analysis',
    sourceLabel: 'Análisis de causa',
    origin: 'aggregated',
    sourceId: r.id,
    nativeEventId: null,
    organizationId: r.organizationId,
    siteId: null,
    folio: null,
    href: `/dashboard/capa/${r.capaId}`,
    title: r.title,
    eventType: 'analysis',
    category: r.type,
    subcategory: null,
    status: normalizeStatus(r.status),
    rawStatus: r.status,
    severity: null,
    area: null,
    process: null,
    product: null,
    machine: null,
    shift: null,
    supplier: null,
    responsibleUserId: r.responsibleUserId,
    quantityAffected: null,
    unitsProduced: null,
    cost: null,
    durationHours: null,
    npr: null,
    eventDate: toISODate(r.startedAt) ?? toISODate(r.createdAt)!,
    detectedAt: null,
    dueDate: null,
    closedAt: toISODate(r.approvedAt),
    createdAt: toISO(r.createdAt)!,
  };
}

// ---------------------------------------------------------------------------
// Deduplicación + ensamblado
// ---------------------------------------------------------------------------

/** Mapea el `source_type` de un quality_event nativo al `UnifiedSource` agregado. */
export function sourceTypeToUnifiedSource(sourceType: string | null): UnifiedSource | null {
  switch (sourceType) {
    case 'capa_action':
      return 'capa_action';
    case 'audit_finding':
      return 'audit_finding';
    case 'task':
      return 'task';
    case 'project':
      return 'project';
    case 'analysis':
      return 'analysis';
    default:
      return null;
  }
}

export interface UnifiedInput {
  native: NativeEventRow[];
  capas: CapaRow[];
  capaActions: CapaActionRow[];
  findings: FindingRow[];
  tasks: TaskRow[];
  projects: ProjectRow[];
  fmeaRows: FmeaRowRow[];
  analyses: AnalysisRow[];
}

/**
 * Ensambla el dataset unificado a partir de eventos nativos + registros
 * agregados en vivo. Deduplica: si un evento nativo referencia un registro de un
 * módulo (source_type/source_id), el registro AGREGADO equivalente se omite (el
 * nativo es la representación canónica del hecho ya convertido). Así el mismo
 * hecho no se cuenta dos veces.
 */
export function buildUnifiedDataset(input: UnifiedInput): UnifiedEvent[] {
  const nativeEvents = input.native.map(mapNativeEvent);

  // Conjunto de registros de módulo ya reclamados por un evento nativo.
  const claimed = new Set<string>();
  for (const n of input.native) {
    const src = sourceTypeToUnifiedSource(n.sourceType);
    if (src && n.sourceId) claimed.add(`${src}:${n.sourceId}`);
  }

  const aggregated: UnifiedEvent[] = [];
  const pushIfFresh = (ev: UnifiedEvent) => {
    if (!claimed.has(ev.key)) aggregated.push(ev);
  };

  input.capas.map(mapCapa).forEach(pushIfFresh);
  input.capaActions.map(mapCapaAction).forEach(pushIfFresh);
  input.findings.map(mapFinding).forEach(pushIfFresh);
  input.tasks.map(mapTask).forEach(pushIfFresh);
  input.projects.map(mapProject).forEach(pushIfFresh);
  input.fmeaRows.map(mapFmeaRow).forEach(pushIfFresh);
  input.analyses.map(mapAnalysis).forEach(pushIfFresh);

  return [...nativeEvents, ...aggregated];
}

/** Catálogo de fuentes: nativas, agregadas o convertidas (para documentar/UI). */
export const SOURCE_CLASSIFICATION: Record<UnifiedSource, 'native' | 'aggregated'> = {
  quality_event: 'native',
  capa: 'aggregated',
  capa_action: 'aggregated',
  audit_finding: 'aggregated',
  task: 'aggregated',
  project: 'aggregated',
  fmea_row: 'aggregated',
  analysis: 'aggregated',
};
