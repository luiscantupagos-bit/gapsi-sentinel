'use server';

/**
 * Server Actions del gestor global de tareas (TASK-009). Organización y usuario
 * desde la sesión; permisos validados en la capa de datos.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  TaskNotFoundError,
  TaskPermissionError,
  TaskValidationError,
  addTaskAssignment,
  addTaskComment,
  addTaskDependency,
  createTask,
  transitionTask,
  updateTask,
  uploadTaskFile,
} from '@/server/tasks';
import { InvalidTaskTransitionError, type TaskStatus } from '@/features/tasks/task-state';
import { DependencyCycleError, SelfDependencyError } from '@/features/tasks/dependencies';

export interface FormState {
  ok: boolean;
  message: string;
  errors?: string[];
}

function toState(error: unknown): FormState {
  if (error instanceof TaskValidationError)
    return { ok: false, message: 'Revisa los datos.', errors: error.errors };
  if (error instanceof TaskPermissionError) return { ok: false, message: error.message };
  if (error instanceof TaskNotFoundError) return { ok: false, message: error.message };
  if (error instanceof InvalidTaskTransitionError) return { ok: false, message: error.message };
  if (error instanceof DependencyCycleError || error instanceof SelfDependencyError)
    return { ok: false, message: error.message };
  return { ok: false, message: 'Ocurrió un error al procesar la solicitud.' };
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const opt = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v === '' ? null : v;
};

function revalidateTasks(taskId?: string) {
  revalidatePath('/dashboard/tasks');
  revalidatePath('/dashboard/tasks/board');
  revalidatePath('/dashboard');
  if (taskId) revalidatePath(`/dashboard/tasks/${taskId}`);
}

export async function createTaskAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  let id: string;
  try {
    id = await createTask(session.organizationId, session.userId, {
      title: s(fd, 'title'),
      description: opt(fd, 'description'),
      taskType: s(fd, 'taskType') || 'manual',
      priority: s(fd, 'priority') || 'normal',
      projectId: opt(fd, 'projectId'),
      responsibleUserId: opt(fd, 'responsibleUserId'),
      siteId: opt(fd, 'siteId'),
      startDate: opt(fd, 'startDate'),
      targetDate: opt(fd, 'targetDate'),
      estimatedHours: opt(fd, 'estimatedHours') ? Number(opt(fd, 'estimatedHours')) : null,
    });
  } catch (e) {
    return toState(e);
  }
  revalidateTasks(id);
  redirect(`/dashboard/tasks/${id}`);
}

export async function updateTaskAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const taskId = s(fd, 'taskId');
  try {
    await updateTask(session.organizationId, session.userId, taskId, {
      title: s(fd, 'title'),
      description: opt(fd, 'description'),
      priority: s(fd, 'priority') || undefined,
      responsibleUserId: fd.has('responsibleUserId') ? opt(fd, 'responsibleUserId') : undefined,
      startDate: fd.has('startDate') ? opt(fd, 'startDate') : undefined,
      targetDate: fd.has('targetDate') ? opt(fd, 'targetDate') : undefined,
      progress: fd.has('progress') ? Number(s(fd, 'progress')) : undefined,
    });
  } catch (e) {
    return toState(e);
  }
  revalidateTasks(taskId);
  return { ok: true, message: 'Tarea actualizada.' };
}

export async function transitionTaskAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const taskId = s(fd, 'taskId');
  try {
    await transitionTask(
      session.organizationId,
      session.userId,
      taskId,
      s(fd, 'to') as TaskStatus,
      {
        reason: opt(fd, 'reason'),
        result: opt(fd, 'result'),
      },
    );
  } catch (e) {
    return toState(e);
  }
  revalidateTasks(taskId);
  return { ok: true, message: 'Estado actualizado.' };
}

export async function addTaskCommentAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const taskId = s(fd, 'taskId');
  try {
    await addTaskComment(session.organizationId, session.userId, taskId, s(fd, 'body'));
  } catch (e) {
    return toState(e);
  }
  revalidateTasks(taskId);
  return { ok: true, message: 'Comentario agregado.' };
}

export async function addTaskAssignmentAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const taskId = s(fd, 'taskId');
  try {
    await addTaskAssignment(
      session.organizationId,
      session.userId,
      taskId,
      s(fd, 'userId'),
      s(fd, 'role') || 'participant',
    );
  } catch (e) {
    return toState(e);
  }
  revalidateTasks(taskId);
  return { ok: true, message: 'Participante agregado.' };
}

export async function addTaskDependencyAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const taskId = s(fd, 'taskId');
  try {
    await addTaskDependency(session.organizationId, session.userId, {
      fromTaskId: s(fd, 'fromTaskId'),
      toTaskId: taskId,
      mandatory: fd.get('mandatory') !== 'false',
      lagDays: Number(s(fd, 'lagDays') || '0'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidateTasks(taskId);
  return { ok: true, message: 'Dependencia agregada.' };
}

export async function uploadTaskEvidenceAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const taskId = s(fd, 'taskId');
  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Selecciona un archivo.' };
  }
  try {
    await uploadTaskFile(
      session.organizationId,
      session.userId,
      taskId,
      {
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        data: Buffer.from(await file.arrayBuffer()),
      },
      s(fd, 'kind') === 'evidence' ? 'evidence' : 'attachment',
    );
  } catch (e) {
    return toState(e);
  }
  revalidateTasks(taskId);
  return { ok: true, message: 'Evidencia adjuntada.' };
}
