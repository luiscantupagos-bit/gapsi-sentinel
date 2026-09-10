/**
 * DOC-UX-001 — presentación documental contra la capa de datos. Requiere
 * `DATABASE_URL`. Usa organizaciones desechables.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, seedOrgWithPublishedTemplate } from './_helpers';
import {
  createStructuredDocument,
  getStructuredContent,
  saveStructuredContent,
  getDocumentTheme,
  setDocumentTheme,
  getDocumentLibrary,
  DocumentValidationError,
} from '@/server/documents';

describe.skipIf(!hasDb)('presentación documental (DOC-UX-001)', () => {
  it('A. el tema documental se guarda y aísla por organización', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    await setDocumentTheme(a.orgId, a.userId, {
      primary: '#005BAA',
      secondary: '#E5E7EB',
      accent: '#F59E0B',
      text: '#1f2937',
      heading: '#0f2440',
    });
    const themeA = await getDocumentTheme(a.orgId);
    expect(themeA.primary).toBe('#005baa');
    // B conserva el default (no ve el tema de A).
    const themeB = await getDocumentTheme(b.orgId);
    expect(themeB.primary).toBe('#0f2440');
  });

  it('rechaza colores no-HEX', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    await expect(
      setDocumentTheme(a.orgId, a.userId, { primary: 'rojo', secondary: '#fff', accent: '#000' }),
    ).rejects.toBeInstanceOf(DocumentValidationError);
  });

  it('F/G. el structured_content legacy (evidencia/observaciones) sobrevive y no se muestra', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'procedure',
      title: 'Con datos legacy',
      areaCode: 'CA',
      structuredContent: {
        fields: { objetivo: 'O', alcance: 'A' },
        repeatables: { activities: [{ nombre: 'Uno', descripcion: 'd' }] },
      },
    });
    const { versionId } = await getStructuredContent(org.orgId, id);
    // Inyecta datos legacy directamente (como si vinieran de un doc previo a DOC-UX-001).
    await db().documentVersion.update({
      where: { id: versionId },
      data: {
        structuredContent: {
          schemaVersion: 1,
          templateType: 'procedure',
          fields: { objetivo: 'O', alcance: 'A' },
          repeatables: {
            activities: [
              {
                nombre: 'Uno',
                descripcion: 'd',
                evidencia: 'Informe',
                observaciones: 'nota legacy',
              },
            ],
          },
        },
      },
    });
    // El dato legacy sigue en la BD (lectura no destructiva).
    const raw = await db().documentVersion.findFirst({ where: { id: versionId } });
    expect(JSON.stringify(raw?.structuredContent)).toContain('evidencia');
    // getStructuredContent lo tolera y no lo expone; el render no muestra columnas.
    const data = await getStructuredContent(org.orgId, id);
    expect(data.renderedHtml).not.toContain('Informe');
    expect(data.renderedHtml).not.toContain('nota legacy');
    expect(data.renderedHtml).not.toContain('Evidencia');
  });

  it('B. los conteos de la biblioteca están scoped por organización', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    // Área del catálogo en A (las carpetas se agrupan por nombre de área).
    await db().qualityCatalogValue.create({
      data: { organizationId: a.orgId, kind: 'area', code: 'CA', name: 'Calidad' },
    });
    await createStructuredDocument(a.orgId, a.userId, {
      documentType: 'procedure',
      title: 'Doc A',
      areaCode: 'CA',
      areaName: 'Calidad',
      structuredContent: { fields: { objetivo: 'O', alcance: 'A' }, repeatables: {} },
    });
    const libA = await getDocumentLibrary(a.orgId);
    const libB = await getDocumentLibrary(b.orgId);
    // A cuenta su documento en el área Calidad; B no ve documentos ni áreas de A.
    expect(libA.areas.find((x) => x.name === 'Calidad')?.count).toBe(1);
    expect(libB.areas.reduce((s, x) => s + x.count, 0)).toBe(0);
  });

  it('§14. re-guardar un procedimiento con datos legacy no los borra (ni resucita ni hereda)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'procedure',
      title: 'Legacy save',
      areaCode: 'CA',
      structuredContent: {
        fields: { objetivo: 'O', alcance: 'A' },
        repeatables: {
          activities: [
            { nombre: 'Uno', descripcion: 'd1', responsable: 'Ana' },
            { nombre: 'Dos', descripcion: 'd2', responsable: 'Beto' },
          ],
        },
      },
    });
    const { versionId } = await getStructuredContent(org.orgId, id);
    // Inyecta datos legacy en el contenido ALMACENADO (doc previo a DOC-UX-001).
    await db().documentVersion.update({
      where: { id: versionId },
      data: {
        structuredContent: {
          schemaVersion: 1,
          templateType: 'procedure',
          fields: { objetivo: 'O', alcance: 'A' },
          repeatables: {
            activities: [
              {
                nombre: 'Uno',
                descripcion: 'd1',
                responsable: 'Ana',
                evidencia: 'Informe A',
                observaciones: 'Obs A',
              },
              {
                nombre: 'Dos',
                descripcion: 'd2',
                responsable: 'Beto',
                evidencia: 'Informe B',
                observaciones: 'Obs B',
              },
            ],
          },
        },
      },
    });
    // B. Guarda desde la UI actual (SIN campos legacy): edita 'Uno', elimina 'Dos',
    // agrega 'Tres'.
    await saveStructuredContent(org.orgId, org.userId, id, versionId, {
      structuredContent: {
        fields: { objetivo: 'O2', alcance: 'A' },
        repeatables: {
          activities: [
            { nombre: 'Uno', descripcion: 'editada', responsable: 'Ana' },
            { nombre: 'Tres', descripcion: 'd3', responsable: 'Caro' },
          ],
        },
      },
    });
    // C. Relee el contenido almacenado.
    const raw = await db().documentVersion.findFirst({ where: { id: versionId } });
    const acts = (
      raw?.structuredContent as { repeatables: { activities: Array<Record<string, unknown>> } }
    ).repeatables.activities;
    const uno = acts.find((a) => a.nombre === 'Uno')!;
    const tres = acts.find((a) => a.nombre === 'Tres')!;
    expect(uno.evidencia).toBe('Informe A'); // conservado
    expect(uno.observaciones).toBe('Obs A'); // conservado
    expect(uno.descripcion).toBe('editada'); // edición del usuario aplicada
    expect(acts.find((a) => a.nombre === 'Dos')).toBeUndefined(); // E: eliminada no reaparece
    expect(tres.evidencia).toBeUndefined(); // F: nueva no hereda
    expect(tres.observaciones).toBeUndefined();
    // D. El render no muestra los campos legacy preservados.
    const data = await getStructuredContent(org.orgId, id);
    expect(data.renderedHtml).not.toContain('Informe A');
    expect(data.renderedHtml).not.toContain('Obs A');
    expect(data.renderedHtml).not.toContain('Evidencia');
  });

  it('el control de cambios de la versión inicial muestra "Documento nuevo"', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'procedure',
      title: 'Nuevo',
      areaCode: 'CA',
      structuredContent: { fields: { objetivo: 'O', alcance: 'A' }, repeatables: {} },
    });
    // Publica la versión para que el render use published + control de cambios.
    const { versionId } = await getStructuredContent(org.orgId, id);
    await db().documentVersion.update({
      where: { id: versionId },
      data: { status: 'published', publishedAt: new Date() },
    });
    const data = await getStructuredContent(org.orgId, id);
    expect(data.renderedHtml).toContain('Control de cambios');
    expect(data.renderedHtml).toContain('Documento nuevo');
  });
});
