/**
 * DOC-003 — activación de Programas ejecutables (ocurrencias + tareas nativas)
 * contra la capa de datos. Requiere `DATABASE_URL`. Organizaciones desechables.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, seedOrgWithPublishedTemplate } from './_helpers';
import { createStructuredDocument } from '@/server/documents';
import {
  activateProgram,
  getProgramInstances,
  validateProgramForActivation,
  ProgramActivationError,
} from '@/server/programs';

const ACT_ID = '11111111-1111-4111-8111-111111111111';

function programContent(responsibleUserId: string | null = null) {
  return {
    fields: { objetivo: 'O', alcance: 'A' },
    program: {
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      activities: [
        {
          activityId: ACT_ID,
          name: 'Auditoría trimestral',
          description: 'Auditoría BPM',
          executionEnabled: true,
          responsibleUserId,
          schedule: {
            type: 'single',
            startDate: null,
            dueDate: '2026-10-15',
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

async function makeProgram(
  org: { orgId: string; userId: string },
  content: ReturnType<typeof programContent> = programContent(),
) {
  return createStructuredDocument(org.orgId, org.userId, {
    documentType: 'program',
    title: 'Programa de auditorías',
    areaCode: 'CA',
    structuredContent: content,
  });
}

async function currentVersionId(orgId: string, documentId: string): Promise<string> {
  const v = await db().documentVersion.findFirst({
    where: { documentId, organizationId: orgId, isCurrent: true },
    select: { id: true },
  });
  return v!.id;
}

describe.skipIf(!hasDb)('activación de Programas ejecutables (DOC-003)', () => {
  it('A. activar genera una ocurrencia enlazada a una Tarea nativa', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await makeProgram(org, programContent(org.userId));
    const versionId = await currentVersionId(org.orgId, id);

    const res = await activateProgram(org.orgId, org.userId, id, versionId);
    expect(res.instances).toBe(1);
    expect(res.tasks).toBe(1);

    const instances = await getProgramInstances(org.orgId, id);
    expect(instances).toHaveLength(1);
    expect(instances[0]?.occurrenceKey).toBe('single:2026-10-15');
    expect(instances[0]?.activityId).toBe(ACT_ID);
    expect(instances[0]?.taskId).toBeTruthy();

    // La tarea nativa existe y apunta a la ocurrencia (sourceType/sourceId).
    const task = await db().task.findFirst({
      where: {
        organizationId: org.orgId,
        sourceType: 'program_activity',
        sourceId: instances[0]!.id,
      },
      select: { id: true, title: true },
    });
    expect(task?.id).toBe(instances[0]?.taskId);
  });

  it('B. reactivar (retry) es idempotente: no duplica ocurrencias ni tareas', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await makeProgram(org, programContent(org.userId));
    const versionId = await currentVersionId(org.orgId, id);

    await activateProgram(org.orgId, org.userId, id, versionId);
    const second = await activateProgram(org.orgId, org.userId, id, versionId);
    // La segunda no crea tareas nuevas.
    expect(second.tasks).toBe(0);

    expect(await getProgramInstances(org.orgId, id)).toHaveLength(1);
    const taskCount = await db().task.count({
      where: { organizationId: org.orgId, sourceType: 'program_activity' },
    });
    expect(taskCount).toBe(1);
  });

  it('N. una actividad NO ejecutable (documental) no genera ocurrencias ni tareas', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const content = programContent();
    (content.program.activities[0] as Record<string, unknown>).executionEnabled = false;
    const id = await makeProgram(org, content);
    const versionId = await currentVersionId(org.orgId, id);

    const res = await activateProgram(org.orgId, org.userId, id, versionId);
    expect(res.instances).toBe(0);
    expect(res.tasks).toBe(0);
    expect(await getProgramInstances(org.orgId, id)).toHaveLength(0);
  });

  it('K. un responsable de otro tenant es rechazado (validación server-side)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const other = await seedOrgWithPublishedTemplate(db());
    const content = programContent();
    (content.program.activities[0] as Record<string, unknown>).responsibleUserId = other.userId;
    const id = await makeProgram(org, content);
    const versionId = await currentVersionId(org.orgId, id);

    const errors = await validateProgramForActivation(org.orgId, id, versionId);
    expect(errors.some((e) => e.includes('no pertenece a la organización'))).toBe(true);
    await expect(activateProgram(org.orgId, org.userId, id, versionId)).rejects.toBeInstanceOf(
      ProgramActivationError,
    );
  });

  it('D. las ocurrencias están aisladas por organización', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const id = await makeProgram(a, programContent(a.userId));
    const versionId = await currentVersionId(a.orgId, id);
    await activateProgram(a.orgId, a.userId, id, versionId);
    // B no ve las ocurrencias de A.
    expect(await getProgramInstances(b.orgId, id)).toHaveLength(0);
  });
});
