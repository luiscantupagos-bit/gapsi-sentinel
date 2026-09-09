/**
 * DOC-002 — Referencias inteligentes (@) y formatos emitidos (//) contra la capa
 * de datos. Requiere `DATABASE_URL`. Usa organizaciones desechables.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, seedOrgWithPublishedTemplate } from './_helpers';
import {
  DocumentNotEditableError,
  DocumentNotFoundError,
  createStructuredDocument,
  getStructuredContent,
  getDocumentRelations,
  issueFormFromDocument,
  saveStructuredContent,
  createEditorVersion,
} from '@/server/documents';

async function newProcedure(orgId: string, userId: string, title = 'Origen') {
  const id = await createStructuredDocument(orgId, userId, {
    documentType: 'procedure',
    title,
    areaCode: 'CA',
    structuredContent: {
      fields: { objetivo: 'O', alcance: 'A' },
      repeatables: { activities: [{ nombre: 'A', descripcion: 'd' }] },
    },
  });
  const data = await getStructuredContent(orgId, id);
  return { id, versionId: data.versionId };
}

async function newPolicy(orgId: string, userId: string, title = 'Destino') {
  return createStructuredDocument(orgId, userId, {
    documentType: 'policy',
    title,
    areaCode: 'DG',
    structuredContent: { fields: { declaracion: 'X' }, repeatables: {} },
  });
}

const withRef = (targetId: string) => ({
  fields: {
    objetivo: {
      segments: [
        { type: 'text', text: 'Ver ' },
        { type: 'ref', relationType: 'reference', targetDocumentId: targetId },
      ],
    },
    alcance: 'A',
  },
  repeatables: { activities: [{ nombre: 'A', descripcion: 'd' }] },
});

describe.skipIf(!hasDb)('referencias inteligentes (DOC-002)', () => {
  it('A/K. crea una relación @ (mismo tenant) al guardar el contenido', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const src = await newProcedure(org.orgId, org.userId);
    const target = await newPolicy(org.orgId, org.userId);
    await saveStructuredContent(org.orgId, org.userId, src.id, src.versionId, {
      structuredContent: withRef(target),
    });
    const rel = await getDocumentRelations(org.orgId, src.id);
    expect(rel.references).toHaveLength(1);
    expect(rel.references[0]?.relatedDocumentId).toBe(target);
    expect(rel.references[0]?.available).toBe(true);
  });

  it('C. deduplica múltiples tokens al mismo destino', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const src = await newProcedure(org.orgId, org.userId);
    const target = await newPolicy(org.orgId, org.userId);
    await saveStructuredContent(org.orgId, org.userId, src.id, src.versionId, {
      structuredContent: {
        fields: {
          objetivo: {
            segments: [{ type: 'ref', relationType: 'reference', targetDocumentId: target }],
          },
          alcance: {
            segments: [{ type: 'ref', relationType: 'reference', targetDocumentId: target }],
          },
        },
        repeatables: { activities: [{ nombre: 'A', descripcion: 'd' }] },
      },
    });
    const rows = await db().documentRelation.findMany({
      where: { documentId: src.id, relationType: 'reference', active: true },
    });
    expect(rows).toHaveLength(1);
  });

  it('D/E/F. // crea un formato borrador v1.0 y su relación issued_form', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const src = await newProcedure(org.orgId, org.userId);
    const form = await issueFormFromDocument(org.orgId, org.userId, src.id, src.versionId, {
      title: 'Bitácora de producto no conforme',
    });
    expect(form.code).toMatch(/^FO-CA-\d{3}$/);
    const formDoc = await db().document.findFirst({ where: { id: form.documentId } });
    expect(formDoc?.documentType).toBe('form');
    expect(formDoc?.status).toBe('draft');
    const formVer = await db().documentVersion.findFirst({
      where: { documentId: form.documentId },
    });
    expect(formVer?.label).toBe('v1.0');
    expect(formVer?.status).toBe('draft');
    const rel = await getDocumentRelations(org.orgId, src.id);
    expect(rel.issuedForms).toHaveLength(1);
    expect(rel.issuedForms[0]?.relatedDocumentId).toBe(form.documentId);
  });

  it('G. quitar el token da de baja la relación pero NO borra el documento destino', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const src = await newProcedure(org.orgId, org.userId);
    const target = await newPolicy(org.orgId, org.userId);
    await saveStructuredContent(org.orgId, org.userId, src.id, src.versionId, {
      structuredContent: withRef(target),
    });
    expect((await getDocumentRelations(org.orgId, src.id)).references).toHaveLength(1);
    // Guarda sin el token.
    await saveStructuredContent(org.orgId, org.userId, src.id, src.versionId, {
      structuredContent: {
        fields: { objetivo: 'O', alcance: 'A' },
        repeatables: { activities: [{ nombre: 'A', descripcion: 'd' }] },
      },
    });
    expect((await getDocumentRelations(org.orgId, src.id)).references).toHaveLength(0);
    // La relación quedó inactiva (baja lógica), no borrada; el destino sigue existiendo.
    const rows = await db().documentRelation.findMany({
      where: { documentId: src.id, relationType: 'reference' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.active).toBe(false);
    expect(await db().document.findFirst({ where: { id: target } })).not.toBeNull();
  });

  it('H. una versión nueva copia las relaciones y la anterior queda intacta', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const src = await newProcedure(org.orgId, org.userId);
    const target = await newPolicy(org.orgId, org.userId);
    await saveStructuredContent(org.orgId, org.userId, src.id, src.versionId, {
      structuredContent: withRef(target),
    });
    const v2 = await createEditorVersion(org.orgId, org.userId, src.id, {
      bump: 'minor',
      changeNotes: 'c',
    });
    // v1.0 conserva su relación; v1.1 la recibió copiada.
    expect((await getDocumentRelations(org.orgId, src.id, src.versionId)).references).toHaveLength(
      1,
    );
    expect((await getDocumentRelations(org.orgId, src.id, v2)).references).toHaveLength(1);
  });

  it('I/J. una versión publicada sella sus relaciones (app y trigger)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const src = await newProcedure(org.orgId, org.userId);
    const target = await newPolicy(org.orgId, org.userId);
    await saveStructuredContent(org.orgId, org.userId, src.id, src.versionId, {
      structuredContent: withRef(target),
    });
    await db().documentVersion.update({
      where: { id: src.versionId },
      data: { status: 'published', publishedAt: new Date() },
    });
    // App: no se puede guardar sobre una versión publicada.
    await expect(
      saveStructuredContent(org.orgId, org.userId, src.id, src.versionId, {
        structuredContent: { fields: { objetivo: 'O', alcance: 'A' }, repeatables: {} },
      }),
    ).rejects.toBeInstanceOf(DocumentNotEditableError);
    // Trigger: no se puede modificar una relación de una versión publicada.
    const rel = await db().documentRelation.findFirst({
      where: { sourceVersionId: src.versionId, relationType: 'reference' },
    });
    await expect(
      db().documentRelation.update({ where: { id: rel!.id }, data: { active: false } }),
    ).rejects.toThrow();
  });

  it('L. emitir // sobre una versión no editable falla sin dejar formato huérfano', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const src = await newProcedure(org.orgId, org.userId);
    await db().documentVersion.update({
      where: { id: src.versionId },
      data: { status: 'published', publishedAt: new Date() },
    });
    const before = await db().document.count({
      where: { organizationId: org.orgId, documentType: 'form' },
    });
    await expect(
      issueFormFromDocument(org.orgId, org.userId, src.id, src.versionId, { title: 'X' }),
    ).rejects.toBeInstanceOf(DocumentNotEditableError);
    const after = await db().document.count({
      where: { organizationId: org.orgId, documentType: 'form' },
    });
    expect(after).toBe(before); // no se creó ningún formato huérfano
  });

  it('B. aislamiento entre organizaciones: no se referencia un documento ajeno', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const src = await newProcedure(a.orgId, a.userId);
    const foreignTarget = await newPolicy(b.orgId, b.userId);
    // Guardar con una referencia a un documento de OTRA organización: no rompe el
    // guardado y NO crea relación (destino no válido en el tenant).
    await saveStructuredContent(a.orgId, a.userId, src.id, src.versionId, {
      structuredContent: withRef(foreignTarget),
    });
    expect((await getDocumentRelations(a.orgId, src.id)).references).toHaveLength(0);
    // B no puede leer el documento de A.
    await expect(getStructuredContent(b.orgId, src.id)).rejects.toBeInstanceOf(
      DocumentNotFoundError,
    );
  });
});
