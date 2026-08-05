/**
 * CAPA — permisos, folios y aislamiento entre organizaciones (TASK-007). DB.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { db, hasDb, inRollbackTx, newId, seedOrgWithPublishedTemplate } from './_helpers';
import {
  CapaNotFoundError,
  CapaPermissionError,
  createCapa,
  getCapaDetail,
  listCapas,
  updateCapa,
} from '@/server/capa';

afterAll(async () => {
  if (hasDb) await db().$disconnect();
});

async function addMember(orgId: string, role: string): Promise<string> {
  const id = newId();
  await db().user.create({ data: { id, email: `u-${id}@x.test` } });
  await db().membership.create({ data: { organizationId: orgId, userId: id, role } });
  return id;
}

describe.skipIf(!hasDb)('CAPA — permisos y aislamiento', () => {
  it('viewer no puede crear; evaluador y admin sí', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const viewer = await addMember(fx.orgId, 'viewer');
    const evaluator = await addMember(fx.orgId, 'evaluator');
    await expect(
      createCapa(fx.orgId, viewer, { title: 'X', description: 'Y', sourceType: 'internal_nc' }),
    ).rejects.toBeInstanceOf(CapaPermissionError);
    const id = await createCapa(fx.orgId, evaluator, {
      title: 'X',
      description: 'Y',
      sourceType: 'internal_nc',
    });
    expect(id).toBeTruthy();
  });

  it('un evaluador sin asignación no edita una CAPA ajena', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const other = await addMember(fx.orgId, 'evaluator');
    const capaId = await createCapa(fx.orgId, fx.userId, {
      title: 'X',
      description: 'Y',
      sourceType: 'internal_nc',
    });
    await expect(
      updateCapa(fx.orgId, other, capaId, { title: 'hackeado' }),
    ).rejects.toBeInstanceOf(CapaPermissionError);
  });

  it('el responsable asignado sí puede editar', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const responsible = await addMember(fx.orgId, 'evaluator');
    const capaId = await createCapa(fx.orgId, fx.userId, {
      title: 'X',
      description: 'Y',
      sourceType: 'internal_nc',
      responsibleUserId: responsible,
    });
    await updateCapa(fx.orgId, responsible, capaId, { area: 'Producción' });
    expect((await getCapaDetail(fx.orgId, capaId)).capa.area).toBe('Producción');
  });

  it('folio único por organización y año; consecutivo independiente por org', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const a1 = await createCapa(a.orgId, a.userId, {
      title: '1',
      description: 'd',
      sourceType: 'internal_nc',
      detectedAt: '2026-03-01',
    });
    const a2 = await createCapa(a.orgId, a.userId, {
      title: '2',
      description: 'd',
      sourceType: 'internal_nc',
      detectedAt: '2026-06-01',
    });
    const b1 = await createCapa(b.orgId, b.userId, {
      title: '1',
      description: 'd',
      sourceType: 'internal_nc',
      detectedAt: '2026-06-01',
    });
    const fa1 = (await getCapaDetail(a.orgId, a1)).capa.folio;
    const fa2 = (await getCapaDetail(a.orgId, a2)).capa.folio;
    const fb1 = (await getCapaDetail(b.orgId, b1)).capa.folio;
    expect(fa1).toBe('CAPA-2026-0001');
    expect(fa2).toBe('CAPA-2026-0002');
    expect(fb1).toBe('CAPA-2026-0001'); // misma numeración en otra organización
  });

  it('el folio reinicia por año dentro de la misma organización', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const y2025 = await createCapa(a.orgId, a.userId, {
      title: '25',
      description: 'd',
      sourceType: 'internal_nc',
      detectedAt: '2025-05-01',
    });
    const y2026 = await createCapa(a.orgId, a.userId, {
      title: '26',
      description: 'd',
      sourceType: 'internal_nc',
      detectedAt: '2026-05-01',
    });
    expect((await getCapaDetail(a.orgId, y2025)).capa.folio).toBe('CAPA-2025-0001');
    expect((await getCapaDetail(a.orgId, y2026)).capa.folio).toBe('CAPA-2026-0001');
  });

  it('una organización no accede a la CAPA de otra', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const capaId = await createCapa(a.orgId, a.userId, {
      title: 'privada',
      description: 'd',
      sourceType: 'internal_nc',
    });
    await expect(getCapaDetail(b.orgId, capaId)).rejects.toBeInstanceOf(CapaNotFoundError);
    await expect(
      updateCapa(b.orgId, b.userId, capaId, { title: 'x' }),
    ).rejects.toBeInstanceOf(CapaNotFoundError);
    // El listado de B no incluye la CAPA de A.
    const listB = await listCapas(b.orgId);
    expect(listB.some((c) => c.id === capaId)).toBe(false);
    const listA = await listCapas(a.orgId);
    expect(listA.some((c) => c.id === capaId)).toBe(true);
  });

  it('RLS: con contexto de organización solo se ven las CAPA propias', async () => {
    await inRollbackTx(async (tx) => {
      const a = await seedOrgWithPublishedTemplate(tx);
      const b = await seedOrgWithPublishedTemplate(tx);
      const mk = async (orgId: string) =>
        tx.capa.create({
          data: {
            id: newId(),
            organizationId: orgId,
            folio: `CAPA-2026-${orgId.slice(0, 4)}`,
            year: 2026,
            title: 'x',
            description: 'y',
            sourceType: 'internal_nc',
          },
        });
      await mk(a.orgId);
      await mk(b.orgId);

      await tx.$executeRawUnsafe('SET LOCAL ROLE gapsi_app');
      await tx.$executeRaw`SELECT set_config('app.current_org', ${a.orgId}, true)`;
      const capasA = await tx.$queryRaw<{ organization_id: string }[]>`
        SELECT organization_id FROM capas`;
      expect(capasA.every((c) => c.organization_id === a.orgId)).toBe(true);
      expect(capasA.some((c) => c.organization_id === b.orgId)).toBe(false);
    });
  });

  it('rechaza referencia cruzada de sitio de otra organización (FK compuesta)', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    // Intentar crear en A con el sitio de B debe fallar por la FK compuesta.
    await expect(
      createCapa(a.orgId, a.userId, {
        title: 'x',
        description: 'd',
        sourceType: 'internal_nc',
        siteId: b.siteId,
      }),
    ).rejects.toThrow();
  });
});
