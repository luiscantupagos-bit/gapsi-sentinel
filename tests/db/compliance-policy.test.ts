/**
 * CORE-UX-005 — política del semáforo de cumplimiento (persistencia tenant-scoped).
 * Requiere `DATABASE_URL`. Organizaciones desechables.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, seedOrgWithPublishedTemplate } from './_helpers';
import {
  getOrganizationCompliancePolicy,
  updateOrganizationCompliancePolicy,
  CompliancePolicyError,
} from '@/server/compliance';
import {
  DEFAULT_RESOLVED_POLICY,
  resolveComplianceBand,
} from '@/features/compliance/compliance-band';

const CUSTOM = {
  greenMin: 95,
  yellowMin: 90,
  orangeMin: 80,
  green: '#00aa00',
  yellow: '#ffcc00',
  orange: '#ff8800',
  red: '#cc0000',
};

describe.skipIf(!hasDb)('política de cumplimiento (CORE-UX-005)', () => {
  it('A. organización sin fila usa los defaults 90/80/70', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const policy = await getOrganizationCompliancePolicy(org.orgId);
    expect(policy).toEqual(DEFAULT_RESOLVED_POLICY);
  });

  it('B/I. guarda la política y la devuelve', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    await updateOrganizationCompliancePolicy(org.orgId, org.userId, CUSTOM);
    const policy = await getOrganizationCompliancePolicy(org.orgId);
    expect(policy).toMatchObject(CUSTOM);
  });

  it('C. una segunda actualización persiste los nuevos valores', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    await updateOrganizationCompliancePolicy(org.orgId, org.userId, CUSTOM);
    await updateOrganizationCompliancePolicy(org.orgId, org.userId, {
      ...CUSTOM,
      greenMin: 88,
      yellowMin: 77,
      orangeMin: 66,
    });
    const policy = await getOrganizationCompliancePolicy(org.orgId);
    expect(policy.greenMin).toBe(88);
    expect(policy.orangeMin).toBe(66);
  });

  it('D/E. aislamiento: org A no lee ni altera la política de B', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    await updateOrganizationCompliancePolicy(a.orgId, a.userId, CUSTOM);
    // B sin fila sigue en defaults (no ve la de A).
    expect(await getOrganizationCompliancePolicy(b.orgId)).toEqual(DEFAULT_RESOLVED_POLICY);
    // Actualizar B no toca A.
    await updateOrganizationCompliancePolicy(b.orgId, b.userId, { ...CUSTOM, greenMin: 91 });
    const aPolicy = await getOrganizationCompliancePolicy(a.orgId);
    expect(aPolicy.greenMin).toBe(95);
  });

  it('F. rechaza orden inválido a nivel de aplicación', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    await expect(
      updateOrganizationCompliancePolicy(org.orgId, org.userId, {
        ...CUSTOM,
        greenMin: 80,
        yellowMin: 90,
        orangeMin: 70,
      }),
    ).rejects.toBeInstanceOf(CompliancePolicyError);
  });

  it('F2. el CHECK de la BD rechaza un orden inválido (insert directo)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    await expect(
      db().organizationCompliancePolicy.create({
        data: { organizationId: org.orgId, greenMin: 50, yellowMin: 60, orangeMin: 70 },
      }),
    ).rejects.toThrow();
  });

  it('G. conserva decimales', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    await updateOrganizationCompliancePolicy(org.orgId, org.userId, {
      ...CUSTOM,
      greenMin: 89.99,
      yellowMin: 79.99,
      orangeMin: 69.99,
    });
    const policy = await getOrganizationCompliancePolicy(org.orgId);
    expect(policy.greenMin).toBe(89.99);
    expect(policy.yellowMin).toBe(79.99);
    expect(policy.orangeMin).toBe(69.99);
  });

  it('H. rechaza colores no HEX', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    await expect(
      updateOrganizationCompliancePolicy(org.orgId, org.userId, { ...CUSTOM, green: 'rgb(0,0,0)' }),
    ).rejects.toBeInstanceOf(CompliancePolicyError);
  });

  it('J/K. el resolver usa la política custom guardada (dashboard/diagnóstico)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    // Con defaults, 85 es amarillo.
    expect(resolveComplianceBand(85, await getOrganizationCompliancePolicy(org.orgId)).level).toBe(
      'yellow',
    );
    // Con custom (95/90/80), 85 baja a naranja y usa su color.
    await updateOrganizationCompliancePolicy(org.orgId, org.userId, CUSTOM);
    const band = resolveComplianceBand(85, await getOrganizationCompliancePolicy(org.orgId));
    expect(band.level).toBe('orange');
    expect(band.color).toBe('#ff8800');
  });
});
