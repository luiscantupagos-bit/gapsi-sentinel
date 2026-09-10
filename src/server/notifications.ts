/**
 * Notificaciones internas transversales (DOC-003 §1-13). Infraestructura mínima
 * y reutilizable: producer/processor + listado + lectura. Canal MVP = dentro de
 * C3 Sentinel (sin email/SMS/push). Todo tenant-scoped; el estado se deriva de
 * `deliveredAt`/`readAt`. El primer producer es Programas ejecutables, pero el
 * modelo (`source_type`/`source_id`) sirve a task/document_review/audit/capa/etc.
 */
import { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';
import { formatIsoDate } from '@/features/documents/date-format';
import { getDocumentPresentation } from './documents';
import {
  planProgramNotifications,
  type ProgramNotificationType,
} from '@/features/notifications/schedule';

const PROGRAM_SOURCE = 'program_activity';

/** Estados TERMINALES de Tarea que detienen los avisos (§8/§24). */
const TERMINAL_TASK_STATUSES = new Set(['completed', 'cancelled']);

export interface ProcessSummary {
  scanned: number;
  created: number;
  skippedCompleted: number;
  skippedExisting: number;
}

function titleFor(type: ProgramNotificationType): string {
  switch (type) {
    case 'program_due_soon':
      return 'Actividad próxima a vencer';
    case 'program_due_today':
      return 'Actividad que vence hoy';
    case 'program_overdue':
      return 'Actividad vencida';
  }
}

function messageFor(type: ProgramNotificationType, activityName: string, dueText: string): string {
  const name = `«${activityName}»`;
  switch (type) {
    case 'program_due_soon':
      return `${name} vence el ${dueText}.`;
    case 'program_due_today':
      return `${name} vence hoy (${dueText}).`;
    case 'program_overdue':
      return `${name} venció el ${dueText}.`;
  }
}

/**
 * Procesa los avisos de Programa vigentes al día `now` (ISO YYYY-MM-DD) para una
 * organización. Determinista (recibe `now`), idempotente (dedup por clave real) y
 * sin canales externos. Pensado para ejecución manual o cron futuro.
 */
export async function processProgramNotifications(
  organizationId: string,
  now: string,
): Promise<ProcessSummary> {
  const prisma = getPrisma();
  // §18: solo ocurrencias vigentes (no superseded/cancelled), con destinatario,
  // vencimiento y tarea enlazada.
  const instances = await prisma.programActivityInstance.findMany({
    where: {
      organizationId,
      status: 'scheduled',
      responsibleUserId: { not: null },
      taskId: { not: null },
      dueAt: { not: null },
    },
    select: {
      id: true,
      documentId: true,
      documentVersionId: true,
      activityId: true,
      activityName: true,
      dueAt: true,
      notifyBeforeDays: true,
      responsibleUserId: true,
      taskId: true,
    },
  });

  const summary: ProcessSummary = {
    scanned: 0,
    created: 0,
    skippedCompleted: 0,
    skippedExisting: 0,
  };
  if (instances.length === 0) return summary;

  // §22: batch de tareas + avisos existentes (evita N+1).
  const taskIds = instances.map((i) => i.taskId!).filter(Boolean);
  const tasks = await prisma.task.findMany({
    where: { organizationId, id: { in: taskIds } },
    select: { id: true, status: true },
  });
  const taskStatus = new Map(tasks.map((t) => [t.id, t.status]));

  const existing = await prisma.notificationDelivery.findMany({
    where: {
      organizationId,
      sourceType: PROGRAM_SOURCE,
      sourceId: { in: instances.map((i) => i.id) },
    },
    select: { sourceId: true, notificationType: true, scheduledFor: true },
  });
  const seen = new Set(
    existing.map(
      (e) => `${e.sourceId}|${e.notificationType}|${e.scheduledFor.toISOString().slice(0, 10)}`,
    ),
  );

  const dateFormat = (await getDocumentPresentation(organizationId)).dateFormat;
  const nowTs = new Date();
  const rows: Array<{
    organizationId: string;
    userId: string;
    sourceType: string;
    sourceId: string;
    notificationType: string;
    scheduledFor: Date;
    title: string;
    message: string;
    payload: Prisma.InputJsonValue;
    deliveredAt: Date;
  }> = [];

  for (const inst of instances) {
    summary.scanned += 1;
    if (TERMINAL_TASK_STATUSES.has(taskStatus.get(inst.taskId!) ?? '')) {
      summary.skippedCompleted += 1;
      continue;
    }
    const dueIso = inst.dueAt!.toISOString().slice(0, 10);
    const plans = planProgramNotifications(dueIso, inst.notifyBeforeDays, now);
    for (const plan of plans) {
      const key = `${inst.id}|${plan.type}|${plan.scheduledFor}`;
      if (seen.has(key)) {
        summary.skippedExisting += 1;
        continue;
      }
      seen.add(key);
      const dueText = formatIsoDate(dueIso, dateFormat) ?? dueIso;
      rows.push({
        organizationId,
        userId: inst.responsibleUserId!,
        sourceType: PROGRAM_SOURCE,
        sourceId: inst.id,
        notificationType: plan.type,
        scheduledFor: new Date(`${plan.scheduledFor}T00:00:00.000Z`),
        title: titleFor(plan.type),
        message: messageFor(plan.type, inst.activityName, dueText),
        payload: {
          documentId: inst.documentId,
          documentVersionId: inst.documentVersionId,
          activityId: inst.activityId,
          instanceId: inst.id,
          taskId: inst.taskId,
        },
        // §11: sin worker/canal externo, se marca entregada al crearse.
        deliveredAt: nowTs,
      });
    }
  }

  if (rows.length) {
    await withOrgContext(organizationId, async (tx) => {
      // skipDuplicates protege contra carreras contra el índice único (dedup DB §3).
      const res = await tx.notificationDelivery.createMany({ data: rows, skipDuplicates: true });
      summary.created += res.count;
    });
  }
  return summary;
}

export interface NotificationRow {
  id: string;
  sourceType: string;
  sourceId: string;
  notificationType: string;
  title: string;
  message: string;
  payload: unknown;
  createdAt: string;
  readAt: string | null;
}

/** Notificaciones del usuario (no leídas primero, recientes). Solo suyas (§13/§20). */
export async function listNotificationsForUser(
  organizationId: string,
  userId: string,
  options: { limit?: number; unreadOnly?: boolean } = {},
): Promise<NotificationRow[]> {
  const rows = await getPrisma().notificationDelivery.findMany({
    where: {
      organizationId,
      userId,
      ...(options.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: [{ readAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
    take: Math.min(Math.max(options.limit ?? 20, 1), 100),
    select: {
      id: true,
      sourceType: true,
      sourceId: true,
      notificationType: true,
      title: true,
      message: true,
      payload: true,
      createdAt: true,
      readAt: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    readAt: r.readAt ? r.readAt.toISOString() : null,
  }));
}

/** Cuenta de no leídas del usuario (para el badge de la barra superior, futuro). */
export async function countUnreadNotifications(
  organizationId: string,
  userId: string,
): Promise<number> {
  return getPrisma().notificationDelivery.count({
    where: { organizationId, userId, readAt: null },
  });
}

export class NotificationNotFoundError extends Error {
  constructor() {
    super('Notificación no encontrada.');
    this.name = 'NotificationNotFoundError';
  }
}

/** Marca como leída una notificación PROPIA del usuario (§12/§20). */
export async function markNotificationRead(
  organizationId: string,
  userId: string,
  notificationId: string,
): Promise<void> {
  const found = await getPrisma().notificationDelivery.findFirst({
    where: { id: notificationId, organizationId, userId },
    select: { id: true },
  });
  if (!found) throw new NotificationNotFoundError();
  await withOrgContext(organizationId, async (tx) => {
    await tx.notificationDelivery.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  });
}
