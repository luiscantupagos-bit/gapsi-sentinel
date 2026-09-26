/**
 * HACCP-005 — validación de medidas de control: creación, requisitos de «Satisfactoria»,
 * resultados (no satisfactoria/no concluyente → revisión), clon con identidad lógica,
 * inmutabilidad de publicado, aislamiento por organización. §44.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, newId, seedOrgWithPublishedTemplate } from './_helpers';
import {
  addTeamMember,
  createHaccpPlan,
  createHaccpVersion,
  getHaccpPlanDetail,
  publishHaccpVersion,
  HaccpNotFoundError,
  HaccpValidationError,
} from '@/server/haccp';
import { addProcessStep, getPlanFlow } from '@/server/haccp-flow';
import { addHazard, getHazardAnalysis } from '@/server/haccp-hazards';
import { saveAssessment, getControlMeasures } from '@/server/haccp-control';
import { getValidations, removeValidation, saveValidation } from '@/server/haccp-validation';

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
  const flow = await getPlanFlow(fx.orgId, planId);
  await addHazard(fx.orgId, fx.userId, d.active!.id, {
    sourceType: 'process_step',
    processStepId: flow.steps[0]!.processStepId,
    hazardType: 'biological',
    name: 'Salmonella spp.',
    probability: 4,
    severity: 5,
  });
  const hz = (await getHazardAnalysis(fx.orgId, planId))!.stepGroups[0]!.hazards[0]!;
  // Clasifica como PPRO (P1 yes, P2 no).
  await saveAssessment(fx.orgId, fx.userId, d.active!.id, {
    hazardLogicalId: hz.hazardLogicalId,
    answers: [
      { questionId: 'P1', answer: 'yes' },
      { questionId: 'P2', answer: 'no' },
    ],
  });
  const cm = (await getControlMeasures(fx.orgId, planId))!;
  return {
    orgId: fx.orgId,
    owner: fx.userId,
    planId,
    versionId: d.active!.id,
    measureLogical: cm.assessments[0]!.controlMeasureLogicalId,
  };
}

const satisfactory = {
  objective: 'Demostrar capacidad de control',
  methodType: 'literature',
  evidenceSummary: 'Literatura científica',
  acceptanceCriteria: 'Ausencia en el producto',
  conclusion: 'La medida es capaz',
  performedAt: '2026-09-01',
  result: 'satisfactory' as const,
};

describe.skipIf(!hasDb)('HACCP-005 — validación de medidas de control', () => {
  it('A/B/D: crea validación ligada al control (PPRO); aparece con su contexto', async () => {
    const ctx = await setup();
    await saveValidation(ctx.orgId, ctx.owner, ctx.versionId, {
      controlMeasureLogicalId: ctx.measureLogical,
      objective: 'Validar',
      methodType: 'literature',
      result: 'inconclusive',
    });
    const v = (await getValidations(ctx.orgId, ctx.planId))!;
    expect(v.validations).toHaveLength(1);
    expect(v.validations[0]!.classification).toBe('ppro'); // §D contexto
    expect(v.validations[0]!.hazardName).toBe('Salmonella spp.');
  });

  it('G: «Satisfactoria» exige requisitos mínimos (server-side)', async () => {
    const ctx = await setup();
    await expect(
      saveValidation(ctx.orgId, ctx.owner, ctx.versionId, {
        controlMeasureLogicalId: ctx.measureLogical,
        objective: 'x',
        result: 'satisfactory', // faltan campos
      }),
    ).rejects.toBeInstanceOf(HaccpValidationError);
    await saveValidation(ctx.orgId, ctx.owner, ctx.versionId, {
      controlMeasureLogicalId: ctx.measureLogical,
      performedByUserId: ctx.owner,
      ...satisfactory,
    });
    const v = (await getValidations(ctx.orgId, ctx.planId))!;
    expect(v.validations[0]!.status).toBe('satisfactory');
    expect(v.completeness.satisfactory).toBe(1);
    expect(v.pending).toHaveLength(0); // ya no está pendiente
  });

  it('E/F: evidencia por documento (referencia exacta)', async () => {
    const ctx = await setup();
    const docId = newId();
    await db().document.create({
      data: {
        id: docId,
        organizationId: ctx.orgId,
        code: 'ES-EV-001',
        title: 'Estudio',
        documentType: 'specification',
        origin: 'internal',
        status: 'effective',
      },
    });
    await saveValidation(ctx.orgId, ctx.owner, ctx.versionId, {
      controlMeasureLogicalId: ctx.measureLogical,
      evidenceDocumentId: docId,
      result: 'inconclusive',
    });
    const row = await db().haccpControlValidation.findFirst({
      where: { organizationId: ctx.orgId, planVersionId: ctx.versionId },
    });
    expect(row?.evidenceDocumentId).toBe(docId);
  });

  it('H/I: no satisfactoria / no concluyente → revisión requerida', async () => {
    const ctx = await setup();
    await saveValidation(ctx.orgId, ctx.owner, ctx.versionId, {
      controlMeasureLogicalId: ctx.measureLogical,
      result: 'unsatisfactory',
    });
    let v = (await getValidations(ctx.orgId, ctx.planId))!;
    expect(v.validations[0]!.status).toBe('unsatisfactory');
    expect(v.validations[0]!.needsReview).toBe(true); // §H
    await saveValidation(ctx.orgId, ctx.owner, ctx.versionId, {
      controlMeasureLogicalId: ctx.measureLogical,
      result: 'inconclusive',
    });
    v = (await getValidations(ctx.orgId, ctx.planId))!;
    expect(v.validations[0]!.status).toBe('needs_review'); // §I
  });

  it('L: la versión publicada es inmutable', async () => {
    const ctx = await setup();
    await saveValidation(ctx.orgId, ctx.owner, ctx.versionId, {
      controlMeasureLogicalId: ctx.measureLogical,
      result: 'inconclusive',
    });
    await addTeamMember(ctx.orgId, ctx.owner, ctx.versionId, { userId: ctx.owner, isLeader: true });
    await publishHaccpVersion(ctx.orgId, ctx.owner, ctx.planId);
    await expect(
      saveValidation(ctx.orgId, ctx.owner, ctx.versionId, {
        controlMeasureLogicalId: ctx.measureLogical,
        result: 'unsatisfactory',
      }),
    ).rejects.toBeInstanceOf(HaccpValidationError);
  });

  it('M/N/P: clon conserva validation_logical_id; histórico intacto', async () => {
    const ctx = await setup();
    await saveValidation(ctx.orgId, ctx.owner, ctx.versionId, {
      controlMeasureLogicalId: ctx.measureLogical,
      performedByUserId: ctx.owner,
      ...satisfactory,
    });
    const v1 = (await getValidations(ctx.orgId, ctx.planId))!.validations[0]!;
    await addTeamMember(ctx.orgId, ctx.owner, ctx.versionId, { userId: ctx.owner, isLeader: true });
    await publishHaccpVersion(ctx.orgId, ctx.owner, ctx.planId);
    await createHaccpVersion(ctx.orgId, ctx.owner, ctx.planId, 'minor', 'v2');
    const v2 = (await getValidations(ctx.orgId, ctx.planId))!.validations[0]!;
    expect(v2.validationLogicalId).toBe(v1.validationLogicalId); // §N estable
    expect(v2.id).not.toBe(v1.id);
    expect(v2.status).toBe('satisfactory'); // §P antecedente intacto
    // §P: v1 conserva su validación.
    const v1Count = await db().haccpControlValidation.count({
      where: { organizationId: ctx.orgId, planVersionId: ctx.versionId },
    });
    expect(v1Count).toBe(1);
  });

  it('J/K/Q: aislamiento por organización', async () => {
    const ctx = await setup();
    await saveValidation(ctx.orgId, ctx.owner, ctx.versionId, {
      controlMeasureLogicalId: ctx.measureLogical,
      result: 'inconclusive',
    });
    const other = await setup();
    expect(await getValidations(other.orgId, ctx.planId)).toBeNull();
    await expect(
      saveValidation(other.orgId, other.owner, ctx.versionId, {
        controlMeasureLogicalId: ctx.measureLogical,
        result: 'inconclusive',
      }),
    ).rejects.toBeInstanceOf(HaccpNotFoundError);
  });

  it('elimina la validación (draft)', async () => {
    const ctx = await setup();
    await saveValidation(ctx.orgId, ctx.owner, ctx.versionId, {
      controlMeasureLogicalId: ctx.measureLogical,
      result: 'inconclusive',
    });
    const v = (await getValidations(ctx.orgId, ctx.planId))!;
    await removeValidation(ctx.orgId, ctx.owner, v.validations[0]!.id);
    const after = (await getValidations(ctx.orgId, ctx.planId))!;
    expect(after.validations).toHaveLength(0);
    await expect(removeValidation(ctx.orgId, ctx.owner, newId())).rejects.toBeInstanceOf(
      HaccpNotFoundError,
    );
  });
});
