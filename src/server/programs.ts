/**
 * Orquestación de Programas ejecutables (DOC-003). Al PUBLICAR un Programa, cada
 * actividad con `executionEnabled` genera OCURRENCIAS (motor puro
 * `program-execution`), cada una materializada como una fila
 * `program_activity_instances` enlazada a una **Tarea nativa** (no se duplica el
 * motor de tareas §6). Idempotente: la clave (versión, actividad, ocurrencia) evita
 * duplicados en reintentos; el estado operativo vive en la Tarea.
 */
import { getPrisma, withOrgContext } from './db';
import { sanitizeStructuredContent } from '@/features/documents/structured-content';
import {
  generateOccurrences,
  validateProgramForPublish,
  scheduleLabel,
  type ProgramBlock,
} from '@/features/documents/program-execution';
import {
  deriveExecutionStatus,
  executionSummary,
  executionProgress,
  type ExecutionStatus,
  type ExecutionSummary,
  type ExecutionProgress,
} from '@/features/documents/program-status';
import { formatIsoDate, type DateFormat } from '@/features/documents/date-format';
import { createTask } from './tasks';
import { getDocumentPresentation } from './documents';

export class ProgramActivationError extends Error {
  constructor(public errors: string[]) {
    super(errors.join(' '));
    this.name = 'ProgramActivationError';
  }
}

export interface ActivationResult {
  activated: boolean;
  instances: number;
  tasks: number;
}

/** Ids de miembros de la organización (para validar responsables, §12). */
async function orgMemberIds(organizationId: string): Promise<Set<string>> {
  const rows = await getPrisma().membership.findMany({
    where: { organizationId },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

/**
 * Valida un Programa para publicarlo/activarlo (sin efectos): horizonte, fechas,
 * responsable presente y miembro de la organización (§37/§12). Devuelve mensajes en
 * español (vacío = válido). Los tipos no-Programa devuelven vacío.
 */
export async function validateProgramForActivation(
  organizationId: string,
  documentId: string,
  versionId: string,
): Promise<string[]> {
  const version = await getPrisma().documentVersion.findFirst({
    where: { id: versionId, documentId, organizationId },
    include: { document: { select: { documentType: true } } },
  });
  if (!version || version.document.documentType !== 'program') return [];
  const block = sanitizeStructuredContent('program', version.structuredContent).program;
  if (!block) return [];
  const errors = validateProgramForPublish(block);
  const members = await orgMemberIds(organizationId);
  for (const a of block.activities.filter((x) => x.executionEnabled)) {
    if (a.responsibleUserId && !members.has(a.responsibleUserId)) {
      errors.push(
        `La actividad "${a.name}" tiene un responsable que no pertenece a la organización.`,
      );
    }
  }
  return errors;
}

/**
 * Activa un Programa PUBLICADO: genera ocurrencias + tareas de forma idempotente.
 * Solo debe llamarse tras publicar (borrador no genera nada, §10). Devuelve conteos.
 */
export async function activateProgram(
  organizationId: string,
  actorId: string,
  documentId: string,
  versionId: string,
): Promise<ActivationResult> {
  const prisma = getPrisma();
  const version = await prisma.documentVersion.findFirst({
    where: { id: versionId, documentId, organizationId },
    include: { document: { select: { documentType: true, code: true, title: true } } },
  });
  if (!version || version.document.documentType !== 'program') {
    return { activated: false, instances: 0, tasks: 0 };
  }

  const content = sanitizeStructuredContent('program', version.structuredContent);
  const block: ProgramBlock | undefined = content.program;
  if (!block) return { activated: false, instances: 0, tasks: 0 };

  // Validación para publicar (horizonte, fechas, responsable, recurrencia §37).
  const errors = validateProgramForPublish(block);
  const executable = block.activities.filter((a) => a.executionEnabled);

  // §12: el responsable debe ser miembro de la organización (rechazo cross-tenant).
  const members = await orgMemberIds(organizationId);
  for (const a of executable) {
    if (a.responsibleUserId && !members.has(a.responsibleUserId)) {
      errors.push(
        `La actividad "${a.name}" tiene un responsable que no pertenece a la organización.`,
      );
    }
  }
  if (errors.length) throw new ProgramActivationError(errors);

  let instances = 0;
  let tasks = 0;

  for (const activity of executable) {
    const occurrences = generateOccurrences(activity, block);
    for (const occ of occurrences) {
      // 1) Upsert de la ocurrencia (idempotente por versión+actividad+clave).
      const instanceId = await withOrgContext(organizationId, async (tx) => {
        const row = await tx.programActivityInstance.upsert({
          where: {
            documentVersionId_activityId_occurrenceKey: {
              documentVersionId: versionId,
              activityId: activity.activityId,
              occurrenceKey: occ.occurrenceKey,
            },
          },
          update: {
            activityName: activity.name,
            plannedStart: occ.plannedStart ? new Date(occ.plannedStart) : null,
            dueAt: occ.dueAt ? new Date(occ.dueAt) : null,
            responsibleUserId: activity.responsibleUserId,
            expectedEvidence: activity.expectedEvidence || null,
            notifyBeforeDays: activity.notifyBeforeDays,
          },
          create: {
            organizationId,
            documentId,
            documentVersionId: versionId,
            activityId: activity.activityId,
            occurrenceKey: occ.occurrenceKey,
            activityName: activity.name,
            plannedStart: occ.plannedStart ? new Date(occ.plannedStart) : null,
            dueAt: occ.dueAt ? new Date(occ.dueAt) : null,
            responsibleUserId: activity.responsibleUserId,
            expectedEvidence: activity.expectedEvidence || null,
            notifyBeforeDays: activity.notifyBeforeDays,
          },
          select: { id: true, taskId: true },
        });
        instances += 1;
        return { id: row.id, taskId: row.taskId };
      });

      // 2) Enlaza (o crea) la Tarea nativa. Idempotente: no duplica (§10).
      //    La tarea se crea DESPUÉS de la instancia → nunca queda tarea huérfana (§34).
      if (!instanceId.taskId) {
        const existing = await prisma.task.findFirst({
          where: { organizationId, sourceType: 'program_activity', sourceId: instanceId.id },
          select: { id: true },
        });
        const taskId =
          existing?.id ??
          (await createTask(organizationId, actorId, {
            title: `${activity.name} — ${occ.dueAt}`,
            description: activity.description || null,
            taskType: 'manual',
            origin: 'document',
            responsibleUserId: activity.responsibleUserId,
            targetDate: occ.dueAt,
            startDate: occ.plannedStart ?? undefined,
            sourceType: 'program_activity',
            sourceId: instanceId.id,
          }));
        if (!existing) tasks += 1;
        await withOrgContext(organizationId, async (tx) => {
          await tx.programActivityInstance.update({
            where: { id: instanceId.id },
            data: { taskId },
          });
        });
      }
    }
  }

  return { activated: true, instances, tasks };
}

export interface ProgramInstanceRow {
  id: string;
  activityId: string;
  occurrenceKey: string;
  activityName: string;
  documentVersionId: string;
  dueAt: string | null;
  responsibleUserId: string | null;
  taskId: string | null;
  status: string;
  expectedEvidence: string | null;
}

/** Ocurrencias ejecutables de un documento (todas las versiones), más reciente primero. */
export async function getProgramInstances(
  organizationId: string,
  documentId: string,
): Promise<ProgramInstanceRow[]> {
  const rows = await getPrisma().programActivityInstance.findMany({
    where: { organizationId, documentId },
    orderBy: [{ dueAt: 'asc' }, { activityName: 'asc' }],
    select: {
      id: true,
      activityId: true,
      occurrenceKey: true,
      activityName: true,
      documentVersionId: true,
      dueAt: true,
      responsibleUserId: true,
      taskId: true,
      status: true,
      expectedEvidence: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    dueAt: r.dueAt ? r.dueAt.toISOString().slice(0, 10) : null,
  }));
}

export interface ExecutionRow {
  instanceId: string;
  activityId: string;
  activityName: string;
  occurrenceKey: string;
  dueAtRaw: string | null;
  dueAtDisplay: string | null;
  responsibleName: string;
  status: ExecutionStatus;
  expectedEvidence: string | null;
  taskId: string | null;
}

export interface ProgramExecution {
  documentId: string;
  code: string;
  title: string;
  versionLabel: string | null;
  versionId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  published: boolean;
  rows: ExecutionRow[];
  summary: ExecutionSummary;
  progress: ExecutionProgress;
}

/**
 * Vista de EJECUCIÓN de un Programa (DOC-003 §4-16): ocurrencias + estado derivado
 * de la Tarea + resumen/progreso. Batch (sin N+1). No lee estado operativo del
 * structured_content. `now`/`versionId` inyectables (tests / histórico §47).
 */
export async function getProgramExecution(
  organizationId: string,
  documentId: string,
  options: { versionId?: string; now?: string } = {},
): Promise<ProgramExecution> {
  const prisma = getPrisma();
  const now = options.now ?? new Date().toISOString().slice(0, 10);

  const doc = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
    select: { id: true, code: true, title: true, currentVersionLabel: true },
  });
  if (!doc) {
    return {
      documentId,
      code: '',
      title: '',
      versionLabel: null,
      versionId: null,
      periodStart: null,
      periodEnd: null,
      published: false,
      rows: [],
      summary: { total: 0, completed: 0, pending: 0, overdue: 0, dueSoon30: 0 },
      progress: { completed: 0, total: 0, percent: 0 },
    };
  }

  // Versión objetivo: la indicada, o la vigente publicada.
  const targetVersion =
    (options.versionId
      ? await prisma.documentVersion.findFirst({
          where: { id: options.versionId, documentId, organizationId },
          select: { id: true, label: true, status: true, structuredContent: true },
        })
      : await prisma.documentVersion.findFirst({
          where: { documentId, organizationId, status: 'published', isCurrent: true },
          select: { id: true, label: true, status: true, structuredContent: true },
        })) ?? null;

  const period = targetVersion
    ? sanitizeStructuredContent('program', targetVersion.structuredContent).program
    : undefined;

  const instances = targetVersion
    ? await prisma.programActivityInstance.findMany({
        where: { organizationId, documentId, documentVersionId: targetVersion.id },
        orderBy: [{ dueAt: 'asc' }, { activityName: 'asc' }],
      })
    : [];

  // Batch: tareas + nombres de miembros + formato de fecha.
  const taskIds = instances.map((i) => i.taskId).filter((x): x is string => Boolean(x));
  const [tasks, memberships, presentation] = await Promise.all([
    taskIds.length
      ? prisma.task.findMany({
          where: { organizationId, id: { in: taskIds } },
          select: { id: true, status: true },
        })
      : Promise.resolve([] as { id: string; status: string }[]),
    prisma.membership.findMany({
      where: { organizationId },
      select: { userId: true, user: { select: { displayName: true, email: true } } },
    }),
    getDocumentPresentation(organizationId),
  ]);
  const taskStatus = new Map(tasks.map((t) => [t.id, t.status]));
  const memberName = new Map(
    memberships.map((m) => [m.userId, m.user.displayName ?? m.user.email]),
  );
  const dateFormat: DateFormat = presentation.dateFormat;

  const rows: ExecutionRow[] = instances.map((inst) => {
    const dueRaw = inst.dueAt ? inst.dueAt.toISOString().slice(0, 10) : null;
    const status = deriveExecutionStatus(
      inst.status,
      inst.taskId ? (taskStatus.get(inst.taskId) ?? null) : null,
      dueRaw,
      now,
    );
    return {
      instanceId: inst.id,
      activityId: inst.activityId,
      activityName: inst.activityName,
      occurrenceKey: inst.occurrenceKey,
      dueAtRaw: dueRaw,
      dueAtDisplay: formatIsoDate(dueRaw, dateFormat),
      // §10: si el responsable ya no es miembro → "Usuario inactivo".
      responsibleName: inst.responsibleUserId
        ? (memberName.get(inst.responsibleUserId) ?? 'Usuario inactivo')
        : '—',
      status,
      expectedEvidence: inst.expectedEvidence,
      taskId: inst.taskId,
    };
  });

  return {
    documentId: doc.id,
    code: doc.code,
    title: doc.title,
    versionLabel: targetVersion?.label ?? doc.currentVersionLabel ?? null,
    versionId: targetVersion?.id ?? null,
    periodStart: period?.periodStart ?? null,
    periodEnd: period?.periodEnd ?? null,
    published: Boolean(targetVersion && targetVersion.status === 'published'),
    rows,
    summary: executionSummary(
      rows.map((r) => ({ status: r.status, dueAt: r.dueAtRaw })),
      now,
    ),
    progress: executionProgress(rows.map((r) => ({ status: r.status, dueAt: r.dueAtRaw }))),
  };
}

/** Origen de una Tarea de Programa (Task→Programa §15): documento + actividad + ocurrencia. */
export interface TaskProgramOrigin {
  documentId: string;
  code: string;
  title: string;
  activityName: string;
  occurrenceLabel: string;
  scheduleLabel: string;
}

/** Resuelve el origen de una Tarea con sourceType='program_activity' (o `null`). */
export async function getTaskProgramOrigin(
  organizationId: string,
  instanceId: string,
): Promise<TaskProgramOrigin | null> {
  const prisma = getPrisma();
  const inst = await prisma.programActivityInstance.findFirst({
    where: { id: instanceId, organizationId },
    select: {
      documentId: true,
      documentVersionId: true,
      activityId: true,
      activityName: true,
      occurrenceKey: true,
      dueAt: true,
    },
  });
  if (!inst) return null;
  const [doc, presentation] = await Promise.all([
    prisma.document.findFirst({
      where: { id: inst.documentId, organizationId },
      select: { code: true, title: true },
    }),
    getDocumentPresentation(organizationId),
  ]);
  if (!doc) return null;
  const dueRaw = inst.dueAt ? inst.dueAt.toISOString().slice(0, 10) : null;
  // Etiqueta de la actividad/programación desde la versión que originó la instancia.
  const version = await prisma.documentVersion.findFirst({
    where: { id: inst.documentVersionId, organizationId },
    select: { structuredContent: true },
  });
  const block = version
    ? sanitizeStructuredContent('program', version.structuredContent).program
    : undefined;
  const activity = block?.activities.find((a) => a.activityId === inst.activityId);
  return {
    documentId: inst.documentId,
    code: doc.code,
    title: doc.title,
    activityName: inst.activityName,
    occurrenceLabel: formatIsoDate(dueRaw, presentation.dateFormat) ?? inst.occurrenceKey,
    scheduleLabel: activity ? scheduleLabel(activity.schedule) : '',
  };
}
