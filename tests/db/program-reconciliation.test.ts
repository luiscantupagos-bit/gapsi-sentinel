/**
 * DOC-003 — reconciliación de EJECUCIÓN entre versiones (§2-13, §17 H-U, §18).
 * Requiere `DATABASE_URL`. Usa organizaciones desechables. Al publicar una versión
 * nueva: las ocurrencias futuras equivalentes CONTINÚAN (la tarea se adopta), las
 * cambiadas/eliminadas se SUSTITUYEN (tarea a terminal), y el histórico permanece.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, newId, seedOrgWithPublishedTemplate } from './_helpers';
import {
  STRUCTURED_SCHEMA_VERSION,
  sanitizeStructuredContent,
} from '@/features/documents/structured-content';
import { createStructuredDocument } from '@/server/documents';
import {
  activateProgram,
  activateProgramWithReconciliation,
  supersedeFutureOccurrences,
  getProgramExecution,
  getProgramInstances,
} from '@/server/programs';
import { processProgramNotifications } from '@/server/notifications';

const ACT1 = '11111111-1111-4111-8111-111111111111';
const ACT2 = '22222222-2222-4222-8222-222222222222';
const NOW = '2026-10-10';

interface Org {
  orgId: string;
  userId: string;
}

function single(activityId: string, dueDate: string, responsibleUserId: string) {
  return {
    activityId,
    name: `Actividad ${activityId.slice(0, 4)}`,
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
    expectedEvidence: 'Evidencia',
    observations: '',
    notifyBeforeDays: 7,
  };
}

function programContent(activities: unknown[]) {
  return {
    fields: { objetivo: 'O', alcance: 'A' },
    program: { periodStart: '2026-01-01', periodEnd: '2026-12-31', activities },
  };
}

/** Crea el documento Programa v1.0, lo marca publicado y lo activa. */
async function publishV1(org: Org, activities: unknown[]) {
  const id = await createStructuredDocument(org.orgId, org.userId, {
    documentType: 'program',
    title: 'Programa',
    areaCode: 'CA',
    structuredContent: programContent(activities),
  } as never);
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
  return { id, v1Id: v!.id };
}

/** Publica una versión nueva (obsoleta la anterior) y reconcilia la ejecución. */
async function publishV2(org: Org, docId: string, priorVersionId: string, activities: unknown[]) {
  const content = sanitizeStructuredContent('program', programContent(activities));
  const vid = newId();
  await db().documentVersion.update({
    where: { id: priorVersionId },
    data: { status: 'obsolete', isCurrent: false },
  });
  await db().documentVersion.create({
    data: {
      id: vid,
      organizationId: org.orgId,
      documentId: docId,
      label: '2.0',
      status: 'published',
      isCurrent: true,
      author: org.userId,
      updatedBy: org.userId,
      templateKey: 'program',
      contentSchemaVersion: STRUCTURED_SCHEMA_VERSION,
      structuredContent: content as unknown as object,
      publishedAt: new Date(),
    },
  });
  const result = await activateProgramWithReconciliation(
    org.orgId,
    org.userId,
    docId,
    vid,
    [priorVersionId],
    NOW,
  );
  return { v2Id: vid, result };
}

describe.skipIf(!hasDb)('reconciliación de programas ejecutables (DOC-003)', () => {
  it('H. actividad que continúa: la ocurrencia futura equivalente adopta su tarea (sin duplicar)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id, v1Id } = await publishV1(org, [single(ACT1, '2026-11-01', org.userId)]);
    const before = (await getProgramInstances(org.orgId, id)).find(
      (i) => i.documentVersionId === v1Id,
    )!;
    const originalTaskId = before.taskId!;

    const { v2Id, result } = await publishV2(org, id, v1Id, [
      single(ACT1, '2026-11-01', org.userId),
    ]);
    // Continuidad: la ocurrencia se ADOPTA (carry); no hay reemplazos ni cancelaciones.
    expect(result.carried).toBe(1);
    expect(result.superseded).toBe(0);
    expect(result.cancelledTasks).toBe(0);

    const all = await getProgramInstances(org.orgId, id);
    const v1 = all.find((i) => i.documentVersionId === v1Id)!;
    const v2 = all.find((i) => i.documentVersionId === v2Id)!;
    expect(v1.status).toBe('superseded');
    expect(v1.taskId).toBeNull();
    expect(v2.taskId).toBe(originalTaskId); // MISMA tarea (continuidad)

    // No se duplicaron tareas de programa para el documento.
    const tasks = await db().task.count({
      where: {
        organizationId: org.orgId,
        sourceType: 'program_activity',
        sourceId: { in: all.map((i) => i.id) },
      },
    });
    expect(tasks).toBe(1);
    // El origen de la tarea ahora apunta a la instancia de la versión nueva.
    const task = await db().task.findFirst({
      where: { id: originalTaskId },
      select: { sourceId: true },
    });
    expect(task?.sourceId).toBe(v2.id);
  });

  it('I. histórico (completadas/vencidas/pasadas) permanece intacto tras publicar', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const monthly = {
      ...single(ACT1, '2026-08-01', org.userId),
      schedule: {
        type: 'recurring',
        startDate: '2026-08-01',
        dueDate: null,
        frequency: 'monthly',
        interval: 1,
        endDate: '2026-11-30',
      },
    };
    const { id, v1Id } = await publishV1(org, [monthly]);
    const insts = (await getProgramInstances(org.orgId, id)).filter(
      (i) => i.documentVersionId === v1Id,
    );
    expect(insts).toHaveLength(4); // ago, sep, oct, nov
    const aug = insts.find((i) => i.dueAt === '2026-08-01')!;
    await db().task.update({ where: { id: aug.taskId! }, data: { status: 'completed' } });

    await publishV2(org, id, v1Id, [monthly]);

    const after = (await getProgramInstances(org.orgId, id)).filter(
      (i) => i.documentVersionId === v1Id,
    );
    const augAfter = after.find((i) => i.id === aug.id)!;
    expect(augAfter.status).toBe('scheduled'); // instancia histórica intacta
    const augTask = await db().task.findFirst({
      where: { id: aug.taskId! },
      select: { status: true },
    });
    expect(augTask?.status).toBe('completed'); // completada preservada
    // Vencidas pasadas (sep, oct) siguen; solo la futura (nov) se sustituye.
    const superseded = after.filter((i) => i.status === 'superseded');
    expect(superseded).toHaveLength(1);
    expect(superseded[0]?.dueAt).toBe('2026-11-01');
  });

  it('J/§7. actividad eliminada: futura sustituida y su tarea cancelada, sin borrar la tarea', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id, v1Id } = await publishV1(org, [single(ACT1, '2026-11-01', org.userId)]);
    const inst = (await getProgramInstances(org.orgId, id)).find(
      (i) => i.documentVersionId === v1Id,
    )!;
    const taskId = inst.taskId!;

    const { result } = await publishV2(org, id, v1Id, []); // se elimina la actividad
    expect(result.superseded).toBe(1);
    expect(result.cancelledTasks).toBe(1);

    const v1 = (await getProgramInstances(org.orgId, id)).find((i) => i.id === inst.id)!;
    expect(v1.status).toBe('superseded');
    const task = await db().task.findFirst({ where: { id: taskId }, select: { status: true } });
    expect(task?.status).toBe('cancelled'); // terminal coherente, no borrada
  });

  it('K. actividad nueva genera ejecución nueva en la versión publicada', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id, v1Id } = await publishV1(org, [single(ACT1, '2026-11-01', org.userId)]);
    const { v2Id } = await publishV2(org, id, v1Id, [
      single(ACT1, '2026-11-01', org.userId),
      single(ACT2, '2026-12-15', org.userId),
    ]);
    const v2 = (await getProgramInstances(org.orgId, id)).filter(
      (i) => i.documentVersionId === v2Id,
    );
    const nueva = v2.find((i) => i.activityId === ACT2)!;
    expect(nueva).toBeTruthy();
    expect(nueva.taskId).toBeTruthy();
    expect(nueva.dueAt).toBe('2026-12-15');
  });

  it('Q. una ocurrencia sustituida no genera nuevos avisos', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id, v1Id } = await publishV1(org, [single(ACT1, '2026-11-01', org.userId)]);
    await publishV2(org, id, v1Id, []); // sustituye la futura
    const summary = await processProgramNotifications(org.orgId, '2026-10-28');
    // La única instancia del doc quedó superseded → el processor la ignora.
    const created = await db().notificationDelivery.count({
      where: { organizationId: org.orgId, sourceType: 'program_activity' },
    });
    expect(created).toBe(0);
    expect(summary.created).toBe(0);
  });

  it('R/§8. la consulta histórica por versionId muestra la versión pedida, no la vigente', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id, v1Id } = await publishV1(org, [single(ACT1, '2026-11-01', org.userId)]);
    const { v2Id } = await publishV2(org, id, v1Id, [single(ACT1, '2026-11-01', org.userId)]);

    const hist = await getProgramExecution(org.orgId, id, { versionId: v1Id, now: NOW });
    expect(hist.versionId).toBe(v1Id);
    expect(hist.rows[0]?.status).toBe('superseded'); // la instancia previa quedó sustituida

    const active = await getProgramExecution(org.orgId, id, { now: NOW });
    expect(active.versionId).toBe(v2Id); // vigente publicada
    expect(active.rows[0]?.status).toBe('scheduled');
  });

  it('S/§9. la versión activa usa la publicada vigente, no un borrador más nuevo', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id, v1Id } = await publishV1(org, [single(ACT1, '2026-11-01', org.userId)]);
    // Un borrador más nuevo no cambia la ejecución vigente.
    await db().documentVersion.create({
      data: {
        id: newId(),
        organizationId: org.orgId,
        documentId: id,
        label: '2.0-draft',
        status: 'draft',
        isCurrent: false,
        author: org.userId,
        contentSchemaVersion: STRUCTURED_SCHEMA_VERSION,
        structuredContent: sanitizeStructuredContent(
          'program',
          programContent([single(ACT2, '2026-12-01', org.userId)]),
        ) as unknown as object,
      },
    });
    const active = await getProgramExecution(org.orgId, id, { now: NOW });
    expect(active.versionId).toBe(v1Id);
    expect(active.rows.every((r) => r.activityId === ACT1)).toBe(true);
  });

  it('T/§10. obsoletar sustituye las futuras y cancela sus tareas; el histórico permanece', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id, v1Id } = await publishV1(org, [single(ACT1, '2026-11-01', org.userId)]);
    const inst = (await getProgramInstances(org.orgId, id)).find(
      (i) => i.documentVersionId === v1Id,
    )!;
    const res = await supersedeFutureOccurrences(org.orgId, org.userId, v1Id, NOW);
    expect(res.superseded).toBe(1);
    expect(res.cancelledTasks).toBe(1);
    const after = (await getProgramInstances(org.orgId, id)).find((i) => i.id === inst.id)!;
    expect(after.status).toBe('superseded');
    const task = await db().task.findFirst({
      where: { id: inst.taskId! },
      select: { status: true },
    });
    expect(task?.status).toBe('cancelled');
  });

  it('§18/P. activación concurrente/doble no duplica ocurrencias ni tareas', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'program',
      title: 'Programa',
      areaCode: 'CA',
      structuredContent: programContent([single(ACT1, '2026-11-01', org.userId)]),
    } as never);
    const v = await db().documentVersion.findFirst({
      where: { documentId: id, organizationId: org.orgId, isCurrent: true },
      select: { id: true },
    });
    await db().documentVersion.update({
      where: { id: v!.id },
      data: { status: 'published', publishedAt: new Date() },
    });
    // Doble activación simultánea: la unicidad protege contra duplicados.
    await Promise.allSettled([
      activateProgram(org.orgId, org.userId, id, v!.id),
      activateProgram(org.orgId, org.userId, id, v!.id),
    ]);
    const instances = await db().programActivityInstance.count({
      where: { organizationId: org.orgId, documentId: id },
    });
    const tasks = await db().task.count({
      where: { organizationId: org.orgId, sourceType: 'program_activity' },
    });
    expect(instances).toBe(1);
    expect(tasks).toBe(1);
  });

  it('idempotencia: reconciliar dos veces produce el mismo resultado', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id, v1Id } = await publishV1(org, [single(ACT1, '2026-11-01', org.userId)]);
    const activities = [single(ACT1, '2026-11-01', org.userId)];
    const { v2Id } = await publishV2(org, id, v1Id, activities);
    // Reejecutar la reconciliación (retry) no debe duplicar ni re-sustituir.
    const again = await activateProgramWithReconciliation(
      org.orgId,
      org.userId,
      id,
      v2Id,
      [v1Id],
      NOW,
    );
    expect(again.carried).toBe(0); // la previa ya no es 'scheduled'
    expect(again.superseded).toBe(0);
    const tasks = await db().task.count({
      where: { organizationId: org.orgId, sourceType: 'program_activity' },
    });
    expect(tasks).toBe(1);
  });
});
