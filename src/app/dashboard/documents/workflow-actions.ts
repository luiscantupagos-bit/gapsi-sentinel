'use server';

/**
 * Server Actions del control documental (TASK-006). Organización y usuario desde
 * la sesión; permisos validados en la capa de datos.
 */
import { revalidatePath } from 'next/cache';
import { requireServerSession } from '@/server/session';
import { DocumentNotFoundError } from '@/server/documents';
import {
  WorkflowPermissionError,
  WorkflowValidationError,
  acknowledgeRead,
  addComment,
  approvalDecision,
  assignWorkflow,
  distributeDocument,
  obsoleteVersion,
  publishVersion,
  registerControlledCopy,
  reviewDecision,
  submitForReview,
  updateControlledCopy,
} from '@/server/document-workflow';

export interface FormState {
  ok: boolean;
  message: string;
  errors?: string[];
}

function toState(error: unknown): FormState {
  if (error instanceof WorkflowValidationError)
    return { ok: false, message: 'Revisa los datos.', errors: error.errors };
  if (error instanceof WorkflowPermissionError) return { ok: false, message: error.message };
  if (error instanceof DocumentNotFoundError) return { ok: false, message: error.message };
  return { ok: false, message: 'Ocurrió un error al procesar la solicitud.' };
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const opt = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v === '' ? undefined : v;
};

function revalidateDoc(documentId: string) {
  revalidatePath(`/dashboard/documents/${documentId}`);
  revalidatePath('/dashboard/documents/tasks');
  revalidatePath('/dashboard');
}

export async function assignWorkflowAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const documentId = s(fd, 'documentId');
  try {
    await assignWorkflow(session.organizationId, session.userId, s(fd, 'versionId'), {
      reviewers: fd.getAll('reviewers').map(String).filter(Boolean),
      approvers: fd.getAll('approvers').map(String).filter(Boolean),
      reviewerDueAt: opt(fd, 'reviewerDueAt') ?? null,
      approverDueAt: opt(fd, 'approverDueAt') ?? null,
    });
  } catch (e) {
    return toState(e);
  }
  revalidateDoc(documentId);
  return { ok: true, message: 'Flujo asignado.' };
}

export async function submitReviewAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const documentId = s(fd, 'documentId');
  try {
    await submitForReview(session.organizationId, session.userId, s(fd, 'versionId'));
  } catch (e) {
    return toState(e);
  }
  revalidateDoc(documentId);
  return { ok: true, message: 'Enviado a revisión.' };
}

export async function reviewAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const documentId = s(fd, 'documentId');
  try {
    await reviewDecision(session.organizationId, session.userId, s(fd, 'versionId'), {
      decision: s(fd, 'decision') === 'request_changes' ? 'request_changes' : 'approve',
      comment: opt(fd, 'comment'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidateDoc(documentId);
  return { ok: true, message: 'Decisión de revisión registrada.' };
}

export async function approvalAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const documentId = s(fd, 'documentId');
  try {
    await approvalDecision(session.organizationId, session.userId, s(fd, 'versionId'), {
      decision: s(fd, 'decision') === 'reject' ? 'reject' : 'approve',
      comment: opt(fd, 'comment'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidateDoc(documentId);
  return { ok: true, message: 'Decisión de aprobación registrada.' };
}

export async function publishAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const documentId = s(fd, 'documentId');
  // §J/§C: si el formulario trae una justificación, se publica CON EXCEPCIÓN (permiso
  // elevado + justificación obligatoria, validados server-side en publishVersion).
  const reason = opt(fd, 'exceptionReason');
  try {
    await publishVersion(
      session.organizationId,
      session.userId,
      s(fd, 'versionId'),
      opt(fd, 'effectiveAt') ?? null,
      reason ? { reason } : null,
    );
  } catch (e) {
    return toState(e);
  }
  revalidateDoc(documentId);
  return {
    ok: true,
    message: reason ? 'Versión publicada con excepción.' : 'Versión publicada.',
  };
}

export async function obsoleteAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const documentId = s(fd, 'documentId');
  try {
    await obsoleteVersion(
      session.organizationId,
      session.userId,
      s(fd, 'versionId'),
      s(fd, 'reason') || 'Obsoletado',
    );
  } catch (e) {
    return toState(e);
  }
  revalidateDoc(documentId);
  return { ok: true, message: 'Versión obsoleta.' };
}

export async function distributeAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const documentId = s(fd, 'documentId');
  const targetType = s(fd, 'targetType') as 'organization' | 'site' | 'user' | 'role';
  try {
    await distributeDocument(session.organizationId, session.userId, documentId, {
      targetType,
      userId: opt(fd, 'userId'),
      role: opt(fd, 'role'),
      readRequired: fd.get('readRequired') === 'on' || fd.get('readRequired') === 'true',
      readDueAt: opt(fd, 'readDueAt') ?? null,
    });
  } catch (e) {
    return toState(e);
  }
  revalidateDoc(documentId);
  return { ok: true, message: 'Documento distribuido.' };
}

export async function acknowledgeReadAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const documentId = s(fd, 'documentId');
  try {
    await acknowledgeRead(
      session.organizationId,
      session.userId,
      s(fd, 'versionId'),
      s(fd, 'checksum'),
    );
  } catch (e) {
    return toState(e);
  }
  revalidateDoc(documentId);
  return { ok: true, message: 'Lectura confirmada.' };
}

export async function registerCopyAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const documentId = s(fd, 'documentId');
  try {
    await registerControlledCopy(session.organizationId, session.userId, s(fd, 'versionId'), {
      recipient: s(fd, 'recipient'),
      format: s(fd, 'format') === 'printed' ? 'printed' : 'digital',
      notes: opt(fd, 'notes') ?? null,
    });
  } catch (e) {
    return toState(e);
  }
  revalidateDoc(documentId);
  return { ok: true, message: 'Copia controlada registrada.' };
}

const DISPOSITIONS = new Set(['destroyed', 'archived_obsolete', 'replaced', 'other']);

export async function updateCopyAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const documentId = s(fd, 'documentId');
  // §I: registrar recuperación. La copia queda RECUPERADA (estado); la DISPOSICIÓN final
  // (destruida/archivada/reemplazada/otra) se guarda aparte. La disposición es obligatoria.
  const disposition = opt(fd, 'disposition');
  if (!disposition || !DISPOSITIONS.has(disposition))
    return { ok: false, message: 'Revisa los datos.', errors: ['La disposición es obligatoria.'] };
  const replacedByCopyId = disposition === 'replaced' ? opt(fd, 'replacedByCopyId') : undefined;
  try {
    await updateControlledCopy(
      session.organizationId,
      session.userId,
      s(fd, 'copyId'),
      'recovered',
      null,
      {
        disposition: disposition as 'destroyed' | 'archived_obsolete' | 'replaced' | 'other',
        confirmedBy: opt(fd, 'confirmedBy') ?? null,
        replacedByCopyId: replacedByCopyId ?? null,
        recoveryNotes: opt(fd, 'recoveryNotes') ?? null,
        recoveredBy: opt(fd, 'recoveredBy') ?? null,
      },
    );
  } catch (e) {
    return toState(e);
  }
  revalidateDoc(documentId);
  return { ok: true, message: 'Recuperación registrada.' };
}

/** Envoltorios con firma `(formData) => void` para formularios simples de servidor. */
export async function acknowledgeReadForm(formData: FormData): Promise<void> {
  await acknowledgeReadAction(null, formData);
}
/** DOC-UX-003: wrapper `void` para usar «Enviar a revisión» como acción de form. */
export async function submitReviewForm(formData: FormData): Promise<void> {
  await submitReviewAction(null, formData);
}

export async function addCommentAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const documentId = s(fd, 'documentId');
  try {
    await addComment(session.organizationId, session.userId, s(fd, 'versionId'), {
      stage: opt(fd, 'stage'),
      type: opt(fd, 'type'),
      body: s(fd, 'body'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidateDoc(documentId);
  return { ok: true, message: 'Comentario agregado.' };
}
