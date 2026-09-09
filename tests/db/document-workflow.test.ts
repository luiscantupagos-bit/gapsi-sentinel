/**
 * Control documental avanzado (TASK-006) contra la capa de datos. Requiere DB.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, newId, seedOrgWithPublishedTemplate } from './_helpers';
import {
  createEditorDocument,
  getEditorContent,
  saveContent,
  DocumentNotEditableError,
  DocumentNotFoundError,
} from '@/server/documents';
import {
  WorkflowPermissionError,
  WorkflowValidationError,
  acknowledgeRead,
  addComment,
  approvalDecision,
  assignWorkflow,
  distributeDocument,
  publishVersion,
  pendingReads,
  registerControlledCopy,
  reviewDecision,
  submitForReview,
} from '@/server/document-workflow';

async function addMember(orgId: string, role: string): Promise<string> {
  const id = newId();
  await db().user.create({ data: { id, email: `u-${id}@x.test` } });
  await db().membership.create({ data: { organizationId: orgId, userId: id, role } });
  return id;
}

async function setup() {
  const fx = await seedOrgWithPublishedTemplate(db()); // fx.userId = owner (autor)
  const reviewer = await addMember(fx.orgId, 'evaluator');
  const approver = await addMember(fx.orgId, 'evaluator');
  const viewer = await addMember(fx.orgId, 'viewer');
  const other = await addMember(fx.orgId, 'evaluator');
  const docId = await createEditorDocument(fx.orgId, fx.userId, {
    code: `CTRL-${newId().slice(0, 6)}`,
    title: 'Documento controlado',
    documentType: 'procedure',
    templateKey: 'procedure',
  });
  const content = await getEditorContent(fx.orgId, docId);
  await db().documentVersion.update({
    where: { id: content.versionId },
    data: { changeNotes: 'Versión inicial' },
  });
  return {
    orgId: fx.orgId,
    author: fx.userId,
    reviewer,
    approver,
    viewer,
    other,
    docId,
    versionId: content.versionId,
    pageConfig: content.pageConfig,
  };
}

async function assignAndSubmit(s: Awaited<ReturnType<typeof setup>>) {
  await assignWorkflow(s.orgId, s.author, s.versionId, {
    reviewers: [s.reviewer],
    approvers: [s.approver],
  });
  await submitForReview(s.orgId, s.author, s.versionId);
}

describe.skipIf(!hasDb)('control documental — flujo y permisos', () => {
  it('envía a revisión y bloquea la edición', async () => {
    const s = await setup();
    await assignAndSubmit(s);
    const c = await getEditorContent(s.orgId, s.docId, s.versionId);
    expect(c.versionStatus).toBe('in_review');
    expect(c.editable).toBe(false);
    await expect(
      saveContent(s.orgId, s.author, s.docId, s.versionId, {
        contentJson: c.contentJson,
        pageConfig: s.pageConfig,
      }),
    ).rejects.toBeInstanceOf(DocumentNotEditableError);
  });

  it('un usuario no asignado no puede revisar; el revisor asignado sí', async () => {
    const s = await setup();
    await assignAndSubmit(s);
    await expect(
      reviewDecision(s.orgId, s.other, s.versionId, { decision: 'approve' }),
    ).rejects.toBeInstanceOf(WorkflowPermissionError);
    await reviewDecision(s.orgId, s.reviewer, s.versionId, { decision: 'approve' });
    const c = await getEditorContent(s.orgId, s.docId, s.versionId);
    expect(c.versionStatus).toBe('in_approval');
  });

  it('solicitar cambios exige comentario y devuelve a edición', async () => {
    const s = await setup();
    await assignAndSubmit(s);
    await expect(
      reviewDecision(s.orgId, s.reviewer, s.versionId, { decision: 'request_changes' }),
    ).rejects.toBeInstanceOf(WorkflowValidationError);
    await reviewDecision(s.orgId, s.reviewer, s.versionId, {
      decision: 'request_changes',
      comment: 'Corregir el objetivo',
    });
    const c = await getEditorContent(s.orgId, s.docId, s.versionId);
    expect(c.versionStatus).toBe('changes_requested');
    expect(c.editable).toBe(true);
  });

  it('aprueba revisión y aprobación; queda aprobado y no editable', async () => {
    const s = await setup();
    await assignAndSubmit(s);
    await reviewDecision(s.orgId, s.reviewer, s.versionId, { decision: 'approve' });
    await approvalDecision(s.orgId, s.approver, s.versionId, {
      decision: 'approve',
      comment: 'Ok',
    });
    const c = await getEditorContent(s.orgId, s.docId, s.versionId);
    expect(c.versionStatus).toBe('approved');
    expect(c.editable).toBe(false);
  });

  it('rechazar exige motivo y vuelve a cambios solicitados', async () => {
    const s = await setup();
    await assignAndSubmit(s);
    await reviewDecision(s.orgId, s.reviewer, s.versionId, { decision: 'approve' });
    await expect(
      approvalDecision(s.orgId, s.approver, s.versionId, { decision: 'reject' }),
    ).rejects.toBeInstanceOf(WorkflowValidationError);
    await approvalDecision(s.orgId, s.approver, s.versionId, {
      decision: 'reject',
      comment: 'No cumple',
    });
    const c = await getEditorContent(s.orgId, s.docId, s.versionId);
    expect(c.versionStatus).toBe('changes_requested');
  });

  it('el autor no aprueba su propio documento si hay otro aprobador', async () => {
    const s = await setup();
    await assignWorkflow(s.orgId, s.author, s.versionId, {
      reviewers: [s.reviewer],
      approvers: [s.author, s.approver],
    });
    await submitForReview(s.orgId, s.author, s.versionId);
    await reviewDecision(s.orgId, s.reviewer, s.versionId, { decision: 'approve' });
    await expect(
      approvalDecision(s.orgId, s.author, s.versionId, { decision: 'approve' }),
    ).rejects.toBeInstanceOf(WorkflowPermissionError);
  });

  it('publica: una sola vigente, checksum aprobado y aprobación append-only', async () => {
    const s = await setup();
    await assignAndSubmit(s);
    await reviewDecision(s.orgId, s.reviewer, s.versionId, { decision: 'approve' });
    await approvalDecision(s.orgId, s.approver, s.versionId, { decision: 'approve' });
    await publishVersion(s.orgId, s.author, s.versionId);
    const version = await db().documentVersion.findUniqueOrThrow({ where: { id: s.versionId } });
    expect(version.status).toBe('published');
    expect(version.isCurrent).toBe(true);
    const current = await db().documentVersion.count({
      where: { documentId: s.docId, isCurrent: true },
    });
    expect(current).toBe(1);
    // Aprobación registró el checksum de la versión.
    const approval = await db().documentApproval.findFirstOrThrow({
      where: { versionId: s.versionId, stage: 'approval', decision: 'approved' },
    });
    expect(approval.contentChecksum).toBe(version.contentChecksum);
    // Append-only: no se puede actualizar la aprobación.
    await expect(
      db().documentApproval.update({ where: { id: approval.id }, data: { comment: 'x' } }),
    ).rejects.toThrow();
  });

  it('distribución crea lectura pendiente; solo el destinatario confirma; única por versión', async () => {
    const s = await setup();
    await assignAndSubmit(s);
    await reviewDecision(s.orgId, s.reviewer, s.versionId, { decision: 'approve' });
    await approvalDecision(s.orgId, s.approver, s.versionId, { decision: 'approve' });
    await publishVersion(s.orgId, s.author, s.versionId);
    await distributeDocument(s.orgId, s.author, s.docId, {
      targetType: 'user',
      userId: s.reviewer,
    });

    const pend = await pendingReads(s.orgId, s.reviewer);
    expect(pend.some((p) => p.versionId === s.versionId)).toBe(true);
    // Otro usuario no tiene esa lectura pendiente.
    expect((await pendingReads(s.orgId, s.other)).some((p) => p.versionId === s.versionId)).toBe(
      false,
    );

    const version = await db().documentVersion.findUniqueOrThrow({ where: { id: s.versionId } });
    // Checksum distinto → rechazo.
    await expect(acknowledgeRead(s.orgId, s.reviewer, s.versionId, 'malo')).rejects.toBeInstanceOf(
      WorkflowValidationError,
    );
    await acknowledgeRead(s.orgId, s.reviewer, s.versionId, version.contentChecksum!);
    // Segunda confirmación → única.
    await expect(
      acknowledgeRead(s.orgId, s.reviewer, s.versionId, version.contentChecksum!),
    ).rejects.toBeInstanceOf(WorkflowPermissionError);
    const ack = await db().documentReadAck.findFirstOrThrow({
      where: { versionId: s.versionId, userId: s.reviewer },
    });
    expect(ack.contentChecksum).toBe(version.contentChecksum);
  });

  it('copias controladas: número único y pendiente de recuperación al obsoletar', async () => {
    const s = await setup();
    await assignAndSubmit(s);
    await reviewDecision(s.orgId, s.reviewer, s.versionId, { decision: 'approve' });
    await approvalDecision(s.orgId, s.approver, s.versionId, { decision: 'approve' });
    await publishVersion(s.orgId, s.author, s.versionId);
    const n1 = await registerControlledCopy(s.orgId, s.author, s.versionId, {
      recipient: 'Planta',
      format: 'printed',
    });
    const n2 = await registerControlledCopy(s.orgId, s.author, s.versionId, {
      recipient: 'Oficina',
      format: 'digital',
    });
    expect(n1).toBe(1);
    expect(n2).toBe(2);

    // Nueva versión publicada → la anterior obsoleta y su copia pendiente de recuperación.
    const v2 = await createEditorDocumentSecondVersion(s);
    await publishVersion(s.orgId, s.author, v2);
    const oldVersion = await db().documentVersion.findUniqueOrThrow({ where: { id: s.versionId } });
    expect(oldVersion.status).toBe('obsolete');
    const copy = await db().documentControlledCopy.findFirstOrThrow({
      where: { versionId: s.versionId, copyNumber: 1 },
    });
    expect(copy.status).toBe('pending_recovery');
  });

  it('viewer no puede enviar a revisión; aislamiento entre organizaciones', async () => {
    const s = await setup();
    await assignWorkflow(s.orgId, s.author, s.versionId, {
      reviewers: [s.reviewer],
      approvers: [s.approver],
    });
    await expect(submitForReview(s.orgId, s.viewer, s.versionId)).rejects.toBeInstanceOf(
      WorkflowPermissionError,
    );
    // Otra organización no puede tocar esta versión.
    const b = await seedOrgWithPublishedTemplate(db());
    await expect(submitForReview(b.orgId, b.userId, s.versionId)).rejects.toBeInstanceOf(
      DocumentNotFoundError,
    );
    await expect(addComment(b.orgId, b.userId, s.versionId, { body: 'x' })).rejects.toBeInstanceOf(
      DocumentNotFoundError,
    );
  });
});

/** Crea una segunda versión borrador y la lleva a aprobada (para publicar). */
async function createEditorDocumentSecondVersion(
  s: Awaited<ReturnType<typeof setup>>,
): Promise<string> {
  const { createEditorVersion } = await import('@/server/documents');
  const v2 = await createEditorVersion(s.orgId, s.author, s.docId, {
    label: 'v2',
    changeNotes: 'segunda',
  });
  await assignWorkflow(s.orgId, s.author, v2, { reviewers: [s.reviewer], approvers: [s.approver] });
  await submitForReview(s.orgId, s.author, v2);
  await reviewDecision(s.orgId, s.reviewer, v2, { decision: 'approve' });
  await approvalDecision(s.orgId, s.approver, v2, { decision: 'approve' });
  return v2;
}
