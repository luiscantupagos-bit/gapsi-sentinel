/**
 * HACCP-006 — verificación: definición, relación con PCC/PPRO, recurrencia→ocurrencias→Task
 * nativa (idempotente), registro con versión exacta (pinned/latest), resultado y conclusión,
 * clon con identidad lógica, histórico preservado, transición idempotente, aislamiento y RLS.
 * §52 + §54 (integración definición→tarea→registro→resultado). Reutiliza el motor de Programas.
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
import {
  saveVerificationDefinition,
  materializeVerificationSchedule,
  createVerificationRecord,
  recordVerificationResult,
  getVerifications,
} from '@/server/haccp-verification';
import { submitRecord } from '@/server/records';

async function setup() {
  const fx = await seedOrgWithPublishedTemplate(db());
  const planId = await createHaccpPlan(fx.orgId, fx.userId, {
    title: 'Plan',
    scope: 'S',
    productProcess: 'PP',
    responsibleUserId: fx.userId,
  });
  const d = await getHaccpPlanDetail(fx.orgId, planId);
  const versionId = d.active!.id;
  await addProcessStep(fx.orgId, fx.userId, versionId, { name: 'Recepción' });
  const flow = await getPlanFlow(fx.orgId, planId);
  await addHazard(fx.orgId, fx.userId, versionId, {
    sourceType: 'process_step',
    processStepId: flow.steps[0]!.processStepId,
    hazardType: 'biological',
    name: 'Salmonella spp.',
    probability: 4,
    severity: 5,
  });
  const hz = (await getHazardAnalysis(fx.orgId, planId))!.stepGroups[0]!.hazards[0]!;
  await saveAssessment(fx.orgId, fx.userId, versionId, {
    hazardLogicalId: hz.hazardLogicalId,
    answers: [
      { questionId: 'P1', answer: 'yes' },
      { questionId: 'P2', answer: 'yes' },
      { questionId: 'P6', answer: 'no' },
      { questionId: 'P7', answer: 'yes' },
      { questionId: 'P8', answer: 'no' },
    ],
  });
  const cm = (await getControlMeasures(fx.orgId, planId))!;
  return {
    orgId: fx.orgId,
    userId: fx.userId,
    planId,
    versionId,
    controlLogical: cm.assessments[0]!.controlMeasureLogicalId,
  };
}

async function createForm(orgId: string, opts: { versionStatus?: string } = {}) {
  const documentId = newId();
  const versionId = newId();
  await db().document.create({
    data: {
      id: documentId,
      organizationId: orgId,
      code: `FR-V-${newId().slice(0, 4)}`,
      title: 'Formato de verificación',
      documentType: 'form',
      origin: 'internal',
      status: 'effective',
    },
  });
  await db().documentVersion.create({
    data: {
      id: versionId,
      organizationId: orgId,
      documentId,
      label: 'v1',
      status: opts.versionStatus ?? 'published',
      isCurrent: true,
      formSchema: {
        schemaVersion: 1,
        sections: [
          {
            id: 'main',
            title: 'Principal',
            repeatable: false,
            fields: [{ id: 'ok', label: 'Conforme', kind: 'boolean', required: false }],
          },
        ],
      },
    },
  });
  return { documentId, versionId };
}

const defInput = {
  scopeType: 'pcc',
  title: 'Revisión de registros',
  frequencyType: 'monthly',
  startAt: '2026-01-01',
  interval: 1,
  endDate: '2026-04-30',
};

describe.skipIf(!hasDb)('HACCP-006 — verificación', () => {
  it('A/B: crea definición ligada a un control (PPRO); resuelve su contexto', async () => {
    const c = await setup();
    await saveVerificationDefinition(c.orgId, c.userId, c.versionId, {
      ...defInput,
      controlMeasureLogicalId: c.controlLogical,
    });
    const v = (await getVerifications(c.orgId, c.planId))!;
    expect(v.definitions).toHaveLength(1);
    expect(v.definitions[0]!.controlContext?.hazardName).toBe('Salmonella spp.');
    expect(v.definitions[0]!.controlContext?.classification).toBe('ppro');
  });

  it('C/D/E/T: recurrencia → ocurrencias → Task nativa idempotente', async () => {
    const c = await setup();
    await saveVerificationDefinition(c.orgId, c.userId, c.versionId, {
      ...defInput,
      scopeType: 'plan',
    });
    const first = await materializeVerificationSchedule(c.orgId, c.userId, c.planId);
    expect(first.occurrences).toBe(4); // ene..abr
    expect(first.tasks).toBe(4);
    // Reejecutar NO duplica (§12/§41/§T).
    const second = await materializeVerificationSchedule(c.orgId, c.userId, c.planId);
    expect(second.occurrences).toBe(0);
    expect(second.tasks).toBe(0);
    const taskCount = await db().task.count({
      where: { organizationId: c.orgId, sourceType: 'haccp_verification' },
    });
    expect(taskCount).toBe(4);
    const v = (await getVerifications(c.orgId, c.planId))!;
    expect(v.occurrences.every((o) => o.taskId)).toBe(true); // §D todas con Task
  });

  it('F/G/I: registro con la versión PUBLICADA vigente (latest_published)', async () => {
    const c = await setup();
    const form = await createForm(c.orgId);
    await saveVerificationDefinition(c.orgId, c.userId, c.versionId, {
      ...defInput,
      scopeType: 'plan',
      recordStrategy: 'latest_published',
      requiredDocumentId: form.documentId,
    });
    await materializeVerificationSchedule(c.orgId, c.userId, c.planId);
    const occId = (await getVerifications(c.orgId, c.planId))!.occurrences[0]!.id;
    const recordId = await createVerificationRecord(c.orgId, c.userId, occId);
    const rec = await db().recordInstance.findFirst({ where: { id: recordId } });
    expect(rec?.documentVersionId).toBe(form.versionId); // §G versión exacta
    expect(rec?.sourceType).toBe('haccp_verification');
  });

  it('H: registro con versión FIJA (pinned_version)', async () => {
    const c = await setup();
    const form = await createForm(c.orgId);
    // Nueva versión publicada del formato; el pin debe seguir usando v1.
    await db().documentVersion.update({
      where: { id: form.versionId },
      data: { isCurrent: false },
    });
    const v2 = newId();
    await db().documentVersion.create({
      data: {
        id: v2,
        organizationId: c.orgId,
        documentId: form.documentId,
        label: 'v2',
        status: 'published',
        isCurrent: true,
        formSchema: {
          schemaVersion: 1,
          sections: [
            {
              id: 'm',
              title: 'M',
              repeatable: false,
              fields: [{ id: 'x', label: 'X', kind: 'text' }],
            },
          ],
        },
      },
    });
    await saveVerificationDefinition(c.orgId, c.userId, c.versionId, {
      ...defInput,
      scopeType: 'plan',
      recordStrategy: 'pinned_version',
      requiredDocumentId: form.documentId,
      requiredDocumentVersionId: form.versionId, // v1 fija
    });
    await materializeVerificationSchedule(c.orgId, c.userId, c.planId);
    const occId = (await getVerifications(c.orgId, c.planId))!.occurrences[0]!.id;
    const recordId = await createVerificationRecord(c.orgId, c.userId, occId);
    const rec = await db().recordInstance.findFirst({ where: { id: recordId } });
    expect(rec?.documentVersionId).toBe(form.versionId); // pinned = v1, NO v2
  });

  it('J/K/L: resultado conforme / no conforme; conclusión obligatoria', async () => {
    const c = await setup();
    await saveVerificationDefinition(c.orgId, c.userId, c.versionId, {
      ...defInput,
      scopeType: 'plan',
    });
    await materializeVerificationSchedule(c.orgId, c.userId, c.planId);
    const occ = (await getVerifications(c.orgId, c.planId))!.occurrences;
    // §L: no conforme sin conclusión falla.
    await expect(
      recordVerificationResult(c.orgId, c.userId, occ[0]!.id, { result: 'no_conforme' }),
    ).rejects.toBeInstanceOf(HaccpValidationError);
    // §J conforme:
    await recordVerificationResult(c.orgId, c.userId, occ[0]!.id, { result: 'conforme' });
    // §K no conforme con conclusión:
    await recordVerificationResult(c.orgId, c.userId, occ[1]!.id, {
      result: 'no_conforme',
      conclusion: 'Faltan registros del turno nocturno.',
    });
    const row0 = await db().haccpVerificationOccurrence.findFirst({ where: { id: occ[0]!.id } });
    expect(row0?.result).toBe('conforme');
    expect(row0?.completedAt).not.toBeNull();
  });

  it('§19/§54: no cierra con Record en borrador; flujo completo definición→tarea→registro→resultado', async () => {
    const c = await setup();
    const form = await createForm(c.orgId);
    await saveVerificationDefinition(c.orgId, c.userId, c.versionId, {
      ...defInput,
      scopeType: 'plan',
      recordStrategy: 'latest_published',
      requiredDocumentId: form.documentId,
    });
    await materializeVerificationSchedule(c.orgId, c.userId, c.planId);
    const occId = (await getVerifications(c.orgId, c.planId))!.occurrences[0]!.id;
    await createVerificationRecord(c.orgId, c.userId, occId);
    // Registro en borrador → no permite cerrar (§19).
    await expect(
      recordVerificationResult(c.orgId, c.userId, occId, { result: 'conforme' }),
    ).rejects.toBeInstanceOf(HaccpValidationError);
    // Enviar el registro y luego cerrar.
    const rec = await db().haccpVerificationOccurrence.findFirst({ where: { id: occId } });
    await submitRecord(c.orgId, c.userId, rec!.recordId!, { values: {}, rows: {} });
    await recordVerificationResult(c.orgId, c.userId, occId, { result: 'conforme' });
    const done = await db().haccpVerificationOccurrence.findFirst({ where: { id: occId } });
    expect(done?.completedAt).not.toBeNull();
  });

  it('O/P/Q/R/S: clon conserva verification_logical_id; histórico preservado; v1 no re-materializa', async () => {
    const c = await setup();
    await saveVerificationDefinition(c.orgId, c.userId, c.versionId, {
      ...defInput,
      scopeType: 'plan',
    });
    await materializeVerificationSchedule(c.orgId, c.userId, c.planId);
    const v1 = (await getVerifications(c.orgId, c.planId))!;
    const logical = v1.definitions[0]!.verificationLogicalId;
    const occBefore = await db().haccpVerificationOccurrence.count({
      where: { organizationId: c.orgId },
    });

    await addTeamMember(c.orgId, c.userId, c.versionId, { userId: c.userId, isLeader: true });
    await publishHaccpVersion(c.orgId, c.userId, c.planId);
    await createHaccpVersion(c.orgId, c.userId, c.planId, 'minor', 'v2');

    const v2 = (await getVerifications(c.orgId, c.planId))!;
    expect(v2.definitions[0]!.verificationLogicalId).toBe(logical); // §P estable
    // §R/§S: materializar la v2 (mismo logical id, mismas ocurrencias) NO duplica el histórico.
    const res = await materializeVerificationSchedule(c.orgId, c.userId, c.planId);
    expect(res.occurrences).toBe(0);
    const occAfter = await db().haccpVerificationOccurrence.count({
      where: { organizationId: c.orgId },
    });
    expect(occAfter).toBe(occBefore); // §Q histórico intacto
  });

  it('M/N/U: aislamiento por organización y RLS', async () => {
    const c = await setup();
    await saveVerificationDefinition(c.orgId, c.userId, c.versionId, {
      ...defInput,
      scopeType: 'plan',
    });
    const other = await setup();
    expect(await getVerifications(other.orgId, c.planId)).toBeNull();
    await expect(
      saveVerificationDefinition(other.orgId, other.userId, c.versionId, {
        ...defInput,
        scopeType: 'plan',
      }),
    ).rejects.toBeInstanceOf(HaccpNotFoundError);
    const pol = await db().$queryRawUnsafe<{ c: number }[]>(
      "select count(*)::int c from pg_policies where tablename='haccp_verification_definitions' and policyname='haccp_verification_definitions_tenant_isolation'",
    );
    expect(pol[0]!.c).toBe(1);
  });
});
