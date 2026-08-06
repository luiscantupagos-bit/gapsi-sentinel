/**
 * Gestor global de tareas — folios, estados, dependencias, permisos, agregación,
 * RLS y aislamiento entre organizaciones (TASK-009). DB.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { db, hasDb, inRollbackTx, newId, seedOrgWithPublishedTemplate } from './_helpers';
import {
  TaskPermissionError,
  TaskValidationError,
  addTaskDependency,
  convertToTask,
  createTask,
  getTaskDetail,
  listGlobalTasks,
  transitionTask,
  updateTask,
} from '@/server/tasks';
import { DependencyCycleError } from '@/features/tasks/dependencies';
import { InvalidTaskTransitionError } from '@/features/tasks/task-state';
import { createCapa } from '@/server/capa';

afterAll(async () => {
  if (hasDb) await db().$disconnect();
});

async function addMember(orgId: string, role: string): Promise<string> {
  const id = newId();
  await db().user.create({ data: { id, email: `u-${id}@x.test` } });
  await db().membership.create({ data: { organizationId: orgId, userId: id, role } });
  return id;
}

describe.skipIf(!hasDb)('Tareas — permisos, folios, estados', () => {
  it('viewer no puede crear; evaluador y admin sí', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const viewer = await addMember(fx.orgId, 'viewer');
    await expect(createTask(fx.orgId, viewer, { title: 'X' })).rejects.toBeInstanceOf(
      TaskPermissionError,
    );
    const id = await createTask(fx.orgId, fx.userId, { title: 'X' });
    expect(id).toBeTruthy();
  });

  it('folio TSK-AAAA-#### secuencial e independiente por organización', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const a1 = await createTask(a.orgId, a.userId, { title: '1' });
    const a2 = await createTask(a.orgId, a.userId, { title: '2' });
    const b1 = await createTask(b.orgId, b.userId, { title: '1' });
    const year = new Date().getUTCFullYear();
    expect((await getTaskDetail(a.orgId, a1)).task.folio).toBe(`TSK-${year}-0001`);
    expect((await getTaskDetail(a.orgId, a2)).task.folio).toBe(`TSK-${year}-0002`);
    expect((await getTaskDetail(b.orgId, b1)).task.folio).toBe(`TSK-${year}-0001`);
  });

  it('transiciones válidas e inválidas; completada queda en solo lectura', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const id = await createTask(fx.orgId, fx.userId, { title: 'T' });
    // Salto inválido pending → completed.
    await expect(transitionTask(fx.orgId, fx.userId, id, 'completed')).rejects.toBeInstanceOf(
      InvalidTaskTransitionError,
    );
    await transitionTask(fx.orgId, fx.userId, id, 'in_progress');
    await transitionTask(fx.orgId, fx.userId, id, 'completed');
    // Solo lectura: editar una tarea completada falla.
    await expect(updateTask(fx.orgId, fx.userId, id, { title: 'x' })).rejects.toBeInstanceOf(
      TaskValidationError,
    );
  });

  it('bloquear exige motivo; cancelar exige motivo', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const id = await createTask(fx.orgId, fx.userId, { title: 'T' });
    await transitionTask(fx.orgId, fx.userId, id, 'in_progress');
    await expect(transitionTask(fx.orgId, fx.userId, id, 'blocked')).rejects.toBeInstanceOf(
      TaskValidationError,
    );
    await transitionTask(fx.orgId, fx.userId, id, 'blocked', { reason: 'Falta insumo' });
    expect((await getTaskDetail(fx.orgId, id)).task.blockedReason).toBe('Falta insumo');
  });

  it('un evaluador no asignado no edita; el responsable sí', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const responsible = await addMember(fx.orgId, 'evaluator');
    const other = await addMember(fx.orgId, 'evaluator');
    const id = await createTask(fx.orgId, fx.userId, {
      title: 'T',
      responsibleUserId: responsible,
    });
    await expect(updateTask(fx.orgId, other, id, { title: 'hack' })).rejects.toBeInstanceOf(
      TaskPermissionError,
    );
    await updateTask(fx.orgId, responsible, id, { progress: 50 });
    expect((await getTaskDetail(fx.orgId, id)).task.progress).toBe(50);
  });
});

describe.skipIf(!hasDb)('Tareas — dependencias', () => {
  it('rechaza ciclos', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const t1 = await createTask(fx.orgId, fx.userId, { title: 'A' });
    const t2 = await createTask(fx.orgId, fx.userId, { title: 'B' });
    await addTaskDependency(fx.orgId, fx.userId, { fromTaskId: t1, toTaskId: t2 });
    await expect(
      addTaskDependency(fx.orgId, fx.userId, { fromTaskId: t2, toTaskId: t1 }),
    ).rejects.toBeInstanceOf(DependencyCycleError);
  });

  it('una dependencia obligatoria no completada bloquea el inicio', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const pre = await createTask(fx.orgId, fx.userId, { title: 'pre' });
    const post = await createTask(fx.orgId, fx.userId, { title: 'post' });
    await addTaskDependency(fx.orgId, fx.userId, {
      fromTaskId: pre,
      toTaskId: post,
      mandatory: true,
    });
    await expect(transitionTask(fx.orgId, fx.userId, post, 'in_progress')).rejects.toBeInstanceOf(
      TaskValidationError,
    );
    // Completa la predecesora y ahora sí arranca.
    await transitionTask(fx.orgId, fx.userId, pre, 'in_progress');
    await transitionTask(fx.orgId, fx.userId, pre, 'completed');
    await transitionTask(fx.orgId, fx.userId, post, 'in_progress');
    expect((await getTaskDetail(fx.orgId, post)).task.status).toBe('in_progress');
  });
});

describe.skipIf(!hasDb)('Tareas — agregación híbrida', () => {
  it('agrega acciones CAPA y las deduplica al convertirlas', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const capaId = await createCapa(fx.orgId, fx.userId, {
      title: 'CAPA',
      description: 'd',
      sourceType: 'internal_nc',
    });
    const action = await db().capaAction.create({
      data: {
        organizationId: fx.orgId,
        capaId,
        actionType: 'corrective',
        description: 'Acción agregada',
        responsibleUserId: fx.userId,
      },
    });
    const before = await listGlobalTasks(fx.orgId, fx.userId, {});
    const agg = before.find((i) => i.sourceType === 'capa_action' && i.sourceId === action.id);
    expect(agg).toBeTruthy();
    expect(agg!.kind).toBe('aggregated');
    expect(agg!.originHref).toBe(`/dashboard/capa/${capaId}`);

    // Convertir en tarea nativa enlazada: deja de aparecer como agregada.
    await convertToTask(fx.orgId, fx.userId, {
      title: 'Acción agregada',
      taskType: 'capa_action',
      origin: 'capa',
      sourceType: 'capa_action',
      sourceId: action.id,
    });
    const after = await listGlobalTasks(fx.orgId, fx.userId, {});
    const dup = after.filter((i) => i.sourceType === 'capa_action' && i.sourceId === action.id);
    expect(dup).toHaveLength(1);
    expect(dup[0]!.kind).toBe('native');
  });
});

describe.skipIf(!hasDb)('Tareas — aislamiento y RLS', () => {
  it('una organización no accede a la tarea de otra', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const id = await createTask(a.orgId, a.userId, { title: 'privada' });
    await expect(getTaskDetail(b.orgId, id)).rejects.toThrow();
    const listB = await listGlobalTasks(b.orgId, b.userId, {});
    expect(listB.some((i) => i.id === id)).toBe(false);
  });

  it('RLS: con contexto de organización solo se ven las tareas propias', async () => {
    await inRollbackTx(async (tx) => {
      const a = await seedOrgWithPublishedTemplate(tx);
      const b = await seedOrgWithPublishedTemplate(tx);
      const mk = (orgId: string) =>
        tx.task.create({
          data: {
            id: newId(),
            organizationId: orgId,
            folio: `TSK-2026-${orgId.slice(0, 4)}`,
            title: 't',
          },
        });
      await mk(a.orgId);
      await mk(b.orgId);
      await tx.$executeRawUnsafe('SET LOCAL ROLE gapsi_app');
      await tx.$executeRaw`SELECT set_config('app.current_org', ${a.orgId}, true)`;
      const rows = await tx.$queryRaw<
        { organization_id: string }[]
      >`SELECT organization_id FROM tasks`;
      expect(rows.every((r) => r.organization_id === a.orgId)).toBe(true);
      expect(rows.some((r) => r.organization_id === b.orgId)).toBe(false);
    });
  });

  it('rechaza sitio de otra organización (FK compuesta)', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    await expect(createTask(a.orgId, a.userId, { title: 'x', siteId: b.siteId })).rejects.toThrow();
  });
});
