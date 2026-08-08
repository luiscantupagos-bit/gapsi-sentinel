'use server';

/**
 * Server Actions del módulo documental (TASK-004).
 * La organización y el usuario se resuelven desde la sesión de servidor.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { UnsupportedFileError } from '@/server/document-storage';
import {
  DocumentNotEditableError,
  DocumentNotFoundError,
  DocumentValidationError,
  DuplicateCodeError,
  RelationScopeError,
  addAttachment,
  archiveDocument,
  createDocument,
  createVersion,
  updateDocumentMetadata,
} from '@/server/documents';

export interface ActionState {
  ok: boolean;
  message: string;
  errors?: string[];
}

function toState(error: unknown): ActionState {
  if (error instanceof DocumentValidationError) {
    return { ok: false, message: 'Corrige los errores del formulario.', errors: error.errors };
  }
  if (error instanceof DuplicateCodeError) return { ok: false, message: error.message };
  if (error instanceof RelationScopeError) return { ok: false, message: error.message };
  if (error instanceof UnsupportedFileError) return { ok: false, message: error.message };
  if (error instanceof DocumentNotEditableError) return { ok: false, message: error.message };
  if (error instanceof DocumentNotFoundError) return { ok: false, message: error.message };
  return { ok: false, message: 'Ocurrió un error al procesar la solicitud.' };
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}
function optional(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v === '' ? null : v;
}
async function fileFromForm(formData: FormData, field: string) {
  const f = formData.get(field);
  if (f instanceof File && f.size > 0) {
    return {
      originalName: f.name,
      mimeType: f.type || 'application/octet-stream',
      data: Buffer.from(await f.arrayBuffer()),
    };
  }
  return undefined;
}

export async function createDocumentAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireServerSession();
  let newId: string;
  try {
    const file = await fileFromForm(formData, 'mainFile');
    newId = await createDocument(
      session.organizationId,
      session.userId,
      {
        code: str(formData, 'code'),
        title: str(formData, 'title'),
        documentType: str(formData, 'documentType'),
        versionLabel: str(formData, 'versionLabel'),
        origin: str(formData, 'origin'),
        status: str(formData, 'status'),
        confidentiality: str(formData, 'confidentiality'),
        description: optional(formData, 'description'),
        siteId: optional(formData, 'siteId'),
        responsibleUserId: optional(formData, 'responsibleUserId'),
        ownerArea: optional(formData, 'ownerArea'),
        issuedAt: optional(formData, 'issuedAt'),
        nextReviewAt: optional(formData, 'nextReviewAt'),
        changeNotes: optional(formData, 'changeNotes'),
      },
      file,
    );
  } catch (error) {
    return toState(error);
  }
  revalidatePath('/dashboard/documents');
  redirect(`/dashboard/documents/${newId}`);
}

export async function updateMetadataAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireServerSession();
  const documentId = str(formData, 'documentId');
  try {
    await updateDocumentMetadata(session.organizationId, session.userId, documentId, {
      title: str(formData, 'title'),
      documentType: str(formData, 'documentType'),
      status: str(formData, 'status'),
      confidentiality: str(formData, 'confidentiality'),
      description: optional(formData, 'description'),
      siteId: optional(formData, 'siteId'),
      responsibleUserId: optional(formData, 'responsibleUserId'),
      ownerArea: optional(formData, 'ownerArea'),
      issuedAt: optional(formData, 'issuedAt'),
      nextReviewAt: optional(formData, 'nextReviewAt'),
    });
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/dashboard/documents/${documentId}`);
  redirect(`/dashboard/documents/${documentId}`);
}

export async function addAttachmentAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireServerSession();
  const documentId = str(formData, 'documentId');
  try {
    const file = await fileFromForm(formData, 'attachment');
    if (!file) return { ok: false, message: 'Selecciona un archivo.' };
    await addAttachment(session.organizationId, session.userId, documentId, file);
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/dashboard/documents/${documentId}`);
  return { ok: true, message: 'Anexo agregado correctamente.' };
}

export async function createVersionAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireServerSession();
  const documentId = str(formData, 'documentId');
  try {
    const bump = str(formData, 'bump') === 'major' ? 'major' : 'minor';
    await createVersion(session.organizationId, session.userId, documentId, {
      bump,
      changeNotes: optional(formData, 'changeNotes'),
    });
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/dashboard/documents/${documentId}`);
  return { ok: true, message: 'Nueva versión creada.' };
}

export async function archiveDocumentAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireServerSession();
  const documentId = str(formData, 'documentId');
  try {
    await archiveDocument(
      session.organizationId,
      session.userId,
      documentId,
      optional(formData, 'reason'),
    );
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/dashboard/documents/${documentId}`);
  return { ok: true, message: 'Documento archivado.' };
}
