/**
 * Análisis de calidad (TASK-008) contra la capa de datos. Requiere DB.
 * Usa organizaciones desechables (persisten; sin borrado físico de agregados).
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, inRollbackTx, newId, seedOrgWithPublishedTemplate } from './_helpers';
import type { Prisma } from '@prisma/client';
import {
  AnalysisNotFoundError,
  AnalysisPermissionError,
  AnalysisValidationError,
  addCauseEdge,
  addCauseNode,
  addFmeaRow,
  addParticipant,
  confirmRecurrence,
  createAnalysis,
  createCapaActionFromAnalysis,
  createNewVersion,
  findRecurrenceCandidates,
  getAnalysisDetail,
  getComparison,
  getParetoResult,
  saveConclusion,
  setComparativeCases,
  setParetoItems,
  transitionAnalysis,
  updateAnalysis,
  updateFmeaRow,
} from '@/server/quality-analysis';

async function addMember(orgId: string, role: string): Promise<string> {
  const id = newId();
  await db().user.create({ data: { id, email: `u-${id}@x.test` } });
  await db().membership.create({ data: { organizationId: orgId, userId: id, role } });
  return id;
}

let folioSeq = 0;
async function makeCapa(
  orgId: string,
  createdBy: string,
  over: Partial<Prisma.CapaUncheckedCreateInput> = {},
): Promise<string> {
  folioSeq += 1;
  const id = newId();
  await db().capa.create({
    data: {
      id,
      organizationId: orgId,
      folio: `CAPA-2026-${String(folioSeq).padStart(4, '0')}-${id.slice(0, 4)}`,
      year: 2026,
      title: over.title ?? 'NC de prueba',
      description: 'desc',
      sourceType: over.sourceType ?? 'internal_nc',
      status: over.status ?? 'reported',
      createdBy,
      ...over,
    },
  });
  return id;
}

async function setup() {
  const fx = await seedOrgWithPublishedTemplate(db()); // owner
  const participant = await addMember(fx.orgId, 'evaluator');
  const reviewer = await addMember(fx.orgId, 'evaluator');
  const other = await addMember(fx.orgId, 'evaluator');
  const viewer = await addMember(fx.orgId, 'viewer');
  const capaId = await makeCapa(fx.orgId, fx.userId);
  return { orgId: fx.orgId, owner: fx.userId, participant, reviewer, other, viewer, capaId };
}

describe.skipIf(!hasDb)('análisis de calidad — estados y permisos', () => {
  it('crea Ishikawa con las 6 categorías por defecto e historial', async () => {
    const s = await setup();
    const id = await createAnalysis(s.orgId, s.owner, s.capaId, {
      type: 'ishikawa',
      title: 'Ishikawa de temperatura',
    });
    const d = await getAnalysisDetail(s.orgId, id);
    expect(d.categories.length).toBe(6);
    expect(d.history.some((h) => h.event === 'analysis_created')).toBe(true);
  });

  it('viewer no puede crear; evaluador sí', async () => {
    const s = await setup();
    await expect(
      createAnalysis(s.orgId, s.viewer, s.capaId, { type: 'freeform', title: 'x' }),
    ).rejects.toBeInstanceOf(AnalysisPermissionError);
    const id = await createAnalysis(s.orgId, s.participant, s.capaId, {
      type: 'freeform',
      title: 'x',
    });
    expect(id).toBeTruthy();
  });

  it('un evaluador no relacionado no edita; un participante sí', async () => {
    const s = await setup();
    const id = await createAnalysis(s.orgId, s.owner, s.capaId, { type: 'freeform', title: 'x' });
    await expect(updateAnalysis(s.orgId, s.other, id, { title: 'hack' })).rejects.toBeInstanceOf(
      AnalysisPermissionError,
    );
    await addParticipant(s.orgId, s.owner, id, s.participant);
    await updateAnalysis(s.orgId, s.participant, id, { objective: 'objetivo' });
    expect((await getAnalysisDetail(s.orgId, id)).analysis.objective).toBe('objetivo');
  });

  it('flujo revisión→aprobación: snapshot, versión y solo lectura', async () => {
    const s = await setup();
    const id = await createAnalysis(s.orgId, s.owner, s.capaId, { type: 'freeform', title: 'x' });
    await updateAnalysis(s.orgId, s.owner, id, { reviewerUserId: s.reviewer });
    await transitionAnalysis(s.orgId, s.owner, id, 'in_progress');
    // No puede ir a revisión sin conclusión.
    await expect(transitionAnalysis(s.orgId, s.owner, id, 'under_review')).rejects.toBeInstanceOf(
      AnalysisValidationError,
    );
    await saveConclusion(s.orgId, s.owner, id, {
      summary: 'Resumen',
      proposedRootCause: 'Causa raíz propuesta',
    });
    await transitionAnalysis(s.orgId, s.owner, id, 'under_review');
    // Un no revisor no aprueba.
    await expect(transitionAnalysis(s.orgId, s.other, id, 'approved')).rejects.toBeInstanceOf(
      AnalysisPermissionError,
    );
    await transitionAnalysis(s.orgId, s.reviewer, id, 'approved');
    const d = await getAnalysisDetail(s.orgId, id);
    expect(d.analysis.status).toBe('approved');
    expect(d.analysis.snapshot).toBeTruthy();
    const versions = await db().qualityAnalysisVersion.count({ where: { analysisId: id } });
    expect(versions).toBe(1);
    // Solo lectura.
    await expect(updateAnalysis(s.orgId, s.owner, id, { title: 'z' })).rejects.toBeInstanceOf(
      AnalysisValidationError,
    );
  });

  it('nueva versión duplica la estructura en un borrador editable', async () => {
    const s = await setup();
    const id = await createAnalysis(s.orgId, s.owner, s.capaId, { type: 'ishikawa', title: 'x' });
    await updateAnalysis(s.orgId, s.owner, id, { reviewerUserId: s.reviewer });
    await transitionAnalysis(s.orgId, s.owner, id, 'in_progress');
    await saveConclusion(s.orgId, s.owner, id, { summary: 'r', proposedRootCause: 'c' });
    await transitionAnalysis(s.orgId, s.owner, id, 'under_review');
    await transitionAnalysis(s.orgId, s.reviewer, id, 'approved');
    const v2 = await createNewVersion(s.orgId, s.owner, id);
    const d = await getAnalysisDetail(s.orgId, v2);
    expect(d.analysis.version).toBe(2);
    expect(d.analysis.status).toBe('draft');
    expect(d.categories.length).toBe(6); // estructura copiada
    // La versión anterior sigue aprobada e intacta.
    expect((await getAnalysisDetail(s.orgId, id)).analysis.status).toBe('approved');
  });
});

describe.skipIf(!hasDb)('árbol de causas', () => {
  it('rechaza ciclos y auto-referencia', async () => {
    const s = await setup();
    const id = await createAnalysis(s.orgId, s.owner, s.capaId, { type: 'cause_tree', title: 't' });
    const a = await addCauseNode(s.orgId, s.owner, id, { type: 'event', description: 'Evento' });
    const b = await addCauseNode(s.orgId, s.owner, id, {
      type: 'immediate_cause',
      description: 'Causa',
    });
    await addCauseEdge(s.orgId, s.owner, id, { fromNodeId: a, toNodeId: b, relation: 'caused' });
    await expect(
      addCauseEdge(s.orgId, s.owner, id, { fromNodeId: b, toNodeId: a, relation: 'caused' }),
    ).rejects.toBeInstanceOf(AnalysisValidationError);
    await expect(
      addCauseEdge(s.orgId, s.owner, id, { fromNodeId: a, toNodeId: a, relation: 'caused' }),
    ).rejects.toBeInstanceOf(AnalysisValidationError);
  });
});

describe.skipIf(!hasDb)('Pareto y AMEF', () => {
  it('Pareto ordena y calcula acumulado desde datos', async () => {
    const s = await setup();
    const id = await createAnalysis(s.orgId, s.owner, s.capaId, { type: 'pareto', title: 'p' });
    await setParetoItems(s.orgId, s.owner, id, [
      { category: 'A', count: 50 },
      { category: 'B', count: 30 },
      { category: 'C', count: 20 },
    ]);
    const r = await getParetoResult(s.orgId, id);
    expect(r.total).toBe(100);
    expect(r.rows[0]?.category).toBe('A');
    expect(r.rows[1]?.cumulativePercentage).toBe(80);
  });

  it('AMEF calcula NPR, valida rangos y recalcula tras acción', async () => {
    const s = await setup();
    const id = await createAnalysis(s.orgId, s.owner, s.capaId, { type: 'fmea', title: 'f' });
    await expect(
      addFmeaRow(s.orgId, s.owner, id, {
        failureMode: 'Fuga',
        severity: 11,
        occurrence: 3,
        detection: 4,
      }),
    ).rejects.toBeInstanceOf(AnalysisValidationError);
    const rowId = await addFmeaRow(s.orgId, s.owner, id, {
      failureMode: 'Fuga',
      severity: 10,
      occurrence: 5,
      detection: 4,
    });
    let row = await db().fmeaRow.findUniqueOrThrow({ where: { id: rowId } });
    expect(row.npr).toBe(200);
    expect(row.actionPriority).toBe('critical');
    await updateFmeaRow(s.orgId, s.owner, rowId, {
      severityPost: 10,
      occurrencePost: 2,
      detectionPost: 2,
      executedAction: 'Sello nuevo',
    });
    row = await db().fmeaRow.findUniqueOrThrow({ where: { id: rowId } });
    expect(row.nprPost).toBe(40);
  });
});

describe.skipIf(!hasDb)('recurrencia y comparación', () => {
  it('encuentra candidatas por coincidencia y exige justificación', async () => {
    const s = await setup();
    const similar = await makeCapa(s.orgId, s.owner, {
      sourceType: 'internal_nc',
      title: 'Otra NC',
    });
    const id = await createAnalysis(s.orgId, s.owner, s.capaId, { type: 'recurrence', title: 'r' });
    const candidates = await findRecurrenceCandidates(s.orgId, id);
    expect(candidates.some((c) => c.capaId === similar)).toBe(true);
    await expect(
      confirmRecurrence(s.orgId, s.owner, id, {
        matchedCapaId: similar,
        confirmation: 'recurrent',
        justification: '',
      }),
    ).rejects.toBeInstanceOf(AnalysisValidationError);
    await confirmRecurrence(s.orgId, s.owner, id, {
      matchedCapaId: similar,
      confirmation: 'recurrent',
      justification: 'Mismo modo de falla',
    });
    expect((await getAnalysisDetail(s.orgId, id)).recurrence.length).toBe(1);
  });

  it('comparación exige entre 2 y 5 CAPA', async () => {
    const s = await setup();
    const c2 = await makeCapa(s.orgId, s.owner);
    const c3 = await makeCapa(s.orgId, s.owner);
    const id = await createAnalysis(s.orgId, s.owner, s.capaId, {
      type: 'comparative',
      title: 'c',
    });
    await expect(setComparativeCases(s.orgId, s.owner, id, [s.capaId])).rejects.toBeInstanceOf(
      AnalysisValidationError,
    );
    await setComparativeCases(s.orgId, s.owner, id, [s.capaId, c2, c3]);
    const cmp = await getComparison(s.orgId, id);
    expect(cmp.length).toBe(3);
  });
});

describe.skipIf(!hasDb)('conversión a acciones CAPA y aislamiento', () => {
  it('crea acción, vincula y evita duplicados', async () => {
    const s = await setup();
    const id = await createAnalysis(s.orgId, s.owner, s.capaId, { type: 'fmea', title: 'f' });
    const rowId = await addFmeaRow(s.orgId, s.owner, id, {
      failureMode: 'Fuga',
      severity: 8,
      occurrence: 4,
      detection: 5,
    });
    const actionId = await createCapaActionFromAnalysis(s.orgId, s.owner, id, {
      sourceEntity: 'fmea_row',
      sourceId: rowId,
      description: 'Cambiar sello',
    });
    expect(actionId).toBeTruthy();
    // Vínculo bidireccional.
    const link = await db().qualityAnalysisActionLink.findFirstOrThrow({
      where: { analysisId: id, capaActionId: actionId },
    });
    expect(link.sourceEntity).toBe('fmea_row');
    // Duplicado por el mismo elemento de origen.
    await expect(
      createCapaActionFromAnalysis(s.orgId, s.owner, id, {
        sourceEntity: 'fmea_row',
        sourceId: rowId,
        description: 'otra',
      }),
    ).rejects.toBeInstanceOf(AnalysisValidationError);
  });

  it('no crea acción si la CAPA está cerrada', async () => {
    const s = await setup();
    const closed = await makeCapa(s.orgId, s.owner, { status: 'closed' });
    const id = await createAnalysis(s.orgId, s.owner, closed, { type: 'freeform', title: 'x' });
    await expect(
      createCapaActionFromAnalysis(s.orgId, s.owner, id, {
        sourceEntity: 'conclusion',
        description: 'no debe',
      }),
    ).rejects.toThrow();
  });

  it('una organización no accede al análisis de otra', async () => {
    const s = await setup();
    const b = await seedOrgWithPublishedTemplate(db());
    const id = await createAnalysis(s.orgId, s.owner, s.capaId, { type: 'freeform', title: 'x' });
    await expect(getAnalysisDetail(b.orgId, id)).rejects.toBeInstanceOf(AnalysisNotFoundError);
  });

  it('RLS: con contexto de organización solo se ven los análisis propios', async () => {
    await inRollbackTx(async (tx) => {
      const a = await seedOrgWithPublishedTemplate(tx);
      const bb = await seedOrgWithPublishedTemplate(tx);
      const mkCapa = async (orgId: string) => {
        const id = newId();
        await tx.capa.create({
          data: {
            id,
            organizationId: orgId,
            folio: `CAPA-2026-${orgId.slice(0, 6)}`,
            year: 2026,
            title: 't',
            description: 'd',
            sourceType: 'internal_nc',
          },
        });
        return id;
      };
      const mkAnalysis = async (orgId: string, capaId: string) =>
        tx.qualityAnalysis.create({
          data: { id: newId(), organizationId: orgId, capaId, type: 'freeform', title: 'x' },
        });
      await mkAnalysis(a.orgId, await mkCapa(a.orgId));
      await mkAnalysis(bb.orgId, await mkCapa(bb.orgId));

      await tx.$executeRawUnsafe('SET LOCAL ROLE gapsi_app');
      await tx.$executeRaw`SELECT set_config('app.current_org', ${a.orgId}, true)`;
      const rows = await tx.$queryRaw<{ organization_id: string }[]>`
        SELECT organization_id FROM quality_analyses`;
      expect(rows.every((r) => r.organization_id === a.orgId)).toBe(true);
      expect(rows.some((r) => r.organization_id === bb.orgId)).toBe(false);
    });
  });
});
