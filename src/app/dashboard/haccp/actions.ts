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
