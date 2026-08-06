'use server';

/**
 * Server Actions de PROYECTOS (TASK-009). Organización y usuario desde la sesión;
 * permisos validados en la capa de datos.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  ProjectNotFoundError,
  ProjectPermissionError,
  ProjectValidationError,
  addMilestone,
  addProjectComment,
  addProjectMember,
  addProjectRelation,
  createProject,
  transitionProject,
  updateMilestoneStatus,
  updateProject,
  uploadProjectFile,
} from '@/server/projects';
import {
  InvalidProjectTransitionError,
  type ProjectStatus,
} from '@/features/projects/project-state';

export interface FormState {
  ok: boolean;
  message: string;
  errors?: string[];
}

function toState(error: unknown): FormState {
  if (error instanceof ProjectValidationError)
    return { ok: false, message: 'Revisa los datos.', errors: error.errors };
  if (error instanceof ProjectPermissionError) return { ok: false, message: error.message };
  if (error instanceof ProjectNotFoundError) return { ok: false, message: error.message };
  if (error instanceof InvalidProjectTransitionError) return { ok: false, message: error.message };
  return { ok: false, message: 'Ocurrió un error al procesar la solicitud.' };
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const opt = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v === '' ? null : v;
};

function revalidateProjects(projectId?: string) {
  revalidatePath('/dashboard/projects');
  revalidatePath('/dashboard');
  if (projectId) {
    revalidatePath(`/dashboard/projects/${projectId}`);
    revalidatePath(`/dashboard/projects/${projectId}/gantt`);
  }
}

export async function createProjectAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  let id: string;
  try {
    id = await createProject(session.organizationId, session.userId, {
      name: s(fd, 'name'),
      description: opt(fd, 'description'),
      objective: opt(fd, 'objective'),
      projectType: s(fd, 'projectType'),
      priority: s(fd, 'priority') || 'normal',
      responsibleUserId: opt(fd, 'responsibleUserId'),
      sponsorUserId: opt(fd, 'sponsorUserId'),
      startDate: opt(fd, 'startDate'),
      targetDate: opt(fd, 'targetDate'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidateProjects(id);
  redirect(`/dashboard/projects/${id}`);
}

export async function updateProjectAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const projectId = s(fd, 'projectId');
  try {
    await updateProject(session.organizationId, session.userId, projectId, {
      name: s(fd, 'name'),
      description: opt(fd, 'description'),
      objective: opt(fd, 'objective'),
      scope: opt(fd, 'scope'),
      priority: s(fd, 'priority') || undefined,
      responsibleUserId: fd.has('responsibleUserId') ? opt(fd, 'responsibleUserId') : undefined,
      sponsorUserId: fd.has('sponsorUserId') ? opt(fd, 'sponsorUserId') : undefined,
      startDate: fd.has('startDate') ? opt(fd, 'startDate') : undefined,
      targetDate: fd.has('targetDate') ? opt(fd, 'targetDate') : undefined,
      risksSummary: opt(fd, 'risksSummary'),
      expectedOutcome: opt(fd, 'expectedOutcome'),
      actualOutcome: opt(fd, 'actualOutcome'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidateProjects(projectId);
  return { ok: true, message: 'Proyecto actualizado.' };
}

export async function transitionProjectAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const projectId = s(fd, 'projectId');
  try {
    await transitionProject(
      session.organizationId,
      session.userId,
      projectId,
      s(fd, 'to') as ProjectStatus,
      { reason: opt(fd, 'reason'), justification: opt(fd, 'justification') },
    );
  } catch (e) {
    return toState(e);
  }
  revalidateProjects(projectId);
  return { ok: true, message: 'Estado del proyecto actualizado.' };
}

export async function addMilestoneAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const projectId = s(fd, 'projectId');
  try {
    await addMilestone(session.organizationId, session.userId, projectId, {
      name: s(fd, 'name'),
      description: opt(fd, 'description'),
      targetDate: opt(fd, 'targetDate'),
      responsibleUserId: opt(fd, 'responsibleUserId'),
      acceptanceCriteria: opt(fd, 'acceptanceCriteria'),
      sequence: Number(s(fd, 'sequence') || '1'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidateProjects(projectId);
  return { ok: true, message: 'Hito agregado.' };
}

export async function updateMilestoneStatusAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const projectId = s(fd, 'projectId');
  try {
    await updateMilestoneStatus(
      session.organizationId,
      session.userId,
      s(fd, 'milestoneId'),
      s(fd, 'status'),
    );
  } catch (e) {
    return toState(e);
  }
  revalidateProjects(projectId);
  return { ok: true, message: 'Hito actualizado.' };
}

export async function addProjectMemberAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const projectId = s(fd, 'projectId');
  try {
    await addProjectMember(
      session.organizationId,
      session.userId,
      projectId,
      s(fd, 'userId'),
      s(fd, 'role') || 'member',
    );
  } catch (e) {
    return toState(e);
  }
  revalidateProjects(projectId);
  return { ok: true, message: 'Participante agregado.' };
}

export async function addProjectRelationAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const projectId = s(fd, 'projectId');
  try {
    await addProjectRelation(session.organizationId, session.userId, projectId, {
      relationType: s(fd, 'relationType'),
      targetId: opt(fd, 'targetId'),
      externalRef: opt(fd, 'externalRef'),
      note: opt(fd, 'note'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidateProjects(projectId);
  return { ok: true, message: 'Relación agregada.' };
}

export async function addProjectCommentAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const projectId = s(fd, 'projectId');
  try {
    await addProjectComment(session.organizationId, session.userId, projectId, s(fd, 'body'));
  } catch (e) {
    return toState(e);
  }
  revalidateProjects(projectId);
  return { ok: true, message: 'Comentario agregado.' };
}

export async function uploadProjectEvidenceAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const projectId = s(fd, 'projectId');
  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Selecciona un archivo.' };
  }
  try {
    await uploadProjectFile(
      session.organizationId,
      session.userId,
      projectId,
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
  revalidateProjects(projectId);
  return { ok: true, message: 'Evidencia adjuntada.' };
}
