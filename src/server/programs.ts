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
  type ProgramBlock,
} from '@/features/documents/program-execution';
import { createTask } from './tasks';

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
