/**
 * HACCP-PROCESS-EXPANSION — entradas/salidas/destinos del proceso: creación, destinos internos
 * (con conexión), externos y múltiples, subproductos/desechos/devoluciones, clon con identidad
 * lógica, histórico intacto, reset de verificación in situ, contexto de peligro por entrada,
 * compatibilidad de peligros de etapa, aislamiento y RLS. §V.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, newId, seedOrgWithPublishedTemplate } from './_helpers';
import {
  createHaccpPlan,
  createHaccpVersion,
  getHaccpPlanDetail,
  publishHaccpVersion,
  addTeamMember,
  HaccpNotFoundError,
} from '@/server/haccp';
import { addProcessStep, getPlanFlow, setFlowVerification } from '@/server/haccp-flow';
import {
  addProcessInput,
  addProcessOutput,
  addProcessDestination,
  getProcessModel,
} from '@/server/haccp-process';
import { addHazard, getHazardAnalysis } from '@/server/haccp-hazards';

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
  await addProcessStep(fx.orgId, fx.userId, versionId, { name: 'Clasificación' });
  const flow = await getPlanFlow(fx.orgId, planId);
  return {
    orgId: fx.orgId,
    userId: fx.userId,
    planId,
    versionId,
    recepStepId: flow.steps[0]!.id,
    recepLogical: flow.steps[0]!.processStepId,
    clasifStepId: flow.steps[1]!.id,
    clasifLogical: flow.steps[1]!.processStepId,
  };
}

describe.skipIf(!hasDb)('HACCP-PROCESS-EXPANSION — modelo de proceso', () => {
  it('A/B: crea una y varias entradas por etapa', async () => {
    const c = await setup();
    await addProcessInput(c.orgId, c.userId, c.recepStepId, {
      name: 'Huevo',
      inputType: 'raw_material',
    });
    await addProcessInput(c.orgId, c.userId, c.recepStepId, {
      name: 'Tarima plástica',
      inputType: 'reusable_material',
    });
    const model = (await getProcessModel(c.orgId, c.planId))!;
    expect(model.steps[0]!.inputs).toHaveLength(2);
    expect(model.steps[0]!.inputs[0]!.name).toBe('Huevo');
  });

  it('C/D: salida con destino INTERNO genera conexión (§E1)', async () => {
    const c = await setup();
    const outId = await addProcessOutput(c.orgId, c.userId, c.recepStepId, {
      name: 'Huevo conforme',
      outputType: 'conforming_product',
    });
    await addProcessDestination(c.orgId, c.userId, outId, {
      destinationType: 'next_process_step',
      destinationProcessStepId: c.clasifLogical,
      label: 'Conforme',
    });
    const model = (await getProcessModel(c.orgId, c.planId))!;
    const dest = model.steps[0]!.outputs[0]!.destinations[0]!;
    expect(dest.destinationStepName).toBe('Clasificación');
    // §E1: la conexión gráfica se creó.
    const flow = await getPlanFlow(c.orgId, c.planId);
    expect(
      flow.connections.some(
        (x) => x.fromStepId === c.recepLogical && x.toStepId === c.clasifLogical,
      ),
    ).toBe(true);
  });

  it('E/F/G/H/I: destino externo, múltiples destinos, subproducto/desecho/devolución', async () => {
    const c = await setup();
    const chico = await addProcessOutput(c.orgId, c.userId, c.recepStepId, {
      name: 'Huevo chico',
      outputType: 'byproduct', // §G subproducto
    });
    await addProcessDestination(c.orgId, c.userId, chico, {
      destinationType: 'bulk_sale',
      destinationExternalText: 'Venta a granel',
    });
    await addProcessDestination(c.orgId, c.userId, chico, {
      destinationType: 'supplier_return', // §I devolución
      destinationExternalText: 'Devolución a proveedor',
    });
    const roto = await addProcessOutput(c.orgId, c.userId, c.recepStepId, {
      name: 'Huevo roto',
      outputType: 'waste',
    });
    await addProcessDestination(c.orgId, c.userId, roto, {
      destinationType: 'waste_disposal', // §H desecho
      destinationExternalText: 'Disposición',
    });
    const model = (await getProcessModel(c.orgId, c.planId))!;
    const outs = model.steps[0]!.outputs;
    expect(outs).toHaveLength(2);
    const chicoView = outs.find((o) => o.name === 'Huevo chico')!;
    expect(chicoView.destinations).toHaveLength(2); // §F múltiples destinos
    expect(chicoView.destinations[0]!.destinationExternalText).toBe('Venta a granel');
  });

  it('J/K/L/M: el clon preserva input/output_logical_id; histórico intacto', async () => {
    const c = await setup();
    await addProcessInput(c.orgId, c.userId, c.recepStepId, {
      name: 'Huevo',
      inputType: 'raw_material',
    });
    const outId = await addProcessOutput(c.orgId, c.userId, c.recepStepId, {
      name: 'Conforme',
      outputType: 'conforming_product',
    });
    await addProcessDestination(c.orgId, c.userId, outId, {
      destinationType: 'external_sale',
      destinationExternalText: 'Venta',
    });
    const v1 = (await getProcessModel(c.orgId, c.planId))!;
    const v1Input = v1.steps[0]!.inputs[0]!.inputLogicalId;
    const v1Output = v1.steps[0]!.outputs[0]!.outputLogicalId;

    await addTeamMember(c.orgId, c.userId, c.versionId, { userId: c.userId, isLeader: true });
    await publishHaccpVersion(c.orgId, c.userId, c.planId);
    await createHaccpVersion(c.orgId, c.userId, c.planId, 'minor', 'v2');

    const v2 = (await getProcessModel(c.orgId, c.planId))!;
    expect(v2.steps[0]!.inputs[0]!.inputLogicalId).toBe(v1Input); // §L estable
    expect(v2.steps[0]!.outputs[0]!.outputLogicalId).toBe(v1Output);
    expect(v2.steps[0]!.outputs[0]!.destinations[0]!.destinationExternalText).toBe('Venta');
    // §M: el histórico de v1 sigue con su entrada.
    const v1Count = await db().haccpProcessInput.count({
      where: { organizationId: c.orgId, planVersionId: c.versionId },
    });
    expect(v1Count).toBe(1);
  });

  it('N: editar entradas/salidas reinicia la verificación in situ (§Q5)', async () => {
    const c = await setup();
    await setFlowVerification(c.orgId, c.userId, c.versionId, true);
    let flow = await getPlanFlow(c.orgId, c.planId);
    expect(flow.version!.flowVerifiedOnSite).toBe(true);
    await addProcessInput(c.orgId, c.userId, c.recepStepId, { name: 'Agua', inputType: 'water' });
    flow = await getPlanFlow(c.orgId, c.planId);
    expect(flow.version!.flowVerifiedOnSite).toBe(false);
  });

  it('O/P: peligro por ENTRADA (contexto input) y compatibilidad del peligro de ETAPA', async () => {
    const c = await setup();
    const inId = await addProcessInput(c.orgId, c.userId, c.recepStepId, {
      name: 'Tarima plástica',
      inputType: 'reusable_material',
    });
    const input = await db().haccpProcessInput.findFirst({ where: { id: inId } });
    // Peligro asociado a la entrada (contexto input).
    await addHazard(c.orgId, c.userId, c.versionId, {
      sourceType: 'process_step',
      processStepId: c.recepLogical,
      contextType: 'input',
      inputLogicalId: input!.inputLogicalId,
      hazardType: 'physical',
      name: 'Fragmento de plástico',
      probability: 2,
      severity: 3,
    });
    // Peligro generado en la etapa (contexto step, compatibilidad §P).
    await addHazard(c.orgId, c.userId, c.versionId, {
      sourceType: 'process_step',
      processStepId: c.recepLogical,
      hazardType: 'biological',
      name: 'Contaminación por manipulación',
      probability: 2,
      severity: 4,
    });
    const analysis = (await getHazardAnalysis(c.orgId, c.planId))!;
    const recepGroup = analysis.stepGroups.find((s) => s.processStepId === c.recepLogical)!;
    const inputHazards = recepGroup.inputs.find((i) => i.inputLogicalId === input!.inputLogicalId)!;
    expect(inputHazards.hazards).toHaveLength(1); // §O
    expect(inputHazards.hazards[0]!.contextType).toBe('input');
    expect(recepGroup.stepHazards.some((h) => h.name.includes('manipulación'))).toBe(true); // §P
  });

  it('Q/R/S: aislamiento por organización y RLS', async () => {
    const c = await setup();
    await addProcessInput(c.orgId, c.userId, c.recepStepId, {
      name: 'Huevo',
      inputType: 'raw_material',
    });
    const other = await setup();
    expect(await getProcessModel(other.orgId, c.planId)).toBeNull();
    await expect(
      addProcessInput(other.orgId, other.userId, c.recepStepId, { name: 'X', inputType: 'other' }),
    ).rejects.toBeInstanceOf(HaccpNotFoundError);
    const pol = await db().$queryRawUnsafe<{ c: number }[]>(
      "select count(*)::int c from pg_policies where tablename='haccp_process_inputs' and policyname='haccp_process_inputs_tenant_isolation'",
    );
    expect(pol[0]!.c).toBe(1);
  });
});
