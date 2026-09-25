/**
 * HACCP-002 — diagrama de flujo: etapas/conexiones, orden, ramas, verificación in situ,
 * reset por edición, inmutabilidad de publicado, clon con identidad lógica estable,
 * aislamiento por organización. §E36.
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
import {
  addConnection,
  addProcessStep,
  getPlanFlow,
  moveProcessStep,
  removeProcessStep,
  setFlowVerification,
  updateProcessStep,
} from '@/server/haccp-flow';

async function setup() {
  const fx = await seedOrgWithPublishedTemplate(db());
  const planId = await createHaccpPlan(fx.orgId, fx.userId, {
    title: 'Plan flujo',
    scope: 'S',
    productProcess: 'PP',
    responsibleUserId: fx.userId,
  });
  const d = await getHaccpPlanDetail(fx.orgId, planId);
  return { orgId: fx.orgId, owner: fx.userId, planId, versionId: d.active!.id };
}

async function stepIdByName(orgId: string, planId: string, name: string) {
  const flow = await getPlanFlow(orgId, planId);
  const s = flow.steps.find((x) => x.name === name)!;
  return { rowId: s.id, logical: s.processStepId };
}

describe.skipIf(!hasDb)('HACCP-002 — diagrama de flujo', () => {
  it('A/B/C: crea etapas, múltiples y reordena', async () => {
    const ctx = await setup();
    await addProcessStep(ctx.orgId, ctx.owner, ctx.versionId, { name: 'Recepción' });
    await addProcessStep(ctx.orgId, ctx.owner, ctx.versionId, { name: 'Inspección' });
    await addProcessStep(ctx.orgId, ctx.owner, ctx.versionId, { name: 'Empaque' });
    let flow = await getPlanFlow(ctx.orgId, ctx.planId);
    expect(flow.steps.map((s) => s.name)).toEqual(['Recepción', 'Inspección', 'Empaque']);
    // mueve Empaque arriba
    const emp = flow.steps.find((s) => s.name === 'Empaque')!;
    await moveProcessStep(ctx.orgId, ctx.owner, emp.id, 'up');
    flow = await getPlanFlow(ctx.orgId, ctx.planId);
    expect(flow.steps.map((s) => s.name)).toEqual(['Recepción', 'Empaque', 'Inspección']);
  });

  it('D/E: conecta etapas y ramifica (decisión → 2 destinos)', async () => {
    const ctx = await setup();
    await addProcessStep(ctx.orgId, ctx.owner, ctx.versionId, {
      name: 'Inspección',
      stepType: 'decision',
    });
    await addProcessStep(ctx.orgId, ctx.owner, ctx.versionId, { name: 'Clasificación' });
    await addProcessStep(ctx.orgId, ctx.owner, ctx.versionId, { name: 'PNC', stepType: 'output' });
    const insp = await stepIdByName(ctx.orgId, ctx.planId, 'Inspección');
    const clasif = await stepIdByName(ctx.orgId, ctx.planId, 'Clasificación');
    const pnc = await stepIdByName(ctx.orgId, ctx.planId, 'PNC');
    await addConnection(ctx.orgId, ctx.owner, ctx.versionId, {
      fromProcessStepId: insp.logical,
      toProcessStepId: clasif.logical,
      connectionType: 'conditional',
      label: 'Conforme',
    });
    await addConnection(ctx.orgId, ctx.owner, ctx.versionId, {
      fromProcessStepId: insp.logical,
      toProcessStepId: pnc.logical,
      connectionType: 'reject',
      label: 'No conforme',
    });
    const flow = await getPlanFlow(ctx.orgId, ctx.planId);
    const out = flow.connections.filter((c) => c.fromStepId === insp.logical);
    expect(out).toHaveLength(2);
    expect(out.map((c) => c.label).sort()).toEqual(['Conforme', 'No conforme']);
  });

  it('H/I: verifica el flujo y editar reinicia la verificación (§E20)', async () => {
    const ctx = await setup();
    await addProcessStep(ctx.orgId, ctx.owner, ctx.versionId, { name: 'Recepción' });
    await setFlowVerification(ctx.orgId, ctx.owner, ctx.versionId, true, 'Verificado en piso');
    let flow = await getPlanFlow(ctx.orgId, ctx.planId);
    expect(flow.version?.flowVerifiedOnSite).toBe(true);
    // editar una etapa reinicia la verificación
    const rec = await stepIdByName(ctx.orgId, ctx.planId, 'Recepción');
    await updateProcessStep(ctx.orgId, ctx.owner, rec.rowId, { name: 'Recepción de huevo' });
    flow = await getPlanFlow(ctx.orgId, ctx.planId);
    expect(flow.version?.flowVerifiedOnSite).toBe(false);
  });

  it('J: la versión publicada es inmutable (no admite editar el flujo)', async () => {
    const ctx = await setup();
    await addProcessStep(ctx.orgId, ctx.owner, ctx.versionId, { name: 'Recepción' });
    await addTeamMember(ctx.orgId, ctx.owner, ctx.versionId, { userId: ctx.owner, isLeader: true });
    await publishHaccpVersion(ctx.orgId, ctx.owner, ctx.planId);
    await expect(
      addProcessStep(ctx.orgId, ctx.owner, ctx.versionId, { name: 'Otra' }),
    ).rejects.toBeInstanceOf(HaccpValidationError);
  });

  it('K/L/M/N: clon conserva processStepId; etapa nueva = id lógico nuevo; v1 histórica intacta', async () => {
    const ctx = await setup();
    await addProcessStep(ctx.orgId, ctx.owner, ctx.versionId, { name: 'Recepción' });
    await addProcessStep(ctx.orgId, ctx.owner, ctx.versionId, { name: 'Empaque' });
    const rec1 = await stepIdByName(ctx.orgId, ctx.planId, 'Recepción');
    const emp1 = await stepIdByName(ctx.orgId, ctx.planId, 'Empaque');
    await addConnection(ctx.orgId, ctx.owner, ctx.versionId, {
      fromProcessStepId: rec1.logical,
      toProcessStepId: emp1.logical,
    });
    await addTeamMember(ctx.orgId, ctx.owner, ctx.versionId, { userId: ctx.owner, isLeader: true });
    await publishHaccpVersion(ctx.orgId, ctx.owner, ctx.planId);
    const v2 = await createHaccpVersion(ctx.orgId, ctx.owner, ctx.planId, 'minor', 'v2');

    // §L: clon conserva processStepId con NUEVA row id.
    const flow2 = await getPlanFlow(ctx.orgId, ctx.planId);
    const rec2 = flow2.steps.find((s) => s.name === 'Recepción')!;
    expect(rec2.processStepId).toBe(rec1.logical); // identidad lógica estable
    expect(rec2.id).not.toBe(rec1.rowId); // fila nueva
    expect(flow2.connections).toHaveLength(1); // conexión clonada
    expect(flow2.connections[0]?.fromStepId).toBe(rec1.logical);

    // §M: etapa nueva en v2 tiene id lógico nuevo.
    await addProcessStep(ctx.orgId, ctx.owner, v2, { name: 'Loteado' });
    const flow2b = await getPlanFlow(ctx.orgId, ctx.planId);
    const lote = flow2b.steps.find((s) => s.name === 'Loteado')!;
    expect([rec1.logical, emp1.logical]).not.toContain(lote.processStepId);

    // §N: eliminar en v2 no afecta el histórico de v1.
    const emp2 = flow2b.steps.find((s) => s.name === 'Empaque')!;
    await removeProcessStep(ctx.orgId, ctx.owner, emp2.id);
    const v1Steps = await db().haccpProcessStep.count({
      where: { organizationId: ctx.orgId, planVersionId: ctx.versionId },
    });
    expect(v1Steps).toBe(2); // v1 conserva sus 2 etapas
  });

  it('F/G/O: aislamiento por organización; no se edita el flujo de otra org', async () => {
    const ctx = await setup();
    await addProcessStep(ctx.orgId, ctx.owner, ctx.versionId, { name: 'Recepción' });
    const other = await setup();
    // otra org no ve el flujo del plan de la primera
    const foreignFlow = await getPlanFlow(other.orgId, ctx.planId);
    expect(foreignFlow.version).toBeNull();
    // editar la versión de la primera org desde la segunda → no encontrado / denegado
    await expect(
      addProcessStep(other.orgId, other.owner, ctx.versionId, { name: 'X' }),
    ).rejects.toBeInstanceOf(HaccpNotFoundError);
  });
});
