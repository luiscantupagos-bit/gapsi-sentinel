/**
 * HACCP-002 — servidor del diagrama de flujo (etapas y conexiones, version-owned). Cada etapa
 * tiene identidad LÓGICA estable (`process_step_id`) que sobrevive al clon de versión. Editar el
 * flujo en un borrador reinicia la verificación in situ (§E20). Publicado = inmutable.
 */
import { randomUUID } from 'node:crypto';
import { getPrisma, withOrgContext } from './db';
import { isVersionEditable } from '@/features/haccp/haccp-state';
import {
  HaccpNotFoundError,
  HaccpValidationError,
  activeVersion,
  memberDirectory,
  requireAdmin,
  requireEditableVersion,
  type Tx,
} from './haccp';

/** §E20: cualquier edición del flujo en un borrador reinicia la verificación in situ. */
async function resetFlowVerification(tx: Tx, planVersionId: string): Promise<void> {
  await tx.haccpPlanVersion.update({
    where: { id: planVersionId },
    data: { flowVerifiedOnSite: false, flowVerifiedAt: null, flowVerifiedBy: null },
  });
}

/** Etapas + conexiones de la versión activa del plan, para render/edición. */
export async function getPlanFlow(organizationId: string, planId: string) {
  const version = await activeVersion(organizationId, planId);
  if (!version) return { version: null, steps: [], connections: [] };
  const [steps, connections, names] = await Promise.all([
    getPrisma().haccpProcessStep.findMany({
      where: { organizationId, planVersionId: version.id },
      orderBy: { sequence: 'asc' },
    }),
    getPrisma().haccpProcessConnection.findMany({
      where: { organizationId, planVersionId: version.id },
      orderBy: { sequence: 'asc' },
    }),
    memberDirectory(organizationId),
  ]);
  const nameOf = (id: string | null | undefined) => (id ? (names.get(id) ?? null) : null);
  return {
    version: {
      id: version.id,
      versionLabel: version.versionLabel,
      status: version.status,
      editable: isVersionEditable(version.status),
      flowVerifiedOnSite: version.flowVerifiedOnSite,
      flowVerifiedAtLabel: version.flowVerifiedAt
        ? version.flowVerifiedAt.toISOString().slice(0, 10)
        : null,
      flowVerifiedByName: nameOf(version.flowVerifiedBy),
      flowVerificationNotes: version.flowVerificationNotes,
    },
    steps: steps.map((s) => ({
      id: s.id,
      processStepId: s.processStepId,
      stepType: s.stepType,
      name: s.name,
      description: s.description,
      sequence: s.sequence,
      area: s.area,
      responsibleName: nameOf(s.responsibleUserId),
      responsibleRole: s.responsibleRole,
      equipment: s.equipment,
      inputs: s.inputs,
      outputs: s.outputs,
      parameters: s.parameters,
      notes: s.notes,
    })),
    connections: connections.map((c) => ({
      id: c.id,
      fromStepId: c.fromStepId,
      toStepId: c.toStepId,
      connectionType: c.connectionType,
      label: c.label,
      sequence: c.sequence,
    })),
  };
}

export interface ProcessStepInput {
  name: string;
  stepType?: string;
  description?: string | null;
  area?: string | null;
  responsibleUserId?: string | null;
  responsibleRole?: string | null;
  equipment?: string | null;
  inputs?: string | null;
  outputs?: string | null;
  parameters?: string | null;
  notes?: string | null;
}

export async function addProcessStep(
  organizationId: string,
  userId: string,
  planVersionId: string,
  input: ProcessStepInput,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  await requireEditableVersion(organizationId, planVersionId);
  if (!input.name?.trim())
    throw new HaccpValidationError(['El nombre de la etapa es obligatorio.']);
  await withOrgContext(organizationId, async (tx) => {
    const max = await tx.haccpProcessStep.aggregate({
      where: { organizationId, planVersionId },
      _max: { sequence: true },
    });
    await tx.haccpProcessStep.create({
      data: {
        organizationId,
        planVersionId,
        processStepId: randomUUID(), // identidad lógica nueva (§E23)
        stepType: input.stepType ?? 'process',
        name: input.name.trim(),
        description: input.description ?? null,
        area: input.area ?? null,
        responsibleUserId: input.responsibleUserId ?? null,
        responsibleRole: input.responsibleRole ?? null,
        equipment: input.equipment ?? null,
        inputs: input.inputs ?? null,
        outputs: input.outputs ?? null,
        parameters: input.parameters ?? null,
        notes: input.notes ?? null,
        sequence: (max._max.sequence ?? 0) + 1,
      },
    });
    await resetFlowVerification(tx, planVersionId);
  });
}

async function loadStep(organizationId: string, stepId: string) {
  const s = await getPrisma().haccpProcessStep.findFirst({ where: { id: stepId, organizationId } });
  if (!s) throw new HaccpNotFoundError();
  return s;
}

export async function updateProcessStep(
  organizationId: string,
  userId: string,
  stepId: string,
  input: Partial<ProcessStepInput>,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const step = await loadStep(organizationId, stepId);
  await requireEditableVersion(organizationId, step.planVersionId);
  await withOrgContext(organizationId, async (tx) => {
    await tx.haccpProcessStep.update({
      where: { id: stepId },
      data: {
        name: input.name?.trim() ?? step.name,
        stepType: input.stepType ?? step.stepType,
        description: input.description === undefined ? step.description : input.description,
        area: input.area === undefined ? step.area : input.area,
        responsibleUserId:
          input.responsibleUserId === undefined ? step.responsibleUserId : input.responsibleUserId,
        responsibleRole:
          input.responsibleRole === undefined ? step.responsibleRole : input.responsibleRole,
        equipment: input.equipment === undefined ? step.equipment : input.equipment,
        inputs: input.inputs === undefined ? step.inputs : input.inputs,
        outputs: input.outputs === undefined ? step.outputs : input.outputs,
        parameters: input.parameters === undefined ? step.parameters : input.parameters,
        notes: input.notes === undefined ? step.notes : input.notes,
      },
    });
    await resetFlowVerification(tx, step.planVersionId);
  });
}

export async function removeProcessStep(
  organizationId: string,
  userId: string,
  stepId: string,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const step = await loadStep(organizationId, stepId);
  await requireEditableVersion(organizationId, step.planVersionId);
  await withOrgContext(organizationId, async (tx) => {
    await tx.haccpProcessConnection.deleteMany({
      where: {
        organizationId,
        planVersionId: step.planVersionId,
        OR: [{ fromStepId: step.processStepId }, { toStepId: step.processStepId }],
      },
    });
    await tx.haccpProcessStep.delete({ where: { id: stepId } });
    await resetFlowVerification(tx, step.planVersionId);
  });
}

/** Reordena una etapa arriba/abajo intercambiando `sequence` con su vecina (accesible §E12). */
export async function moveProcessStep(
  organizationId: string,
  userId: string,
  stepId: string,
  direction: 'up' | 'down',
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const step = await loadStep(organizationId, stepId);
  await requireEditableVersion(organizationId, step.planVersionId);
  await withOrgContext(organizationId, async (tx) => {
    const neighbor = await tx.haccpProcessStep.findFirst({
      where: {
        organizationId,
        planVersionId: step.planVersionId,
        sequence: direction === 'up' ? { lt: step.sequence } : { gt: step.sequence },
      },
      orderBy: { sequence: direction === 'up' ? 'desc' : 'asc' },
    });
    if (!neighbor) return;
    await tx.haccpProcessStep.update({
      where: { id: step.id },
      data: { sequence: neighbor.sequence },
    });
    await tx.haccpProcessStep.update({
      where: { id: neighbor.id },
      data: { sequence: step.sequence },
    });
  });
}

export interface ConnectionInput {
  fromProcessStepId: string;
  toProcessStepId: string;
  connectionType?: string;
  label?: string | null;
}

export async function addConnection(
  organizationId: string,
  userId: string,
  planVersionId: string,
  input: ConnectionInput,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  await requireEditableVersion(organizationId, planVersionId);
  if (input.fromProcessStepId === input.toProcessStepId)
    throw new HaccpValidationError(['Una etapa no puede conectarse consigo misma.']);
  const steps = await getPrisma().haccpProcessStep.findMany({
    where: {
      organizationId,
      planVersionId,
      processStepId: { in: [input.fromProcessStepId, input.toProcessStepId] },
    },
    select: { processStepId: true },
  });
  if (steps.length !== 2)
    throw new HaccpValidationError(['Las etapas a conectar deben pertenecer a esta versión.']);
  await withOrgContext(organizationId, async (tx) => {
    const dup = await tx.haccpProcessConnection.findFirst({
      where: {
        organizationId,
        planVersionId,
        fromStepId: input.fromProcessStepId,
        toStepId: input.toProcessStepId,
      },
    });
    if (dup) throw new HaccpValidationError(['La conexión ya existe.']);
    const max = await tx.haccpProcessConnection.aggregate({
      where: { organizationId, planVersionId },
      _max: { sequence: true },
    });
    await tx.haccpProcessConnection.create({
      data: {
        organizationId,
        planVersionId,
        fromStepId: input.fromProcessStepId,
        toStepId: input.toProcessStepId,
        connectionType: input.connectionType ?? 'sequence',
        label: input.label ?? null,
        sequence: (max._max.sequence ?? 0) + 1,
      },
    });
    await resetFlowVerification(tx, planVersionId);
  });
}

export async function removeConnection(
  organizationId: string,
  userId: string,
  connectionId: string,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const c = await getPrisma().haccpProcessConnection.findFirst({
    where: { id: connectionId, organizationId },
  });
  if (!c) throw new HaccpNotFoundError();
  await requireEditableVersion(organizationId, c.planVersionId);
  await withOrgContext(organizationId, async (tx) => {
    await tx.haccpProcessConnection.delete({ where: { id: connectionId } });
    await resetFlowVerification(tx, c.planVersionId);
  });
}

/** §E18/§E19: marca el flujo como verificado en planta (o retira la verificación). */
export async function setFlowVerification(
  organizationId: string,
  userId: string,
  planVersionId: string,
  verified: boolean,
  notes?: string | null,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  await requireEditableVersion(organizationId, planVersionId);
  await withOrgContext(organizationId, async (tx) => {
    await tx.haccpPlanVersion.update({
      where: { id: planVersionId },
      data: {
        flowVerifiedOnSite: verified,
        flowVerifiedAt: verified ? new Date() : null,
        flowVerifiedBy: verified ? userId : null,
        flowVerificationNotes: notes ?? null,
      },
    });
  });
}
