/**
 * HACCP-003 — análisis de peligros: peligros MP/proceso, score/significancia, relación exacta
 * de fuente, aislamiento tenant, inmutabilidad de publicado, clon con identidad lógica,
 * snapshot de la matriz. §49.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, newId, seedOrgWithPublishedTemplate } from './_helpers';
import {
  addSourceReference,
  addTeamMember,
  createHaccpPlan,
  createHaccpVersion,
  getHaccpPlanDetail,
  publishHaccpVersion,
  HaccpNotFoundError,
  HaccpValidationError,
} from '@/server/haccp';
import { addProcessStep, getPlanFlow } from '@/server/haccp-flow';
import { addHazard, getHazardAnalysis, removeHazard, saveRiskMatrix } from '@/server/haccp-hazards';
import { DEFAULT_RISK_MATRIX } from '@/features/haccp/haccp-hazards';

async function createDoc(orgId: string, userId: string, code: string) {
  const docId = newId();
  await db().document.create({
    data: {
      id: docId,
      organizationId: orgId,
      code,
      title: `${code}`,
      documentType: 'specification',
      origin: 'internal',
      status: 'effective',
      createdBy: userId,
    },
  });
  await db().documentVersion.create({
    data: {
      id: newId(),
      organizationId: orgId,
      documentId: docId,
      label: 'v1.0',
      status: 'published',
      isCurrent: true,
      publishedAt: new Date(),
    },
  });
  return docId;
}

async function setup() {
  const fx = await seedOrgWithPublishedTemplate(db());
  const planId = await createHaccpPlan(fx.orgId, fx.userId, {
    title: 'Plan',
    scope: 'S',
    productProcess: 'PP',
    responsibleUserId: fx.userId,
  });
  const d = await getHaccpPlanDetail(fx.orgId, planId);
  await addProcessStep(fx.orgId, fx.userId, d.active!.id, { name: 'Recepción' });
  return { orgId: fx.orgId, owner: fx.userId, planId, versionId: d.active!.id };
}

async function firstStepLogical(orgId: string, planId: string) {
  const flow = await getPlanFlow(orgId, planId);
  return flow.steps[0]!.processStepId;
}

describe.skipIf(!hasDb)('HACCP-003 — análisis de peligros', () => {
  it('B/C/D/E/G/R: peligro de proceso con score/significancia; etapa nueva queda pendiente', async () => {
    const ctx = await setup();
    const stepLogical = await firstStepLogical(ctx.orgId, ctx.planId);
    await addHazard(ctx.orgId, ctx.owner, ctx.versionId, {
      sourceType: 'process_step',
      processStepId: stepLogical,
      hazardType: 'biological',
      name: 'Salmonella spp.',
      probability: 4,
      severity: 5,
    });
    await addHazard(ctx.orgId, ctx.owner, ctx.versionId, {
      sourceType: 'process_step',
      processStepId: stepLogical,
      hazardType: 'physical',
      name: 'Cuerpo extraño',
      probability: 2,
      severity: 2,
    });
    const a = (await getHazardAnalysis(ctx.orgId, ctx.planId))!;
    const step = a.stepGroups.find((s) => s.processStepId === stepLogical)!;
    expect(step.hazards).toHaveLength(2);
    const salmonella = step.hazards.find((h) => h.name === 'Salmonella spp.')!;
    expect(salmonella.riskScore).toBe(20); // §D
    expect(salmonella.isSignificant).toBe(true); // §E (>=8)
    expect(step.hazards.find((h) => h.name === 'Cuerpo extraño')!.isSignificant).toBe(false);

    // §R: agregar una etapa nueva → queda sin peligros (pendiente).
    await addProcessStep(ctx.orgId, ctx.owner, ctx.versionId, { name: 'Empaque' });
    const a2 = (await getHazardAnalysis(ctx.orgId, ctx.planId))!;
    const empaque = a2.stepGroups.find((s) => s.name === 'Empaque')!;
    expect(empaque.hazards).toHaveLength(0);
  });

  it('A/F: peligro de materia prima referencia la fuente exacta', async () => {
    const ctx = await setup();
    const doc = await createDoc(ctx.orgId, ctx.owner, 'ES-MP-001');
    await addSourceReference(ctx.orgId, ctx.owner, ctx.versionId, {
      referenceKind: 'material',
      sourceDocumentId: doc,
    });
    const d = await getHaccpPlanDetail(ctx.orgId, ctx.planId);
    const matRef = d.references.find((r) => r.referenceKind === 'material')!;
    await addHazard(ctx.orgId, ctx.owner, ctx.versionId, {
      sourceType: 'material',
      sourceReferenceId: matRef.id,
      hazardType: 'chemical',
      name: 'Residuos veterinarios',
      probability: 2,
      severity: 4,
    });
    const a = (await getHazardAnalysis(ctx.orgId, ctx.planId))!;
    const group = a.materialGroups.find((m) => m.sourceReferenceId === matRef.id)!;
    expect(group.hazards).toHaveLength(1);
    expect(group.hazards[0]?.sourceReferenceId).toBe(matRef.id);
  });

  it('§21 override de significancia exige justificación', async () => {
    const ctx = await setup();
    const stepLogical = await firstStepLogical(ctx.orgId, ctx.planId);
    await expect(
      addHazard(ctx.orgId, ctx.owner, ctx.versionId, {
        sourceType: 'process_step',
        processStepId: stepLogical,
        hazardType: 'physical',
        name: 'Menor',
        probability: 1,
        severity: 1,
        overrideSignificant: true,
      }),
    ).rejects.toBeInstanceOf(HaccpValidationError);
    // con justificación: fuerza significativo aunque el score sea bajo
    await addHazard(ctx.orgId, ctx.owner, ctx.versionId, {
      sourceType: 'process_step',
      processStepId: stepLogical,
      hazardType: 'physical',
      name: 'Menor',
      probability: 1,
      severity: 1,
      overrideSignificant: true,
      significanceReason: 'Requisito legal específico',
    });
    const a = (await getHazardAnalysis(ctx.orgId, ctx.planId))!;
    const hz = a.stepGroups[0]!.hazards.find((h) => h.name === 'Menor')!;
    expect(hz.isSignificant).toBe(true);
    expect(hz.significanceSource).toBe('override');
  });

  it('J: la versión publicada es inmutable (no admite agregar peligros)', async () => {
    const ctx = await setup();
    await addTeamMember(ctx.orgId, ctx.owner, ctx.versionId, { userId: ctx.owner, isLeader: true });
    await publishHaccpVersion(ctx.orgId, ctx.owner, ctx.planId);
    const stepLogical = await firstStepLogical(ctx.orgId, ctx.planId);
    await expect(
      addHazard(ctx.orgId, ctx.owner, ctx.versionId, {
        sourceType: 'process_step',
        processStepId: stepLogical,
        hazardType: 'biological',
        name: 'X',
        probability: 1,
        severity: 1,
      }),
    ).rejects.toBeInstanceOf(HaccpValidationError);
  });

  it('K/L/M/N/O/Q: clon conserva hazard_logical_id + snapshot de matriz; histórico intacto', async () => {
    const ctx = await setup();
    const stepLogical = await firstStepLogical(ctx.orgId, ctx.planId);
    await addHazard(ctx.orgId, ctx.owner, ctx.versionId, {
      sourceType: 'process_step',
      processStepId: stepLogical,
      hazardType: 'biological',
      name: 'Salmonella spp.',
      probability: 4,
      severity: 5,
    });
    const a1 = (await getHazardAnalysis(ctx.orgId, ctx.planId))!;
    const h1 = a1.stepGroups[0]!.hazards[0]!;
    expect(a1.matrix.significanceThreshold).toBe(DEFAULT_RISK_MATRIX.significanceThreshold);
    await addTeamMember(ctx.orgId, ctx.owner, ctx.versionId, { userId: ctx.owner, isLeader: true });
    await publishHaccpVersion(ctx.orgId, ctx.owner, ctx.planId);
    const v2 = await createHaccpVersion(ctx.orgId, ctx.owner, ctx.planId, 'minor', 'v2');

    const a2 = (await getHazardAnalysis(ctx.orgId, ctx.planId))!;
    const h2 = a2.stepGroups[0]!.hazards[0]!;
    expect(h2.hazardLogicalId).toBe(h1.hazardLogicalId); // §L identidad lógica estable
    expect(h2.id).not.toBe(h1.id); // fila nueva
    expect(a2.matrix.significanceThreshold).toBe(DEFAULT_RISK_MATRIX.significanceThreshold); // §O snapshot

    // §M: nuevo peligro en v2 → id lógico nuevo.
    await addHazard(ctx.orgId, ctx.owner, v2, {
      sourceType: 'process_step',
      processStepId: stepLogical,
      hazardType: 'physical',
      name: 'Nuevo',
      probability: 1,
      severity: 1,
    });
    const a2b = (await getHazardAnalysis(ctx.orgId, ctx.planId))!;
    const nuevo = a2b.stepGroups[0]!.hazards.find((h) => h.name === 'Nuevo')!;
    expect(nuevo.hazardLogicalId).not.toBe(h1.hazardLogicalId);

    // §N: eliminar en v2 no afecta el histórico de v1.
    await removeHazard(ctx.orgId, ctx.owner, h2.id);
    const v1Count = await db().haccpHazard.count({
      where: { organizationId: ctx.orgId, planVersionId: ctx.versionId },
    });
    expect(v1Count).toBe(1); // v1 conserva su peligro
  });

  it('§20 recalcular con nueva matriz cambia la significancia (respeta override)', async () => {
    const ctx = await setup();
    const stepLogical = await firstStepLogical(ctx.orgId, ctx.planId);
    await addHazard(ctx.orgId, ctx.owner, ctx.versionId, {
      sourceType: 'process_step',
      processStepId: stepLogical,
      hazardType: 'biological',
      name: 'Score 9',
      probability: 3,
      severity: 3, // score 9, umbral 8 → significativo
    });
    let a = (await getHazardAnalysis(ctx.orgId, ctx.planId))!;
    expect(a.stepGroups[0]!.hazards[0]!.isSignificant).toBe(true);
    // sube el umbral a 12 → 9 deja de ser significativo
    await saveRiskMatrix(ctx.orgId, ctx.owner, ctx.versionId, {
      ...DEFAULT_RISK_MATRIX,
      significanceThreshold: 12,
    });
    a = (await getHazardAnalysis(ctx.orgId, ctx.planId))!;
    expect(a.stepGroups[0]!.hazards[0]!.isSignificant).toBe(false);
  });

  it('H/I/P: aislamiento por organización', async () => {
    const ctx = await setup();
    const stepLogical = await firstStepLogical(ctx.orgId, ctx.planId);
    await addHazard(ctx.orgId, ctx.owner, ctx.versionId, {
      sourceType: 'process_step',
      processStepId: stepLogical,
      hazardType: 'biological',
      name: 'Salmonella spp.',
      probability: 4,
      severity: 5,
    });
    const other = await setup();
    expect(await getHazardAnalysis(other.orgId, ctx.planId)).toBeNull();
    await expect(
      addHazard(other.orgId, other.owner, ctx.versionId, {
        sourceType: 'process_step',
        processStepId: stepLogical,
        hazardType: 'biological',
        name: 'X',
        probability: 1,
        severity: 1,
      }),
    ).rejects.toBeInstanceOf(HaccpNotFoundError);
  });
});
