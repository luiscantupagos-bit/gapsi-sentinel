/**
 * HACCP-001 — pruebas de base de datos: aislamiento por organización, versionado, equipo
 * (líder único), fuentes con versión exacta + snapshot, publicación, detección de
 * actualización, clon de versión e inmutabilidad. §58.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, newId, seedOrgWithPublishedTemplate } from './_helpers';
import {
  addSourceReference,
  addTeamMember,
  createHaccpPlan,
  createHaccpVersion,
  getHaccpPlanDetail,
  listHaccpPlans,
  publishHaccpVersion,
  updateSourceToLatest,
  HaccpValidationError,
} from '@/server/haccp';

async function addMember(orgId: string, role: string): Promise<string> {
  const id = newId();
  await db().user.create({ data: { id, email: `u-${id}@x.test` } });
  await db().membership.create({ data: { organizationId: orgId, userId: id, role } });
  return id;
}

async function createDoc(orgId: string, userId: string, code: string) {
  const docId = newId();
  const vId = newId();
  await db().document.create({
    data: {
      id: docId,
      organizationId: orgId,
      code,
      title: `${code} — ficha`,
      documentType: 'specification',
      origin: 'internal',
      status: 'effective',
      createdBy: userId,
    },
  });
  await db().documentVersion.create({
    data: {
      id: vId,
      organizationId: orgId,
      documentId: docId,
      label: 'v1.0',
      status: 'published',
      isCurrent: true,
      publishedAt: new Date(),
    },
  });
  return { docId, vId };
}

async function newPublishedVersion(orgId: string, docId: string, label: string) {
  await db().documentVersion.updateMany({
    where: { documentId: docId, organizationId: orgId, isCurrent: true },
    data: { isCurrent: false, status: 'obsolete' },
  });
  const vId = newId();
  await db().documentVersion.create({
    data: {
      id: vId,
      organizationId: orgId,
      documentId: docId,
      label,
      status: 'published',
      isCurrent: true,
      publishedAt: new Date(),
    },
  });
  return vId;
}

interface Ctx {
  orgId: string;
  owner: string;
}
async function setup(): Promise<Ctx> {
  const fx = await seedOrgWithPublishedTemplate(db());
  return { orgId: fx.orgId, owner: fx.userId };
}

async function fullPlan(ctx: Ctx): Promise<string> {
  const planId = await createHaccpPlan(ctx.orgId, ctx.owner, {
    title: 'Plan huevo',
    scope: 'Empaque de huevo',
    productProcess: 'Huevo fresco',
    responsibleUserId: ctx.owner,
    siteId: null,
  });
  const detail = await getHaccpPlanDetail(ctx.orgId, planId);
  await addTeamMember(ctx.orgId, ctx.owner, detail.active!.id, {
    userId: ctx.owner,
    haccpRole: 'Líder HACCP',
    isLeader: true,
  });
  return planId;
}

describe.skipIf(!hasDb)('HACCP-001 — módulo HACCP', () => {
  it('A/B/P: crea plan en org A; otra org no lo ve (RLS/tenant)', async () => {
    const ctx = await setup();
    const planId = await createHaccpPlan(ctx.orgId, ctx.owner, { title: 'Plan A' });
    const listA = await listHaccpPlans(ctx.orgId);
    expect(listA.find((p) => p.id === planId)).toBeTruthy();
    expect(listA[0]?.code).toBe('PL-HACCP-001');

    const other = await setup();
    const listB = await listHaccpPlans(other.orgId);
    expect(listB.find((p) => p.id === planId)).toBeUndefined();
  });

  it('C/D: equipo y líder único por versión', async () => {
    const ctx = await setup();
    const planId = await createHaccpPlan(ctx.orgId, ctx.owner, { title: 'P' });
    const d = await getHaccpPlanDetail(ctx.orgId, planId);
    const m2 = await addMember(ctx.orgId, 'admin');
    await addTeamMember(ctx.orgId, ctx.owner, d.active!.id, { userId: ctx.owner, isLeader: true });
    await addTeamMember(ctx.orgId, ctx.owner, d.active!.id, { userId: m2, isLeader: true });
    const after = await getHaccpPlanDetail(ctx.orgId, planId);
    expect(after.team).toHaveLength(2);
    expect(after.team.filter((t) => t.isLeader)).toHaveLength(1); // §11: solo 1 líder
    expect(after.team.find((t) => t.isLeader)?.userId).toBe(m2);
  });

  it('E/F/G/H: fuentes producto(≤1)/MP/PPR/documento sellan la versión exacta', async () => {
    const ctx = await setup();
    const planId = await createHaccpPlan(ctx.orgId, ctx.owner, { title: 'P' });
    const d = await getHaccpPlanDetail(ctx.orgId, planId);
    const pt = await createDoc(ctx.orgId, ctx.owner, 'ES-PT-001');
    const mp1 = await createDoc(ctx.orgId, ctx.owner, 'ES-MP-001');
    const mp2 = await createDoc(ctx.orgId, ctx.owner, 'ES-MP-002');
    const ppr = await createDoc(ctx.orgId, ctx.owner, 'PRO-01');
    const doc = await createDoc(ctx.orgId, ctx.owner, 'PR-CA-003');

    await addSourceReference(ctx.orgId, ctx.owner, d.active!.id, {
      referenceKind: 'product',
      sourceDocumentId: pt.docId,
    });
    await addSourceReference(ctx.orgId, ctx.owner, d.active!.id, {
      referenceKind: 'material',
      sourceDocumentId: mp1.docId,
    });
    await addSourceReference(ctx.orgId, ctx.owner, d.active!.id, {
      referenceKind: 'material',
      sourceDocumentId: mp2.docId,
    });
    await addSourceReference(ctx.orgId, ctx.owner, d.active!.id, {
      referenceKind: 'prerequisite',
      sourceDocumentId: ppr.docId,
      category: 'Limpieza y desinfección',
    });
    await addSourceReference(ctx.orgId, ctx.owner, d.active!.id, {
      referenceKind: 'document',
      sourceDocumentId: doc.docId,
    });

    const after = await getHaccpPlanDetail(ctx.orgId, planId);
    expect(after.references.filter((r) => r.referenceKind === 'product')).toHaveLength(1);
    expect(after.references.filter((r) => r.referenceKind === 'material')).toHaveLength(2);
    const prod = after.references.find((r) => r.referenceKind === 'product')!;
    expect(prod.sourceVersionId).toBe(pt.vId); // versión exacta
    expect(prod.code).toBe('ES-PT-001');

    // §12: agregar otro producto REEMPLAZA (≤1 por versión).
    const pt2 = await createDoc(ctx.orgId, ctx.owner, 'ES-PT-002');
    await addSourceReference(ctx.orgId, ctx.owner, d.active!.id, {
      referenceKind: 'product',
      sourceDocumentId: pt2.docId,
    });
    const after2 = await getHaccpPlanDetail(ctx.orgId, planId);
    expect(after2.references.filter((r) => r.referenceKind === 'product')).toHaveLength(1);
    expect(after2.references.find((r) => r.referenceKind === 'product')?.code).toBe('ES-PT-002');
  });

  it('I/J/K/M: publica (sella), nueva versión de fuente no cambia snapshot, detecta update', async () => {
    const ctx = await setup();
    const planId = await fullPlan(ctx);
    const d = await getHaccpPlanDetail(ctx.orgId, planId);
    const mp = await createDoc(ctx.orgId, ctx.owner, 'ES-MP-001');
    await addSourceReference(ctx.orgId, ctx.owner, d.active!.id, {
      referenceKind: 'material',
      sourceDocumentId: mp.docId,
    });
    await publishHaccpVersion(ctx.orgId, ctx.owner, planId);
    const published = await getHaccpPlanDetail(ctx.orgId, planId);
    expect(published.plan.status).toBe('published');
    const ref = published.references.find((r) => r.referenceKind === 'material')!;
    expect(ref.sourceVersionId).toBe(mp.vId); // §I snapshot sellado

    // La fuente saca una versión nueva → §J el snapshot NO cambia, §K se detecta update.
    const v2 = await newPublishedVersion(ctx.orgId, mp.docId, 'v2.0');
    const afterUpdate = await getHaccpPlanDetail(ctx.orgId, planId);
    const ref2 = afterUpdate.references.find((r) => r.referenceKind === 'material')!;
    expect(ref2.sourceVersionId).toBe(mp.vId); // sin cambio silencioso
    expect(ref2.updateAvailable).toBe(true);
    expect(afterUpdate.updatesAvailable).toBe(1);

    // §M: no se puede actualizar en versión publicada (inmutable).
    await expect(updateSourceToLatest(ctx.orgId, ctx.owner, ref2.id)).rejects.toBeInstanceOf(
      HaccpValidationError,
    );

    // §L: nueva versión clona las referencias con la MISMA versión exacta (no latest, §38).
    const draftId = await createHaccpVersion(ctx.orgId, ctx.owner, planId, 'minor', 'Ajuste');
    const draft = await getHaccpPlanDetail(ctx.orgId, planId);
    expect(draft.active!.id).toBe(draftId);
    expect(draft.active!.versionLabel).toBe('v1.1');
    const draftRef = draft.references.find((r) => r.referenceKind === 'material')!;
    expect(draftRef.sourceVersionId).toBe(mp.vId); // exacta anterior, no v2.0
    expect(draftRef.updateAvailable).toBe(true);

    // §39/§M: en el borrador SÍ se puede actualizar a la más reciente.
    await updateSourceToLatest(ctx.orgId, ctx.owner, draftRef.id);
    const draft2 = await getHaccpPlanDetail(ctx.orgId, planId);
    const updated = draft2.references.find((r) => r.referenceKind === 'material')!;
    expect(updated.sourceVersionId).toBe(v2);
    expect(updated.updateAvailable).toBe(false);
  });

  it('N: la versión publicada es inmutable (no admite editar equipo)', async () => {
    const ctx = await setup();
    const planId = await fullPlan(ctx);
    await publishHaccpVersion(ctx.orgId, ctx.owner, planId);
    const published = await getHaccpPlanDetail(ctx.orgId, planId);
    await expect(
      addTeamMember(ctx.orgId, ctx.owner, published.active!.id, { userId: ctx.owner }),
    ).rejects.toBeInstanceOf(HaccpValidationError);
  });

  it('O: no se puede referenciar un documento de otra organización (cross-tenant DENY)', async () => {
    const ctx = await setup();
    const other = await setup();
    const foreign = await createDoc(other.orgId, other.owner, 'ES-X-001');
    const planId = await createHaccpPlan(ctx.orgId, ctx.owner, { title: 'P' });
    const d = await getHaccpPlanDetail(ctx.orgId, planId);
    await expect(
      addSourceReference(ctx.orgId, ctx.owner, d.active!.id, {
        referenceKind: 'material',
        sourceDocumentId: foreign.docId,
      }),
    ).rejects.toBeInstanceOf(HaccpValidationError);
  });

  it('publicar sin equipo/líder falla (§35)', async () => {
    const ctx = await setup();
    const planId = await createHaccpPlan(ctx.orgId, ctx.owner, {
      title: 'P',
      scope: 'S',
      productProcess: 'PP',
      responsibleUserId: ctx.owner,
    });
    await expect(publishHaccpVersion(ctx.orgId, ctx.owner, planId)).rejects.toBeInstanceOf(
      HaccpValidationError,
    );
  });
});
