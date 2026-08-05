'use server';

/**
 * Server Actions del módulo CAPA (TASK-007). Organización y usuario desde la
 * sesión; permisos validados en la capa de datos.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { UnsupportedFileError } from '@/server/document-storage';
import {
  CapaNotFoundError,
  CapaPermissionError,
  CapaValidationError,
  addAction,
  addComment,
  addEffectivenessReview,
  addFile,
  addImmediateAction,
  closeCapa,
  createCapa,
  reopenCapa,
  saveRootCause,
  transitionCapa,
  updateAction,
  updateCapa,
  updateImmediateAction,
} from '@/server/capa';
import type {
  ActionStatus,
  ActionType,
  CapaEvidenceType,
  CapaPriority,
  CapaScope,
  CapaSeverity,
  CapaSourceType,
  CapaStatus,
  EffectivenessResult,
  ImmediateActionStatus,
  ImmediateActionType,
  RcaMethod,
} from '@/features/capa/capa-state';

export interface FormState {
  ok: boolean;
  message: string;
  errors?: string[];
}

function toState(error: unknown): FormState {
  if (error instanceof CapaValidationError)
    return { ok: false, message: 'Revisa los datos.', errors: error.errors };
  if (error instanceof CapaPermissionError) return { ok: false, message: error.message };
  if (error instanceof CapaNotFoundError) return { ok: false, message: error.message };
  if (error instanceof UnsupportedFileError) return { ok: false, message: error.message };
  return { ok: false, message: 'Ocurrió un error al procesar la solicitud.' };
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const opt = (fd: FormData, k: string): string | null => {
  const v = s(fd, k);
  return v === '' ? null : v;
};

function revalidateCapa(capaId: string) {
  revalidatePath(`/dashboard/capa/${capaId}`);
  revalidatePath('/dashboard/capa');
  revalidatePath('/dashboard/capa/tasks');
  revalidatePath('/dashboard');
}

/** Campos comunes de creación/edición desde el formulario. */
function readCapaInput(fd: FormData) {
  return {
    title: s(fd, 'title'),
    description: s(fd, 'description'),
    sourceType: s(fd, 'sourceType') as CapaSourceType,
    siteId: opt(fd, 'siteId'),
    area: opt(fd, 'area'),
    process: opt(fd, 'process'),
    product: opt(fd, 'product'),
    diagnosticId: opt(fd, 'diagnosticId'),
    documentId: opt(fd, 'documentId'),
    requirementId: opt(fd, 'requirementId'),
    findingId: opt(fd, 'findingId'),
    externalReference: opt(fd, 'externalReference'),
    detectedAt: opt(fd, 'detectedAt'),
    responsibleUserId: opt(fd, 'responsibleUserId'),
    priority: s(fd, 'priority') as CapaPriority,
    severity: s(fd, 'severity') as CapaSeverity,
    scope: s(fd, 'scope') as CapaScope,
    impacts: fd.getAll('impacts').map(String),
    tags: s(fd, 'tags')
      ? s(fd, 'tags')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    targetDate: opt(fd, 'targetDate'),
    problemWhat: opt(fd, 'problemWhat'),
    problemWhere: opt(fd, 'problemWhere'),
    problemWhen: opt(fd, 'problemWhen'),
    problemWhoDetect: opt(fd, 'problemWhoDetect'),
    problemWhoAffect: opt(fd, 'problemWhoAffect'),
    problemHowMuch: opt(fd, 'problemHowMuch'),
    problemHow: opt(fd, 'problemHow'),
    conditionObserved: opt(fd, 'conditionObserved'),
    requirementBreached: opt(fd, 'requirementBreached'),
    objectiveEvidence: opt(fd, 'objectiveEvidence'),
    knownScope: opt(fd, 'knownScope'),
    knownRecurrence: opt(fd, 'knownRecurrence'),
    relatedRefs: opt(fd, 'relatedRefs'),
  };
}

export async function createCapaAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  let capaId: string;
  try {
    capaId = await createCapa(session.organizationId, session.userId, readCapaInput(fd));
  } catch (e) {
    return toState(e);
  }
  revalidatePath('/dashboard/capa');
  redirect(`/dashboard/capa/${capaId}`);
}

export async function updateCapaAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  try {
    await updateCapa(session.organizationId, session.userId, capaId, readCapaInput(fd));
  } catch (e) {
    return toState(e);
  }
  revalidateCapa(capaId);
  redirect(`/dashboard/capa/${capaId}`);
}

export async function transitionAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  try {
    await transitionCapa(
      session.organizationId,
      session.userId,
      capaId,
      s(fd, 'to') as CapaStatus,
      {
        justification: opt(fd, 'justification') ?? undefined,
        reason: opt(fd, 'reason') ?? undefined,
      },
    );
  } catch (e) {
    return toState(e);
  }
  revalidateCapa(capaId);
  return { ok: true, message: 'Estado actualizado.' };
}

export async function addImmediateActionAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  try {
    await addImmediateAction(session.organizationId, session.userId, capaId, {
      actionType: s(fd, 'actionType') as ImmediateActionType,
      description: s(fd, 'description'),
      responsibleUserId: opt(fd, 'responsibleUserId'),
      committedAt: opt(fd, 'committedAt'),
      executedAt: opt(fd, 'executedAt'),
      status: (opt(fd, 'status') as ImmediateActionStatus) ?? undefined,
      result: opt(fd, 'result'),
      estimatedCost: opt(fd, 'estimatedCost'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidateCapa(capaId);
  return { ok: true, message: 'Acción inmediata registrada.' };
}

export async function updateImmediateActionAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  try {
    await updateImmediateAction(session.organizationId, session.userId, s(fd, 'actionId'), {
      status: (opt(fd, 'status') as ImmediateActionStatus) ?? undefined,
      executedAt: opt(fd, 'executedAt'),
      result: opt(fd, 'result'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidateCapa(capaId);
  return { ok: true, message: 'Acción inmediata actualizada.' };
}

export async function saveRootCauseAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const whys = [1, 2, 3, 4, 5]
    .map((n) => ({ level: n, question: opt(fd, `whyQ${n}`), answer: s(fd, `why${n}`) }))
    .filter((w) => w.answer !== '');
  try {
    await saveRootCause(session.organizationId, session.userId, capaId, {
      method: s(fd, 'method') as RcaMethod,
      immediateCause: opt(fd, 'immediateCause'),
      contributingCause: opt(fd, 'contributingCause'),
      rootCause: opt(fd, 'rootCause'),
      justification: opt(fd, 'justification'),
      investigatorUserId: opt(fd, 'investigatorUserId'),
      conclude: fd.get('conclude') === 'on' || fd.get('conclude') === 'true',
      whys,
    });
  } catch (e) {
    return toState(e);
  }
  revalidateCapa(capaId);
  return { ok: true, message: 'Análisis de causa guardado.' };
}

export async function addActionAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  try {
    await addAction(session.organizationId, session.userId, capaId, {
      actionType: s(fd, 'actionType') as ActionType,
      description: s(fd, 'description'),
      responsibleUserId: opt(fd, 'responsibleUserId'),
      startDate: opt(fd, 'startDate'),
      dueDate: opt(fd, 'dueDate'),
      priority: (opt(fd, 'priority') as CapaPriority) ?? undefined,
      documentId: opt(fd, 'documentId'),
      docChangeRequest: opt(fd, 'docChangeRequest'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidateCapa(capaId);
  return { ok: true, message: 'Acción agregada al plan.' };
}

export async function updateActionAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const progressRaw = s(fd, 'progress');
  try {
    await updateAction(session.organizationId, session.userId, s(fd, 'actionId'), {
      status: (opt(fd, 'status') as ActionStatus) ?? undefined,
      progress: progressRaw ? Number(progressRaw) : undefined,
      result: opt(fd, 'result'),
      comment: opt(fd, 'comment'),
      dueDate: opt(fd, 'dueDate'),
      responsibleUserId: opt(fd, 'responsibleUserId'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidateCapa(capaId);
  return { ok: true, message: 'Acción actualizada.' };
}

export async function addEffectivenessAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  try {
    await addEffectivenessReview(session.organizationId, session.userId, capaId, {
      criterion: s(fd, 'criterion'),
      method: opt(fd, 'method'),
      plannedAt: opt(fd, 'plannedAt'),
      executedAt: opt(fd, 'executedAt'),
      verifierUserId: opt(fd, 'verifierUserId'),
      followUpPeriod: opt(fd, 'followUpPeriod'),
      observedResult: opt(fd, 'observedResult'),
      conclusion: s(fd, 'conclusion') as EffectivenessResult,
      comment: opt(fd, 'comment'),
      requiresNewAction: fd.get('requiresNewAction') === 'on',
      requiresReopen: fd.get('requiresReopen') === 'on',
    });
  } catch (e) {
    return toState(e);
  }
  revalidateCapa(capaId);
  return { ok: true, message: 'Verificación de eficacia registrada.' };
}

export async function closeCapaAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  try {
    await closeCapa(session.organizationId, session.userId, capaId, { summary: s(fd, 'summary') });
  } catch (e) {
    return toState(e);
  }
  revalidateCapa(capaId);
  return { ok: true, message: 'CAPA cerrada.' };
}

export async function reopenCapaAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  try {
    await reopenCapa(session.organizationId, session.userId, capaId, {
      reason: s(fd, 'reason'),
      target: s(fd, 'target') as CapaStatus,
      responsibleUserId: s(fd, 'responsibleUserId'),
      targetDate: s(fd, 'targetDate'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidateCapa(capaId);
  return { ok: true, message: 'CAPA reabierta.' };
}

export async function addCommentAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  try {
    await addComment(session.organizationId, session.userId, capaId, s(fd, 'body'));
  } catch (e) {
    return toState(e);
  }
  revalidateCapa(capaId);
  return { ok: true, message: 'Comentario agregado.' };
}

export async function uploadEvidenceAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const f = fd.get('file');
  if (!(f instanceof File) || f.size === 0) return { ok: false, message: 'Selecciona un archivo.' };
  try {
    await addFile(session.organizationId, session.userId, capaId, {
      evidenceType: s(fd, 'evidenceType') as CapaEvidenceType,
      originalName: f.name,
      mimeType: f.type || 'application/octet-stream',
      data: Buffer.from(await f.arrayBuffer()),
    });
  } catch (e) {
    return toState(e);
  }
  revalidateCapa(capaId);
  return { ok: true, message: 'Evidencia adjuntada.' };
}
