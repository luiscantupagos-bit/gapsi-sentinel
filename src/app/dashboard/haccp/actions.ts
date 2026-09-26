'use server';

/**
 * HACCP-001 — Server Actions. Organización/usuario desde la sesión; permisos y validación
 * en la capa de datos (src/server/haccp.ts).
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  HaccpNotFoundError,
  HaccpPermissionError,
  HaccpValidationError,
  addSourceReference,
  addTeamMember,
  createHaccpPlan,
  createHaccpVersion,
  publishHaccpVersion,
  removeSourceReference,
  removeTeamMember,
  updateHaccpPlan,
  updateSourceToLatest,
} from '@/server/haccp';
import {
  addConnection,
  addProcessStep,
  moveProcessStep,
  removeConnection,
  removeProcessStep,
  setFlowVerification,
  updateProcessStep,
} from '@/server/haccp-flow';
import { addHazard, removeHazard, saveRiskMatrix, updateHazard } from '@/server/haccp-hazards';
import { DEFAULT_RISK_MATRIX } from '@/features/haccp/haccp-hazards';
import { removeAssessment, saveAssessment, saveControlPlan } from '@/server/haccp-control';
import { removeValidation, saveValidation } from '@/server/haccp-validation';
import type { HaccpReferenceKind } from '@/features/haccp/haccp-state';
import type { VersionBump } from '@/features/documents/versioning';

export interface FormState {
  ok: boolean;
  message: string;
  errors?: string[];
}

function toState(error: unknown): FormState {
  if (error instanceof HaccpValidationError)
    return { ok: false, message: 'Revisa los datos.', errors: error.errors };
  if (error instanceof HaccpPermissionError) return { ok: false, message: error.message };
  if (error instanceof HaccpNotFoundError) return { ok: false, message: error.message };
  return { ok: false, message: 'Ocurrió un error al procesar la solicitud.' };
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const opt = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v === '' ? undefined : v;
};

function revalidatePlan(planId: string) {
  revalidatePath(`/dashboard/haccp/${planId}`);
  revalidatePath('/dashboard/haccp');
}

export async function createPlanAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  let planId: string;
  try {
    planId = await createHaccpPlan(session.organizationId, session.userId, {
      title: s(fd, 'title'),
      description: opt(fd, 'description') ?? null,
      scope: opt(fd, 'scope') ?? null,
      productProcess: opt(fd, 'productProcess') ?? null,
      siteId: opt(fd, 'siteId') ?? null,
      responsibleUserId: opt(fd, 'responsibleUserId') ?? null,
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePath('/dashboard/haccp');
  redirect(`/dashboard/haccp/${planId}`);
}

export async function updatePlanAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await updateHaccpPlan(session.organizationId, session.userId, planId, {
      title: opt(fd, 'title'),
      description: opt(fd, 'description') ?? null,
      scope: opt(fd, 'scope') ?? null,
      productProcess: opt(fd, 'productProcess') ?? null,
      siteId: fd.get('siteId') === null ? undefined : (opt(fd, 'siteId') ?? null),
      responsibleUserId:
        fd.get('responsibleUserId') === null ? undefined : (opt(fd, 'responsibleUserId') ?? null),
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Plan actualizado.' };
}

export async function publishPlanAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await publishHaccpVersion(session.organizationId, session.userId, planId);
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Plan HACCP publicado.' };
}

export async function newVersionAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await createHaccpVersion(
      session.organizationId,
      session.userId,
      planId,
      (s(fd, 'bump') === 'major' ? 'major' : 'minor') as VersionBump,
      opt(fd, 'changeNotes') ?? null,
    );
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Nueva versión creada.' };
}

export async function addTeamMemberAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await addTeamMember(session.organizationId, session.userId, s(fd, 'planVersionId'), {
      userId: opt(fd, 'userId') ?? null,
      externalName: opt(fd, 'externalName') ?? null,
      area: opt(fd, 'area') ?? null,
      jobTitle: opt(fd, 'jobTitle') ?? null,
      haccpRole: opt(fd, 'haccpRole') ?? null,
      responsibility: opt(fd, 'responsibility') ?? null,
      trainingSummary: opt(fd, 'trainingSummary') ?? null,
      isLeader: fd.get('isLeader') === 'on' || fd.get('isLeader') === 'true',
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Integrante agregado.' };
}

export async function removeTeamMemberAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await removeTeamMember(session.organizationId, session.userId, s(fd, 'memberId'));
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Integrante eliminado.' };
}

export async function addSourceAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await addSourceReference(session.organizationId, session.userId, s(fd, 'planVersionId'), {
      referenceKind: s(fd, 'referenceKind') as HaccpReferenceKind,
      sourceDocumentId: s(fd, 'sourceDocumentId'),
      category: opt(fd, 'category') ?? null,
      notes: opt(fd, 'notes') ?? null,
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Fuente agregada.' };
}

export async function removeSourceAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await removeSourceReference(session.organizationId, session.userId, s(fd, 'referenceId'));
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Fuente eliminada.' };
}

export async function updateSourceToLatestAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await updateSourceToLatest(session.organizationId, session.userId, s(fd, 'referenceId'));
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Fuente actualizada a la versión más reciente.' };
}

// --- HACCP-002: diagrama de flujo -------------------------------------------

export async function addStepAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await addProcessStep(session.organizationId, session.userId, s(fd, 'planVersionId'), {
      name: s(fd, 'name'),
      stepType: opt(fd, 'stepType'),
      description: opt(fd, 'description') ?? null,
      area: opt(fd, 'area') ?? null,
      responsibleUserId: opt(fd, 'responsibleUserId') ?? null,
      responsibleRole: opt(fd, 'responsibleRole') ?? null,
      equipment: opt(fd, 'equipment') ?? null,
      inputs: opt(fd, 'inputs') ?? null,
      outputs: opt(fd, 'outputs') ?? null,
      parameters: opt(fd, 'parameters') ?? null,
      notes: opt(fd, 'notes') ?? null,
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Etapa agregada.' };
}

export async function updateStepAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await updateProcessStep(session.organizationId, session.userId, s(fd, 'stepId'), {
      name: opt(fd, 'name'),
      stepType: opt(fd, 'stepType'),
      description: opt(fd, 'description') ?? null,
      area: opt(fd, 'area') ?? null,
      responsibleUserId: opt(fd, 'responsibleUserId') ?? null,
      responsibleRole: opt(fd, 'responsibleRole') ?? null,
      equipment: opt(fd, 'equipment') ?? null,
      inputs: opt(fd, 'inputs') ?? null,
      outputs: opt(fd, 'outputs') ?? null,
      parameters: opt(fd, 'parameters') ?? null,
      notes: opt(fd, 'notes') ?? null,
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Etapa actualizada.' };
}

export async function removeStepAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await removeProcessStep(session.organizationId, session.userId, s(fd, 'stepId'));
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Etapa eliminada.' };
}

export async function moveStepAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await moveProcessStep(
      session.organizationId,
      session.userId,
      s(fd, 'stepId'),
      s(fd, 'direction') === 'up' ? 'up' : 'down',
    );
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Etapa reordenada.' };
}

export async function addConnectionAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await addConnection(session.organizationId, session.userId, s(fd, 'planVersionId'), {
      fromProcessStepId: s(fd, 'fromProcessStepId'),
      toProcessStepId: s(fd, 'toProcessStepId'),
      connectionType: opt(fd, 'connectionType'),
      label: opt(fd, 'label') ?? null,
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Conexión agregada.' };
}

export async function removeConnectionAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await removeConnection(session.organizationId, session.userId, s(fd, 'connectionId'));
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Conexión eliminada.' };
}

export async function verifyFlowAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  const verified = fd.get('verified') === 'true' || fd.get('verified') === 'on';
  try {
    await setFlowVerification(
      session.organizationId,
      session.userId,
      s(fd, 'planVersionId'),
      verified,
      opt(fd, 'notes') ?? null,
    );
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: verified ? 'Flujo verificado en planta.' : 'Verificación retirada.' };
}

// --- HACCP-003: análisis de peligros ----------------------------------------

const num = (fd: FormData, k: string, dflt: number) => {
  const n = Number(s(fd, k));
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : dflt;
};

export async function addHazardAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  const override = opt(fd, 'overrideSignificant');
  try {
    await addHazard(session.organizationId, session.userId, s(fd, 'planVersionId'), {
      sourceType: s(fd, 'sourceType') === 'material' ? 'material' : 'process_step',
      sourceReferenceId: opt(fd, 'sourceReferenceId') ?? null,
      processStepId: opt(fd, 'processStepId') ?? null,
      hazardType: s(fd, 'hazardType'),
      name: s(fd, 'name'),
      description: opt(fd, 'description') ?? null,
      originOrCause: opt(fd, 'originOrCause') ?? null,
      probability: num(fd, 'probability', 1),
      severity: num(fd, 'severity', 1),
      existingControlMeasure: opt(fd, 'existingControlMeasure') ?? null,
      overrideSignificant: override === undefined ? null : override === 'yes',
      significanceReason: opt(fd, 'significanceReason') ?? null,
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Peligro agregado.' };
}

export async function updateHazardAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  const override = opt(fd, 'overrideSignificant');
  try {
    await updateHazard(session.organizationId, session.userId, s(fd, 'hazardId'), {
      hazardType: opt(fd, 'hazardType'),
      name: opt(fd, 'name'),
      description: opt(fd, 'description') ?? null,
      originOrCause: opt(fd, 'originOrCause') ?? null,
      probability: num(fd, 'probability', 1),
      severity: num(fd, 'severity', 1),
      existingControlMeasure: opt(fd, 'existingControlMeasure') ?? null,
      overrideSignificant: override === undefined ? undefined : override === 'yes',
      significanceReason: opt(fd, 'significanceReason') ?? null,
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Peligro actualizado.' };
}

export async function removeHazardAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await removeHazard(session.organizationId, session.userId, s(fd, 'hazardId'));
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Peligro eliminado.' };
}

const LEVELS = 5;
function scaleFrom(fd: FormData, prefix: string, defaults: { value: number; label: string }[]) {
  return Array.from({ length: LEVELS }, (_, i) => {
    const value = i + 1;
    const label = opt(fd, `${prefix}_${value}`) ?? defaults[i]?.label ?? String(value);
    return { value, label };
  });
}

export async function saveRiskMatrixAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await saveRiskMatrix(session.organizationId, session.userId, s(fd, 'planVersionId'), {
      probabilityScale: scaleFrom(fd, 'prob', DEFAULT_RISK_MATRIX.probabilityScale),
      severityScale: scaleFrom(fd, 'sev', DEFAULT_RISK_MATRIX.severityScale),
      scoreFormula: s(fd, 'scoreFormula') === 'sum' ? 'sum' : 'multiply',
      significanceThreshold: num(
        fd,
        'significanceThreshold',
        DEFAULT_RISK_MATRIX.significanceThreshold,
      ),
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Criterios de riesgo guardados.' };
}

// --- HACCP-004: selección de medidas de control -----------------------------

export async function saveAssessmentAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  // Respuestas: campos answer_<questionId> = yes|no|na.
  const answers: { questionId: string; answer: 'yes' | 'no' | 'na' }[] = [];
  for (const [k, v] of fd.entries()) {
    if (k.startsWith('answer_') && (v === 'yes' || v === 'no' || v === 'na')) {
      answers.push({ questionId: k.slice('answer_'.length), answer: v });
    }
  }
  const override = opt(fd, 'overrideClassification');
  try {
    await saveAssessment(session.organizationId, session.userId, s(fd, 'planVersionId'), {
      hazardLogicalId: s(fd, 'hazardLogicalId'),
      answers,
      overrideClassification: (override ?? null) as
        | 'ppr'
        | 'ppro'
        | 'pcc'
        | 'other'
        | 'review_required'
        | null,
      overrideReason: opt(fd, 'overrideReason') ?? null,
      justification: opt(fd, 'justification') ?? null,
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Evaluación guardada.' };
}

export async function removeAssessmentAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await removeAssessment(session.organizationId, session.userId, s(fd, 'assessmentId'));
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Evaluación eliminada.' };
}

export async function saveControlPlanAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await saveControlPlan(session.organizationId, session.userId, s(fd, 'assessmentId'), {
      controlMeasure: opt(fd, 'controlMeasure') ?? null,
      justification: opt(fd, 'justification') ?? null,
      criticalLimit: opt(fd, 'criticalLimit') ?? null,
      actionCriterion: opt(fd, 'actionCriterion') ?? null,
      monitoringWhat: opt(fd, 'monitoringWhat') ?? null,
      monitoringHow: opt(fd, 'monitoringHow') ?? null,
      monitoringWho: opt(fd, 'monitoringWho') ?? null,
      monitoringWhen: opt(fd, 'monitoringWhen') ?? null,
      correction: opt(fd, 'correction') ?? null,
      correctiveAction: opt(fd, 'correctiveAction') ?? null,
      recordReference: opt(fd, 'recordReference') ?? null,
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Plan de control guardado.' };
}

// --- HACCP-005: validación de medidas de control ----------------------------

export async function saveValidationAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await saveValidation(session.organizationId, session.userId, s(fd, 'planVersionId'), {
      controlMeasureLogicalId: s(fd, 'controlMeasureLogicalId'),
      objective: opt(fd, 'objective') ?? null,
      scope: opt(fd, 'scope') ?? null,
      methodType: opt(fd, 'methodType') ?? null,
      methodDescription: opt(fd, 'methodDescription') ?? null,
      evidenceSummary: opt(fd, 'evidenceSummary') ?? null,
      technicalBasis: opt(fd, 'technicalBasis') ?? null,
      acceptanceCriteria: opt(fd, 'acceptanceCriteria') ?? null,
      conclusion: opt(fd, 'conclusion') ?? null,
      evidenceDocumentId: opt(fd, 'evidenceDocumentId') ?? null,
      performedAt: opt(fd, 'performedAt') ?? null,
      performedByUserId: opt(fd, 'performedByUserId') ?? null,
      performedByExternalName: opt(fd, 'performedByExternalName') ?? null,
      reviewedByUserId: opt(fd, 'reviewedByUserId') ?? null,
      nextValidationAt: opt(fd, 'nextValidationAt') ?? null,
      result: opt(fd, 'result') ?? null,
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Validación guardada.' };
}

export async function removeValidationAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const planId = s(fd, 'planId');
  try {
    await removeValidation(session.organizationId, session.userId, s(fd, 'validationId'));
  } catch (e) {
    return toState(e);
  }
  revalidatePlan(planId);
  return { ok: true, message: 'Validación eliminada.' };
}
