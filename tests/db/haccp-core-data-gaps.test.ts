/**
 * HACCP-CORE-DATA-GAPS — uso previsto (paso 3, en HaccpPlanVersion) y disposición (paso 10, en el
 * plan de control): guardar, clonar en nueva versión, inmutabilidad de publicado, integridad
 * histórica, distinción corrección/disposición/acción correctiva, opcionales vacíos, aislamiento.
 * §G. Migración aditiva; sin entidades nuevas.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, newId, seedOrgWithPublishedTemplate } from './_helpers';
import {
  addTeamMember,
  createHaccpPlan,
  createHaccpVersion,
  getHaccpPlanDetail,
  publishHaccpVersion,
  saveIntendedUse,
  HaccpNotFoundError,
  HaccpValidationError,
} from '@/server/haccp';
import { addProcessStep, getPlanFlow } from '@/server/haccp-flow';
import { addHazard, getHazardAnalysis } from '@/server/haccp-hazards';
import { saveAssessment, saveControlPlan, getControlMeasures } from '@/server/haccp-control';

async function setup() {
  const fx = await seedOrgWithPublishedTemplate(db());
  const planId = await createHaccpPlan(fx.orgId, fx.userId, {
    title: 'Plan',
    scope: 'S',
    productProcess: 'PP',
    responsibleUserId: fx.userId,
  });
  const d = await getHaccpPlanDetail(fx.orgId, planId);
  return { orgId: fx.orgId, userId: fx.userId, planId, versionId: d.active!.id };
}

async function withControl(c: Awaited<ReturnType<typeof setup>>) {
  await addProcessStep(c.orgId, c.userId, c.versionId, { name: 'Recepción' });
  const flow = await getPlanFlow(c.orgId, c.planId);
  await addHazard(c.orgId, c.userId, c.versionId, {
    sourceType: 'process_step',
    processStepId: flow.steps[0]!.processStepId,
    hazardType: 'biological',
    name: 'Salmonella spp.',
    probability: 4,
    severity: 5,
  });
  const hz = (await getHazardAnalysis(c.orgId, c.planId))!.stepGroups[0]!.hazards[0]!;
  await saveAssessment(c.orgId, c.userId, c.versionId, {
    hazardLogicalId: hz.hazardLogicalId,
    answers: [
      { questionId: 'P1', answer: 'yes' },
      { questionId: 'P2', answer: 'no' },
    ],
  });
  return (await getControlMeasures(c.orgId, c.planId))!.assessments[0]!;
}

describe.skipIf(!hasDb)('HACCP-CORE-DATA-GAPS — uso previsto', () => {
  it('guarda el uso previsto en el borrador y lo lee', async () => {
    const c = await setup();
    await saveIntendedUse(c.orgId, c.userId, c.versionId, {
      intendedUse: 'Consumo tras cocción',
      intendedConsumer: 'Público general',
      sensitiveGroups: '',
    });
    const d = await getHaccpPlanDetail(c.orgId, c.planId);
    expect(d.active!.intendedUse).toBe('Consumo tras cocción');
    expect(d.active!.intendedConsumer).toBe('Público general');
    expect(d.active!.sensitiveGroups).toBeNull(); // opcional vacío → null
  });

  it('la nueva versión clona el uso previsto; el histórico queda intacto', async () => {
    const c = await setup();
    await saveIntendedUse(c.orgId, c.userId, c.versionId, { intendedUse: 'Uso X' });
    await addTeamMember(c.orgId, c.userId, c.versionId, { userId: c.userId, isLeader: true });
    await publishHaccpVersion(c.orgId, c.userId, c.planId);
    await createHaccpVersion(c.orgId, c.userId, c.planId, 'minor', 'v2');
    const d = await getHaccpPlanDetail(c.orgId, c.planId);
    expect(d.active!.intendedUse).toBe('Uso X'); // clonado a v2
    const v1 = await db().haccpPlanVersion.findFirst({ where: { id: c.versionId } });
    expect(v1?.intendedUse).toBe('Uso X'); // v1 intacta
  });

  it('la versión publicada es inmutable', async () => {
    const c = await setup();
    await addProcessStep(c.orgId, c.userId, c.versionId, { name: 'X' });
    await addTeamMember(c.orgId, c.userId, c.versionId, { userId: c.userId, isLeader: true });
    await publishHaccpVersion(c.orgId, c.userId, c.planId);
    await expect(
      saveIntendedUse(c.orgId, c.userId, c.versionId, { intendedUse: 'Y' }),
    ).rejects.toBeInstanceOf(HaccpValidationError);
  });

  it('aislamiento por organización', async () => {
    const c = await setup();
    const other = await setup();
    await expect(
      saveIntendedUse(other.orgId, other.userId, c.versionId, { intendedUse: 'Z' }),
    ).rejects.toBeInstanceOf(HaccpNotFoundError);
  });
});

describe.skipIf(!hasDb)('HACCP-CORE-DATA-GAPS — disposición', () => {
  it('guarda disposición distinta de corrección y acción correctiva', async () => {
    const c = await setup();
    const a = await withControl(c);
    await saveControlPlan(c.orgId, c.userId, a.id, {
      controlMeasure: 'Cadena de frío',
      actionCriterion: 'Certificado y condición',
      correction: 'Retener el lote',
      disposition: 'Segregar y evaluar',
      correctiveAction: 'Notificar al proveedor',
    });
    const cm = (await getControlMeasures(c.orgId, c.planId))!;
    const plan = cm.assessments[0]!.plan!;
    expect(plan.correction).toBe('Retener el lote');
    expect(plan.disposition).toBe('Segregar y evaluar');
    expect(plan.correctiveAction).toBe('Notificar al proveedor');
  });

  it('la nueva versión clona la disposición; histórico intacto', async () => {
    const c = await setup();
    const a = await withControl(c);
    await saveControlPlan(c.orgId, c.userId, a.id, { disposition: 'Reproceso controlado' });
    await addTeamMember(c.orgId, c.userId, c.versionId, { userId: c.userId, isLeader: true });
    await publishHaccpVersion(c.orgId, c.userId, c.planId);
    await createHaccpVersion(c.orgId, c.userId, c.planId, 'minor', 'v2');
    const cm = (await getControlMeasures(c.orgId, c.planId))!;
    expect(cm.assessments[0]!.plan!.disposition).toBe('Reproceso controlado'); // v2
    const v1Plan = await db().haccpControlPlan.findFirst({
      where: { organizationId: c.orgId, planVersionId: c.versionId },
    });
    expect(v1Plan?.disposition).toBe('Reproceso controlado'); // v1 intacta
  });
});
