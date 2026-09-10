/**
 * DOC-003 — vista de Ejecución (getProgramExecution) y origen Task→Programa.
 * Requiere `DATABASE_URL`. Organizaciones desechables.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, seedOrgWithPublishedTemplate } from './_helpers';
import { createStructuredDocument } from '@/server/documents';
import {
  activateProgram,
  getProgramExecution,
  getProgramInstances,
  getTaskProgramOrigin,
} from '@/server/programs';

const ACT = '33333333-3333-4333-8333-333333333333';

function program(responsibleUserId: string, dueDate: string) {
  return {
    fields: { objetivo: 'O', alcance: 'A' },
    program: {
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      activities: [
        {
          activityId: ACT,
          name: 'Auditoría BPM',
          description: 'd',
          executionEnabled: true,
          responsibleUserId,
          schedule: {
            type: 'single',
            startDate: null,
            dueDate,
            frequency: null,
            interval: null,
            endDate: null,
          },
          expectedEvidence: 'Informe de auditoría',
          observations: '',
          notifyBeforeDays: 7,
        },
      ],
    },
  };
}

/** Crea, publica (marca la versión) y activa el programa. */
async function activatedProgram(org: { orgId: string; userId: string }, dueDate = '2026-10-15') {
  const id = await createStructuredDocument(org.orgId, org.userId, {
    documentType: 'program',
    title: 'Programa',
    areaCode: 'CA',
    structuredContent: program(org.userId, dueDate),
  });
  const v = await db().documentVersion.findFirst({
    where: { documentId: id, organizationId: org.orgId, isCurrent: true },
    select: { id: true },
  });
  await db().documentVersion.update({
    where: { id: v!.id },
    data: { status: 'published', publishedAt: new Date() },
  });
  await db().document.update({ where: { id }, data: { status: 'effective' } });
  await activateProgram(org.orgId, org.userId, id, v!.id);
  return { id, versionId: v!.id };
}

describe.skipIf(!hasDb)('vista de ejecución de Programa (DOC-003)', () => {
  it('A. devuelve ocurrencias con estado, responsable y tarea', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    await activatedProgram(org);
    const exec = await getProgramExecution(org.orgId, (await activatedProgram(org)).id, {
      now: '2026-10-10',
    });
    expect(exec.published).toBe(true);
    expect(exec.rows).toHaveLength(1);
    expect(exec.rows[0]?.status).toBe('scheduled');
    expect(exec.rows[0]?.taskId).toBeTruthy();
    expect(exec.rows[0]?.responsibleName).toBeTruthy();
    expect(exec.rows[0]?.expectedEvidence).toBe('Informe de auditoría');
  });

  it('B. tarea completada → estado Completada; excluye de pendientes', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id } = await activatedProgram(org);
    const inst = (await getProgramInstances(org.orgId, id))[0]!;
    await db().task.update({ where: { id: inst.taskId! }, data: { status: 'completed' } });
    const exec = await getProgramExecution(org.orgId, id, { now: '2026-10-10' });
    expect(exec.rows[0]?.status).toBe('completed');
    expect(exec.progress.completed).toBe(1);
    expect(exec.progress.percent).toBe(100);
  });

  it('C. vencida derivada cuando dueAt < now y la tarea no es terminal', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id } = await activatedProgram(org, '2026-10-15');
    const exec = await getProgramExecution(org.orgId, id, { now: '2026-10-20' });
    expect(exec.rows[0]?.status).toBe('overdue');
    expect(exec.summary.overdue).toBe(1);
  });

  it('D. ocurrencia cancelada se excluye del progreso', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id } = await activatedProgram(org);
    const inst = (await getProgramInstances(org.orgId, id))[0]!;
    await db().programActivityInstance.update({
      where: { id: inst.id },
      data: { status: 'cancelled' },
    });
    const exec = await getProgramExecution(org.orgId, id, { now: '2026-10-10' });
    expect(exec.rows[0]?.status).toBe('cancelled');
    expect(exec.progress.total).toBe(0);
  });

  it('E. aislamiento por organización', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const { id } = await activatedProgram(a);
    const exec = await getProgramExecution(b.orgId, id, { now: '2026-10-10' });
    expect(exec.rows).toHaveLength(0);
  });

  it('F. programa sin publicar muestra vacío (published=false)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'program',
      title: 'Borrador',
      areaCode: 'CA',
      structuredContent: program(org.userId, '2026-10-15'),
    });
    const exec = await getProgramExecution(org.orgId, id, { now: '2026-10-10' });
    expect(exec.published).toBe(false);
    expect(exec.rows).toHaveLength(0);
  });

  it('G. resuelve el origen Task→Programa (sourceType=program_activity)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id } = await activatedProgram(org);
    const inst = (await getProgramInstances(org.orgId, id))[0]!;
    const origin = await getTaskProgramOrigin(org.orgId, inst.id);
    expect(origin?.documentId).toBe(id);
    expect(origin?.activityName).toBe('Auditoría BPM');
    expect(origin?.code).toBeTruthy();
    // Aislamiento: otra organización no resuelve el origen.
    const other = await seedOrgWithPublishedTemplate(db());
    expect(await getTaskProgramOrigin(other.orgId, inst.id)).toBeNull();
  });
});
