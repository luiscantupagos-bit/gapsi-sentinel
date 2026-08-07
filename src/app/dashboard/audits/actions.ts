'use server';

/**
 * Server Actions del módulo de auditorías (TASK-010). Organización y usuario
 * desde la sesión; permisos validados en la capa de datos.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  ProgramPermissionError,
  ProgramValidationError,
  ProgramNotFoundError,
  addProgramItem,
  createProgram,
  transitionProgram,
} from '@/server/audit-programs';
import {
  AuditNotFoundError,
  AuditPermissionError,
  AuditValidationError,
  addAgendaItem,
  addAuditComment,
  addEvidence,
  addInterview,
  addScopeItem,
  addTeamMember,
  createAudit,
  generateChecklist,
  setChecklistResult,
  transitionAudit,
  updateAudit,
  uploadAuditFile,
} from '@/server/audits';
import {
  FindingNotFoundError,
  FindingPermissionError,
  FindingValidationError,
  addFollowUp,
  convertFindingToCapa,
  createFinding,
  createFindingTask,
  transitionFinding,
  updateFinding,
} from '@/server/audit-findings';
import {
  CertificationPermissionError,
  createCertification,
  updateCertification,
} from '@/server/certifications';
import { InvalidAuditTransitionError, type AuditStatus } from '@/features/audits/audit-state';
import { InvalidProgramTransitionError, type ProgramStatus } from '@/features/audits/program-state';
import { InvalidFindingTransitionError, type FindingStatus } from '@/features/audits/finding-state';

export interface FormState {
  ok: boolean;
  message: string;
  errors?: string[];
}

function toState(error: unknown): FormState {
  const withErrors = error as { errors?: string[] };
  if (
    error instanceof AuditValidationError ||
    error instanceof ProgramValidationError ||
    error instanceof FindingValidationError
  ) {
    return { ok: false, message: 'Revisa los datos.', errors: withErrors.errors };
  }
  if (
    error instanceof AuditPermissionError ||
    error instanceof ProgramPermissionError ||
    error instanceof FindingPermissionError ||
    error instanceof CertificationPermissionError ||
    error instanceof AuditNotFoundError ||
    error instanceof ProgramNotFoundError ||
    error instanceof FindingNotFoundError ||
    error instanceof InvalidAuditTransitionError ||
    error instanceof InvalidProgramTransitionError ||
    error instanceof InvalidFindingTransitionError
  ) {
    return { ok: false, message: (error as Error).message };
  }
  return { ok: false, message: 'Ocurrió un error al procesar la solicitud.' };
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const opt = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v === '' ? null : v;
};

function revAudit(auditId?: string) {
  revalidatePath('/dashboard/audits');
  revalidatePath('/dashboard');
  if (auditId) {
    revalidatePath(`/dashboard/audits/${auditId}`);
    revalidatePath(`/dashboard/audits/${auditId}/execute`);
  }
}

// --- Programas ---------------------------------------------------------------

export async function createProgramAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  let id: string;
  try {
    id = await createProgram(session.organizationId, session.userId, {
      name: s(fd, 'name'),
      description: opt(fd, 'description'),
      objective: opt(fd, 'objective'),
      scope: opt(fd, 'scope'),
      criteria: opt(fd, 'criteria'),
      year: Number(s(fd, 'year')),
      frequency: s(fd, 'frequency') || 'annual',
      siteId: opt(fd, 'siteId'),
      responsibleUserId: opt(fd, 'responsibleUserId'),
      startDate: opt(fd, 'startDate'),
      endDate: opt(fd, 'endDate'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePath('/dashboard/audits/programs');
  redirect(`/dashboard/audits/programs/${id}`);
}

export async function transitionProgramAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const programId = s(fd, 'programId');
  try {
    await transitionProgram(
      session.organizationId,
      session.userId,
      programId,
      s(fd, 'to') as ProgramStatus,
      {
        reason: opt(fd, 'reason'),
      },
    );
  } catch (e) {
    return toState(e);
  }
  revalidatePath(`/dashboard/audits/programs/${programId}`);
  return { ok: true, message: 'Estado del programa actualizado.' };
}

export async function addProgramItemAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const programId = s(fd, 'programId');
  try {
    await addProgramItem(session.organizationId, session.userId, programId, {
      title: s(fd, 'title'),
      plannedDate: opt(fd, 'plannedDate'),
      auditType: s(fd, 'auditType') || 'internal',
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePath(`/dashboard/audits/programs/${programId}`);
  return { ok: true, message: 'Auditoría planeada agregada.' };
}

// --- Auditoría ---------------------------------------------------------------

export async function createAuditAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  let id: string;
  try {
    id = await createAudit(session.organizationId, session.userId, {
      title: s(fd, 'title'),
      auditType: s(fd, 'auditType') || 'internal',
      programId: opt(fd, 'programId'),
      siteId: opt(fd, 'siteId'),
      objective: opt(fd, 'objective'),
      scope: opt(fd, 'scope'),
      criteria: opt(fd, 'criteria'),
      priority: s(fd, 'priority') || 'normal',
      plannedDate: opt(fd, 'plannedDate'),
      leadAuditorUserId: opt(fd, 'leadAuditorUserId'),
    });
  } catch (e) {
    return toState(e);
  }
  revAudit(id);
  redirect(`/dashboard/audits/${id}`);
}

export async function updateAuditAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const auditId = s(fd, 'auditId');
  try {
    await updateAudit(session.organizationId, session.userId, auditId, {
      title: s(fd, 'title'),
      auditType: s(fd, 'auditType') || undefined,
      area: opt(fd, 'area'),
      process: opt(fd, 'process'),
      objective: opt(fd, 'objective'),
      scope: opt(fd, 'scope'),
      criteria: opt(fd, 'criteria'),
      priority: s(fd, 'priority') || undefined,
      plannedDate: fd.has('plannedDate') ? opt(fd, 'plannedDate') : undefined,
      leadAuditorUserId: fd.has('leadAuditorUserId') ? opt(fd, 'leadAuditorUserId') : undefined,
      ...(fd.has('executiveSummary') ? { executiveSummary: s(fd, 'executiveSummary') } : {}),
      ...(fd.has('conclusion') ? { conclusion: s(fd, 'conclusion') } : {}),
    });
  } catch (e) {
    return toState(e);
  }
  revAudit(auditId);
  return { ok: true, message: 'Auditoría actualizada.' };
}

export async function transitionAuditAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const auditId = s(fd, 'auditId');
  try {
    await transitionAudit(
      session.organizationId,
      session.userId,
      auditId,
      s(fd, 'to') as AuditStatus,
      {
        reason: opt(fd, 'reason'),
        justification: opt(fd, 'justification'),
      },
    );
  } catch (e) {
    return toState(e);
  }
  revAudit(auditId);
  return { ok: true, message: 'Estado actualizado.' };
}

export async function addTeamAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const auditId = s(fd, 'auditId');
  try {
    const res = await addTeamMember(session.organizationId, session.userId, auditId, {
      userId: s(fd, 'userId'),
      role: s(fd, 'role') || 'auditor',
      area: opt(fd, 'area'),
    });
    revAudit(auditId);
    return {
      ok: true,
      message: res.potentialConflict
        ? 'Participante agregado. Posible conflicto de independencia: registra una justificación.'
        : 'Participante agregado.',
    };
  } catch (e) {
    return toState(e);
  }
}

export async function addAgendaAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const auditId = s(fd, 'auditId');
  try {
    await addAgendaItem(session.organizationId, session.userId, auditId, {
      startTime: opt(fd, 'startTime'),
      endTime: opt(fd, 'endTime'),
      processArea: opt(fd, 'processArea'),
      location: opt(fd, 'location'),
      notes: opt(fd, 'notes'),
    });
  } catch (e) {
    return toState(e);
  }
  revAudit(auditId);
  return { ok: true, message: 'Bloque de agenda agregado.' };
}

export async function addScopeAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const auditId = s(fd, 'auditId');
  try {
    await addScopeItem(session.organizationId, session.userId, auditId, {
      kind: s(fd, 'kind') || 'process',
      label: opt(fd, 'label'),
    });
  } catch (e) {
    return toState(e);
  }
  revAudit(auditId);
  return { ok: true, message: 'Elemento de alcance agregado.' };
}

export async function generateChecklistAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const auditId = s(fd, 'auditId');
  try {
    const n = await generateChecklist(session.organizationId, session.userId, auditId, {
      templateVersionId: s(fd, 'templateVersionId'),
    });
    revAudit(auditId);
    return { ok: true, message: `Checklist generado con ${n} requisitos.` };
  } catch (e) {
    return toState(e);
  }
}

export async function setResultAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const auditId = s(fd, 'auditId');
  try {
    await setChecklistResult(session.organizationId, session.userId, s(fd, 'checklistItemId'), {
      result: s(fd, 'result') || undefined,
      foundEvidence: fd.has('foundEvidence') ? opt(fd, 'foundEvidence') : undefined,
      expectedEvidence: fd.has('expectedEvidence') ? opt(fd, 'expectedEvidence') : undefined,
      comment: fd.has('comment') ? opt(fd, 'comment') : undefined,
    });
  } catch (e) {
    return toState(e);
  }
  revAudit(auditId);
  return { ok: true, message: 'Resultado registrado.' };
}

export async function addEvidenceAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const auditId = s(fd, 'auditId');
  try {
    await addEvidence(session.organizationId, session.userId, auditId, {
      evidenceType: s(fd, 'evidenceType') || 'observation',
      description: s(fd, 'description'),
      checklistItemId: opt(fd, 'checklistItemId'),
      source: opt(fd, 'source'),
      evidenceDate: opt(fd, 'evidenceDate'),
      documentId: opt(fd, 'documentId'),
    });
  } catch (e) {
    return toState(e);
  }
  revAudit(auditId);
  return { ok: true, message: 'Evidencia registrada.' };
}

export async function addInterviewAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const auditId = s(fd, 'auditId');
  try {
    await addInterview(session.organizationId, session.userId, auditId, {
      checklistItemId: opt(fd, 'checklistItemId'),
      personRole: opt(fd, 'personRole'),
      area: opt(fd, 'area'),
      topic: opt(fd, 'topic'),
      answers: opt(fd, 'answers'),
      auditorNotes: opt(fd, 'auditorNotes'),
      interviewDate: opt(fd, 'interviewDate'),
    });
  } catch (e) {
    return toState(e);
  }
  revAudit(auditId);
  return { ok: true, message: 'Entrevista registrada.' };
}

export async function uploadAuditFileAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const auditId = s(fd, 'auditId');
  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, message: 'Selecciona un archivo.' };
  try {
    await uploadAuditFile(
      session.organizationId,
      session.userId,
      auditId,
      {
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        data: Buffer.from(await file.arrayBuffer()),
      },
      s(fd, 'kind') || 'evidence',
    );
  } catch (e) {
    return toState(e);
  }
  revAudit(auditId);
  return { ok: true, message: 'Archivo adjuntado.' };
}

export async function addAuditCommentAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const auditId = s(fd, 'auditId');
  try {
    await addAuditComment(session.organizationId, session.userId, auditId, s(fd, 'body'));
  } catch (e) {
    return toState(e);
  }
  revAudit(auditId);
  return { ok: true, message: 'Comentario agregado.' };
}

// --- Hallazgos ---------------------------------------------------------------

export async function createFindingAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const auditId = s(fd, 'auditId');
  try {
    await createFinding(session.organizationId, session.userId, {
      auditId,
      snapshotId: opt(fd, 'snapshotId'),
      title: s(fd, 'title'),
      description: opt(fd, 'description'),
      objectiveEvidence: opt(fd, 'objectiveEvidence'),
      requirementBreached: opt(fd, 'requirementBreached'),
      classification: s(fd, 'classification') || 'observation',
      severity: s(fd, 'severity') || 'medium',
      responsibleUserId: opt(fd, 'responsibleUserId'),
      committedDate: opt(fd, 'committedDate'),
      immediateCorrection: opt(fd, 'immediateCorrection'),
    });
  } catch (e) {
    return toState(e);
  }
  revAudit(auditId);
  return { ok: true, message: 'Hallazgo creado.' };
}

export async function transitionFindingAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const findingId = s(fd, 'findingId');
  try {
    await transitionFinding(
      session.organizationId,
      session.userId,
      findingId,
      s(fd, 'to') as FindingStatus,
    );
  } catch (e) {
    return toState(e);
  }
  revalidatePath(`/dashboard/audits/findings/${findingId}`);
  return { ok: true, message: 'Estado del hallazgo actualizado.' };
}

export async function updateFindingAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const findingId = s(fd, 'findingId');
  try {
    await updateFinding(session.organizationId, session.userId, findingId, {
      title: s(fd, 'title'),
      description: opt(fd, 'description'),
      objectiveEvidence: opt(fd, 'objectiveEvidence'),
      requirementBreached: opt(fd, 'requirementBreached'),
      classification: s(fd, 'classification') || undefined,
      severity: s(fd, 'severity') || undefined,
      responsibleUserId: fd.has('responsibleUserId') ? opt(fd, 'responsibleUserId') : undefined,
      committedDate: fd.has('committedDate') ? opt(fd, 'committedDate') : undefined,
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePath(`/dashboard/audits/findings/${findingId}`);
  return { ok: true, message: 'Hallazgo actualizado.' };
}

export async function convertFindingToCapaAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const findingId = s(fd, 'findingId');
  try {
    await convertFindingToCapa(session.organizationId, session.userId, findingId, {});
  } catch (e) {
    return toState(e);
  }
  revalidatePath(`/dashboard/audits/findings/${findingId}`);
  return { ok: true, message: 'CAPA creada y vinculada.' };
}

export async function createFindingTaskAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const findingId = s(fd, 'findingId');
  try {
    await createFindingTask(session.organizationId, session.userId, findingId, {
      title: opt(fd, 'title') ?? undefined,
      targetDate: opt(fd, 'targetDate'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePath(`/dashboard/audits/findings/${findingId}`);
  return { ok: true, message: 'Tarea de seguimiento creada.' };
}

export async function addFollowUpAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const findingId = s(fd, 'findingId');
  try {
    await addFollowUp(session.organizationId, session.userId, findingId, {
      correction: opt(fd, 'correction'),
      status: s(fd, 'status') || 'correction_in_progress',
      targetDate: opt(fd, 'targetDate'),
      result: opt(fd, 'result'),
      comment: opt(fd, 'comment'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePath(`/dashboard/audits/findings/${findingId}`);
  return { ok: true, message: 'Seguimiento registrado.' };
}

// --- Certificaciones ---------------------------------------------------------

export async function createCertAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  try {
    await createCertification(session.organizationId, session.userId, {
      schemeName: s(fd, 'schemeName'),
      version: opt(fd, 'version'),
      siteId: opt(fd, 'siteId'),
      certifierName: opt(fd, 'certifierName'),
      nextAuditDate: opt(fd, 'nextAuditDate'),
      expiryDate: opt(fd, 'expiryDate'),
      status: s(fd, 'status') || 'preparation',
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePath('/dashboard/audits/certifications');
  return { ok: true, message: 'Esquema/certificación registrado.' };
}

export async function updateCertAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  try {
    await updateCertification(session.organizationId, session.userId, s(fd, 'certId'), {
      status: s(fd, 'status') || undefined,
      nextAuditDate: fd.has('nextAuditDate') ? opt(fd, 'nextAuditDate') : undefined,
      comment: opt(fd, 'comment'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePath('/dashboard/audits/certifications');
  return { ok: true, message: 'Certificación actualizada.' };
}
