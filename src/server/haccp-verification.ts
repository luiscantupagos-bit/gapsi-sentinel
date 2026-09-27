/**
 * HACCP-006 — servidor de VERIFICACIÓN. Reutiliza el motor de recurrencia de Programas
 * (`generateOccurrences`), la Task nativa (`createTask`, idempotente por origen), los Records
 * (DOC-004) y el Gantt existentes. NO crea un segundo scheduler. Una definición version-owned →
 * ocurrencias (histórico por identidad lógica) → Task → Record → resultado técnico. Publicado =
 * inmutable. Aislamiento por organización (RLS + withOrgContext).
 */
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';
import { isVersionEditable } from '@/features/haccp/haccp-state';
import { generateOccurrences, type ProgramBlock } from '@/features/documents/program-execution';
import { addMonthsIso } from '@/features/documents/dates';
import {
  definitionToActivity,
  resultRequiresConclusion,
  isOccurrenceOverdue,
  verificationCompleteness,
  validateDefinition,
  type VerificationResult,
} from '@/features/haccp/haccp-verification';
import {
  HaccpNotFoundError,
  HaccpValidationError,
  activeVersion,
  memberDirectory,
  requireAdmin,
  requireEditableVersion,
  type Tx,
} from './haccp';
import { getControlMeasures } from './haccp-control';
import { createTask } from './tasks';
import { createRecord } from './records';

const iso = (d: Date | null | undefined): string | null =>
  d ? d.toISOString().slice(0, 10) : null;

// --- CRUD de definiciones ----------------------------------------------------
export interface VerificationDefinitionInput {
  scopeType: string;
  controlMeasureLogicalId?: string | null;
  hazardLogicalId?: string | null;
  processStepId?: string | null;
  title: string;
  purpose?: string | null;
  method?: string | null;
  responsibleUserId?: string | null;
  responsibleRole?: string | null;
  frequencyType: string;
  interval?: number | null;
  endDate?: string | null;
  recordStrategy?: string | null;
  requiredDocumentId?: string | null;
  requiredDocumentVersionId?: string | null;
  evidenceRequired?: boolean;
  startAt?: string | null;
  notifyBeforeDays?: number | null;
}

export async function saveVerificationDefinition(
  organizationId: string,
  userId: string,
  planVersionId: string,
  input: VerificationDefinitionInput,
  definitionId?: string,
): Promise<string> {
  await requireAdmin(organizationId, userId);
  await requireEditableVersion(organizationId, planVersionId);
  const errors = validateDefinition(input);
  if (errors.length) throw new HaccpValidationError(errors);

  const frequencyConfig = {
    interval: input.interval ?? 1,
    endDate: input.endDate ?? null,
  } as unknown as Prisma.InputJsonValue;
  const data = {
    scopeType: input.scopeType,
    controlMeasureLogicalId: input.controlMeasureLogicalId ?? null,
    hazardLogicalId: input.hazardLogicalId ?? null,
    processStepId: input.processStepId ?? null,
    title: input.title.trim(),
    purpose: input.purpose ?? null,
    method: input.method ?? null,
    responsibleUserId: input.responsibleUserId ?? null,
    responsibleRole: input.responsibleRole ?? null,
    frequencyType: input.frequencyType,
    frequencyConfig,
    recordStrategy: input.recordStrategy ?? 'none',
    requiredDocumentId: input.requiredDocumentId ?? null,
    requiredDocumentVersionId: input.requiredDocumentVersionId ?? null,
    evidenceRequired: Boolean(input.evidenceRequired),
    startAt: input.startAt ? new Date(`${input.startAt}T00:00:00.000Z`) : null,
    notifyBeforeDays: input.notifyBeforeDays ?? 7,
  };

  return withOrgContext(organizationId, async (tx) => {
    if (definitionId) {
      const existing = await tx.haccpVerificationDefinition.findFirst({
        where: { id: definitionId, organizationId, planVersionId },
        select: { id: true },
      });
      if (!existing) throw new HaccpNotFoundError();
      await tx.haccpVerificationDefinition.update({ where: { id: definitionId }, data });
      return definitionId;
    }
    const created = await tx.haccpVerificationDefinition.create({
      data: {
        organizationId,
        planVersionId,
        verificationLogicalId: randomUUID(),
        createdBy: userId,
        ...data,
      },
      select: { id: true },
    });
    return created.id;
  });
}

export async function setVerificationDefinitionStatus(
  organizationId: string,
  userId: string,
  definitionId: string,
  status: string,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const def = await getPrisma().haccpVerificationDefinition.findFirst({
    where: { id: definitionId, organizationId },
  });
  if (!def) throw new HaccpNotFoundError();
  await requireEditableVersion(organizationId, def.planVersionId);
  if (!['active', 'paused', 'archived'].includes(status))
    throw new HaccpValidationError(['Estado de definición inválido.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.haccpVerificationDefinition.update({ where: { id: definitionId }, data: { status } });
  });
}

export async function removeVerificationDefinition(
  organizationId: string,
  userId: string,
  definitionId: string,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const def = await getPrisma().haccpVerificationDefinition.findFirst({
    where: { id: definitionId, organizationId },
  });
  if (!def) throw new HaccpNotFoundError();
  await requireEditableVersion(organizationId, def.planVersionId);
  await withOrgContext(organizationId, async (tx) => {
    await tx.haccpVerificationDefinition.delete({ where: { id: definitionId } });
  });
}

// --- Materialización de ocurrencias (reutiliza el motor de recurrencia) -------
/**
 * Genera/actualiza las ocurrencias de las definiciones ACTIVAS de la versión vigente del plan y
 * materializa cada una como Task nativa (idempotente por origen). Reejecutar NO duplica (§12/§41):
 * las ocurrencias son idempotentes por (org, verification_logical_id, occurrence_key) y la Task
 * por (org, source_type, source_id). Como solo se materializa la versión VIGENTE, una v1 sustituida
 * por v2 deja de generar nuevas verificaciones (§40) sin tocar el histórico.
 */
export async function materializeVerificationSchedule(
  organizationId: string,
  userId: string,
  planId: string,
): Promise<{ occurrences: number; tasks: number }> {
  await requireAdmin(organizationId, userId);
  const version = await activeVersion(organizationId, planId);
  if (!version) throw new HaccpNotFoundError();
  const defs = await getPrisma().haccpVerificationDefinition.findMany({
    where: { organizationId, planVersionId: version.id, status: 'active' },
  });
  const today = new Date().toISOString().slice(0, 10);
  let occCount = 0;
  let taskCount = 0;

  for (const def of defs) {
    const cfg = (def.frequencyConfig ?? {}) as {
      interval?: number | null;
      endDate?: string | null;
    };
    const startAt = iso(def.startAt) ?? today;
    const activity = definitionToActivity({
      verificationLogicalId: def.verificationLogicalId,
      title: def.title,
      purpose: def.purpose,
      responsibleUserId: def.responsibleUserId,
      frequencyType: def.frequencyType,
      startAt,
      frequencyConfig: cfg,
      evidenceRequired: def.evidenceRequired,
      notifyBeforeDays: def.notifyBeforeDays,
    });
    // Horizonte por defecto: 12 meses desde el inicio si no hay endDate (evita generación infinita).
    const periodEnd = cfg.endDate ?? addMonthsIso(startAt, 12) ?? startAt;
    const block: ProgramBlock = { periodStart: startAt, periodEnd, activities: [activity] };
    const occs = generateOccurrences(activity, block);

    for (const occ of occs) {
      // Upsert idempotente de la ocurrencia.
      const existing = await getPrisma().haccpVerificationOccurrence.findFirst({
        where: {
          organizationId,
          verificationLogicalId: def.verificationLogicalId,
          occurrenceKey: occ.occurrenceKey,
        },
      });
      let occurrenceId = existing?.id;
      if (!existing) {
        const created = await withOrgContext(organizationId, (tx) =>
          tx.haccpVerificationOccurrence.create({
            data: {
              organizationId,
              planId,
              verificationLogicalId: def.verificationLogicalId,
              occurrenceKey: occ.occurrenceKey,
              title: def.title,
              plannedStart: occ.plannedStart ? new Date(`${occ.plannedStart}T00:00:00.000Z`) : null,
              dueAt: occ.dueAt ? new Date(`${occ.dueAt}T00:00:00.000Z`) : null,
              responsibleUserId: def.responsibleUserId,
            },
            select: { id: true },
          }),
        );
        occurrenceId = created.id;
        occCount += 1;
      }
      // Materializa la Task nativa (idempotente por origen).
      if (occurrenceId && !existing?.taskId) {
        const taskId = await createTask(organizationId, userId, {
          title: `Verificación: ${def.title} — ${occ.dueAt}`,
          description: def.purpose ?? null,
          taskType: 'follow_up',
          origin: 'other',
          responsibleUserId: def.responsibleUserId,
          targetDate: occ.dueAt,
          startDate: occ.plannedStart ?? undefined,
          sourceType: 'haccp_verification',
          sourceId: occurrenceId,
        }).catch(() => null); // si ya existe la tarea del origen, no duplica
        if (taskId) {
          taskCount += 1;
          await withOrgContext(organizationId, (tx) =>
            tx.haccpVerificationOccurrence.update({
              where: { id: occurrenceId },
              data: { taskId },
            }),
          );
        }
      }
    }
  }
  return { occurrences: occCount, tasks: taskCount };
}

// --- Ejecución: crear registro y capturar resultado --------------------------
async function loadOccurrence(organizationId: string, occurrenceId: string) {
  const occ = await getPrisma().haccpVerificationOccurrence.findFirst({
    where: { id: occurrenceId, organizationId },
  });
  if (!occ) throw new HaccpNotFoundError();
  return occ;
}

/** Crea (o devuelve) el Record de la ocurrencia según la estrategia de versión del formato. */
export async function createVerificationRecord(
  organizationId: string,
  userId: string,
  occurrenceId: string,
): Promise<string> {
  await requireAdmin(organizationId, userId);
  const occ = await loadOccurrence(organizationId, occurrenceId);
  if (occ.recordId) return occ.recordId;
  const def = await getPrisma().haccpVerificationDefinition.findFirst({
    where: { organizationId, verificationLogicalId: occ.verificationLogicalId },
    orderBy: { createdAt: 'desc' },
  });
  if (!def || !def.requiredDocumentId || def.recordStrategy === 'none')
    throw new HaccpValidationError(['Esta verificación no tiene un formato configurado.']);
  // §10.2 pinned: usa la versión fija; §10.1 latest: la publicada vigente al ejecutar.
  const pinnedVersionId =
    def.recordStrategy === 'pinned_version' ? (def.requiredDocumentVersionId ?? null) : null;

  const recordId = await createRecord(organizationId, userId, {
    documentId: def.requiredDocumentId,
    documentVersionId: pinnedVersionId,
    sourceType: 'haccp_verification',
    sourceId: occurrenceId,
    clientGeneratedId: occurrenceId, // idempotencia determinista por ocurrencia (§12)
    assignedToUserId: occ.responsibleUserId,
  });
  const version = await getPrisma().recordInstance.findFirst({
    where: { id: recordId, organizationId },
    select: { documentVersionId: true },
  });
  await withOrgContext(organizationId, (tx) =>
    tx.haccpVerificationOccurrence.update({
      where: { id: occurrenceId },
      data: { recordId, recordDocumentVersionId: version?.documentVersionId ?? null },
    }),
  );
  return recordId;
}

/**
 * Captura el resultado técnico de la verificación y la cierra (§16/§17/§19). La conclusión es
 * obligatoria para no conforme / no concluyente. Si hay Record requerido, no permite cerrar con
 * el Record en borrador (§19). Marca la ocurrencia completada.
 */
export async function recordVerificationResult(
  organizationId: string,
  userId: string,
  occurrenceId: string,
  input: { result: string; conclusion?: string | null },
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const occ = await loadOccurrence(organizationId, occurrenceId);
  if (!['conforme', 'no_conforme', 'no_concluyente'].includes(input.result))
    throw new HaccpValidationError(['Resultado inválido.']);
  if (resultRequiresConclusion(input.result) && !input.conclusion?.trim())
    throw new HaccpValidationError([
      'La conclusión es obligatoria para un resultado no conforme o no concluyente.',
    ]);
  // §19: si hay Record requerido, debe estar al menos enviado (no en borrador).
  if (occ.recordId) {
    const rec = await getPrisma().recordInstance.findFirst({
      where: { id: occ.recordId, organizationId },
      select: { status: true },
    });
    if (rec && (rec.status === 'draft' || rec.status === 'in_progress'))
      throw new HaccpValidationError([
        'El registro de la verificación debe enviarse antes de cerrar.',
      ]);
  }
  await withOrgContext(organizationId, (tx) =>
    tx.haccpVerificationOccurrence.update({
      where: { id: occurrenceId },
      data: {
        result: input.result as VerificationResult,
        conclusion: input.conclusion ?? null,
        completedAt: new Date(),
        closedBy: userId,
      },
    }),
  );
}

// --- Lectura para el workspace ----------------------------------------------
export async function getVerifications(organizationId: string, planId: string) {
  const version = await activeVersion(organizationId, planId);
  if (!version) return null;
  const [defs, occurrences, members, control] = await Promise.all([
    getPrisma().haccpVerificationDefinition.findMany({
      where: { organizationId, planVersionId: version.id },
      orderBy: { createdAt: 'asc' },
    }),
    getPrisma().haccpVerificationOccurrence.findMany({
      where: { organizationId, planId, status: 'scheduled' },
      orderBy: { dueAt: 'asc' },
    }),
    memberDirectory(organizationId),
    getControlMeasures(organizationId, planId),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const nameOf = (id: string | null) => (id ? (members.get(id) ?? null) : null);

  // Contexto de control por logical id (PCC/PPRO), para mostrar límite/criterio (§27).
  const controlByLogical = new Map(
    (control?.assessments ?? []).map((a) => [a.controlMeasureLogicalId, a]),
  );

  const definitions = defs.map((d) => {
    const ctrl = d.controlMeasureLogicalId ? controlByLogical.get(d.controlMeasureLogicalId) : null;
    const cfg = (d.frequencyConfig ?? {}) as { interval?: number; endDate?: string };
    return {
      id: d.id,
      verificationLogicalId: d.verificationLogicalId,
      scopeType: d.scopeType,
      title: d.title,
      purpose: d.purpose,
      method: d.method,
      status: d.status,
      frequencyType: d.frequencyType,
      interval: cfg.interval ?? 1,
      responsibleName: nameOf(d.responsibleUserId) ?? d.responsibleRole,
      recordStrategy: d.recordStrategy,
      requiredDocumentId: d.requiredDocumentId,
      evidenceRequired: d.evidenceRequired,
      startAtLabel: iso(d.startAt),
      controlMeasureLogicalId: d.controlMeasureLogicalId,
      controlContext: ctrl
        ? {
            classification: ctrl.classification,
            classificationLabel: ctrl.classificationLabel,
            hazardName: ctrl.hazardName,
            controlMeasure: ctrl.plan?.controlMeasure ?? null,
            criticalLimit: ctrl.plan?.criticalLimit ?? null,
            actionCriterion: ctrl.plan?.actionCriterion ?? null,
            needsReview: ctrl.needsReview,
          }
        : null,
    };
  });

  const occ = occurrences.map((o) => ({
    id: o.id,
    verificationLogicalId: o.verificationLogicalId,
    title: o.title,
    dueAtLabel: iso(o.dueAt),
    plannedStartLabel: iso(o.plannedStart),
    responsibleName: nameOf(o.responsibleUserId),
    taskId: o.taskId,
    recordId: o.recordId,
    result: o.result,
    conclusion: o.conclusion,
    completedAtLabel: iso(o.completedAt),
    overdue: isOccurrenceOverdue(iso(o.dueAt), iso(o.completedAt), today),
    completed: Boolean(o.completedAt),
  }));

  const activeDefs = defs.filter((d) => d.status === 'active');
  const completeness = verificationCompleteness({
    activeDefinitions: activeDefs.length,
    withoutResponsible: activeDefs.filter((d) => !d.responsibleUserId && !d.responsibleRole).length,
    withoutFrequency: activeDefs.filter((d) => !d.frequencyType).length,
    requiredFormatMissing: activeDefs.filter(
      (d) => d.recordStrategy !== 'none' && !d.requiredDocumentId,
    ).length,
    overdue: occ.filter((o) => o.overdue).length,
    nonConforming: occ.filter((o) => o.result === 'no_conforme').length,
  });

  // Filas para el Gantt reutilizable.
  const ganttRows = occ
    .filter((o) => o.dueAtLabel)
    .map((o) => ({
      id: o.id,
      kind: 'task' as const,
      name: `${o.title} · ${o.dueAtLabel}`,
      href: o.taskId ? `/dashboard/tasks/${o.taskId}` : null,
      start: o.plannedStartLabel ?? o.dueAtLabel,
      end: o.dueAtLabel,
      progress: o.completed ? 100 : 0,
      status: o.completed ? 'completed' : o.overdue ? 'overdue' : 'pending',
      overdue: o.overdue,
    }));

  return {
    version: {
      id: version.id,
      versionLabel: version.versionLabel,
      status: version.status,
      editable: isVersionEditable(version.status),
    },
    definitions,
    occurrences: occ,
    completeness,
    ganttRows,
    // Controles PCC/PPRO para poblar el formulario de creación (§4/§27).
    controls: [...(control?.pcc ?? []), ...(control?.ppro ?? [])].map((a) => ({
      controlMeasureLogicalId: a.controlMeasureLogicalId,
      hazardLogicalId: a.hazardLogicalId,
      classification: a.classification,
      classificationLabel: a.classificationLabel,
      hazardName: a.hazardName,
      needsReview: a.needsReview,
    })),
  };
}

/** HACCP-006 §37 — clona las definiciones de verificación a la nueva versión (identidad lógica). */
export async function cloneVerificationDefinitions(
  tx: Tx,
  organizationId: string,
  fromVersionId: string,
  toVersionId: string,
): Promise<void> {
  const defs = await tx.haccpVerificationDefinition.findMany({
    where: { organizationId, planVersionId: fromVersionId },
  });
  for (const d of defs) {
    await tx.haccpVerificationDefinition.create({
      data: {
        organizationId,
        planVersionId: toVersionId,
        verificationLogicalId: d.verificationLogicalId, // identidad lógica estable (§37)
        scopeType: d.scopeType,
        controlMeasureLogicalId: d.controlMeasureLogicalId,
        hazardLogicalId: d.hazardLogicalId,
        processStepId: d.processStepId,
        title: d.title,
        purpose: d.purpose,
        method: d.method,
        responsibleUserId: d.responsibleUserId,
        responsibleRole: d.responsibleRole,
        frequencyType: d.frequencyType,
        frequencyConfig: (d.frequencyConfig ?? undefined) as Prisma.InputJsonValue | undefined,
        recordStrategy: d.recordStrategy,
        requiredDocumentId: d.requiredDocumentId,
        requiredDocumentVersionId: d.requiredDocumentVersionId,
        evidenceRequired: d.evidenceRequired,
        status: d.status,
        startAt: d.startAt,
        notifyBeforeDays: d.notifyBeforeDays,
        createdBy: d.createdBy,
      },
    });
  }
}
