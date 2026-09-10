/**
 * DOC-UX-003 — configuración general del negocio contra la capa de datos.
 * Requiere `DATABASE_URL`. Usa organizaciones desechables.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, seedOrgWithPublishedTemplate } from './_helpers';
import {
  getOrganizationProfile,
  setOrganizationProfile,
  listOrganizationMembers,
} from '@/server/organization';

describe.skipIf(!hasDb)('perfil general del negocio (DOC-UX-003)', () => {
  it('guarda y lee el perfil, aislado por organización', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());

    await setOrganizationProfile(a.orgId, a.userId, {
      commercialName: 'Alimentos Demo',
      legalName: 'Alimentos Demo S.A. de C.V.',
      taxId: 'ADE260101ABC',
      taxRegime: 'General',
      taxAddress: 'Av. Siempre Viva 123',
      logoUrl: 'https://example.test/logo.png',
    });

    const pa = await getOrganizationProfile(a.orgId);
    expect(pa.commercialName).toBe('Alimentos Demo');
    expect(pa.taxId).toBe('ADE260101ABC');

    // B no ve el perfil de A (campos vacíos).
    const pb = await getOrganizationProfile(b.orgId);
    expect(pb.commercialName).toBe('');
    expect(pb.taxId).toBe('');
  });

  it('actualiza (upsert) sin duplicar', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    await setOrganizationProfile(org.orgId, org.userId, {
      commercialName: 'Uno',
      legalName: '',
      taxId: '',
      taxRegime: '',
      taxAddress: '',
      logoUrl: '',
    });
    await setOrganizationProfile(org.orgId, org.userId, {
      commercialName: 'Dos',
      legalName: '',
      taxId: '',
      taxRegime: '',
      taxAddress: '',
      logoUrl: '',
    });
    expect((await getOrganizationProfile(org.orgId)).commercialName).toBe('Dos');
  });

  it('lista los miembros de la organización', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const members = await listOrganizationMembers(org.orgId);
    expect(members.length).toBeGreaterThanOrEqual(1);
    expect(members[0]?.role).toBeTruthy();
  });
});
