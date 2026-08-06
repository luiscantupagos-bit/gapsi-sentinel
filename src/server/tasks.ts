/**
 * Acceso a datos del GESTOR GLOBAL DE TAREAS (TASK-009).
 *
 * Modelo híbrido A-céntrico:
 * - `tasks` es la fuente de verdad de tareas NATIVAS (manual/proyecto/convertida).
 * - Las tareas de otros módulos (CAPA, documental, AMEF) se AGREGAN en vivo desde
 *   su origen (no se copian) y abren su módulo. `listGlobalTasks` une ambas y
 *   deduplica por (source_type, source_id).
 *
 * Seguridad: organización de la sesión; permisos por rol/asignación en servidor;
 * escrituras en `withOrgContext` (RLS); historial append-only.
 */
import { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';
import { saveDocumentFile } from './document-storage';
import { pendingReads } from './document-workflow';
import {
  TASK_PRIORITIES,
  TASK_STATUS_LABEL,
  TASK_STATUSES,
  TASK_TYPES,
  assertTaskTransition,
  isBlockedByDependencies,
  isReopenTransition,
  isTerminalTask,
  validateTaskTransition,
  type TaskStatus,
} from '@/features/tasks/task-state';
import { assertDependencyAcyclic, type Edge } from '@/features/tasks/dependencies';

type Tx = Prisma.TransactionClient;

export class TaskNotFoundError extends Error {
  constructor() {
    super('Tarea no encontrada en esta organización.');
    this.name = 'TaskNotFoundError';
  }
}
export class TaskPermissionError extends Error {
  constructor(message = 'No tienes permiso para esta acción.') {
    super(message);
    this.name = 'TaskPermissionError';
  }
}
export class TaskValidationError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super('Datos de tarea inválidos.');
    this.name = 'TaskValidationError';
    this.errors = errors;
  }
}

const inSet = <T extends string>(set: readonly T[], v: unknown, fallback: T): T =>
  (set as readonly string[]).includes(v as string) ? (v as T) : fallback;
const today = () => new Date().toISOString().slice(0, 10);
const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const parseDate = (v: string | null | undefined) => (v ? new Date(`${v}T00:00:00.000Z`) : null);

async function memberRole(organizationId: string, userId: string): Promise<string> {
  const m = await getPrisma().membership.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!m) throw new TaskPermissionError('No perteneces a esta organización.');
  return m.role;
}
const isAdmin = (role: string) => role === 'owner' || role === 'admin';
const canCreate = (role: string) => isAdmin(role) || role === 'evaluator';

async function userNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unique.length === 0) return new Map();
  const users = await getPrisma().user.findMany({
    where: { id: { in: unique } },
    select: { id: true, displayName: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u.displayName ?? u.email]));
}

async function loadScoped(organizationId: string, taskId: string) {
  const t = await getPrisma().task.findFirst({ where: { id: taskId, organizationId } });
  if (!t) throw new TaskNotFoundError();
  return t;
}

async function participantIds(organizationId: string, taskId: string): Promise<Set<string>> {
  const rows = await getPrisma().taskAssignment.findMany({
    where: { taskId, organizationId },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

function canAct(
  task: { responsibleUserId: string | null; createdBy: string | null },
  role: string,
  userId: string,
  participants: Set<string>,
): boolean {
  return (
    isAdmin(role) ||
    task.responsibleUserId === userId ||
    task.createdBy === userId ||
    participants.has(userId)
  );
}

async function nextFolio(tx: Tx, organizationId: string, year: number): Promise<string> {
  const rows = await tx.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO task_folio_counters ("organization_id", "year", "last_seq")
    VALUES (${organizationId}::uuid, ${year}, 1)
    ON CONFLICT ("organization_id", "year")
    DO UPDATE SET "last_seq" = task_folio_counters."last_seq" + 1
    RETURNING "last_seq"`;
  const seq = rows[0]?.last_seq ?? 1;
  return `TSK-${year}-${String(seq).padStart(4, '0')}`;
}

async function recordHistory(
  tx: Tx,
  organizationId: string,
  taskId: string,
  event: string,
  actorUserId: string,
  opts: { fromStatus?: string | null; toStatus?: string | null; detail?: string | null } = {},
): Promise<void> {
  await tx.taskStatusHistory.create({
    data: {
      organizationId,
      taskId,
      event,
      fromStatus: opts.fromStatus ?? null,
      toStatus: opts.toStatus ?? null,
      actorUserId,
      detail: opts.detail ?? null,
    },
  });
}

// --- Modelo unificado (nativas + agregadas) ----------------------------------

export interface GlobalTaskItem {
  kind: 'native' | 'aggregated';
  id: string;
  folio: string | null;
  sourceFolio: string | null;
  title: string;
  taskType: string;
  origin: string;
  status: string;
  statusLabel: string;
  priority: string | null;
  responsibleUserId: string | null;
  responsibleName: string | null;
  projectId: string | null;
  projectName: string | null;
  siteName: string | null;
  targetDate: string | null;
  progress: number | null;
  sourceType: string | null;
  sourceId: string | null;
  detailHref: string | null;
  originHref: string;
  overdue: boolean;
}

/** Etiqueta en español para un estado de módulo agregado (mapeado al de tarea). */
function labelForStatus(status: string): string {
  return TASK_STATUS_LABEL[status as TaskStatus] ?? status;
}

// --- Consultas ---------------------------------------------------------------

export interface TaskFilters {
  scope?: 'mine' | 'all';
  status?: string;
  quick?: string;
  search?: string;
  responsibleUserId?: string;
  projectId?: string;
  includeAggregated?: boolean;
}

async function nativeItems(
  organizationId: string,
  filters: TaskFilters,
): Promise<GlobalTaskItem[]> {
  const prisma = getPrisma();
  const where: Prisma.TaskWhereInput = { organizationId };
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.responsibleUserId) where.responsibleUserId = filters.responsibleUserId;
  if (filters.search?.trim()) {
    where.OR = [
      { folio: { contains: filters.search, mode: 'insensitive' } },
      { title: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  const tasks = await prisma.task.findMany({ where, orderBy: { createdAt: 'desc' } });
  const projectIds = tasks.map((t) => t.projectId).filter((x): x is string => Boolean(x));
  const projects = projectIds.length
    ? await prisma.project.findMany({
        where: { id: { in: projectIds }, organizationId },
        select: { id: true, name: true },
      })
    : [];
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const siteIds = tasks.map((t) => t.siteId).filter((x): x is string => Boolean(x));
  const sites = siteIds.length
    ? await prisma.site.findMany({
        where: { id: { in: siteIds }, organizationId },
        select: { id: true, name: true },
      })
    : [];
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const names = await userNames(tasks.map((t) => t.responsibleUserId));
  const t = today();

  return tasks.map((task): GlobalTaskItem => {
    const target = isoDate(task.targetDate);
    return {
      kind: 'native',
      id: task.id,
      folio: task.folio,
      sourceFolio: null,
      title: task.title,
      taskType: task.taskType,
      origin: task.origin,
      status: task.status,
      statusLabel: labelForStatus(task.status),
      priority: task.priority,
      responsibleUserId: task.responsibleUserId,
      responsibleName: task.responsibleUserId ? (names.get(task.responsibleUserId) ?? null) : null,
      projectId: task.projectId,
      projectName: task.projectId ? (projectName.get(task.projectId) ?? null) : null,
      siteName: task.siteId ? (siteName.get(task.siteId) ?? null) : null,
      targetDate: target,
      progress: task.progress,
      sourceType: task.sourceType,
      sourceId: task.sourceId,
      detailHref: `/dashboard/tasks/${task.id}`,
      originHref: `/dashboard/tasks/${task.id}`,
      overdue: !isTerminalTask(task.status as TaskStatus) && !!target && target < t,
    };
  });
}

/** Ítems agregados desde módulos existentes (solo lectura; abren su origen). */
async function aggregatedItems(organizationId: string, userId: string): Promise<GlobalTaskItem[]> {
  const prisma = getPrisma();
  const t = today();
  const items: GlobalTaskItem[] = [];

  // 1) Acciones CAPA (estados 1:1 con los de tarea).
  const capaActions = await prisma.capaAction.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
  const capaIds = [...new Set(capaActions.map((a) => a.capaId))];
  const capas = capaIds.length
    ? await prisma.capa.findMany({
        where: { id: { in: capaIds }, organizationId },
        select: { id: true, folio: true },
      })
    : [];
  const capaFolio = new Map(capas.map((c) => [c.id, c.folio]));
  const actionNames = await userNames(capaActions.map((a) => a.responsibleUserId));
  for (const a of capaActions) {
    const due = isoDate(a.dueDate);
    items.push({
      kind: 'aggregated',
      id: `capa_action:${a.id}`,
      folio: null,
      sourceFolio: capaFolio.get(a.capaId) ?? null,
      title: a.description,
      taskType: 'capa_action',
      origin: 'capa',
      status: a.status,
      statusLabel: labelForStatus(a.status),
      priority: a.priority,
      responsibleUserId: a.responsibleUserId,
      responsibleName: a.responsibleUserId ? (actionNames.get(a.responsibleUserId) ?? null) : null,
      projectId: null,
      projectName: null,
      siteName: null,
      targetDate: due,
      progress: a.progress,
      sourceType: 'capa_action',
      sourceId: a.id,
      detailHref: `/dashboard/capa/${a.capaId}`,
      originHref: `/dashboard/capa/${a.capaId}`,
      overdue: a.status !== 'completed' && a.status !== 'cancelled' && !!due && due < t,
    });
  }

  // 2) Pasos de flujo documental pendientes (revisión/aprobación).
  const steps = await prisma.documentWorkflowStep.findMany({
    where: { organizationId, status: 'pending', role: { in: ['reviewer', 'approver'] } },
  });
  const stepDocIds = [...new Set(steps.map((s) => s.documentId))];
  const stepDocs = stepDocIds.length
    ? await prisma.document.findMany({
        where: { id: { in: stepDocIds }, organizationId },
        select: { id: true, code: true, title: true },
      })
    : [];
  const docMap = new Map(stepDocs.map((d) => [d.id, d]));
  const stepNames = await userNames(steps.map((s) => s.userId));
  for (const s of steps) {
    const doc = docMap.get(s.documentId);
    const due = isoDate(s.dueAt);
    items.push({
      kind: 'aggregated',
      id: `doc_step:${s.id}`,
      folio: null,
      sourceFolio: doc?.code ?? null,
      title: `${s.role === 'reviewer' ? 'Revisar' : 'Aprobar'}: ${doc?.title ?? 'documento'}`,
      taskType: s.role === 'reviewer' ? 'doc_review' : 'doc_approval',
      origin: 'document',
      status: 'pending',
      statusLabel: labelForStatus('pending'),
      priority: null,
      responsibleUserId: s.userId,
      responsibleName: stepNames.get(s.userId) ?? null,
      projectId: null,
      projectName: null,
      siteName: null,
      targetDate: due,
      progress: null,
      sourceType: s.role === 'reviewer' ? 'doc_review' : 'doc_approval',
      sourceId: s.id,
      detailHref: `/dashboard/documents/${s.documentId}`,
      originHref: `/dashboard/documents/${s.documentId}`,
      overdue: !!due && due < t,
    });
  }

  // 3) Acciones AMEF (FmeaRow con acción recomendada o responsable).
  const fmeaRows = await prisma.fmeaRow.findMany({
    where: {
      organizationId,
      OR: [{ responsibleUserId: { not: null } }, { recommendedAction: { not: null } }],
    },
  });
  const fmeaAnalysisIds = [...new Set(fmeaRows.map((r) => r.analysisId))];
  const analyses = fmeaAnalysisIds.length
    ? await prisma.qualityAnalysis.findMany({
        where: { id: { in: fmeaAnalysisIds }, organizationId },
        select: { id: true, capaId: true, title: true },
      })
    : [];
  const analysisMap = new Map(analyses.map((a) => [a.id, a]));
  const fmeaNames = await userNames(fmeaRows.map((r) => r.responsibleUserId));
  for (const r of fmeaRows) {
    const analysis = analysisMap.get(r.analysisId);
    if (!analysis) continue;
    const due = isoDate(r.dueDate);
    const status = r.executedAction ? 'completed' : 'pending';
    items.push({
      kind: 'aggregated',
      id: `fmea_row:${r.id}`,
      folio: null,
      sourceFolio: null,
      title: r.recommendedAction ?? r.failureMode ?? 'Acción AMEF',
      taskType: 'fmea_action',
      origin: 'fmea',
      status,
      statusLabel: labelForStatus(status),
      priority: null,
      responsibleUserId: r.responsibleUserId,
      responsibleName: r.responsibleUserId ? (fmeaNames.get(r.responsibleUserId) ?? null) : null,
      projectId: null,
      projectName: null,
      siteName: null,
      targetDate: due,
      progress: null,
      sourceType: 'fmea_row',
      sourceId: r.id,
      detailHref: `/dashboard/capa/${analysis.capaId}/analysis/${analysis.id}`,
      originHref: `/dashboard/capa/${analysis.capaId}/analysis/${analysis.id}`,
      overdue: status !== 'completed' && !!due && due < t,
    });
  }

  // 4) Lecturas documentales pendientes del usuario actual (personales).
  const reads = await pendingReads(organizationId, userId);
  if (reads.length) {
    const readDocIds = [...new Set(reads.map((r) => r.documentId))];
    const readDocs = await prisma.document.findMany({
      where: { id: { in: readDocIds }, organizationId },
      select: { id: true, code: true, title: true },
    });
    const rMap = new Map(readDocs.map((d) => [d.id, d]));
    const name = (await userNames([userId])).get(userId) ?? null;
    for (const r of reads) {
      const doc = rMap.get(r.documentId);
      const due = isoDate(r.readDueAt);
      items.push({
        kind: 'aggregated',
        id: `doc_read:${r.distributionId}`,
        folio: null,
        sourceFolio: doc?.code ?? null,
        title: `Leer: ${doc?.title ?? 'documento'}`,
        taskType: 'doc_read',
        origin: 'document',
        status: 'pending',
        statusLabel: labelForStatus('pending'),
        priority: null,
        responsibleUserId: userId,
        responsibleName: name,
        projectId: null,
        projectName: null,
        siteName: null,
        targetDate: due,
        progress: null,
        sourceType: 'doc_read',
        sourceId: r.distributionId,
        detailHref: `/dashboard/documents/${r.documentId}/preview?version=${r.versionId}`,
        originHref: `/dashboard/documents/${r.documentId}/preview?version=${r.versionId}`,
        overdue: !!due && due < t,
      });
    }
  }

  return items;
}

/** Vista unificada del gestor global (nativas + agregadas, deduplicadas). */
export async function listGlobalTasks(
  organizationId: string,
  userId: string,
  filters: TaskFilters = {},
): Promise<GlobalTaskItem[]> {
  await memberRole(organizationId, userId);
  const native = await nativeItems(organizationId, filters);
  const includeAgg = filters.includeAggregated !== false && !filters.projectId;
  const aggregated = includeAgg ? await aggregatedItems(organizationId, userId) : [];

  // Dedup: oculta el ítem agregado ya convertido en tarea nativa.
  const linked = new Set(
    native.filter((n) => n.sourceType && n.sourceId).map((n) => `${n.sourceType}:${n.sourceId}`),
  );
  const aggFiltered = aggregated.filter((a) => !linked.has(`${a.sourceType}:${a.sourceId}`));

  let all = [...native, ...aggFiltered];

  // Filtros transversales.
  if (filters.scope === 'mine') all = all.filter((i) => i.responsibleUserId === userId);
  if (filters.status) all = all.filter((i) => i.status === filters.status);
  if (filters.search?.trim() && aggFiltered.length) {
    const q = filters.search.toLowerCase();
    all = all.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.folio ?? '').toLowerCase().includes(q) ||
        (i.sourceFolio ?? '').toLowerCase().includes(q),
    );
  }
  const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  switch (filters.quick) {
    case 'pending':
      all = all.filter((i) => i.status === 'pending');
      break;
    case 'in_progress':
      all = all.filter((i) => i.status === 'in_progress');
      break;
    case 'blocked':
      all = all.filter((i) => i.status === 'blocked');
      break;
    case 'completed':
      all = all.filter((i) => i.status === 'completed');
      break;
    case 'overdue':
      all = all.filter((i) => i.overdue);
      break;
    case 'due_soon':
      all = all.filter(
        (i) =>
          !!i.targetDate &&
          i.targetDate >= today() &&
          i.targetDate <= soon &&
          i.status !== 'completed' &&
          i.status !== 'cancelled',
      );
      break;
  }

  // Orden: vencidas primero, luego por fecha objetivo, luego por folio.
  all.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const da = a.targetDate ?? '9999-99-99';
    const db = b.targetDate ?? '9999-99-99';
    if (da !== db) return da < db ? -1 : 1;
    return (a.folio ?? a.sourceFolio ?? '').localeCompare(b.folio ?? b.sourceFolio ?? '');
  });
  return all;
}

export async function getTaskSummary(organizationId: string, userId: string) {
  const all = await listGlobalTasks(organizationId, userId, {});
  const t = today();
  const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const openItems = all.filter((i) => i.status !== 'completed' && i.status !== 'cancelled');
  return {
    open: openItems.length,
    overdue: all.filter((i) => i.overdue).length,
    dueSoon: openItems.filter((i) => !!i.targetDate && i.targetDate >= t && i.targetDate <= soon)
      .length,
    mine: openItems.filter((i) => i.responsibleUserId === userId).length,
    blocked: all.filter((i) => i.status === 'blocked').length,
  };
}

// --- Detalle -----------------------------------------------------------------

export async function getTaskDetail(organizationId: string, taskId: string) {
  const prisma = getPrisma();
  const task = await loadScoped(organizationId, taskId);
  const [assignments, relations, comments, files, depsFrom, depsTo, history] = await Promise.all([
    prisma.taskAssignment.findMany({ where: { taskId, organizationId } }),
    prisma.taskRelation.findMany({ where: { taskId, organizationId } }),
    prisma.taskComment.findMany({
      where: { taskId, organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.taskFile.findMany({ where: { taskId, organizationId }, orderBy: { createdAt: 'asc' } }),
    prisma.taskDependency.findMany({ where: { toTaskId: taskId, organizationId } }),
    prisma.taskDependency.findMany({ where: { fromTaskId: taskId, organizationId } }),
    prisma.taskStatusHistory.findMany({
      where: { taskId, organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  const relatedTaskIds = [...depsFrom.map((d) => d.fromTaskId), ...depsTo.map((d) => d.toTaskId)];
  const relatedTasks = relatedTaskIds.length
    ? await prisma.task.findMany({
        where: { id: { in: relatedTaskIds }, organizationId },
        select: { id: true, folio: true, title: true, status: true },
      })
    : [];
  const rtMap = new Map(relatedTasks.map((t) => [t.id, t]));

  const names = await userNames([
    task.responsibleUserId,
    task.createdBy,
    ...assignments.map((a) => a.userId),
    ...comments.map((c) => c.author),
    ...history.map((h) => h.actorUserId),
  ]);
  const project = task.projectId
    ? await prisma.project.findFirst({
        where: { id: task.projectId, organizationId },
        select: { id: true, folio: true, name: true },
      })
    : null;
  const site = task.siteId
    ? await prisma.site.findFirst({
        where: { id: task.siteId, organizationId },
        select: { name: true },
      })
    : null;

  return {
    task: {
      id: task.id,
      folio: task.folio,
      title: task.title,
      description: task.description,
      taskType: task.taskType,
      origin: task.origin,
      status: task.status,
      priority: task.priority,
      responsibleUserId: task.responsibleUserId,
      responsibleName: task.responsibleUserId ? (names.get(task.responsibleUserId) ?? null) : null,
      createdByName: task.createdBy ? (names.get(task.createdBy) ?? null) : null,
      startDate: isoDate(task.startDate),
      targetDate: isoDate(task.targetDate),
      closedAt: task.closedAt,
      progress: task.progress,
      estimatedHours: task.estimatedHours ? Number(task.estimatedHours) : null,
      actualHours: task.actualHours ? Number(task.actualHours) : null,
      blockedReason: task.blockedReason,
      result: task.result,
      sourceType: task.sourceType,
      sourceId: task.sourceId,
      siteName: site?.name ?? null,
      readOnly: isTerminalTask(task.status as TaskStatus),
    },
    project,
    assignments: assignments.map((a) => ({
      id: a.id,
      userId: a.userId,
      name: names.get(a.userId) ?? a.userId,
      role: a.role,
    })),
    relations: relations.map((r) => ({
      id: r.id,
      relationType: r.relationType,
      targetId: r.targetId,
      externalRef: r.externalRef,
      note: r.note,
      href: relationHref(r.relationType, r.targetId),
    })),
    dependencies: depsFrom.map((d) => {
      const rt = rtMap.get(d.fromTaskId);
      return {
        id: d.id,
        fromTaskId: d.fromTaskId,
        folio: rt?.folio ?? null,
        title: rt?.title ?? '',
        status: rt?.status ?? '',
        mandatory: d.mandatory,
        satisfied: rt?.status === 'completed',
      };
    }),
    dependents: depsTo.map((d) => {
      const rt = rtMap.get(d.toTaskId);
      return { id: d.id, toTaskId: d.toTaskId, folio: rt?.folio ?? null, title: rt?.title ?? '' };
    }),
    comments: comments.map((c) => ({
      id: c.id,
      author: c.author ? (names.get(c.author) ?? null) : null,
      body: c.body,
      createdAt: c.createdAt,
    })),
    files: files.map((f) => ({
      id: f.id,
      kind: f.kind,
      originalName: f.originalName,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
    })),
    history: history.map((h) => ({
      id: h.id.toString(),
      event: h.event,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      detail: h.detail,
      actorName: h.actorUserId ? (names.get(h.actorUserId) ?? null) : null,
      createdAt: h.createdAt,
    })),
  };
}

/** Enlace real al origen de una relación (para trazabilidad clickeable). */
export function relationHref(relationType: string, targetId: string | null): string | null {
  if (!targetId) return null;
  switch (relationType) {
    case 'document':
    case 'document_version':
      return `/dashboard/documents/${targetId}`;
    case 'capa':
      return `/dashboard/capa/${targetId}`;
    case 'project':
      return `/dashboard/projects/${targetId}`;
    case 'parent_task':
      return `/dashboard/tasks/${targetId}`;
    default:
      return null;
  }
}

// --- Escrituras --------------------------------------------------------------

export interface TaskInput {
  title: string;
  description?: string | null;
  taskType?: string;
  origin?: string;
  priority?: string;
  siteId?: string | null;
  projectId?: string | null;
  milestoneId?: string | null;
  responsibleUserId?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  estimatedHours?: number | null;
  sourceType?: string | null;
  sourceId?: string | null;
}

export async function createTask(
  organizationId: string,
  actorId: string,
  input: TaskInput,
): Promise<string> {
  const role = await memberRole(organizationId, actorId);
  if (!canCreate(role)) throw new TaskPermissionError('No tienes permiso para crear tareas.');
  if (!input.title?.trim()) throw new TaskValidationError(['El título es obligatorio.']);
  if (input.startDate && input.targetDate && input.targetDate < input.startDate) {
    throw new TaskValidationError(['La fecha objetivo no puede ser anterior a la de inicio.']);
  }
  // Valida proyecto y evita duplicar una fuente ya enlazada.
  if (input.projectId) {
    const p = await getPrisma().project.findFirst({
      where: { id: input.projectId, organizationId },
      select: { id: true },
    });
    if (!p) throw new TaskValidationError(['El proyecto no pertenece a la organización.']);
  }
  if (input.sourceType && input.sourceId) {
    const existing = await getPrisma().task.findFirst({
      where: { organizationId, sourceType: input.sourceType, sourceId: input.sourceId },
      select: { id: true },
    });
    if (existing) throw new TaskValidationError(['Ya existe una tarea para ese origen.']);
  }

  const year = new Date().getUTCFullYear();
  return withOrgContext(organizationId, async (tx) => {
    const folio = await nextFolio(tx, organizationId, year);
    const task = await tx.task.create({
      data: {
        organizationId,
        folio,
        title: input.title.trim(),
        description: input.description ?? null,
        taskType: inSet(TASK_TYPES, input.taskType, 'manual'),
        origin: inSet(
          ['manual', 'project', 'capa', 'analysis', 'document', 'fmea', 'other'] as const,
          input.origin,
          input.projectId ? 'project' : 'manual',
        ),
        priority: inSet(TASK_PRIORITIES, input.priority, 'normal'),
        status: 'pending',
        siteId: input.siteId || null,
        projectId: input.projectId || null,
        milestoneId: input.milestoneId || null,
        responsibleUserId: input.responsibleUserId || null,
        startDate: parseDate(input.startDate),
        targetDate: parseDate(input.targetDate),
        estimatedHours: input.estimatedHours ?? null,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        createdBy: actorId,
      },
    });
    await recordHistory(tx, organizationId, task.id, 'task.created', actorId, {
      toStatus: 'pending',
    });
    return task.id;
  });
}

export async function updateTask(
  organizationId: string,
  actorId: string,
  taskId: string,
  input: Partial<TaskInput> & { progress?: number; actualHours?: number | null },
): Promise<void> {
  const task = await loadScoped(organizationId, taskId);
  const role = await memberRole(organizationId, actorId);
  const parts = await participantIds(organizationId, taskId);
  if (!canAct(task, role, actorId, parts)) {
    throw new TaskPermissionError('No tienes permiso para editar esta tarea.');
  }
  if (isTerminalTask(task.status as TaskStatus)) {
    throw new TaskValidationError(['La tarea está en solo lectura.']);
  }
  const progress =
    input.progress === undefined
      ? task.progress
      : Math.max(0, Math.min(100, Math.trunc(input.progress)));
  await withOrgContext(organizationId, async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: {
        title: input.title?.trim() ?? task.title,
        description: input.description ?? task.description,
        priority: input.priority ? inSet(TASK_PRIORITIES, input.priority, 'normal') : task.priority,
        responsibleUserId:
          input.responsibleUserId === undefined
            ? task.responsibleUserId
            : input.responsibleUserId || null,
        siteId: input.siteId === undefined ? task.siteId : input.siteId || null,
        startDate: input.startDate === undefined ? task.startDate : parseDate(input.startDate),
        targetDate: input.targetDate === undefined ? task.targetDate : parseDate(input.targetDate),
        estimatedHours:
          input.estimatedHours === undefined ? task.estimatedHours : input.estimatedHours,
        actualHours: input.actualHours === undefined ? task.actualHours : input.actualHours,
        progress,
      },
    });
    await recordHistory(tx, organizationId, taskId, 'task.updated', actorId);
  });
}

export async function transitionTask(
  organizationId: string,
  actorId: string,
  taskId: string,
  to: TaskStatus,
  opts: { reason?: string | null; result?: string | null } = {},
): Promise<void> {
  const task = await loadScoped(organizationId, taskId);
  const role = await memberRole(organizationId, actorId);
  const from = task.status as TaskStatus;
  const reopen = isReopenTransition(from, to);
  if (reopen && !isAdmin(role)) {
    throw new TaskPermissionError('La reapertura requiere owner/admin.');
  }
  if (!reopen) {
    const parts = await participantIds(organizationId, taskId);
    if (!canAct(task, role, actorId, parts)) {
      throw new TaskPermissionError('No tienes permiso para cambiar el estado de la tarea.');
    }
  }
  assertTaskTransition(from, to, { reopen });

  // Dependencias obligatorias al arrancar.
  if (to === 'in_progress') {
    const deps = await getPrisma().taskDependency.findMany({
      where: { toTaskId: taskId, organizationId },
    });
    if (deps.length) {
      const preds = await getPrisma().task.findMany({
        where: { id: { in: deps.map((d) => d.fromTaskId) }, organizationId },
        select: { id: true, status: true },
      });
      const statusById = new Map(preds.map((p) => [p.id, p.status as TaskStatus]));
      const shaped = deps.map((d) => ({
        mandatory: d.mandatory,
        predecessorStatus: statusById.get(d.fromTaskId) ?? ('pending' as TaskStatus),
      }));
      if (isBlockedByDependencies(shaped)) {
        throw new TaskValidationError([
          'No puedes iniciar: una dependencia obligatoria no está completada.',
        ]);
      }
    }
  }

  const requireResult = task.taskType !== 'manual';
  const errors = validateTaskTransition({
    to,
    reason: opts.reason,
    result: opts.result,
    requireResultOnComplete: requireResult,
  });
  if (errors.length) throw new TaskValidationError(errors);

  await withOrgContext(organizationId, async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: {
        status: to,
        blockedReason: to === 'blocked' ? (opts.reason ?? null) : task.blockedReason,
        result: to === 'completed' ? (opts.result ?? task.result) : task.result,
        closedAt: to === 'completed' || to === 'cancelled' ? new Date() : task.closedAt,
        progress: to === 'completed' ? 100 : task.progress,
      },
    });
    await recordHistory(
      tx,
      organizationId,
      taskId,
      reopen ? 'task.reopened' : 'task.status',
      actorId,
      {
        fromStatus: from,
        toStatus: to,
        detail: opts.reason ?? opts.result ?? null,
      },
    );
  });
}

export async function addTaskComment(
  organizationId: string,
  actorId: string,
  taskId: string,
  body: string,
): Promise<void> {
  await loadScoped(organizationId, taskId);
  await memberRole(organizationId, actorId);
  if (!body?.trim()) throw new TaskValidationError(['El comentario no puede estar vacío.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.taskComment.create({
      data: { organizationId, taskId, author: actorId, body: body.trim() },
    });
  });
}

export async function addTaskAssignment(
  organizationId: string,
  actorId: string,
  taskId: string,
  userId: string,
  assignmentRole = 'participant',
): Promise<void> {
  const task = await loadScoped(organizationId, taskId);
  const role = await memberRole(organizationId, actorId);
  const parts = await participantIds(organizationId, taskId);
  if (!canAct(task, role, actorId, parts)) {
    throw new TaskPermissionError('No tienes permiso para gestionar participantes.');
  }
  const member = await getPrisma().membership.findFirst({
    where: { organizationId, userId },
    select: { userId: true },
  });
  if (!member) throw new TaskValidationError(['El usuario no pertenece a la organización.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.taskAssignment.upsert({
      where: { taskId_userId: { taskId, userId } },
      create: {
        organizationId,
        taskId,
        userId,
        role: inSet(['assignee', 'participant', 'watcher'] as const, assignmentRole, 'participant'),
        addedBy: actorId,
      },
      update: {
        role: inSet(['assignee', 'participant', 'watcher'] as const, assignmentRole, 'participant'),
      },
    });
  });
}

export async function addTaskRelation(
  organizationId: string,
  actorId: string,
  taskId: string,
  input: {
    relationType: string;
    targetId?: string | null;
    externalRef?: string | null;
    note?: string | null;
  },
): Promise<void> {
  await loadScoped(organizationId, taskId);
  await memberRole(organizationId, actorId);
  await withOrgContext(organizationId, async (tx) => {
    await tx.taskRelation.create({
      data: {
        organizationId,
        taskId,
        relationType: inSet(
          [
            'document',
            'document_version',
            'capa',
            'capa_action',
            'analysis',
            'fmea_row',
            'project',
            'milestone',
            'parent_task',
            'external',
          ] as const,
          input.relationType,
          'external',
        ),
        targetId: input.targetId || null,
        externalRef: input.externalRef ?? null,
        note: input.note ?? null,
        createdBy: actorId,
      },
    });
  });
}

export async function addTaskDependency(
  organizationId: string,
  actorId: string,
  input: { fromTaskId: string; toTaskId: string; mandatory?: boolean; lagDays?: number },
): Promise<void> {
  const role = await memberRole(organizationId, actorId);
  if (!canCreate(role))
    throw new TaskPermissionError('No tienes permiso para gestionar dependencias.');
  const prisma = getPrisma();
  const [from, to] = await Promise.all([
    prisma.task.findFirst({
      where: { id: input.fromTaskId, organizationId },
      select: { id: true },
    }),
    prisma.task.findFirst({ where: { id: input.toTaskId, organizationId }, select: { id: true } }),
  ]);
  if (!from || !to) throw new TaskNotFoundError();

  const existing = await prisma.taskDependency.findMany({
    where: { organizationId },
    select: { fromTaskId: true, toTaskId: true },
  });
  const edges: Edge[] = existing.map((e) => ({ from: e.fromTaskId, to: e.toTaskId }));
  assertDependencyAcyclic(edges, { from: input.fromTaskId, to: input.toTaskId });

  await withOrgContext(organizationId, async (tx) => {
    await tx.taskDependency.create({
      data: {
        organizationId,
        fromTaskId: input.fromTaskId,
        toTaskId: input.toTaskId,
        mandatory: input.mandatory ?? true,
        lagDays: Math.max(0, input.lagDays ?? 0),
        createdBy: actorId,
      },
    });
    await recordHistory(tx, organizationId, input.toTaskId, 'task.dependency_added', actorId, {
      detail: `Depende de ${input.fromTaskId}`,
    });
  });
}

export async function uploadTaskFile(
  organizationId: string,
  actorId: string,
  taskId: string,
  file: { originalName: string; mimeType: string; data: Buffer },
  kind: 'attachment' | 'evidence' = 'attachment',
): Promise<void> {
  const task = await loadScoped(organizationId, taskId);
  const role = await memberRole(organizationId, actorId);
  const parts = await participantIds(organizationId, taskId);
  if (!canAct(task, role, actorId, parts)) {
    throw new TaskPermissionError('No tienes permiso para adjuntar evidencia.');
  }
  const saved = await saveDocumentFile({ organizationId, ...file });
  await withOrgContext(organizationId, async (tx) => {
    await tx.taskFile.create({
      data: {
        organizationId,
        taskId,
        kind,
        originalName: saved.originalName,
        storedName: saved.storedName,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        extension: saved.extension,
        storageKey: saved.storageKey,
        checksum: saved.checksum,
        uploadedBy: actorId,
      },
    });
  });
}

/** Convierte una fuente de otro módulo en tarea nativa (enlazada, no copiada). */
export async function convertToTask(
  organizationId: string,
  actorId: string,
  input: TaskInput & {
    sourceType: string;
    sourceId: string;
    relationType?: string;
    relationTargetId?: string;
  },
): Promise<string> {
  const taskId = await createTask(organizationId, actorId, input);
  if (input.relationType && input.relationTargetId) {
    await addTaskRelation(organizationId, actorId, taskId, {
      relationType: input.relationType,
      targetId: input.relationTargetId,
    });
  }
  return taskId;
}

/** Contexto de permisos del usuario sobre una tarea (para la interfaz). */
export async function getUserTaskContext(organizationId: string, userId: string, taskId: string) {
  const role =
    (
      await getPrisma().membership.findFirst({
        where: { organizationId, userId },
        select: { role: true },
      })
    )?.role ?? 'viewer';
  const task = await getPrisma().task.findFirst({
    where: { id: taskId, organizationId },
    select: { responsibleUserId: true, createdBy: true },
  });
  const parts = await participantIds(organizationId, taskId);
  const canActOn = task ? canAct(task, role, userId, parts) : false;
  return { role, isAdmin: isAdmin(role), canCreate: canCreate(role), canAct: canActOn };
}

/** Tareas nativas de la organización para elegir dependencias (excluye una). */
export async function listNativeTasksBrief(organizationId: string, excludeId?: string) {
  const rows = await getPrisma().task.findMany({
    where: { organizationId, id: excludeId ? { not: excludeId } : undefined },
    select: { id: true, folio: true, title: true, status: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return rows;
}

export const _taskStatuses = TASK_STATUSES;
