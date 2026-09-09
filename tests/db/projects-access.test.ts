/**
 * Proyectos — folios, estados, permisos, hitos, RLS y aislamiento (TASK-009). DB.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, inRollbackTx, newId, seedOrgWithPublishedTemplate } from './_helpers';
import {
  ProjectPermissionError,
  ProjectValidationError,
  addMilestone,
  createProject,
  getProjectDetail,
  listProjects,
  transitionProject,
} from '@/server/projects';

async function addMember(orgId: string, role: string): Promise<string> {
  const id = newId();
  await db().user.create({ data: { id, email: `u-${id}@x.test` } });
  await db().membership.create({ data: { organizationId: orgId, userId: id, role } });
  return id;
}

describe.skipIf(!hasDb)('Proyectos — permisos y folios', () => {
  it('viewer no crea; evaluador y admin sí', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const viewer = await addMember(fx.orgId, 'viewer');
    await expect(
      createProject(fx.orgId, viewer, { name: 'P', projectType: 'implementation' }),
    ).rejects.toBeInstanceOf(ProjectPermissionError);
    const id = await createProject(fx.orgId, fx.userId, {
      name: 'P',
      projectType: 'implementation',
    });
    expect(id).toBeTruthy();
  });

  it('folio PRJ-AAAA-#### secuencial e independiente por organización', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const a1 = await createProject(a.orgId, a.userId, { name: '1', projectType: 'compliance' });
    const a2 = await createProject(a.orgId, a.userId, { name: '2', projectType: 'compliance' });
    const b1 = await createProject(b.orgId, b.userId, { name: '1', projectType: 'compliance' });
    const year = new Date().getUTCFullYear();
    const folio = async (org: string, id: string) =>
      (await getProjectDetail(org, id)).project.folio;
    expect(await folio(a.orgId, a1)).toBe(`PRJ-${year}-0001`);
    expect(await folio(a.orgId, a2)).toBe(`PRJ-${year}-0002`);
    expect(await folio(b.orgId, b1)).toBe(`PRJ-${year}-0001`);
  });
});

describe.skipIf(!hasDb)('Proyectos — estados', () => {
  it('activar exige responsable y fechas', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const bare = await createProject(fx.orgId, fx.userId, {
      name: 'sin datos',
      projectType: 'other',
    });
    await transitionProject(fx.orgId, fx.userId, bare, 'planned');
    await expect(transitionProject(fx.orgId, fx.userId, bare, 'active')).rejects.toBeInstanceOf(
      ProjectValidationError,
    );
    const ready = await createProject(fx.orgId, fx.userId, {
      name: 'listo',
      projectType: 'other',
      responsibleUserId: fx.userId,
      startDate: '2026-01-01',
      targetDate: '2026-12-31',
    });
    await transitionProject(fx.orgId, fx.userId, ready, 'active');
    expect((await getProjectDetail(fx.orgId, ready)).project.status).toBe('active');
  });

  it('completar deja el proyecto en solo lectura', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const id = await createProject(fx.orgId, fx.userId, {
      name: 'p',
      projectType: 'other',
      responsibleUserId: fx.userId,
      startDate: '2026-01-01',
      targetDate: '2026-12-31',
    });
    await transitionProject(fx.orgId, fx.userId, id, 'active');
    await transitionProject(fx.orgId, fx.userId, id, 'completed');
    expect((await getProjectDetail(fx.orgId, id)).project.readOnly).toBe(true);
  });

  it('agregar hitos', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const id = await createProject(fx.orgId, fx.userId, { name: 'p', projectType: 'other' });
    await addMilestone(fx.orgId, fx.userId, id, { name: 'Hito 1', targetDate: '2026-06-01' });
    const detail = await getProjectDetail(fx.orgId, id);
    expect(detail.milestones).toHaveLength(1);
    expect(detail.milestones[0]!.name).toBe('Hito 1');
  });
});

describe.skipIf(!hasDb)('Proyectos — aislamiento y RLS', () => {
  it('una organización no ve el proyecto de otra', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const id = await createProject(a.orgId, a.userId, { name: 'privado', projectType: 'other' });
    const listB = await listProjects(b.orgId);
    expect(listB.some((p) => p.id === id)).toBe(false);
    const listA = await listProjects(a.orgId);
    expect(listA.some((p) => p.id === id)).toBe(true);
  });

  it('RLS: solo se ven los proyectos del contexto', async () => {
    await inRollbackTx(async (tx) => {
      const a = await seedOrgWithPublishedTemplate(tx);
      const b = await seedOrgWithPublishedTemplate(tx);
      const mk = (orgId: string) =>
        tx.project.create({
          data: {
            id: newId(),
            organizationId: orgId,
            folio: `PRJ-2026-${orgId.slice(0, 4)}`,
            name: 'p',
            projectType: 'other',
          },
        });
      await mk(a.orgId);
      await mk(b.orgId);
      await tx.$executeRawUnsafe('SET LOCAL ROLE gapsi_app');
      await tx.$executeRaw`SELECT set_config('app.current_org', ${a.orgId}, true)`;
      const rows = await tx.$queryRaw<
        { organization_id: string }[]
      >`SELECT organization_id FROM projects`;
      expect(rows.every((r) => r.organization_id === a.orgId)).toBe(true);
    });
  });
});
