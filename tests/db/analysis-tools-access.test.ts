/**
 * CORE-ALIGN-003 Fase 5 — 5 Porqués, FTA y relaciones transversales. Requiere DB.
 * Organizaciones desechables (sin borrado físico de agregados).
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, newId, seedOrgWithPublishedTemplate } from './_helpers';
import type { Prisma } from '@prisma/client';
import {
  AnalysisPermissionError,
  AnalysisValidationError,
  addFtaNode,
  attachAnalysisRelation,
  createAnalysis,
  createHypothesis,
  createLinkedAnalysis,
  deleteFtaNode,
  detachAnalysisRelation,
  getAnalysisDetail,
  getFtaValidation,
  listAnalysesForTarget,
  listAnalysisLibrary,
  listFtaNodes,
  saveConclusion,
} from '@/server/quality-analysis';

async function addMember(orgId: string, role: string): Promise<string> {
  const id = newId();
  await db().user.create({ data: { id, email: `u-${id}@x.test` } });
  await db().membership.create({ data: { organizationId: orgId, userId: id, role } });
  return id;
}

let seq = 0;
async function makeCapa(orgId: string, createdBy: string): Promise<string> {
  seq += 1;
  const id = newId();
  await db().capa.create({
    data: {
      id,
      organizationId: orgId,
      folio: `CAPA-2026-${String(seq).padStart(4, '0')}-${id.slice(0, 4)}`,
      year: 2026,
      title: 'NC',
      description: 'd',
      sourceType: 'internal_nc',
      status: 'reported',
      createdBy,
    },
  });
  return id;
}
async function makeProject(orgId: string): Promise<string> {
  const id = newId();
  await db().project.create({
    data: {
      id,
      organizationId: orgId,
      folio: `PRJ-${id.slice(0, 6)}`,
      name: 'Proyecto',
      projectType: 'other',
    },
  });
  return id;
}
async function makeEvent(orgId: string, createdBy: string): Promise<string> {
  const id = newId();
  await db().qualityEvent.create({
    data: {
      id,
      organizationId: orgId,
      folio: `EV-${id.slice(0, 6)}`,
      eventDate: new Date('2026-01-10'),
      eventType: 'deviation',
      title: 'Desviación',
      createdBy,
    } satisfies Prisma.QualityEventUncheckedCreateInput,
  });
  return id;
}

async function setup() {
  const fx = await seedOrgWithPublishedTemplate(db()); // owner
  const viewer = await addMember(fx.orgId, 'viewer');
  return { orgId: fx.orgId, owner: fx.userId, viewer };
}

describe.skipIf(!hasDb)('Fase 5 — 5 Porqués', () => {
  it('cadena de hipótesis + conclusión humana (causa raíz no automática)', async () => {
    const s = await setup();
    const capaId = await makeCapa(s.orgId, s.owner);
    const id = await createAnalysis(s.orgId, s.owner, capaId, {
      type: '5whys',
      title: 'Rebaba en pieza',
    });
    const w1 = await createHypothesis(s.orgId, s.owner, id, {
      description: 'El corte no es limpio',
      sourceTool: '5whys',
    });
    const w2 = await createHypothesis(s.orgId, s.owner, id, {
      description: 'La herramienta está desgastada',
      parentHypothesisId: w1,
      sourceTool: '5whys',
      evidenceFor: 'Bitácora de mantenimiento',
    });
    expect(w2).toBeTruthy();
    // La causa raíz la escribe el responsable; el sistema no la deduce.
    await saveConclusion(s.orgId, s.owner, id, {
      summary: 'Cadena de 2 niveles',
      proposedRootCause: 'No hay plan de reemplazo de herramienta',
    });
    const d = await getAnalysisDetail(s.orgId, id);
    expect(d.hypotheses.length).toBe(2);
    expect(d.hypotheses.some((h) => h.parentHypothesisId === w1)).toBe(true);
    expect(d.conclusion?.proposedRootCause).toContain('reemplazo');
  });
});

describe.skipIf(!hasDb)('Fase 5 — FTA', () => {
  it('siembra evento superior, agrega compuerta AND con básicos y valida', async () => {
    const s = await setup();
    const projectId = await makeProject(s.orgId);
    const id = await createLinkedAnalysis(
      s.orgId,
      s.owner,
      { type: 'fta', title: 'Falla de sellado' },
      { relationType: 'project', targetId: projectId },
    );
    let nodes = await listFtaNodes(s.orgId, id);
    expect(nodes.filter((n) => n.nodeType === 'top')).toHaveLength(1);
    const top = nodes[0]!;

    // El evento superior combina dos básicos con una compuerta AND.
    const b1 = await addFtaNode(s.orgId, s.owner, id, {
      parentId: top.id,
      nodeType: 'basic',
      label: 'Sensor descalibrado',
    });
    await addFtaNode(s.orgId, s.owner, id, {
      parentId: top.id,
      nodeType: 'basic',
      label: 'Presión baja',
    });
    // Falta la compuerta en el top → inválido.
    expect((await getFtaValidation(s.orgId, id)).some((e) => e.includes('compuerta'))).toBe(true);

    // Marcar la compuerta AND en el top.
    const { updateFtaNode } = await import('@/server/quality-analysis');
    await updateFtaNode(s.orgId, s.owner, top.id, { gateType: 'and' });
    expect(await getFtaValidation(s.orgId, id)).toHaveLength(0);

    // Un básico no puede tener hijos.
    await expect(
      addFtaNode(s.orgId, s.owner, id, { parentId: b1, nodeType: 'basic', label: 'X' }),
    ).rejects.toBeInstanceOf(AnalysisValidationError);

    // No se puede eliminar un nodo con hijos.
    await expect(deleteFtaNode(s.orgId, s.owner, top.id)).rejects.toBeInstanceOf(
      AnalysisValidationError,
    );
    // Eliminar una hoja sí.
    await deleteFtaNode(s.orgId, s.owner, b1);
    nodes = await listFtaNodes(s.orgId, id);
    expect(nodes.find((n) => n.id === b1)).toBeUndefined();
  });

  it('un segundo evento superior es rechazado', async () => {
    const s = await setup();
    const capaId = await makeCapa(s.orgId, s.owner);
    const id = await createLinkedAnalysis(
      s.orgId,
      s.owner,
      { type: 'fta', title: 'Falla' },
      { relationType: 'capa', targetId: capaId },
    );
    await expect(
      addFtaNode(s.orgId, s.owner, id, { nodeType: 'top', label: 'Otro top' }),
    ).rejects.toBeInstanceOf(AnalysisValidationError);
  });
});

describe.skipIf(!hasDb)('Fase 5 — relaciones transversales', () => {
  it('crea vinculado a proyecto, se lista por origen y admite múltiples relaciones', async () => {
    const s = await setup();
    const projectId = await makeProject(s.orgId);
    const eventId = await makeEvent(s.orgId, s.owner);
    const id = await createLinkedAnalysis(
      s.orgId,
      s.owner,
      { type: 'ishikawa', title: 'Ishikawa transversal' },
      { relationType: 'project', targetId: projectId },
    );
    const byProject = await listAnalysesForTarget(s.orgId, 'project', projectId);
    expect(byProject.some((r) => r.id === id)).toBe(true);

    // Segunda relación legítima (no sobrescribe la primera).
    await attachAnalysisRelation(s.orgId, s.owner, id, {
      relationType: 'quality_event',
      targetId: eventId,
    });
    const byEvent = await listAnalysesForTarget(s.orgId, 'quality_event', eventId);
    expect(byEvent.some((r) => r.id === id)).toBe(true);
    expect(
      (await listAnalysesForTarget(s.orgId, 'project', projectId)).some((r) => r.id === id),
    ).toBe(true);

    // Quitar una relación no elimina el análisis ni la otra relación.
    const rel = byEvent.find((r) => r.id === id)!;
    await detachAnalysisRelation(s.orgId, s.owner, rel.relationId!);
    expect(
      (await listAnalysesForTarget(s.orgId, 'quality_event', eventId)).some((r) => r.id === id),
    ).toBe(false);
    expect(
      (await listAnalysesForTarget(s.orgId, 'project', projectId)).some((r) => r.id === id),
    ).toBe(true);

    // Aparece en la biblioteca global con su origen.
    const lib = await listAnalysisLibrary(s.orgId);
    const row = lib.find((r) => r.id === id);
    expect(row?.origin).toContain('Proyecto');
  });

  it('viewer no puede crear ni vincular; target de otra organización es rechazado', async () => {
    const a = await setup();
    const b = await setup();
    const projectA = await makeProject(a.orgId);
    await expect(
      createLinkedAnalysis(
        a.orgId,
        a.viewer,
        { type: 'freeform', title: 'x' },
        { relationType: 'project', targetId: projectA },
      ),
    ).rejects.toBeInstanceOf(AnalysisPermissionError);
    // target inexistente en la organización (pertenece a B) → validación.
    const projectB = await makeProject(b.orgId);
    await expect(
      createLinkedAnalysis(
        a.orgId,
        a.owner,
        { type: 'freeform', title: 'x' },
        { relationType: 'project', targetId: projectB },
      ),
    ).rejects.toBeInstanceOf(AnalysisValidationError);
  });

  it('aislamiento tenant en la biblioteca global', async () => {
    const a = await setup();
    const b = await setup();
    const capaA = await makeCapa(a.orgId, a.owner);
    const idA = await createAnalysis(a.orgId, a.owner, capaA, {
      type: 'freeform',
      title: 'Solo A',
    });
    const libB = await listAnalysisLibrary(b.orgId);
    expect(libB.some((r) => r.id === idA)).toBe(false);
  });
});
