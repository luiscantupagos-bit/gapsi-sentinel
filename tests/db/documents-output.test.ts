/**
 * DOC-UX-002 — copias controladas de salida, diseño/atribución y entitlement
 * contra la capa de datos. Requiere `DATABASE_URL`. Usa organizaciones desechables.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, seedOrgWithPublishedTemplate } from './_helpers';
import {
  createStructuredDocument,
  getStructuredContent,
  createControlledCopyOutput,
  getControlledCopyHistory,
  getControlledCopyForRender,
  setDocumentTheme,
  getDocumentPresentation,
  getOrganizationEntitlements,
  DocumentValidationError,
} from '@/server/documents';

/** Crea un procedimiento con un área de catálogo y publica su versión. */
async function publishedProcedure(org: { orgId: string; userId: string }) {
  await db().qualityCatalogValue.create({
    data: { organizationId: org.orgId, kind: 'area', code: 'CA', name: 'Calidad' },
  });
  const id = await createStructuredDocument(org.orgId, org.userId, {
    documentType: 'procedure',
    title: 'Control de PNC',
    areaCode: 'CA',
    areaName: 'Calidad',
    structuredContent: {
      fields: { objetivo: 'O', alcance: 'A' },
      repeatables: { activities: [{ nombre: 'Uno', descripcion: 'd', responsable: 'Ana' }] },
    },
  });
  const { versionId, documentCode } = await getStructuredContent(org.orgId, id);
  await db().documentVersion.update({
    where: { id: versionId },
    data: { status: 'published', publishedAt: new Date() },
  });
  return { id, versionId, documentCode };
}

describe.skipIf(!hasDb)('copias controladas y presentación (DOC-UX-002)', () => {
  it('B/E. genera copias con folio consecutivo, ligadas a la versión exacta', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id, versionId, documentCode } = await publishedProcedure(org);

    const c1 = await createControlledCopyOutput(org.orgId, org.userId, {
      documentId: id,
      versionId,
      copyType: 'print',
      destinationAreaCode: 'CA',
    });
    const c2 = await createControlledCopyOutput(org.orgId, org.userId, {
      documentId: id,
      versionId,
      copyType: 'pdf',
      reason: 'Auditoría externa',
    });
    expect(c1.folio).toBe(`CC-${documentCode}-0001`);
    expect(c2.folio).toBe(`CC-${documentCode}-0002`); // B: no duplica
    expect(c1.folio).not.toBe(c2.folio);

    // E: la copia queda ligada a la versión exacta.
    const render = await getControlledCopyForRender(org.orgId, c1.id);
    expect(render?.versionId).toBe(versionId);
    expect(render?.copyMark.folio).toBe(c1.folio);
    expect(render?.copyMark.destinationLabel).toBe('Calidad');
  });

  it('D. el motivo del PDF persiste y se ve en el historial', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id, versionId } = await publishedProcedure(org);
    await createControlledCopyOutput(org.orgId, org.userId, {
      documentId: id,
      versionId,
      copyType: 'pdf',
      reason: 'Envío a cliente',
    });
    const history = await getControlledCopyHistory(org.orgId, id);
    expect(history).toHaveLength(1);
    expect(history[0]?.copyType).toBe('pdf');
    expect(history[0]?.reason).toBe('Envío a cliente');
  });

  it('impresión sin área es rechazada; PDF sin motivo es rechazado', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id, versionId } = await publishedProcedure(org);
    await expect(
      createControlledCopyOutput(org.orgId, org.userId, {
        documentId: id,
        versionId,
        copyType: 'print',
        destinationAreaCode: '',
      }),
    ).rejects.toBeInstanceOf(DocumentValidationError);
    await expect(
      createControlledCopyOutput(org.orgId, org.userId, {
        documentId: id,
        versionId,
        copyType: 'pdf',
        reason: '   ',
      }),
    ).rejects.toBeInstanceOf(DocumentValidationError);
  });

  it('C. un área de otro tenant como destino es rechazada', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const other = await seedOrgWithPublishedTemplate(db());
    const { id, versionId } = await publishedProcedure(org);
    // 'MX' existe como área en `other`, no en `org`.
    await db().qualityCatalogValue.create({
      data: { organizationId: other.orgId, kind: 'area', code: 'MX', name: 'Mantenimiento' },
    });
    await expect(
      createControlledCopyOutput(org.orgId, org.userId, {
        documentId: id,
        versionId,
        copyType: 'print',
        destinationAreaCode: 'MX',
      }),
    ).rejects.toBeInstanceOf(DocumentValidationError);
  });

  it('no genera copia controlada formal de una versión NO publicada (§80)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    await db().qualityCatalogValue.create({
      data: { organizationId: org.orgId, kind: 'area', code: 'CA', name: 'Calidad' },
    });
    const id = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'procedure',
      title: 'Borrador',
      areaCode: 'CA',
      structuredContent: { fields: { objetivo: 'O', alcance: 'A' }, repeatables: {} },
    });
    const { versionId } = await getStructuredContent(org.orgId, id); // draft
    await expect(
      createControlledCopyOutput(org.orgId, org.userId, {
        documentId: id,
        versionId,
        copyType: 'print',
        destinationAreaCode: 'CA',
      }),
    ).rejects.toBeInstanceOf(DocumentValidationError);
  });

  it('A. el historial de copias está aislado por organización', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const da = await publishedProcedure(a);
    await createControlledCopyOutput(a.orgId, a.userId, {
      documentId: da.id,
      versionId: da.versionId,
      copyType: 'pdf',
      reason: 'Respaldo',
    });
    // B no ve nada de A (documento inexistente en su tenant → historial vacío).
    const historyB = await getControlledCopyHistory(b.orgId, da.id);
    expect(historyB).toHaveLength(0);
  });

  it('§9. el formato de fecha configurado se aplica y persiste (default DD/MM/AAAA)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id, versionId } = await publishedProcedure(org);
    // Default sin configurar: DD/MM/AAAA.
    await createControlledCopyOutput(org.orgId, org.userId, {
      documentId: id,
      versionId,
      copyType: 'pdf',
      reason: 'Respaldo',
    });
    const h1 = await getControlledCopyHistory(org.orgId, id);
    expect(h1[0]?.issuedAt).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

    // Cambia a ISO y persiste; el historial ahora se ve YYYY-MM-DD.
    await setDocumentTheme(org.orgId, org.userId, {
      primary: '#0f2440',
      secondary: '#e3e8ef',
      accent: '#2563eb',
      text: '#1f2937',
      heading: '#0f2440',
      designId: 'c3-modern',
      showC3Attribution: true,
      dateFormat: 'YYYY-MM-DD',
    });
    expect((await getDocumentPresentation(org.orgId)).dateFormat).toBe('YYYY-MM-DD');
    const h2 = await getControlledCopyHistory(org.orgId, id);
    expect(h2[0]?.issuedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('F/G. el diseño y la preferencia de atribución persisten por organización', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    // Suscripción elegible → puede ocultar la atribución.
    await db().organizationSubscription.create({
      data: { organizationId: org.orgId, plan: 'intermediate', billingCadence: 'annual' },
    });
    await setDocumentTheme(org.orgId, org.userId, {
      primary: '#005baa',
      secondary: '#e5e7eb',
      accent: '#f59e0b',
      text: '#111827',
      heading: '#0f2440',
      designId: 'corporate',
      showC3Attribution: false,
    });
    const p = await getDocumentPresentation(org.orgId);
    expect(p.designId).toBe('corporate'); // F
    expect(p.showC3AttributionPref).toBe(false); // G (permitido por entitlement)
  });

  it('H/I. la atribución solo se puede ocultar con entitlement (guard server-side §110)', async () => {
    // Sin suscripción: entitlement=false → showC3Attribution se fuerza a true.
    const noSub = await seedOrgWithPublishedTemplate(db());
    expect((await getOrganizationEntitlements(noSub.orgId)).canHideC3Attribution).toBe(false);
    await setDocumentTheme(noSub.orgId, noSub.userId, {
      primary: '#0f2440',
      secondary: '#e3e8ef',
      accent: '#2563eb',
      text: '#1f2937',
      heading: '#0f2440',
      designId: 'c3-modern',
      showC3Attribution: false, // el cliente intenta ocultarla
    });
    expect((await getDocumentPresentation(noSub.orgId)).showC3AttributionPref).toBe(true); // H

    // Con suscripción anual: entitlement=true → la preferencia manda.
    const withSub = await seedOrgWithPublishedTemplate(db());
    await db().organizationSubscription.create({
      data: { organizationId: withSub.orgId, plan: 'basic', billingCadence: 'annual' },
    });
    expect((await getOrganizationEntitlements(withSub.orgId)).canHideC3Attribution).toBe(true);
    await setDocumentTheme(withSub.orgId, withSub.userId, {
      primary: '#0f2440',
      secondary: '#e3e8ef',
      accent: '#2563eb',
      text: '#1f2937',
      heading: '#0f2440',
      designId: 'c3-modern',
      showC3Attribution: false,
    });
    expect((await getDocumentPresentation(withSub.orgId)).showC3AttributionPref).toBe(false); // I
  });
});
