'use server';

/**
 * Server Actions del editor documental (TASK-005).
 * Organización y usuario se resuelven desde la sesión; documentId/versionId se
 * validan contra la organización en la capa de datos.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  ContentTooLargeError,
  DocumentNotEditableError,
  DocumentNotFoundError,
  DocumentValidationError,
  UnsupportedImageError,
  addDocumentImage,
  createEditorDocument,
  createEditorVersion,
  saveContent,
} from '@/server/documents';

export interface FormState {
  ok: boolean;
  message: string;
  errors?: string[];
}

function humanMsg(error: unknown): string {
  if (error instanceof DocumentValidationError) return error.errors.join(' ');
  if (
    error instanceof ContentTooLargeError ||
    error instanceof UnsupportedImageError ||
    error instanceof DocumentNotEditableError ||
    error instanceof DocumentNotFoundError
  ) {
    return error.message;
  }
  return 'Ocurrió un error al procesar la solicitud.';
}

export async function createEditorDocumentAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  let id: string;
  try {
    id = await createEditorDocument(session.organizationId, session.userId, {
      code: String(formData.get('code') ?? '').trim(),
      title: String(formData.get('title') ?? '').trim(),
      documentType: String(formData.get('documentType') ?? ''),
      templateKey: String(formData.get('templateKey') ?? ''),
    });
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return { ok: false, message: 'Corrige los errores.', errors: error.errors };
    }
    return { ok: false, message: humanMsg(error) };
  }
  revalidatePath('/dashboard/documents');
  redirect(`/dashboard/documents/${id}/editor`);
}

export interface SaveContentResult {
  ok: boolean;
  message: string;
  savedAt?: string;
}

export async function saveContentAction(input: {
  documentId: string;
  versionId: string;
  /** JSON serializado (string) para evitar problemas de serialización de RSC. */
  contentJson: string;
  pageConfig: string;
  recordHistory?: boolean;
}): Promise<SaveContentResult> {
  const session = await requireServerSession();
  let contentJson: unknown = null;
  let pageConfig: unknown;
  try {
    contentJson = JSON.parse(input.contentJson);
  } catch {
    contentJson = null;
  }
  try {
    pageConfig = JSON.parse(input.pageConfig);
  } catch {
    pageConfig = undefined;
  }
  try {
    const result = await saveContent(
      session.organizationId,
      session.userId,
      input.documentId,
      input.versionId,
      { contentJson, pageConfig },
      Boolean(input.recordHistory),
    );
    revalidatePath(`/dashboard/documents/${input.documentId}`);
    return { ok: true, message: 'Guardado.', savedAt: result.savedAt };
  } catch (error) {
    return { ok: false, message: humanMsg(error) };
  }
}

export async function createEditorVersionAction(input: {
  documentId: string;
  label: string;
  changeNotes?: string;
}): Promise<{ ok: boolean; message: string; versionId?: string }> {
  const session = await requireServerSession();
  try {
    const versionId = await createEditorVersion(
      session.organizationId,
      session.userId,
      input.documentId,
      {
        label: input.label,
        changeNotes: input.changeNotes ?? null,
      },
    );
    revalidatePath(`/dashboard/documents/${input.documentId}`);
    return { ok: true, message: 'Nueva versión creada.', versionId };
  } catch (error) {
    return { ok: false, message: humanMsg(error) };
  }
}

export async function uploadImageAction(
  formData: FormData,
): Promise<{ ok: boolean; message: string; url?: string }> {
  const session = await requireServerSession();
  const documentId = String(formData.get('documentId') ?? '');
  const versionId = String(formData.get('versionId') ?? '');
  const file = formData.get('image');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Selecciona una imagen.' };
  }
  try {
    const result = await addDocumentImage(
      session.organizationId,
      session.userId,
      documentId,
      versionId,
      {
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        data: Buffer.from(await file.arrayBuffer()),
      },
    );
    return { ok: true, message: 'Imagen subida.', url: result.url };
  } catch (error) {
    return { ok: false, message: humanMsg(error) };
  }
}
