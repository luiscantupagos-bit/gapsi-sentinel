/**
 * HACCP-PROCESS-EXPANSION — servidor del modelo de proceso enriquecido: entradas, salidas y
 * destinos por etapa (version-owned, identidad LÓGICA estable). Enriquece HaccpProcessStep /
 * HaccpProcessConnection sin sustituirlos. Un destino interno (`next_process_step`) sincroniza
 * una conexión gráfica (§E1). Editar entradas/salidas/destinos reinicia la verificación in situ
 * (§Q5). Publicado = inmutable. Aislamiento por organización (RLS + withOrgContext).
 */
import { randomUUID } from 'node:crypto';
import { getPrisma, withOrgContext } from './db';
import { isVersionEditable } from '@/features/haccp/haccp-state';
import {
  destinationIsInternalStep,
  inputSourceIsStep,
  type ProcessModelSnapshot,
} from '@/features/haccp/haccp-process';
import {
  HaccpNotFoundError,
  HaccpValidationError,
  activeVersion,
  memberDirectory,
  requireAdmin,
  requireEditableVersion,
  type Tx,
} from './haccp';

/** §Q5: cualquier edición de entradas/salidas/destinos reinicia la verificación in situ. */
async function resetFlowVerification(tx: Tx, planVersionId: string): Promise<void> {
  await tx.haccpPlanVersion.update({
    where: { id: planVersionId },
    data: { flowVerifiedOnSite: false, flowVerifiedAt: null, flowVerifiedBy: null },
  });
}

// --- Lectura del modelo de proceso -------------------------------------------
export interface ProcessDestinationView {
  id: string;
  destinationLogicalId: string;
  destinationType: string;
  destinationProcessStepId: string | null;
  destinationStepName: string | null;
  destinationExternalText: string | null;
  label: string | null;
}
export interface ProcessOutputView {
  id: string;
  outputLogicalId: string;
  name: string;
  outputType: string;
  conditionStatus: string | null;
  description: string | null;
  notes: string | null;
  destinations: ProcessDestinationView[];
}
export interface ProcessInputView {
  id: string;
  inputLogicalId: string;
  name: string;
  inputType: string;
  sourceType: string;
  sourceProcessStepId: string | null;
  sourceStepName: string | null;
  sourceReferenceId: string | null;
  supplierName: string | null;
  externalSource: string | null;
  description: string | null;
  notes: string | null;
}
export interface ProcessStepView {
  id: string;
  processStepId: string;
  name: string;
  stepType: string;
  sequence: number;
  area: string | null;
  responsibleName: string | null;
  responsibleRole: string | null;
  equipment: string | null;
  description: string | null;
  parameters: string | null;
  notes: string | null;
  inputs: ProcessInputView[];
  outputs: ProcessOutputView[];
}

/** Modelo de proceso completo de la versión activa: etapas con sus entradas/salidas/destinos. */
export async function getProcessModel(organizationId: string, planId: string) {
  const version = await activeVersion(organizationId, planId);
  if (!version) return null;
  const [steps, inputs, outputs, destinations, members] = await Promise.all([
    getPrisma().haccpProcessStep.findMany({
      where: { organizationId, planVersionId: version.id },
      orderBy: { sequence: 'asc' },
    }),
    getPrisma().haccpProcessInput.findMany({
      where: { organizationId, planVersionId: version.id },
      orderBy: { sortOrder: 'asc' },
    }),
    getPrisma().haccpProcessOutput.findMany({
      where: { organizationId, planVersionId: version.id },
      orderBy: { sortOrder: 'asc' },
    }),
    getPrisma().haccpProcessOutputDestination.findMany({
      where: { organizationId, planVersionId: version.id },
      orderBy: { sortOrder: 'asc' },
    }),
    memberDirectory(organizationId),
  ]);

  const stepNameByLogical = new Map(steps.map((s) => [s.processStepId, s.name]));
  const destByOutput = new Map<string, ProcessDestinationView[]>();
  for (const d of destinations) {
    const list = destByOutput.get(d.outputLogicalId) ?? [];
    list.push({
      id: d.id,
      destinationLogicalId: d.destinationLogicalId,
      destinationType: d.destinationType,
      destinationProcessStepId: d.destinationProcessStepId,
      destinationStepName: d.destinationProcessStepId
        ? (stepNameByLogical.get(d.destinationProcessStepId) ?? null)
        : null,
      destinationExternalText: d.destinationExternalText,
      label: d.label,
    });
    destByOutput.set(d.outputLogicalId, list);
  }

  const inputsByStep = new Map<string, ProcessInputView[]>();
  for (const i of inputs) {
    const list = inputsByStep.get(i.processStepId) ?? [];
    list.push({
      id: i.id,
      inputLogicalId: i.inputLogicalId,
      name: i.name,
      inputType: i.inputType,
      sourceType: i.sourceType,
      sourceProcessStepId: i.sourceProcessStepId,
      sourceStepName: i.sourceProcessStepId
        ? (stepNameByLogical.get(i.sourceProcessStepId) ?? null)
        : null,
      sourceReferenceId: i.sourceReferenceId,
      supplierName: i.supplierName,
      externalSource: i.externalSource,
      description: i.description,
      notes: i.notes,
    });
    inputsByStep.set(i.processStepId, list);
  }

  const outputsByStep = new Map<string, ProcessOutputView[]>();
  for (const o of outputs) {
    const list = outputsByStep.get(o.processStepId) ?? [];
    list.push({
      id: o.id,
      outputLogicalId: o.outputLogicalId,
      name: o.name,
      outputType: o.outputType,
      conditionStatus: o.conditionStatus,
      description: o.description,
      notes: o.notes,
      destinations: destByOutput.get(o.outputLogicalId) ?? [],
    });
    outputsByStep.set(o.processStepId, list);
  }

  const nameOf = (id: string | null | undefined) => (id ? (members.get(id) ?? null) : null);
  return {
    version: {
      id: version.id,
      versionLabel: version.versionLabel,
      status: version.status,
      editable: isVersionEditable(version.status),
    },
    steps: steps.map<ProcessStepView>((s) => ({
      id: s.id,
      processStepId: s.processStepId,
      name: s.name,
      stepType: s.stepType,
      sequence: s.sequence,
      area: s.area,
      responsibleName: nameOf(s.responsibleUserId),
      responsibleRole: s.responsibleRole,
      equipment: s.equipment,
      description: s.description,
      parameters: s.parameters,
      notes: s.notes,
      inputs: inputsByStep.get(s.processStepId) ?? [],
      outputs: outputsByStep.get(s.processStepId) ?? [],
    })),
  };
}

/** Snapshot para detección de cambio del modelo (§Q4). */
export async function processModelSnapshot(
  tx: Tx,
  organizationId: string,
  planVersionId: string,
): Promise<ProcessModelSnapshot> {
  const [steps, connections, inputs, outputs, destinations] = await Promise.all([
    tx.haccpProcessStep.findMany({ where: { organizationId, planVersionId } }),
    tx.haccpProcessConnection.findMany({ where: { organizationId, planVersionId } }),
    tx.haccpProcessInput.findMany({ where: { organizationId, planVersionId } }),
    tx.haccpProcessOutput.findMany({ where: { organizationId, planVersionId } }),
    tx.haccpProcessOutputDestination.findMany({ where: { organizationId, planVersionId } }),
  ]);
  return {
    steps: steps.map((s) => ({
      processStepId: s.processStepId,
      name: s.name,
      stepType: s.stepType,
      sequence: s.sequence,
    })),
    connections: connections.map((c) => ({
      fromStepId: c.fromStepId,
      toStepId: c.toStepId,
      connectionType: c.connectionType,
    })),
    inputs: inputs.map((i) => ({
      inputLogicalId: i.inputLogicalId,
      processStepId: i.processStepId,
      name: i.name,
      inputType: i.inputType,
    })),
    outputs: outputs.map((o) => ({
      outputLogicalId: o.outputLogicalId,
      processStepId: o.processStepId,
      name: o.name,
      outputType: o.outputType,
    })),
    destinations: destinations.map((d) => ({
      outputLogicalId: d.outputLogicalId,
      destinationType: d.destinationType,
      destinationProcessStepId: d.destinationProcessStepId,
      destinationExternalText: d.destinationExternalText,
    })),
  };
}

// --- Utilidades de edición ---------------------------------------------------
async function loadEditableStep(organizationId: string, stepId: string) {
  const step = await getPrisma().haccpProcessStep.findFirst({
    where: { id: stepId, organizationId },
  });
  if (!step) throw new HaccpNotFoundError();
  await requireEditableVersion(organizationId, step.planVersionId);
  return step;
}

// --- ENTRADAS ----------------------------------------------------------------
export interface ProcessInputInput {
  name: string;
  inputType: string;
  sourceType?: string;
  sourceProcessStepId?: string | null;
  sourceReferenceId?: string | null;
  supplierName?: string | null;
  externalSource?: string | null;
  description?: string | null;
  notes?: string | null;
}

export async function addProcessInput(
  organizationId: string,
  userId: string,
  stepId: string,
  input: ProcessInputInput,
): Promise<string> {
  await requireAdmin(organizationId, userId);
  const step = await loadEditableStep(organizationId, stepId);
  if (!input.name?.trim())
    throw new HaccpValidationError(['El nombre de la entrada es obligatorio.']);
  return withOrgContext(organizationId, async (tx) => {
    const max = await tx.haccpProcessInput.aggregate({
      where: {
        organizationId,
        planVersionId: step.planVersionId,
        processStepId: step.processStepId,
      },
      _max: { sortOrder: true },
    });
    const created = await tx.haccpProcessInput.create({
      data: {
        organizationId,
        planVersionId: step.planVersionId,
        processStepId: step.processStepId,
        inputLogicalId: randomUUID(), // identidad lógica nueva (§Q1)
        name: input.name.trim(),
        inputType: input.inputType,
        sourceType: input.sourceType ?? 'supplier',
        sourceProcessStepId: inputSourceIsStep(input.sourceType)
          ? (input.sourceProcessStepId ?? null)
          : null,
        sourceReferenceId: input.sourceReferenceId ?? null,
        supplierName: input.supplierName ?? null,
        externalSource: input.externalSource ?? null,
        description: input.description ?? null,
        notes: input.notes ?? null,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
      select: { id: true },
    });
    await resetFlowVerification(tx, step.planVersionId);
    return created.id;
  });
}

export async function updateProcessInput(
  organizationId: string,
  userId: string,
  inputId: string,
  patch: Partial<ProcessInputInput>,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const row = await getPrisma().haccpProcessInput.findFirst({
    where: { id: inputId, organizationId },
  });
  if (!row) throw new HaccpNotFoundError();
  await requireEditableVersion(organizationId, row.planVersionId);
  const sourceType = patch.sourceType ?? row.sourceType;
  await withOrgContext(organizationId, async (tx) => {
    await tx.haccpProcessInput.update({
      where: { id: inputId },
      data: {
        name: patch.name?.trim() ?? row.name,
        inputType: patch.inputType ?? row.inputType,
        sourceType,
        sourceProcessStepId: inputSourceIsStep(sourceType)
          ? patch.sourceProcessStepId === undefined
            ? row.sourceProcessStepId
            : patch.sourceProcessStepId
          : null,
        sourceReferenceId:
          patch.sourceReferenceId === undefined ? row.sourceReferenceId : patch.sourceReferenceId,
        supplierName: patch.supplierName === undefined ? row.supplierName : patch.supplierName,
        externalSource:
          patch.externalSource === undefined ? row.externalSource : patch.externalSource,
        description: patch.description === undefined ? row.description : patch.description,
        notes: patch.notes === undefined ? row.notes : patch.notes,
      },
    });
    await resetFlowVerification(tx, row.planVersionId);
  });
}

export async function removeProcessInput(
  organizationId: string,
  userId: string,
  inputId: string,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const row = await getPrisma().haccpProcessInput.findFirst({
    where: { id: inputId, organizationId },
  });
  if (!row) throw new HaccpNotFoundError();
  await requireEditableVersion(organizationId, row.planVersionId);
  await withOrgContext(organizationId, async (tx) => {
    await tx.haccpProcessInput.delete({ where: { id: inputId } });
    await resetFlowVerification(tx, row.planVersionId);
  });
}

// --- SALIDAS -----------------------------------------------------------------
export interface ProcessOutputInput {
  name: string;
  outputType: string;
  conditionStatus?: string | null;
  description?: string | null;
  notes?: string | null;
}

export async function addProcessOutput(
  organizationId: string,
  userId: string,
  stepId: string,
  input: ProcessOutputInput,
): Promise<string> {
  await requireAdmin(organizationId, userId);
  const step = await loadEditableStep(organizationId, stepId);
  if (!input.name?.trim())
    throw new HaccpValidationError(['El nombre de la salida es obligatorio.']);
  return withOrgContext(organizationId, async (tx) => {
    const max = await tx.haccpProcessOutput.aggregate({
      where: {
        organizationId,
        planVersionId: step.planVersionId,
        processStepId: step.processStepId,
      },
      _max: { sortOrder: true },
    });
    const created = await tx.haccpProcessOutput.create({
      data: {
        organizationId,
        planVersionId: step.planVersionId,
        processStepId: step.processStepId,
        outputLogicalId: randomUUID(), // identidad lógica nueva (§Q2)
        name: input.name.trim(),
        outputType: input.outputType,
        conditionStatus: input.conditionStatus ?? null,
        description: input.description ?? null,
        notes: input.notes ?? null,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
      select: { id: true },
    });
    await resetFlowVerification(tx, step.planVersionId);
    return created.id;
  });
}

export async function updateProcessOutput(
  organizationId: string,
  userId: string,
  outputId: string,
  patch: Partial<ProcessOutputInput>,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const row = await getPrisma().haccpProcessOutput.findFirst({
    where: { id: outputId, organizationId },
  });
  if (!row) throw new HaccpNotFoundError();
  await requireEditableVersion(organizationId, row.planVersionId);
  await withOrgContext(organizationId, async (tx) => {
    await tx.haccpProcessOutput.update({
      where: { id: outputId },
      data: {
        name: patch.name?.trim() ?? row.name,
        outputType: patch.outputType ?? row.outputType,
        conditionStatus:
          patch.conditionStatus === undefined ? row.conditionStatus : patch.conditionStatus,
        description: patch.description === undefined ? row.description : patch.description,
        notes: patch.notes === undefined ? row.notes : patch.notes,
      },
    });
    await resetFlowVerification(tx, row.planVersionId);
  });
}

export async function removeProcessOutput(
  organizationId: string,
  userId: string,
  outputId: string,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const row = await getPrisma().haccpProcessOutput.findFirst({
    where: { id: outputId, organizationId },
  });
  if (!row) throw new HaccpNotFoundError();
  await requireEditableVersion(organizationId, row.planVersionId);
  await withOrgContext(organizationId, async (tx) => {
    // Los destinos se borran por CASCADE (FK a la salida).
    await tx.haccpProcessOutput.delete({ where: { id: outputId } });
    await resetFlowVerification(tx, row.planVersionId);
  });
}

// --- DESTINOS ----------------------------------------------------------------
export interface ProcessDestinationInput {
  destinationType: string;
  destinationProcessStepId?: string | null;
  destinationExternalText?: string | null;
  destinationSourceReferenceId?: string | null;
  label?: string | null;
}

/**
 * §E1: sincroniza una conexión gráfica cuando el destino es interno (`next_process_step`). Crea
 * la conexión si no existe (aditivo; no elimina conexiones manuales). La salida define el destino
 * semántico; la conexión es la arista.
 */
async function ensureConnectionForDestination(
  tx: Tx,
  organizationId: string,
  planVersionId: string,
  fromStepId: string,
  toStepId: string,
  label: string | null,
): Promise<void> {
  if (fromStepId === toStepId) return;
  const dup = await tx.haccpProcessConnection.findFirst({
    where: { organizationId, planVersionId, fromStepId, toStepId },
  });
  if (dup) return;
  const max = await tx.haccpProcessConnection.aggregate({
    where: { organizationId, planVersionId },
    _max: { sequence: true },
  });
  await tx.haccpProcessConnection.create({
    data: {
      organizationId,
      planVersionId,
      fromStepId,
      toStepId,
      connectionType: 'sequence',
      label,
      sequence: (max._max.sequence ?? 0) + 1,
    },
  });
}

export async function addProcessDestination(
  organizationId: string,
  userId: string,
  outputId: string,
  input: ProcessDestinationInput,
): Promise<string> {
  await requireAdmin(organizationId, userId);
  const output = await getPrisma().haccpProcessOutput.findFirst({
    where: { id: outputId, organizationId },
  });
  if (!output) throw new HaccpNotFoundError();
  await requireEditableVersion(organizationId, output.planVersionId);
  if (destinationIsInternalStep(input.destinationType) && !input.destinationProcessStepId)
    throw new HaccpValidationError(['Un destino interno requiere la etapa siguiente.']);

  return withOrgContext(organizationId, async (tx) => {
    const max = await tx.haccpProcessOutputDestination.aggregate({
      where: {
        organizationId,
        planVersionId: output.planVersionId,
        outputLogicalId: output.outputLogicalId,
      },
      _max: { sortOrder: true },
    });
    const created = await tx.haccpProcessOutputDestination.create({
      data: {
        organizationId,
        planVersionId: output.planVersionId,
        outputLogicalId: output.outputLogicalId,
        destinationLogicalId: randomUUID(),
        destinationType: input.destinationType,
        destinationProcessStepId: destinationIsInternalStep(input.destinationType)
          ? (input.destinationProcessStepId ?? null)
          : null,
        destinationExternalText: destinationIsInternalStep(input.destinationType)
          ? null
          : (input.destinationExternalText ?? null),
        destinationSourceReferenceId: input.destinationSourceReferenceId ?? null,
        label: input.label ?? null,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
      select: { id: true },
    });
    // §E1: sincroniza la arista gráfica para destinos internos.
    if (destinationIsInternalStep(input.destinationType) && input.destinationProcessStepId) {
      await ensureConnectionForDestination(
        tx,
        organizationId,
        output.planVersionId,
        output.processStepId,
        input.destinationProcessStepId,
        input.label ?? output.name,
      );
    }
    await resetFlowVerification(tx, output.planVersionId);
    return created.id;
  });
}

export async function removeProcessDestination(
  organizationId: string,
  userId: string,
  destinationId: string,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const row = await getPrisma().haccpProcessOutputDestination.findFirst({
    where: { id: destinationId, organizationId },
  });
  if (!row) throw new HaccpNotFoundError();
  await requireEditableVersion(organizationId, row.planVersionId);
  await withOrgContext(organizationId, async (tx) => {
    await tx.haccpProcessOutputDestination.delete({ where: { id: destinationId } });
    await resetFlowVerification(tx, row.planVersionId);
  });
}
