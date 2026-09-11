/**
 * DOC-CHANGE-CONTROL-FOLLOWUP — Control de cambios por versión FORMAL publicada,
 * contra la capa de datos. Una fila por versión publicada; los borradores no generan
 * filas; corte histórico por versión; change_notes obligatorio > v1.0. Requiere DB.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, newId, seedOrgWithPublishedTemplate } from './_helpers';
import { createStructuredDocument, createVersion, buildChangeLog } from '@/server/documents';
import {
  assignWorkflow,
  submitForReview,
  reviewDecision,
  approvalDecision,
  publishVersion,
  WorkflowValidationError,
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
  reviewer: string;
  approver: string;
  docId: string;
}

async function setup(): Promise<Ctx> {
  const fx = await seedOrgWithPublishedTemplate(db());
  const reviewer = await addMember(fx.orgId, 'evaluator');
  const approver = await addMember(fx.orgId, 'evaluator');
  const docId = await createStructuredDocument(fx.orgId, fx.userId, {
    documentType: 'procedure',
    title: 'Procedimiento de prueba',
    areaCode: 'CA',
    structuredContent: { fields: { objetivo: 'O', alcance: 'A' }, repeatables: {} },
  } as never);
  return { orgId: fx.orgId, owner: fx.userId, reviewer, approver, docId };
}

async function current(ctx: Ctx) {
  const v = await db().documentVersion.findFirst({
    where: { organizationId: ctx.orgId, documentId: ctx.docId, isCurrent: true },
  });
  if (!v) throw new Error('sin versión vigente');
  return v;
}

/** Lleva la versión hasta `approved` (sin publicar). */
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

async function publish(ctx: Ctx, versionId: string) {
  await driveToApproved(ctx, versionId);
  await publishVersion(ctx.orgId, ctx.owner, versionId);
}

/** Crea y publica la siguiente versión (mayor/menor) con su descripción. */
async function newVersion(ctx: Ctx, bump: 'minor' | 'major', changeNotes: string) {
  await createVersion(ctx.orgId, ctx.owner, ctx.docId, { bump, changeNotes });
  const v = await current(ctx);
  await publish(ctx, v.id);
  return v;
}

async function log(ctx: Ctx, uptoCreatedAt: Date) {
  return buildChangeLog(ctx.orgId, ctx.docId, uptoCreatedAt);
}

describe.skipIf(!hasDb)('DOC-CHANGE-CONTROL — control de cambios formal', () => {
  it('A. publicar v1.0 crea la primera fila formal («Documento nuevo»)', async () => {
    const ctx = await setup();
    const v10 = await current(ctx);
    await publish(ctx, v10.id);
    const rows = await log(ctx, new Date());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ version: '1.0', change: 'Documento nuevo' });
  });

  it('B. editar un borrador NO crea fila (solo versiones formales)', async () => {
    const ctx = await setup();
    await publish(ctx, (await current(ctx)).id);
    // Crea un borrador v1.1 (no publicado) — no debe aparecer en el control de cambios.
    await createVersion(ctx.orgId, ctx.owner, ctx.docId, { bump: 'minor', changeNotes: 'wip' });
    const draft = await current(ctx);
    expect(draft.status).toBe('draft');
    const rows = await log(ctx, draft.createdAt);
    expect(rows.map((r) => r.version)).toEqual(['1.0']); // sin la v1.1 borrador
  });

  it('C/D. publicar v1.1 y v2.0 agrega una fila por versión formal', async () => {
    const ctx = await setup();
    await publish(ctx, (await current(ctx)).id); // v1.0
    await newVersion(ctx, 'minor', 'Se aclara el criterio de inspección visual.'); // v1.1
    await newVersion(ctx, 'major', 'Se modifica el proceso de aprobación.'); // v2.0
    const rows = await log(ctx, new Date());
    expect(rows.map((r) => r.version)).toEqual(['1.0', '1.1', '2.0']);
    expect(rows[1]?.change).toContain('inspección visual');
    expect(rows[2]?.change).toContain('proceso de aprobación');
  });

  it('E/H. el histórico es inmutable y la anterior queda obsoleta', async () => {
    const ctx = await setup();
    await publish(ctx, (await current(ctx)).id);
    await newVersion(ctx, 'minor', 'Cambio menor.');
    const rowsAfter = await log(ctx, new Date());
    expect(rowsAfter[0]).toMatchObject({ version: '1.0', change: 'Documento nuevo' }); // v1.0 intacta
    const vs = await db().documentVersion.findMany({
      where: { organizationId: ctx.orgId, documentId: ctx.docId },
      orderBy: { createdAt: 'asc' },
    });
    expect(vs[0]?.status).toBe('obsolete'); // v1.0 reemplazada
    expect(vs[1]?.status).toBe('published'); // v1.1 vigente
  });

  it('F. change_notes obligatorio para publicar > v1.0 (server-side)', async () => {
    const ctx = await setup();
    await publish(ctx, (await current(ctx)).id); // v1.0
    await createVersion(ctx.orgId, ctx.owner, ctx.docId, {
      bump: 'minor',
      changeNotes: 'temporal',
    });
    const v11 = await current(ctx);
    await driveToApproved(ctx, v11.id);
    // Ya aprobada, se vacía la descripción: la publicación de una versión > v1.0 debe
    // rechazarse server-side por falta de descripción de cambios.
    await db().documentVersion.update({ where: { id: v11.id }, data: { changeNotes: '   ' } });
    await expect(publishVersion(ctx.orgId, ctx.owner, v11.id)).rejects.toBeInstanceOf(
      WorkflowValidationError,
    );
    // La v1.0 sí pudo publicarse sin notas (ocurrió arriba sin error).
  });

  it('G. la vigente es la última publicada (published + isCurrent)', async () => {
    const ctx = await setup();
    await publish(ctx, (await current(ctx)).id);
    await newVersion(ctx, 'major', 'Rediseño del flujo.');
    const currentV = await current(ctx);
    expect(currentV.label).toBe('v2.0');
    expect(currentV.status).toBe('published');
    expect(currentV.isCurrent).toBe(true);
  });

  it('I. «Realizado por» corresponde al actor de la versión (autor)', async () => {
    const ctx = await setup();
    await publish(ctx, (await current(ctx)).id);
    const rows = await log(ctx, new Date());
    const owner = await db().user.findUniqueOrThrow({ where: { id: ctx.owner } });
    expect(rows[0]?.author).toBe(owner.displayName ?? owner.email);
    expect(rows[0]?.author).not.toBe('—');
  });

  it('J. la fecha del control de cambios usa la publicación formal', async () => {
    const ctx = await setup();
    const v10 = await current(ctx);
    await publish(ctx, v10.id);
    const published = await db().documentVersion.findUniqueOrThrow({ where: { id: v10.id } });
    expect(published.publishedAt).not.toBeNull();
    const rows = await log(ctx, new Date());
    expect(rows[0]?.date).toBeTruthy(); // fecha formateada de publishedAt
  });

  it('K. la vista histórica solo muestra los cambios hasta esa versión', async () => {
    const ctx = await setup();
    const v10 = await current(ctx);
    await publish(ctx, v10.id);
    await newVersion(ctx, 'minor', 'Segundo cambio.'); // v1.1
    await newVersion(ctx, 'major', 'Tercer cambio.'); // v2.0
    // Al ver la v1.0 (corte por su createdAt) solo aparece la v1.0.
    const atV10 = await log(ctx, v10.createdAt);
    expect(atV10.map((r) => r.version)).toEqual(['1.0']);
    // Al ver todo (fecha actual) aparecen las tres.
    const all = await log(ctx, new Date());
    expect(all.map((r) => r.version)).toEqual(['1.0', '1.1', '2.0']);
  });

  it('L. aislamiento por organización', async () => {
    const ctx = await setup();
    await publish(ctx, (await current(ctx)).id);
    const otherOrg = newId();
    await db().organization.create({ data: { id: otherOrg, name: 'Otra' } });
    const rows = await buildChangeLog(otherOrg, ctx.docId, new Date());
    expect(rows).toEqual([]); // otra org no ve el control de cambios
  });
});
