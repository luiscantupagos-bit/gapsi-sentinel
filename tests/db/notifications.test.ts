/**
 * DOC-003 — notificaciones internas (processor + dedup + lectura) contra la capa
 * de datos. Requiere `DATABASE_URL`. Organizaciones desechables.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, seedOrgWithPublishedTemplate } from './_helpers';
import { createStructuredDocument } from '@/server/documents';
import { activateProgram, getProgramInstances } from '@/server/programs';
import {
  processProgramNotifications,
  listNotificationsForUser,
  markNotificationRead,
  countUnreadNotifications,
} from '@/server/notifications';

const ACT = '22222222-2222-4222-8222-222222222222';

function singleProgram(responsibleUserId: string, dueDate: string, notifyBeforeDays = 7) {
  return {
    fields: { objetivo: 'O', alcance: 'A' },
    program: {
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      activities: [
        {
          activityId: ACT,
          name: 'Verificación mensual de plagas',
          description: 'Verificación',
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
          expectedEvidence: 'Informe',
          observations: '',
          notifyBeforeDays,
        },
      ],
    },
  };
}

async function makeAndActivate(
  org: { orgId: string; userId: string },
  content: ReturnType<typeof singleProgram>,
) {
  const id = await createStructuredDocument(org.orgId, org.userId, {
    documentType: 'program',
    title: 'Programa',
    areaCode: 'CA',
    structuredContent: content,
  });
  const v = await db().documentVersion.findFirst({
    where: { documentId: id, organizationId: org.orgId, isCurrent: true },
    select: { id: true },
  });
  await activateProgram(org.orgId, org.userId, id, v!.id);
  return id;
}

describe.skipIf(!hasDb)('notificaciones de Programa (DOC-003)', () => {
  it('A/B. crea due_soon y el rerun no duplica', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await makeAndActivate(org, singleProgram(org.userId, '2026-10-15', 7));

    const first = await processProgramNotifications(org.orgId, '2026-10-08');
    expect(first.created).toBe(1);
    const second = await processProgramNotifications(org.orgId, '2026-10-08');
    expect(second.created).toBe(0);
    expect(second.skippedExisting).toBe(1);

    const list = await listNotificationsForUser(org.orgId, org.userId, {});
    expect(list).toHaveLength(1);
    expect(list[0]?.notificationType).toBe('program_due_soon');
    // L. payload apunta a la ocurrencia/tarea correctas.
    const inst = (await getProgramInstances(org.orgId, id))[0]!;
    const payload = list[0]?.payload as Record<string, unknown>;
    expect(payload.instanceId).toBe(inst.id);
    expect(payload.taskId).toBe(inst.taskId);
  });

  it('C. due_today el día del vencimiento', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    await makeAndActivate(org, singleProgram(org.userId, '2026-10-15', 7));
    const res = await processProgramNotifications(org.orgId, '2026-10-15');
    expect(res.created).toBe(1);
    const list = await listNotificationsForUser(org.orgId, org.userId, {});
    expect(list[0]?.notificationType).toBe('program_due_today');
  });

  it('D. overdue una sola vez aunque se procese varios días', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    await makeAndActivate(org, singleProgram(org.userId, '2026-10-15', 7));
    expect((await processProgramNotifications(org.orgId, '2026-10-16')).created).toBe(1);
    expect((await processProgramNotifications(org.orgId, '2026-10-20')).created).toBe(0);
    const list = await listNotificationsForUser(org.orgId, org.userId, {});
    expect(list.filter((n) => n.notificationType === 'program_overdue')).toHaveLength(1);
  });

  it('E/F. tarea completada o cancelada no genera avisos (§8/§24)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await makeAndActivate(org, singleProgram(org.userId, '2026-10-15', 7));
    const inst = (await getProgramInstances(org.orgId, id))[0]!;
    await db().task.update({ where: { id: inst.taskId! }, data: { status: 'completed' } });
    const res = await processProgramNotifications(org.orgId, '2026-10-16');
    expect(res.created).toBe(0);
    expect(res.skippedCompleted).toBe(1);
  });

  it('K. una ocurrencia superseded no genera avisos', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await makeAndActivate(org, singleProgram(org.userId, '2026-10-15', 7));
    const inst = (await getProgramInstances(org.orgId, id))[0]!;
    await db().programActivityInstance.update({
      where: { id: inst.id },
      data: { status: 'superseded' },
    });
    expect((await processProgramNotifications(org.orgId, '2026-10-16')).created).toBe(0);
  });

  it('G/H. aislamiento por organización y por usuario', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    await makeAndActivate(a, singleProgram(a.userId, '2026-10-15', 7));
    await processProgramNotifications(a.orgId, '2026-10-08');

    // G: B no procesa nada de A.
    expect((await processProgramNotifications(b.orgId, '2026-10-08')).created).toBe(0);
    // H: el usuario de B no ve notificaciones de A.
    expect(await listNotificationsForUser(a.orgId, b.userId, {})).toHaveLength(0);
    expect(await listNotificationsForUser(a.orgId, a.userId, {})).toHaveLength(1);
  });

  it('I. marcar leída oculta de la lista de no leídas', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    await makeAndActivate(org, singleProgram(org.userId, '2026-10-15', 7));
    await processProgramNotifications(org.orgId, '2026-10-08');
    const list = await listNotificationsForUser(org.orgId, org.userId, {});
    expect(await countUnreadNotifications(org.orgId, org.userId)).toBe(1);
    await markNotificationRead(org.orgId, org.userId, list[0]!.id);
    expect(await countUnreadNotifications(org.orgId, org.userId)).toBe(0);
    expect(
      await listNotificationsForUser(org.orgId, org.userId, { unreadOnly: true }),
    ).toHaveLength(0);
  });

  it('J. ocurrencias recurrentes generan avisos separados (por source_id)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const content = {
      fields: { objetivo: 'O', alcance: 'A' },
      program: {
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        activities: [
          {
            activityId: ACT,
            name: 'Auditoría mensual',
            description: 'd',
            executionEnabled: true,
            responsibleUserId: org.userId,
            schedule: {
              type: 'recurring',
              startDate: '2026-10-01',
              dueDate: null,
              frequency: 'monthly',
              interval: 1,
              endDate: '2026-11-30',
            },
            expectedEvidence: 'Informe',
            observations: '',
            notifyBeforeDays: 7,
          },
        ],
      },
    };
    const id = await makeAndActivate(org, content as unknown as ReturnType<typeof singleProgram>);
    const instances = await getProgramInstances(org.orgId, id);
    expect(instances.length).toBeGreaterThanOrEqual(2);
    // Un now posterior a ambas → un overdue por ocurrencia (source_id distinto).
    const res = await processProgramNotifications(org.orgId, '2026-12-15');
    expect(res.created).toBe(instances.length);
    const list = await listNotificationsForUser(org.orgId, org.userId, { limit: 50 });
    const sourceIds = new Set(list.map((n) => n.sourceId));
    expect(sourceIds.size).toBe(instances.length);
  });
});
