/**
 * Control documental avanzado (TASK-006): flujo de revisión/aprobación,
 * publicación, distribución, lectura, copias controladas, comentarios y alertas.
 *
 * Seguridad: organización desde la sesión; permisos por rol y asignación
 * validados en SERVIDOR; escrituras en `withOrgContext` (RLS); registros de
 * aprobación/lectura/estado append-only.
 */
import { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';
import { DocumentNotFoundError } from './documents';
import { contentChecksum, type DocNode } from '@/features/documents/content-schema';
import {
  assertVersionTransition,
  isEditableStatus,
  type VersionStatus,
} from '@/features/documents/workflow-state';

export class WorkflowPermissionError extends Error {
  constructor(message = 'No tienes permiso para esta acción.') {
    super(message);
    this.name = 'WorkflowPermissionError';
  }
}
export class WorkflowValidationError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super('Validación del flujo fallida.');
    this.name = 'WorkflowValidationError';
    this.errors = errors;
  }
}

/** Umbral de "próximo a revisión" (días), configurable. */
export function reviewSoonDays(): number {
  const raw = Number(process.env.DOCUMENTS_REVIEW_SOON_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}

type Tx = Prisma.TransactionClient;

async function memberRole(organizationId: string, userId: string): Promise<string> {
  const m = await getPrisma().membership.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!m) throw new WorkflowPermissionError('No perteneces a esta organización.');
  return m.role;
}

const isAdmin = (role: string) => role === 'owner' || role === 'admin';

async function loadVersion(organizationId: string, versionId: string) {
  const version = await getPrisma().documentVersion.findFirst({
    where: { id: versionId, organizationId },
  });
  if (!version) throw new DocumentNotFoundError();
  return version;
}

async function recordStatus(
  tx: Tx,
  organizationId: string,
  documentId: string,
  versionId: string,
  fromStatus: string | null,
  toStatus: string,
  actorUserId: string,
  comment?: string,
) {
  await tx.documentStatusHistory.create({
    data: {
      organizationId,
      documentId,
      versionId,
      fromStatus,
      toStatus,
      actorUserId,
      comment: comment ?? null,
    },
  });
}

/** Asigna revisores y aprobadores (flujo secuencial). Autor/owner/admin. */
export async function assignWorkflow(
  organizationId: string,
  actorId: string,
  versionId: string,
  input: {
    reviewers: string[];
    approvers: string[];
    reviewerDueAt?: string | null;
    approverDueAt?: string | null;
  },
): Promise<void> {
  const version = await loadVersion(organizationId, versionId);
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role) && version.author !== actorId) {
    throw new WorkflowPermissionError('Solo el elaborador o un administrador configura el flujo.');
  }
  if (!isEditableStatus(version.status as VersionStatus)) {
    throw new WorkflowValidationError([
      'El flujo solo se configura en borrador o cambios solicitados.',
    ]);
  }
  const reviewers = [...new Set(input.reviewers.filter(Boolean))];
  const approvers = [...new Set(input.approvers.filter(Boolean))];
  if (reviewers.length === 0 || approvers.length === 0) {
    throw new WorkflowValidationError(['Asigna al menos un revisor y un aprobador.']);
  }
  const members = await getPrisma().membership.findMany({
    where: { organizationId, userId: { in: [...reviewers, ...approvers] } },
    select: { userId: true },
  });
  const memberSet = new Set(members.map((m) => m.userId));
  if ([...reviewers, ...approvers].some((u) => !memberSet.has(u))) {
    throw new WorkflowValidationError(['Todos los asignados deben pertenecer a la organización.']);
  }

  await withOrgContext(organizationId, async (tx) => {
    const wf = await tx.documentWorkflow.upsert({
      where: { versionId },
      create: {
        organizationId,
        documentId: version.documentId,
        versionId,
        stage: 'elaboration',
        createdBy: actorId,
      },
      update: { stage: 'elaboration' },
    });
    // Cancela asignaciones previas y crea las nuevas.
    await tx.documentWorkflowStep.updateMany({
      where: { versionId, organizationId, status: 'pending' },
      data: { status: 'cancelled' },
    });
    let seq = 1;
    for (const u of reviewers) {
      await tx.documentWorkflowStep.create({
        data: {
          organizationId,
          workflowId: wf.id,
          documentId: version.documentId,
          versionId,
          role: 'reviewer',
          userId: u,
          sequence: seq,
          dueAt: input.reviewerDueAt ? new Date(input.reviewerDueAt) : null,
        },
      });
    }
    seq = 2;
    for (const u of approvers) {
      await tx.documentWorkflowStep.create({
        data: {
          organizationId,
          workflowId: wf.id,
          documentId: version.documentId,
          versionId,
          role: 'approver',
          userId: u,
          sequence: seq,
          dueAt: input.approverDueAt ? new Date(input.approverDueAt) : null,
        },
      });
    }
  });
}

function hasContent(contentJson: Prisma.JsonValue | null): boolean {
  const doc = contentJson as unknown as DocNode | null;
  return Boolean(doc && Array.isArray(doc.content) && doc.content.length > 0);
}

/** Envía a revisión (bloquea edición). Elaborador o admin. */
export async function submitForReview(
  organizationId: string,
  actorId: string,
  versionId: string,
): Promise<void> {
  const version = await loadVersion(organizationId, versionId);
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role) && version.author !== actorId) {
    throw new WorkflowPermissionError('Solo el elaborador o un administrador envía a revisión.');
  }
  if (!isEditableStatus(version.status as VersionStatus)) {
    throw new WorkflowValidationError([
      'Solo un borrador o con cambios solicitados puede enviarse a revisión.',
    ]);
  }
  const doc = await getPrisma().document.findFirstOrThrow({
    where: { id: version.documentId, organizationId },
  });
  const steps = await getPrisma().documentWorkflowStep.findMany({
    where: { versionId, organizationId, status: { not: 'cancelled' } },
  });
  const errors: string[] = [];
  if (!doc.code?.trim()) errors.push('Falta el código.');
  if (!doc.title?.trim()) errors.push('Falta el título.');
  if (!version.label?.trim()) errors.push('Falta la versión.');
  if (!hasContent(version.contentJson)) errors.push('El contenido está vacío.');
  if (!doc.responsibleUserId) errors.push('Falta el responsable.');
  if (!version.changeNotes?.trim()) errors.push('Falta la nota de cambio.');
  if (!steps.some((s) => s.role === 'reviewer')) errors.push('Falta asignar un revisor.');
  if (!steps.some((s) => s.role === 'approver')) errors.push('Falta asignar un aprobador.');
  if (errors.length) throw new WorkflowValidationError(errors);

  assertVersionTransition(version.status as VersionStatus, 'in_review');
  await withOrgContext(organizationId, async (tx) => {
    await tx.documentVersion.update({ where: { id: versionId }, data: { status: 'in_review' } });
    await tx.documentWorkflowStep.updateMany({
      where: { versionId, organizationId, status: { in: ['changes_requested', 'rejected'] } },
      data: { status: 'pending', decidedAt: null, decidedBy: null },
    });
    await tx.documentWorkflow.updateMany({
      where: { versionId, organizationId },
      data: { stage: 'review' },
    });
    await recordStatus(
      tx,
      organizationId,
      version.documentId,
      versionId,
      version.status,
      'in_review',
      actorId,
    );
  });
}

async function assignedStep(
  organizationId: string,
  versionId: string,
  userId: string,
  role: string,
) {
  return getPrisma().documentWorkflowStep.findFirst({
    where: { versionId, organizationId, userId, role, status: 'pending' },
  });
}

/** Decisión de revisión: aprobar o solicitar cambios (comentario obligatorio). */
export async function reviewDecision(
  organizationId: string,
  actorId: string,
  versionId: string,
  input: { decision: 'approve' | 'request_changes'; comment?: string },
): Promise<void> {
  const version = await loadVersion(organizationId, versionId);
  if (version.status !== 'in_review')
    throw new WorkflowValidationError(['La versión no está en revisión.']);
  const step = await assignedStep(organizationId, versionId, actorId, 'reviewer');
  if (!step) throw new WorkflowPermissionError('No estás asignado como revisor de esta versión.');

  if (input.decision === 'request_changes') {
    if (!input.comment?.trim())
      throw new WorkflowValidationError(['El comentario es obligatorio al solicitar cambios.']);
    assertVersionTransition('in_review', 'changes_requested');
    await withOrgContext(organizationId, async (tx) => {
      await tx.documentWorkflowStep.update({
        where: { id: step.id },
        data: {
          status: 'changes_requested',
          decidedAt: new Date(),
          decidedBy: actorId,
          comment: input.comment,
        },
      });
      await tx.documentApproval.create({
        data: {
          organizationId,
          documentId: version.documentId,
          versionId,
          stepId: step.id,
          actorUserId: actorId,
          stage: 'review',
          decision: 'changes_requested',
          comment: input.comment,
          contentChecksum: version.contentChecksum,
        },
      });
      await tx.documentComment.create({
        data: {
          organizationId,
          documentId: version.documentId,
          versionId,
          author: actorId,
          stage: 'review',
          type: 'change_request',
          body: input.comment!,
        },
      });
      await tx.documentVersion.update({
        where: { id: versionId },
        data: { status: 'changes_requested' },
      });
      await tx.documentWorkflow.updateMany({
        where: { versionId, organizationId },
        data: { stage: 'elaboration' },
      });
      await recordStatus(
        tx,
        organizationId,
        version.documentId,
        versionId,
        'in_review',
        'changes_requested',
        actorId,
        input.comment,
      );
    });
    return;
  }

  await withOrgContext(organizationId, async (tx) => {
    await tx.documentWorkflowStep.update({
      where: { id: step.id },
      data: {
        status: 'approved',
        decidedAt: new Date(),
        decidedBy: actorId,
        comment: input.comment ?? null,
      },
    });
    await tx.documentApproval.create({
      data: {
        organizationId,
        documentId: version.documentId,
        versionId,
        stepId: step.id,
        actorUserId: actorId,
        stage: 'review',
        decision: 'approved',
        comment: input.comment ?? null,
        contentChecksum: version.contentChecksum,
      },
    });
    const pendingReviewers = await tx.documentWorkflowStep.count({
      where: { versionId, organizationId, role: 'reviewer', status: 'pending' },
    });
    if (pendingReviewers === 0) {
      assertVersionTransition('in_review', 'in_approval');
      await tx.documentVersion.update({
        where: { id: versionId },
        data: { status: 'in_approval' },
      });
      await tx.documentWorkflow.updateMany({
        where: { versionId, organizationId },
        data: { stage: 'approval' },
      });
      await recordStatus(
        tx,
        organizationId,
        version.documentId,
        versionId,
        'in_review',
        'in_approval',
        actorId,
      );
    }
  });
}

/** Decisión de aprobación: aprobar o rechazar (motivo obligatorio). */
export async function approvalDecision(
  organizationId: string,
  actorId: string,
  versionId: string,
  input: { decision: 'approve' | 'reject'; comment?: string },
): Promise<void> {
  const version = await loadVersion(organizationId, versionId);
  if (version.status !== 'in_approval')
    throw new WorkflowValidationError(['La versión no está en aprobación.']);
  const step = await assignedStep(organizationId, versionId, actorId, 'approver');
  if (!step) throw new WorkflowPermissionError('No estás asignado como aprobador de esta versión.');

  // El autor no aprueba su propio documento si hay otro aprobador asignado.
  if (input.decision === 'approve' && version.author === actorId) {
    const otherApprover = await getPrisma().documentWorkflowStep.count({
      where: {
        versionId,
        organizationId,
        role: 'approver',
        userId: { not: actorId },
        status: { not: 'cancelled' },
      },
    });
    if (otherApprover > 0) {
      throw new WorkflowPermissionError(
        'El autor no puede aprobar su propio documento cuando hay otro aprobador.',
      );
    }
  }

  if (input.decision === 'reject') {
    if (!input.comment?.trim())
      throw new WorkflowValidationError(['El motivo es obligatorio al rechazar.']);
    assertVersionTransition('in_approval', 'changes_requested');
    await withOrgContext(organizationId, async (tx) => {
      await tx.documentWorkflowStep.update({
        where: { id: step.id },
        data: {
          status: 'rejected',
          decidedAt: new Date(),
          decidedBy: actorId,
          comment: input.comment,
        },
      });
      await tx.documentApproval.create({
        data: {
          organizationId,
          documentId: version.documentId,
          versionId,
          stepId: step.id,
          actorUserId: actorId,
          stage: 'approval',
          decision: 'rejected',
          comment: input.comment,
          contentChecksum: version.contentChecksum,
        },
      });
      await tx.documentVersion.update({
        where: { id: versionId },
        data: { status: 'changes_requested' },
      });
      await tx.documentWorkflow.updateMany({
        where: { versionId, organizationId },
        data: { stage: 'elaboration' },
      });
      await recordStatus(
        tx,
        organizationId,
        version.documentId,
        versionId,
        'in_approval',
        'changes_requested',
        actorId,
        input.comment,
      );
    });
    return;
  }

  await withOrgContext(organizationId, async (tx) => {
    await tx.documentWorkflowStep.update({
      where: { id: step.id },
      data: {
        status: 'approved',
        decidedAt: new Date(),
        decidedBy: actorId,
        comment: input.comment ?? null,
      },
    });
    await tx.documentApproval.create({
      data: {
        organizationId,
        documentId: version.documentId,
        versionId,
        stepId: step.id,
        actorUserId: actorId,
        stage: 'approval',
        decision: 'approved',
        comment: input.comment ?? null,
        contentChecksum: version.contentChecksum,
      },
    });
    const pendingApprovers = await tx.documentWorkflowStep.count({
      where: { versionId, organizationId, role: 'approver', status: 'pending' },
    });
    if (pendingApprovers === 0) {
      assertVersionTransition('in_approval', 'approved');
      await tx.documentVersion.update({ where: { id: versionId }, data: { status: 'approved' } });
      await recordStatus(
        tx,
        organizationId,
        version.documentId,
        versionId,
        'in_approval',
        'approved',
        actorId,
      );
    }
  });
}

/** Publica una versión aprobada (owner/admin). Deja una sola vigente. */
export async function publishVersion(
  organizationId: string,
  actorId: string,
  versionId: string,
  effectiveAt?: string | null,
): Promise<void> {
  const version = await loadVersion(organizationId, versionId);
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role)) throw new WorkflowPermissionError('Solo owner/admin puede publicar.');
  if (version.status !== 'approved')
    throw new WorkflowValidationError(['Solo una versión aprobada puede publicarse.']);
  assertVersionTransition('approved', 'published');

  await withOrgContext(organizationId, async (tx) => {
    // Obsoleta la versión vigente anterior (identificada por status=published).
    const prev = await tx.documentVersion.findMany({
      where: { documentId: version.documentId, organizationId, status: 'published' },
    });
    for (const p of prev) {
      if (p.id === versionId) continue;
      await tx.documentVersion.update({
        where: { id: p.id },
        data: { status: 'obsolete', isCurrent: false },
      });
      await recordStatus(
        tx,
        organizationId,
        version.documentId,
        p.id,
        p.status,
        'obsolete',
        actorId,
        'Reemplazada por nueva versión.',
      );
      await tx.documentDistribution.updateMany({
        where: { versionId: p.id, organizationId, status: 'active' },
        data: { status: 'superseded' },
      });
      await tx.documentControlledCopy.updateMany({
        where: { versionId: p.id, organizationId, status: 'active' },
        data: { status: 'pending_recovery' },
      });
    }
    await tx.documentVersion.update({
      where: { id: versionId },
      data: {
        status: 'published',
        isCurrent: true,
        publishedAt: new Date(),
      },
    });
    await tx.document.update({
      where: { id: version.documentId },
      data: {
        status: 'effective',
        currentVersionLabel: version.label,
        effectiveAt: effectiveAt ? new Date(`${effectiveAt}T00:00:00.000Z`) : new Date(),
      },
    });
    await tx.documentWorkflow.updateMany({
      where: { versionId, organizationId },
      data: { stage: 'published' },
    });
    await recordStatus(
      tx,
      organizationId,
      version.documentId,
      versionId,
      'approved',
      'published',
      actorId,
    );
  });
}

/** Obsoleta una versión vigente (owner/admin). */
export async function obsoleteVersion(
  organizationId: string,
  actorId: string,
  versionId: string,
  reason: string,
): Promise<void> {
  const version = await loadVersion(organizationId, versionId);
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role)) throw new WorkflowPermissionError('Solo owner/admin puede obsoletar.');
  if (version.status !== 'published')
    throw new WorkflowValidationError(['Solo una versión vigente puede obsoletarse.']);
  assertVersionTransition('published', 'obsolete');
  await withOrgContext(organizationId, async (tx) => {
    await tx.documentVersion.update({
      where: { id: versionId },
      data: { status: 'obsolete', isCurrent: false },
    });
    await recordStatus(
      tx,
      organizationId,
      version.documentId,
      versionId,
      'published',
      'obsolete',
      actorId,
      reason,
    );
  });
}

/** Distribuye el documento vigente a un destino. owner/admin. */
export async function distributeDocument(
  organizationId: string,
  actorId: string,
  documentId: string,
  input: {
    targetType: 'organization' | 'site' | 'user' | 'role';
    siteId?: string;
    userId?: string;
    role?: string;
    readRequired?: boolean;
    readDueAt?: string | null;
  },
): Promise<void> {
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role)) throw new WorkflowPermissionError('Solo owner/admin puede distribuir.');
  const current = await getPrisma().documentVersion.findFirst({
    where: { documentId, organizationId, isCurrent: true, status: 'published' },
  });
  if (!current)
    throw new WorkflowValidationError([
      'El documento no tiene una versión vigente que distribuir.',
    ]);

  await withOrgContext(organizationId, async (tx) => {
    await tx.documentDistribution.create({
      data: {
        organizationId,
        documentId,
        versionId: current.id,
        targetType: input.targetType,
        siteId: input.siteId ?? null,
        userId: input.userId ?? null,
        role: input.role ?? null,
        distributedBy: actorId,
        readRequired: input.readRequired ?? true,
        readDueAt: input.readDueAt ? new Date(input.readDueAt) : null,
      },
    });
  });
}

/** Usuarios destinatarios (resolución simplificada: user/role/organization; site→org). */
async function distributionTargetsUser(
  distribution: { targetType: string; userId: string | null; role: string | null },
  userId: string,
  userRole: string,
): Promise<boolean> {
  switch (distribution.targetType) {
    case 'user':
      return distribution.userId === userId;
    case 'role':
      return distribution.role === userRole;
    case 'organization':
    case 'site':
      return true; // site se trata como organización (limitación documentada)
    default:
      return false;
  }
}

/** Lecturas pendientes para un usuario (distribución activa sin acuse). */
export async function pendingReads(organizationId: string, userId: string) {
  const prisma = getPrisma();
  const role = await memberRole(organizationId, userId);
  const distributions = await prisma.documentDistribution.findMany({
    where: { organizationId, status: 'active', readRequired: true },
    orderBy: { distributedAt: 'desc' },
  });
  const acks = await prisma.documentReadAck.findMany({
    where: { organizationId, userId },
    select: { versionId: true },
  });
  const ackedVersions = new Set(acks.map((a) => a.versionId));
  const result: {
    distributionId: string;
    documentId: string;
    versionId: string;
    readDueAt: Date | null;
  }[] = [];
  const seen = new Set<string>();
  for (const d of distributions) {
    if (ackedVersions.has(d.versionId)) continue;
    if (seen.has(d.versionId)) continue;
    if (await distributionTargetsUser(d, userId, role)) {
      seen.add(d.versionId);
      result.push({
        distributionId: d.id,
        documentId: d.documentId,
        versionId: d.versionId,
        readDueAt: d.readDueAt,
      });
    }
  }
  return result;
}

/** Confirma la lectura de una versión distribuida (único por usuario y versión). */
export async function acknowledgeRead(
  organizationId: string,
  userId: string,
  versionId: string,
  providedChecksum: string,
): Promise<void> {
  const version = await loadVersion(organizationId, versionId);
  const pend = await pendingReads(organizationId, userId);
  if (!pend.some((p) => p.versionId === versionId)) {
    throw new WorkflowPermissionError('No tienes una lectura pendiente de esta versión.');
  }
  if (!version.contentChecksum || providedChecksum !== version.contentChecksum) {
    throw new WorkflowValidationError([
      'No puedes confirmar una versión distinta a la distribuida.',
    ]);
  }
  try {
    await withOrgContext(organizationId, async (tx) => {
      await tx.documentReadAck.create({
        data: {
          organizationId,
          documentId: version.documentId,
          versionId,
          userId,
          contentChecksum: version.contentChecksum!,
          statement: 'Confirmo que he leído y comprendido esta versión del documento.',
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new WorkflowValidationError(['Ya confirmaste la lectura de esta versión.']);
    }
    throw error;
  }
}

/** Registra una copia controlada (número único por versión). owner/admin. */
export async function registerControlledCopy(
  organizationId: string,
  actorId: string,
  versionId: string,
  input: { recipient: string; format: 'digital' | 'printed'; notes?: string | null },
): Promise<number> {
  const version = await loadVersion(organizationId, versionId);
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role))
    throw new WorkflowPermissionError('Solo owner/admin registra copias controladas.');
  if (!input.recipient?.trim())
    throw new WorkflowValidationError(['El destinatario es obligatorio.']);

  return withOrgContext(organizationId, async (tx) => {
    const max = await tx.documentControlledCopy.aggregate({
      where: { versionId, organizationId },
      _max: { copyNumber: true },
    });
    const copyNumber = (max._max.copyNumber ?? 0) + 1;
    await tx.documentControlledCopy.create({
      data: {
        organizationId,
        documentId: version.documentId,
        versionId,
        copyNumber,
        recipient: input.recipient.trim(),
        format: input.format,
        issuedBy: actorId,
        notes: input.notes ?? null,
      },
    });
    return copyNumber;
  });
}

/** Cambia el estado de una copia controlada (recuperada/destruida/reemplazada). */
export async function updateControlledCopy(
  organizationId: string,
  actorId: string,
  copyId: string,
  status: 'replaced' | 'recovered' | 'destroyed',
  notes?: string | null,
): Promise<void> {
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role))
    throw new WorkflowPermissionError('Solo owner/admin actualiza copias controladas.');
  const copy = await getPrisma().documentControlledCopy.findFirst({
    where: { id: copyId, organizationId },
  });
  if (!copy) throw new DocumentNotFoundError();
  await withOrgContext(organizationId, async (tx) => {
    await tx.documentControlledCopy.update({
      where: { id: copyId },
      data: { status, closedAt: new Date(), notes: notes ?? copy.notes },
    });
  });
}

/** Comentario asociado a una versión. */
export async function addComment(
  organizationId: string,
  actorId: string,
  versionId: string,
  input: { stage?: string; type?: string; body: string },
): Promise<void> {
  const version = await loadVersion(organizationId, versionId);
  if (!input.body?.trim())
    throw new WorkflowValidationError(['El comentario no puede estar vacío.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.documentComment.create({
      data: {
        organizationId,
        documentId: version.documentId,
        versionId,
        author: actorId,
        stage: input.stage ?? null,
        type: input.type ?? 'general',
        body: input.body.trim(),
      },
    });
  });
}

/** Bandeja de tareas del usuario. */
export async function getTasksInbox(organizationId: string, userId: string) {
  const prisma = getPrisma();
  const [reviewSteps, approvalSteps, changed, reads] = await Promise.all([
    prisma.documentWorkflowStep.findMany({
      where: { organizationId, userId, role: 'reviewer', status: 'pending' },
    }),
    prisma.documentWorkflowStep.findMany({
      where: { organizationId, userId, role: 'approver', status: 'pending' },
    }),
    prisma.documentVersion.findMany({
      where: { organizationId, author: userId, status: 'changes_requested' },
      select: { id: true, documentId: true, label: true },
    }),
    pendingReads(organizationId, userId),
  ]);

  const versionIds = [
    ...reviewSteps.map((s) => s.versionId),
    ...approvalSteps.map((s) => s.versionId),
    ...reads.map((r) => r.versionId),
  ];
  const versions = versionIds.length
    ? await prisma.documentVersion.findMany({
        where: { id: { in: versionIds }, organizationId },
        select: { id: true, label: true, status: true, documentId: true },
      })
    : [];
  const vMap = new Map(versions.map((v) => [v.id, v]));
  const docIds = [
    ...new Set(versions.map((v) => v.documentId).concat(changed.map((c) => c.documentId))),
  ];
  const docs = docIds.length
    ? await prisma.document.findMany({
        where: { id: { in: docIds }, organizationId },
        select: { id: true, code: true, title: true, siteId: true },
      })
    : [];
  const dMap = new Map(docs.map((d) => [d.id, d]));

  const decorate = (versionId: string, dueAt: Date | null) => {
    const v = vMap.get(versionId);
    const d = v ? dMap.get(v.documentId) : undefined;
    return {
      versionId,
      documentId: v?.documentId ?? '',
      code: d?.code ?? '',
      title: d?.title ?? '',
      label: v?.label ?? '',
      dueAt: dueAt ? dueAt.toISOString().slice(0, 10) : null,
    };
  };

  return {
    reviews: reviewSteps.map((s) => decorate(s.versionId, s.dueAt)),
    approvals: approvalSteps.map((s) => decorate(s.versionId, s.dueAt)),
    changesRequested: changed.map((c) => ({
      versionId: c.id,
      documentId: c.documentId,
      code: dMap.get(c.documentId)?.code ?? '',
      title: dMap.get(c.documentId)?.title ?? '',
      label: c.label,
      dueAt: null,
    })),
    pendingReads: reads.map((r) => decorate(r.versionId, r.readDueAt)),
  };
}

/** Alertas internas (contadores) para el dashboard. */
export async function getWorkflowAlerts(organizationId: string, userId: string) {
  const inbox = await getTasksInbox(organizationId, userId);
  const prisma = getPrisma();
  const t = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + reviewSoonDays() * 86400000).toISOString().slice(0, 10);
  const [dueSoon, overdue] = await Promise.all([
    prisma.document.count({
      where: {
        organizationId,
        status: 'effective',
        nextReviewAt: { gte: new Date(t), lte: new Date(soon) },
      },
    }),
    prisma.document.count({
      where: { organizationId, status: 'effective', nextReviewAt: { lt: new Date(t) } },
    }),
  ]);
  return {
    pendingReviews: inbox.reviews.length,
    pendingApprovals: inbox.approvals.length,
    changesRequested: inbox.changesRequested.length,
    pendingReads: inbox.pendingReads.length,
    reviewDueSoon: dueSoon,
    reviewOverdue: overdue,
  };
}

/** Datos de control para las pestañas del detalle documental. */
export async function getDocumentControl(organizationId: string, documentId: string) {
  const prisma = getPrisma();
  const doc = await prisma.document.findFirst({ where: { id: documentId, organizationId } });
  if (!doc) throw new DocumentNotFoundError();

  const [steps, approvals, distributions, reads, copies, statusHistory, comments, versions] =
    await Promise.all([
      prisma.documentWorkflowStep.findMany({
        where: { documentId, organizationId },
        orderBy: { sequence: 'asc' },
      }),
      prisma.documentApproval.findMany({
        where: { documentId, organizationId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.documentDistribution.findMany({
        where: { documentId, organizationId },
        orderBy: { distributedAt: 'desc' },
      }),
      prisma.documentReadAck.findMany({
        where: { documentId, organizationId },
        orderBy: { acknowledgedAt: 'desc' },
      }),
      prisma.documentControlledCopy.findMany({
        where: { documentId, organizationId },
        orderBy: { copyNumber: 'asc' },
      }),
      prisma.documentStatusHistory.findMany({
        where: { documentId, organizationId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.documentComment.findMany({
        where: { documentId, organizationId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.documentVersion.findMany({
        where: { documentId, organizationId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

  const userIds = new Set<string>();
  for (const s of steps) userIds.add(s.userId);
  for (const a of approvals) userIds.add(a.actorUserId);
  for (const r of reads) userIds.add(r.userId);
  const users = userIds.size
    ? await prisma.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, displayName: true, email: true },
      })
    : [];
  const uName = new Map(users.map((u) => [u.id, u.displayName ?? u.email]));

  return {
    doc,
    steps,
    approvals,
    distributions,
    reads,
    copies,
    statusHistory,
    comments,
    versions,
    uName,
  };
}

/** Contexto de permisos del usuario sobre una versión (para la interfaz). */
export async function getUserVersionContext(
  organizationId: string,
  userId: string,
  versionId: string,
) {
  const prisma = getPrisma();
  const version = await prisma.documentVersion.findFirst({
    where: { id: versionId, organizationId },
    select: { author: true, status: true },
  });
  if (!version) return null;
  const role =
    (
      await prisma.membership.findFirst({
        where: { organizationId, userId },
        select: { role: true },
      })
    )?.role ?? 'viewer';
  const [reviewerStep, approverStep, reads] = await Promise.all([
    prisma.documentWorkflowStep.findFirst({
      where: { versionId, organizationId, userId, role: 'reviewer', status: 'pending' },
    }),
    prisma.documentWorkflowStep.findFirst({
      where: { versionId, organizationId, userId, role: 'approver', status: 'pending' },
    }),
    pendingReads(organizationId, userId),
  ]);
  return {
    role,
    isAdmin: isAdmin(role),
    isAuthor: version.author === userId,
    isAssignedReviewer: Boolean(reviewerStep),
    isAssignedApprover: Boolean(approverStep),
    hasPendingRead: reads.some((r) => r.versionId === versionId),
  };
}

/** Recalcula el checksum de contenido (para comparar en aprobación/lectura). */
export function checksumOf(contentJson: unknown): string {
  return contentChecksum(
    (contentJson ?? { type: 'doc', content: [{ type: 'paragraph' }] }) as DocNode,
  );
}
