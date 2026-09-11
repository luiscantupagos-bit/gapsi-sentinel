/**
 * DOC-OUTPUT-FOLLOWUP §C/§I/§J — candado de recuperación de copias controladas,
 * recuperación completa (actor/fecha/disposición/reemplazo) y excepción de publicación
 * auditada. Requiere DB.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, newId, seedOrgWithPublishedTemplate } from './_helpers';
import { createStructuredDocument, createVersion } from '@/server/documents';
import {
  assignWorkflow,
  submitForReview,
  reviewDecision,
  approvalDecision,
  publishVersion,
  registerControlledCopy,
  updateControlledCopy,
  WorkflowValidationError,
  WorkflowPermissionError,
} from '@/server/document-workflow';

async function addMember(orgId: string, role: string): Promise<string> {
  const id = newId();
  await db().user.create({ data: { id, email: `u-${id}@x.test` } });
  await db().membership.create({ data: { organizationId: orgId, userId: id, role } });
  return id;
}

interface Ctx {
  orgId: string;
  owner: string;
  admin: string;
  reviewer: string;
  approver: string;
  docId: string;
}

async function setup(): Promise<Ctx> {
  const fx = await seedOrgWithPublishedTemplate(db()); // fx.userId = owner
  const admin = await addMember(fx.orgId, 'admin');
  const reviewer = await addMember(fx.orgId, 'evaluator');
  const approver = await addMember(fx.orgId, 'evaluator');
  const docId = await createStructuredDocument(fx.orgId, fx.userId, {
    documentType: 'procedure',
    title: 'Proc',
    areaCode: 'CA',
    structuredContent: { fields: { objetivo: 'O', alcance: 'A' }, repeatables: {} },
  } as never);
  return { orgId: fx.orgId, owner: fx.userId, admin, reviewer, approver, docId };
}

async function current(ctx: Ctx) {
  return db().documentVersion.findFirstOrThrow({
    where: { organizationId: ctx.orgId, documentId: ctx.docId, isCurrent: true },
  });
}

async function driveToApproved(ctx: Ctx, versionId: string) {
  await assignWorkflow(ctx.orgId, ctx.owner, versionId, {
    reviewers: [ctx.reviewer],
    approvers: [ctx.approver],
  });
  await submitForReview(ctx.orgId, ctx.owner, versionId);
  await reviewDecision(ctx.orgId, ctx.reviewer, versionId, { decision: 'approve' });
  await approvalDecision(ctx.orgId, ctx.approver, versionId, {
    decision: 'approve',
    comment: 'ok',
  });
}

async function publish(ctx: Ctx, versionId: string, exception?: { reason: string }) {
  await driveToApproved(ctx, versionId);
  await publishVersion(ctx.orgId, ctx.owner, versionId, null, exception);
}

describe.skipIf(!hasDb)('DOC-OUTPUT — recuperación de copias y excepción', () => {
  it('flujo completo: bloqueo, recuperación con disposición y desbloqueo', async () => {
    const ctx = await setup();
    const v1 = await current(ctx);
    await publish(ctx, v1.id);
    const printedN = await registerControlledCopy(ctx.orgId, ctx.owner, v1.id, {
      recipient: 'Planta',
      format: 'printed',
    });
    await registerControlledCopy(ctx.orgId, ctx.owner, v1.id, {
      recipient: 'Oficina',
      format: 'digital',
    });
    await createVersion(ctx.orgId, ctx.owner, ctx.docId, { bump: 'minor', changeNotes: 'v2' });
    const v2 = await current(ctx);
    await driveToApproved(ctx, v2.id);
    // §C: bloqueada por copia impresa activa.
    await expect(publishVersion(ctx.orgId, ctx.owner, v2.id)).rejects.toBeInstanceOf(
      WorkflowValidationError,
    );
    // §I: recuperación completa (actor + fecha + disposición).
    const printed = await db().documentControlledCopy.findFirstOrThrow({
      where: { versionId: v1.id, copyNumber: printedN },
    });
    await updateControlledCopy(ctx.orgId, ctx.owner, printed.id, 'destroyed', 'ok', {
      disposition: 'destroyed',
      confirmedBy: ctx.reviewer,
      recoveryNotes: 'Triturada',
    });
    const rec = await db().documentControlledCopy.findFirstOrThrow({ where: { id: printed.id } });
    expect(rec.status).toBe('destroyed');
    expect(rec.recoveredBy).toBe(ctx.owner);
    expect(rec.recoveredAt).not.toBeNull();
    expect(rec.disposition).toBe('destroyed');
    expect(rec.confirmedBy).toBe(ctx.reviewer);
    // Desbloqueada: publica.
    await publishVersion(ctx.orgId, ctx.owner, v2.id);
    const v1After = await db().documentVersion.findUniqueOrThrow({ where: { id: v1.id } });
    expect(v1After.status).toBe('obsolete');
    // Digital → Reemplazada (§C7).
    const digital = await db().documentControlledCopy.findFirstOrThrow({
      where: { versionId: v1.id, copyNumber: 2 },
    });
    expect(digital.status).toBe('replaced');
  });

  it('§J excepción: sin permiso (admin) denegada; sin motivo denegada; owner + motivo OK', async () => {
    const ctx = await setup();
    const v1 = await current(ctx);
    await publish(ctx, v1.id);
    await registerControlledCopy(ctx.orgId, ctx.owner, v1.id, {
      recipient: 'Planta',
      format: 'printed',
    });
    await createVersion(ctx.orgId, ctx.owner, ctx.docId, { bump: 'minor', changeNotes: 'v2' });
    const v2 = await current(ctx);
    await driveToApproved(ctx, v2.id);

    // admin (no owner) con excepción → permiso denegado.
    await expect(
      publishVersion(ctx.orgId, ctx.admin, v2.id, null, { reason: 'urgente' }),
    ).rejects.toBeInstanceOf(WorkflowPermissionError);
    // owner con excepción SIN motivo → validación.
    await expect(
      publishVersion(ctx.orgId, ctx.owner, v2.id, null, { reason: '   ' }),
    ).rejects.toBeInstanceOf(WorkflowValidationError);
    // owner con motivo → publica y registra la excepción con snapshot.
    await publishVersion(ctx.orgId, ctx.owner, v2.id, null, {
      reason: 'Publicación urgente por requisito regulatorio; recuperación en curso.',
    });
    const v2After = await db().documentVersion.findUniqueOrThrow({ where: { id: v2.id } });
    expect(v2After.status).toBe('published');
    const exc = await db().documentPublishException.findMany({
      where: { organizationId: ctx.orgId, documentId: ctx.docId },
    });
    expect(exc).toHaveLength(1);
    expect(exc[0]?.authorizedBy).toBe(ctx.owner);
    expect(Array.isArray(exc[0]?.pendingCopies)).toBe(true);
    const hist = await db().documentHistory.findMany({
      where: { documentId: ctx.docId, action: 'version.published_with_exception' },
    });
    expect(hist.length).toBe(1);
  });

  it('§L36 aislamiento por organización: otra org no ve las excepciones', async () => {
    const ctx = await setup();
    const other = newId();
    await db().organization.create({ data: { id: other, name: 'Otra' } });
    const rows = await db().documentPublishException.findMany({
      where: { organizationId: other },
    });
    expect(rows).toEqual([]);
  });
});
