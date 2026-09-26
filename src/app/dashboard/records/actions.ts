'use server';

/**
 * DOC-004 — Server Actions de Registros. Organización/usuario desde la sesión; permisos y
 * validación en la capa de datos (src/server/records.ts). Los datos del formulario viajan
 * como JSON en un campo oculto `data` (el cliente arma valores/filas).
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  RecordNotFoundError,
  RecordPermissionError,
  RecordValidationError,
  cancelRecord,
  closeRecord,
  createRecord,
  reopenRecord,
  reviewRecord,
  saveFormSchema,
  saveRecordData,
  submitRecord,
} from '@/server/records';

export interface FormState {
  ok: boolean;
  message: string;
  errors?: string[];
}

function toState(error: unknown): FormState {
  if (error instanceof RecordValidationError)
    return { ok: false, message: 'Revisa los datos.', errors: error.errors };
  if (error instanceof RecordPermissionError) return { ok: false, message: error.message };
  if (error instanceof RecordNotFoundError) return { ok: false, message: error.message };
  return { ok: false, message: 'Ocurrió un error al procesar la solicitud.' };
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const opt = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v === '' ? undefined : v;
};
function parseJson(fd: FormData, k: string): unknown {
  const raw = String(fd.get(k) ?? '');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// --- Diseñador (form_schema) --------------------------------------------------
export async function saveFormSchemaAction(
  _prev: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const documentId = s(fd, 'documentId');
  try {
    await saveFormSchema(
      session.organizationId,
      session.userId,
      s(fd, 'documentVersionId'),
      parseJson(fd, 'schema'),
    );
    revalidatePath(`/dashboard/documents/${documentId}/form`);
    return { ok: true, message: 'Formulario guardado.' };
  } catch (error) {
    return toState(error);
  }
}

// --- Registros ---------------------------------------------------------------
export async function createRecordAction(
  _prev: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  let newId: string | null = null;
  try {
    newId = await createRecord(session.organizationId, session.userId, {
      documentId: s(fd, 'documentId'),
      clientGeneratedId: opt(fd, 'clientGeneratedId') ?? null,
      siteId: opt(fd, 'siteId') ?? null,
      assignedToUserId: opt(fd, 'assignedToUserId') ?? null,
      sourceType: opt(fd, 'sourceType') ?? null,
      sourceId: opt(fd, 'sourceId') ?? null,
    });
  } catch (error) {
    return toState(error);
  }
  revalidatePath('/dashboard/records');
  redirect(`/dashboard/records/${newId}`);
}

export async function saveRecordDataAction(
  _prev: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const recordId = s(fd, 'recordId');
  try {
    await saveRecordData(session.organizationId, session.userId, recordId, parseJson(fd, 'data'));
    revalidatePath(`/dashboard/records/${recordId}`);
    return { ok: true, message: 'Borrador guardado.' };
  } catch (error) {
    return toState(error);
  }
}

export async function submitRecordAction(
  _prev: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const recordId = s(fd, 'recordId');
  try {
    await submitRecord(session.organizationId, session.userId, recordId, parseJson(fd, 'data'));
    revalidatePath(`/dashboard/records/${recordId}`);
    return { ok: true, message: 'Registro enviado.' };
  } catch (error) {
    return toState(error);
  }
}

function workflowAction(fn: typeof reviewRecord, path = true) {
  return async (_prev: FormState | null, fd: FormData): Promise<FormState> => {
    const session = await requireServerSession();
    const recordId = s(fd, 'recordId');
    try {
      await fn(session.organizationId, session.userId, recordId);
      if (path) revalidatePath(`/dashboard/records/${recordId}`);
      return { ok: true, message: 'Estado actualizado.' };
    } catch (error) {
      return toState(error);
    }
  };
}

export const reviewRecordAction = workflowAction(reviewRecord);
export const closeRecordAction = workflowAction(closeRecord);
export const cancelRecordAction = workflowAction(cancelRecord);
export const reopenRecordAction = workflowAction(reopenRecord);
