/**
 * CORE-UX-004 — Desacople de análisis legacy de CAPA, estudios desde origen y
 * acciones contextuales de tarea. Requiere DB. Organizaciones desechables.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, newId, seedOrgWithPublishedTemplate } from './_helpers';
import {
  createIndependentAnalysis,
  createLinkedAnalysis,
  getAnalysisDetail,
  listAnalysisLibrary,
  listAnalysesForTarget,
} from '@/server/quality-analysis';
import { createStudy, getStudyOrigin, listStudiesForSource } from '@/server/studies';
import { createTask, transitionTask, TaskValidationError } from '@/server/tasks';

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

async function setup() {
  const fx = await seedOrgWithPublishedTemplate(db()); // owner
  return { orgId: fx.orgId, owner: fx.userId };
}

describe.skipIf(!hasDb)('CORE-UX-004 — análisis legacy sin CAPA', () => {
  it('AMEF independiente: capaId null', async () => {
    const s = await setup();
    const id = await createIndependentAnalysis(s.orgId, s.owner, {
      type: 'fmea',
      title: 'AMEF proceso',
    });
    const d = await getAnalysisDetail(s.orgId, id);
    expect(d.analysis.type).toBe('fmea');
    expect(d.analysis.capaId).toBeNull();
  });

  it('análisis libre independiente: capaId null', async () => {
    const s = await setup();
    const id = await createIndependentAnalysis(s.orgId, s.owner, {
      type: 'freeform',
      title: 'Libre',
    });
    const d = await getAnalysisDetail(s.orgId, id);
    expect(d.analysis.capaId).toBeNull();
  });

  it('AMEF, Ishikawa y Pareto desde proyecto: relación sin CAPA', async () => {
    const s = await setup();
    const projectId = await makeProject(s.orgId);
    const fmea = await createLinkedAnalysis(
      s.orgId,
      s.owner,
      { type: 'fmea', title: 'AMEF proyecto' },
      { relationType: 'project', targetId: projectId },
    );
    const ish = await createLinkedAnalysis(
      s.orgId,
      s.owner,
      { type: 'ishikawa', title: 'Ishikawa proyecto' },
      { relationType: 'project', targetId: projectId },
    );
    const par = await createLinkedAnalysis(
      s.orgId,
      s.owner,
      { type: 'pareto', title: 'Pareto proyecto' },
      { relationType: 'project', targetId: projectId },
    );

    // Ninguno depende de una CAPA.
    for (const id of [fmea, ish, par]) {
      const d = await getAnalysisDetail(s.orgId, id);
      expect(d.analysis.capaId).toBeNull();
    }
    // Ishikawa siembra sus 6 categorías incluso sin CAPA.
    expect((await getAnalysisDetail(s.orgId, ish)).categories.length).toBe(6);
    // Se listan por origen (proyecto) vía analysis_relations.
    const byProject = await listAnalysesForTarget(s.orgId, 'project', projectId);
    for (const id of [fmea, ish, par]) expect(byProject.some((r) => r.id === id)).toBe(true);
  });

  it('aislamiento tenant en la biblioteca', async () => {
    const a = await setup();
    const b = await setup();
    const idA = await createIndependentAnalysis(a.orgId, a.owner, {
      type: 'fmea',
      title: 'Solo A',
    });
    expect((await listAnalysisLibrary(b.orgId)).some((r) => r.id === idA)).toBe(false);
  });
});

describe.skipIf(!hasDb)('CORE-UX-004 — estudio relacionado a proyecto', () => {
  it('crea estudio con origen proyecto y trazabilidad bidireccional', async () => {
    const s = await setup();
    const projectId = await makeProject(s.orgId);
    const studyId = await createStudy(s.orgId, s.owner, {
      title: 'Estudio del proyecto',
      sourceType: 'project',
      sourceId: projectId,
    });
    // Proyecto → estudios.
    const studies = await listStudiesForSource(s.orgId, 'project', projectId);
    expect(studies.some((st) => st.id === studyId)).toBe(true);
    // Estudio → origen (con folio del proyecto y ruta).
    const origin = await getStudyOrigin(s.orgId, 'project', projectId);
    expect(origin?.label).toBe('Proyecto');
    expect(origin?.href).toBe(`/dashboard/projects/${projectId}`);
    expect(origin?.folio).toMatch(/^PRJ-/);
  });
});

describe.skipIf(!hasDb)('CORE-UX-004 — acción contextual de tarea (motivo)', () => {
  it('bloquear exige motivo; con motivo procede', async () => {
    const s = await setup();
    const taskId = await createTask(s.orgId, s.owner, { title: 'Tarea de prueba' });
    await expect(transitionTask(s.orgId, s.owner, taskId, 'blocked', {})).rejects.toBeInstanceOf(
      TaskValidationError,
    );
    await transitionTask(s.orgId, s.owner, taskId, 'blocked', { reason: 'Falta insumo' });
    const t = await db().task.findFirst({ where: { id: taskId }, select: { status: true } });
    expect(t?.status).toBe('blocked');
  });
});
