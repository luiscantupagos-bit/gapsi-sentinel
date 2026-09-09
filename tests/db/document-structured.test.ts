/**
 * DOC-001 — Documentos estructurados contra la capa de datos.
 * Requiere `DATABASE_URL`. Usa organizaciones desechables.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, seedOrgWithPublishedTemplate } from './_helpers';
import {
  DocumentNotEditableError,
  DocumentNotFoundError,
  DuplicateCodeError,
  createStructuredDocument,
  getStructuredContent,
  proposeDocumentCode,
  saveStructuredContent,
  createEditorVersion,
} from '@/server/documents';
import { submitForReview, WorkflowValidationError } from '@/server/document-workflow';

const procedureContent = {
  fields: { objetivo: 'Controlar el producto no conforme', alcance: 'Toda la planta' },
  repeatables: {
    responsibilities: [{ responsable: 'Calidad', responsabilidad: 'Autorizar disposición' }],
    activities: [{ nombre: 'Identificar', descripcion: 'Etiquetar el producto' }],
  },
};

describe.skipIf(!hasDb)('documentos estructurados (DOC-001)', () => {
  it('crea un documento con código automático y persiste el contenido estructurado', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'procedure',
      title: 'Control de producto no conforme',
      areaCode: 'CA',
      structuredContent: procedureContent,
    });
    const data = await getStructuredContent(org.orgId, id);
    expect(data.documentCode).toBe('PR-CA-001');
    expect(data.label).toBe('v1.0');
    expect(data.structuredContent.fields.objetivo).toContain('Controlar');
    expect(data.structuredContent.repeatables.activities).toHaveLength(1);
    expect(data.schemaVersion).toBe(1);
    expect(data.renderedHtml).toContain('C3 Sentinel');
  });

  it('incrementa el consecutivo por organización + tipo + área', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const first = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'procedure',
      title: 'Uno',
      areaCode: 'CA',
      structuredContent: procedureContent,
    });
    const second = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'procedure',
      title: 'Dos',
      areaCode: 'CA',
      structuredContent: procedureContent,
    });
    const c1 = (await getStructuredContent(org.orgId, first)).documentCode;
    const c2 = (await getStructuredContent(org.orgId, second)).documentCode;
    expect(c1).toBe('PR-CA-001');
    expect(c2).toBe('PR-CA-002');
    // La propuesta refleja el siguiente disponible.
    expect(await proposeDocumentCode(org.orgId, 'procedure', 'CA')).toBe('PR-CA-003');
  });

  it('respeta un código personalizado y rechaza duplicados', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'policy',
      title: 'Política de calidad',
      code: 'MI-CODIGO-1',
      codeIsCustom: true,
      areaCode: 'DG',
      structuredContent: { fields: { declaracion: 'X' }, repeatables: {} },
    });
    expect((await getStructuredContent(org.orgId, id)).documentCode).toBe('MI-CODIGO-1');
    await expect(
      createStructuredDocument(org.orgId, org.userId, {
        documentType: 'policy',
        title: 'Otra',
        code: 'MI-CODIGO-1',
        codeIsCustom: true,
        structuredContent: { fields: { declaracion: 'Y' }, repeatables: {} },
      }),
    ).rejects.toBeInstanceOf(DuplicateCodeError);
  });

  it('calcula la próxima revisión desde la emisión', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'manual',
      title: 'Manual de calidad',
      areaCode: 'CA',
      issuedAt: '2026-06-01',
      reviewPeriod: '12',
      structuredContent: { fields: { introduccion: 'I', alcance: 'A' }, repeatables: {} },
    });
    const data = await getStructuredContent(org.orgId, id);
    expect(data.issuedAt).toBe('2026-06-01');
    expect(data.nextReviewAt).toBe('2027-06-01');
  });

  it('guarda y reabre el contenido, saneando claves desconocidas', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'procedure',
      title: 'Editable',
      areaCode: 'CA',
      structuredContent: procedureContent,
    });
    const { versionId } = await getStructuredContent(org.orgId, id);
    await saveStructuredContent(org.orgId, org.userId, id, versionId, {
      structuredContent: {
        fields: { objetivo: 'Nuevo objetivo', hacker: 'x' },
        repeatables: {
          activities: [
            { nombre: 'A', descripcion: 'd1' },
            { nombre: 'B', descripcion: 'd2' },
          ],
        },
      },
    });
    const data = await getStructuredContent(org.orgId, id);
    expect(data.structuredContent.fields.objetivo).toBe('Nuevo objetivo');
    expect(data.structuredContent.fields).not.toHaveProperty('hacker');
    expect(data.structuredContent.repeatables.activities).toHaveLength(2);
  });

  it('arrastra el contenido estructurado a una nueva versión y deja una sola vigente', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'procedure',
      title: 'Versionado',
      areaCode: 'CA',
      structuredContent: procedureContent,
    });
    await createEditorVersion(org.orgId, org.userId, id, { bump: 'minor', changeNotes: 'ajuste' });
    const versions = await db().documentVersion.findMany({ where: { documentId: id } });
    expect(versions).toHaveLength(2);
    expect(versions.filter((v) => v.isCurrent)).toHaveLength(1);
    const current = versions.find((v) => v.isCurrent)!;
    expect(current.label).toBe('v1.1');
    expect(JSON.stringify(current.structuredContent)).toContain('Controlar');
  });

  it('una versión publicada no se edita (app) ni se reescribe (trigger)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'procedure',
      title: 'Publicado',
      areaCode: 'CA',
      structuredContent: procedureContent,
    });
    const { versionId } = await getStructuredContent(org.orgId, id);
    await db().documentVersion.update({
      where: { id: versionId },
      data: { status: 'published', publishedAt: new Date() },
    });
    await expect(
      saveStructuredContent(org.orgId, org.userId, id, versionId, {
        structuredContent: procedureContent,
      }),
    ).rejects.toBeInstanceOf(DocumentNotEditableError);
    await expect(
      db().documentVersion.update({
        where: { id: versionId },
        data: { structuredContent: { fields: { objetivo: 'hack' }, repeatables: {} } },
      }),
    ).rejects.toThrow();
  });

  it('exige los campos obligatorios del tipo al enviar a revisión (§26)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'procedure',
      title: 'Incompleto',
      areaCode: 'CA',
      structuredContent: {
        fields: { objetivo: 'Solo objetivo' },
        repeatables: { activities: [{ nombre: 'A', descripcion: 'd' }] },
      },
    });
    const { versionId } = await getStructuredContent(org.orgId, id);
    // Falta 'alcance' (obligatorio) → el envío a revisión debe fallar.
    await expect(submitForReview(org.orgId, org.userId, versionId)).rejects.toBeInstanceOf(
      WorkflowValidationError,
    );
    try {
      await submitForReview(org.orgId, org.userId, versionId);
    } catch (error) {
      expect((error as WorkflowValidationError).errors.some((e) => e.includes('Alcance'))).toBe(
        true,
      );
    }
  });

  it('mantiene el aislamiento entre organizaciones', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const id = await createStructuredDocument(a.orgId, a.userId, {
      documentType: 'procedure',
      title: 'Ajeno',
      areaCode: 'CA',
      structuredContent: procedureContent,
    });
    await expect(getStructuredContent(b.orgId, id)).rejects.toBeInstanceOf(DocumentNotFoundError);
    // El consecutivo de B es independiente del de A.
    expect(await proposeDocumentCode(b.orgId, 'procedure', 'CA')).toBe('PR-CA-001');
  });
});
