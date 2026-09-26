/**
 * HACCP-004 — selección de medidas de control: evaluación por árbol, clasificación, plan de
 * control, snapshot de metodología, needs_review, clon con identidad lógica, aislamiento. §47.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, seedOrgWithPublishedTemplate } from './_helpers';
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
import { addHazard, getHazardAnalysis, updateHazard } from '@/server/haccp-hazards';
import {
  getControlMeasures,
  removeAssessment,
  saveAssessment,
  saveControlPlan,
} from '@/server/haccp-control';

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
  const stepLogical = flow.steps[0]!.processStepId;
  // Peligro significativo (score 20).
  await addHazard(fx.orgId, fx.userId, d.active!.id, {
    sourceType: 'process_step',
    processStepId: stepLogical,
    hazardType: 'biological',
    name: 'Salmonella spp.',
    probability: 4,
    severity: 5,
  });
  const hz = (await getHazardAnalysis(fx.orgId, planId))!.stepGroups[0]!.hazards[0]!;
  return {
    orgId: fx.orgId,
    owner: fx.userId,
    planId,
    versionId: d.active!.id,
    hazardLogicalId: hz.hazardLogicalId,
  };
}

describe.skipIf(!hasDb)('HACCP-004 — medidas de control', () => {
  it('A/B/C/D/P: evalúa un peligro significativo → clasificación + snapshot de metodología', async () => {
    const ctx = await setup();
    await saveAssessment(ctx.orgId, ctx.owner, ctx.versionId, {
      hazardLogicalId: ctx.hazardLogicalId,
      answers: [
        { questionId: 'P1', answer: 'yes' },
        { questionId: 'P2', answer: 'yes' },
        { questionId: 'P3', answer: 'yes' },
      ],
      justification: 'Sin etapa posterior que lo controle.',
    });
    const cm = (await getControlMeasures(ctx.orgId, ctx.planId))!;
    expect(cm.assessments).toHaveLength(1);
    const a = cm.assessments[0]!;
    expect(a.classification).toBe('pcc'); // §C calculado
    expect(a.justification).toBe('Sin etapa posterior que lo controle.'); // §D
    expect(a.path.map((p) => p.answer)).toEqual(['yes', 'yes', 'yes']); // §B/§Q
    // §P snapshot de metodología en la fila.
    const row = await db().haccpControlAssessment.findFirst({ where: { id: a.id } });
    expect(row?.methodKey).toBe('default');
    expect(row?.methodVersion).toBe('1');
    // el peligro sale de pendientes
    expect(cm.pending).toHaveLength(0);
  });

  it('E/F/G/H: plan de control por clasificación', async () => {
    const ctx = await setup();
    await saveAssessment(ctx.orgId, ctx.owner, ctx.versionId, {
      hazardLogicalId: ctx.hazardLogicalId,
      answers: [
        { questionId: 'P1', answer: 'yes' },
        { questionId: 'P2', answer: 'no' },
      ],
    });
    let cm = (await getControlMeasures(ctx.orgId, ctx.planId))!;
    expect(cm.assessments[0]!.classification).toBe('ppro');
    expect(cm.assessments[0]!.planComplete).toBe(false);
    await saveControlPlan(ctx.orgId, ctx.owner, cm.assessments[0]!.id, {
      controlMeasure: 'Cadena de frío',
      actionCriterion: 'Certificado vigente',
      monitoringWhat: 'Certificado',
      monitoringHow: 'Documental',
      monitoringWho: 'Calidad',
      monitoringWhen: 'Cada recepción',
      correctiveAction: 'Rechazar lote',
    });
    cm = (await getControlMeasures(ctx.orgId, ctx.planId))!;
    expect(cm.assessments[0]!.planComplete).toBe(true); // §G PPRO completo
    expect(cm.ppro).toHaveLength(1);
  });

  it('§9 override de clasificación exige justificación', async () => {
    const ctx = await setup();
    await expect(
      saveAssessment(ctx.orgId, ctx.owner, ctx.versionId, {
        hazardLogicalId: ctx.hazardLogicalId,
        answers: [{ questionId: 'P1', answer: 'no' }],
        overrideClassification: 'pcc',
      }),
    ).rejects.toBeInstanceOf(HaccpValidationError);
    await saveAssessment(ctx.orgId, ctx.owner, ctx.versionId, {
      hazardLogicalId: ctx.hazardLogicalId,
      answers: [{ questionId: 'P1', answer: 'no' }],
      overrideClassification: 'pcc',
      overrideReason: 'Requisito regulatorio',
    });
    const cm = (await getControlMeasures(ctx.orgId, ctx.planId))!;
    expect(cm.assessments[0]!.classification).toBe('pcc');
    expect(cm.assessments[0]!.classificationSource).toBe('override');
  });

  it('K: la versión publicada es inmutable', async () => {
    const ctx = await setup();
    await saveAssessment(ctx.orgId, ctx.owner, ctx.versionId, {
      hazardLogicalId: ctx.hazardLogicalId,
      answers: [{ questionId: 'P1', answer: 'no' }],
    });
    await addTeamMember(ctx.orgId, ctx.owner, ctx.versionId, { userId: ctx.owner, isLeader: true });
    await publishHaccpVersion(ctx.orgId, ctx.owner, ctx.planId);
    await expect(
      saveAssessment(ctx.orgId, ctx.owner, ctx.versionId, {
        hazardLogicalId: ctx.hazardLogicalId,
        answers: [{ questionId: 'P1', answer: 'yes' }],
      }),
    ).rejects.toBeInstanceOf(HaccpValidationError);
  });

  it('L/M/O/Q: clon conserva la evaluación; peligro no significativo → needs_review', async () => {
    const ctx = await setup();
    await saveAssessment(ctx.orgId, ctx.owner, ctx.versionId, {
      hazardLogicalId: ctx.hazardLogicalId,
      answers: [
        { questionId: 'P1', answer: 'yes' },
        { questionId: 'P2', answer: 'no' },
      ],
    });
    const cm1 = (await getControlMeasures(ctx.orgId, ctx.planId))!;
    const a1 = cm1.assessments[0]!;
    await addTeamMember(ctx.orgId, ctx.owner, ctx.versionId, { userId: ctx.owner, isLeader: true });
    await publishHaccpVersion(ctx.orgId, ctx.owner, ctx.planId);
    const v2 = await createHaccpVersion(ctx.orgId, ctx.owner, ctx.planId, 'minor', 'v2');

    const cm2 = (await getControlMeasures(ctx.orgId, ctx.planId))!;
    const a2 = cm2.assessments[0]!;
    expect(a2.controlMeasureLogicalId).toBe(a1.controlMeasureLogicalId); // §M estable
    expect(a2.id).not.toBe(a1.id);
    expect(a2.path.map((p) => p.answer)).toEqual(['yes', 'no']); // §Q intacto

    // §O: el peligro deja de ser significativo → needs_review (no se borra).
    const hz = (await getHazardAnalysis(ctx.orgId, ctx.planId))!.stepGroups[0]!.hazards[0]!;
    await updateHazard(ctx.orgId, ctx.owner, hz.id, { probability: 1, severity: 1 });
    const cm3 = (await getControlMeasures(ctx.orgId, ctx.planId))!;
    expect(cm3.assessments[0]!.needsReview).toBe(true);
  });

  it('I/J/R: aislamiento por organización', async () => {
    const ctx = await setup();
    await saveAssessment(ctx.orgId, ctx.owner, ctx.versionId, {
      hazardLogicalId: ctx.hazardLogicalId,
      answers: [{ questionId: 'P1', answer: 'no' }],
    });
    const other = await setup();
    expect(await getControlMeasures(other.orgId, ctx.planId)).toBeNull();
    await expect(
      saveAssessment(other.orgId, other.owner, ctx.versionId, {
        hazardLogicalId: ctx.hazardLogicalId,
        answers: [{ questionId: 'P1', answer: 'no' }],
      }),
    ).rejects.toBeInstanceOf(HaccpNotFoundError);
  });

  it('N: nuevo peligro significativo aparece como pendiente', async () => {
    const ctx = await setup();
    const cm = (await getControlMeasures(ctx.orgId, ctx.planId))!;
    expect(cm.pending.map((p) => p.hazardLogicalId)).toContain(ctx.hazardLogicalId);
    expect(cm.assessments).toHaveLength(0);
  });
});
