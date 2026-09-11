'use server';

/**
 * Adjuntos de Tarea (PLATFORM-002B §10). Reutiliza el almacenamiento transversal
 * (`src/server/files.ts`). Valida en servidor: sesión, tenant y que la Tarea exista
 * en la organización. No confía en entityId/fileId del cliente sin validar (§14).
 */
import { revalidatePath } from 'next/cache';
import { requireServerSession } from '@/server/session';
import { getPrisma } from '@/server/db';
import {
  uploadFile,
  unlinkAndCleanup,
  FileValidationError,
  StorageQuotaError,
} from '@/server/files';
import type { RelationType } from '@/features/storage/file-policy';

export interface AttachmentState {
  ok: boolean;
  message: string;
}

async function assertTaskInOrg(organizationId: string, taskId: string): Promise<void> {
  const task = await getPrisma().task.findFirst({
    where: { id: taskId, organizationId },
    select: { id: true },
  });
  if (!task) throw new FileValidationError('Tarea no encontrada.');
}

/** Sube un adjunto (o evidencia) a una Tarea. */
export async function uploadTaskFileAction(
  _prev: AttachmentState | null,
  formData: FormData,
): Promise<AttachmentState> {
  const session = await requireServerSession();
  const taskId = String(formData.get('taskId') ?? '');
  const relationType =
    (String(formData.get('relationType') ?? 'attachment') as RelationType) || 'attachment';
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Selecciona un archivo.' };
  }
  try {
    await assertTaskInOrg(session.organizationId, taskId);
    const data = Buffer.from(await file.arrayBuffer());
    await uploadFile(session.organizationId, session.userId, {
      filename: file.name,
      mimeType: file.type,
      data,
      relation: {
        entityType: 'task',
        entityId: taskId,
        relationType: relationType === 'evidence' ? 'evidence' : 'attachment',
      },
    });
  } catch (error) {
    if (error instanceof StorageQuotaError)
      return { ok: false, message: 'No hay espacio disponible.' };
    if (error instanceof FileValidationError) return { ok: false, message: error.message };
    return { ok: false, message: 'No fue posible cargar el archivo.' };
  }
  revalidatePath(`/dashboard/tasks/${taskId}`);
  return { ok: true, message: 'Archivo cargado.' };
}

/** Desvincula un adjunto de la Tarea (y lo borra si queda huérfano §16). */
export async function deleteTaskFileAction(formData: FormData): Promise<void> {
  const session = await requireServerSession();
  const taskId = String(formData.get('taskId') ?? '');
  const fileId = String(formData.get('fileId') ?? '');
  const relationType =
    (String(formData.get('relationType') ?? 'attachment') as RelationType) || 'attachment';
  await assertTaskInOrg(session.organizationId, taskId);
  await unlinkAndCleanup(session.organizationId, fileId, {
    entityType: 'task',
    entityId: taskId,
    relationType,
  });
  revalidatePath(`/dashboard/tasks/${taskId}`);
}
