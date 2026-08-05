/**
 * Editor documental (TASK-005) contra la capa de datos. Requiere `DATABASE_URL`.
 * Usa organizaciones desechables para no contaminar la demo.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { db, hasDb, newId, seedOrgWithPublishedTemplate } from './_helpers';
import {
  ContentTooLargeError,
  DocumentNotEditableError,
  DocumentNotFoundError,
  UnsupportedImageError,
  addDocumentImage,
  createEditorDocument,
  createEditorVersion,
  getEditorContent,
  saveContent,
} from '@/server/documents';

afterAll(async () => {
  if (hasDb) await db().$disconnect();
});

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const doc = (nodes: unknown[]) => ({ type: 'doc', content: nodes });

async function newEditorDoc(orgId: string, userId: string, template = 'procedure') {
  const id = await createEditorDocument(orgId, userId, {
    code: `SEN-${newId().slice(0, 6)}`,
    title: 'Documento de prueba',
    documentType: template === 'policy' ? 'policy' : 'procedure',
    templateKey: template,
  });
  const content = await getEditorContent(orgId, id);
  return { id, versionId: content.versionId, content };
}

describe.skipIf(!hasDb)('editor documental', () => {
  it('crea contenido estructurado a partir de una plantilla', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { content } = await newEditorDoc(org.orgId, org.userId);
    expect(JSON.stringify(content.contentJson)).toContain('Objetivo');
    expect(content.versions).toHaveLength(1);
  });

  it('guarda y reabre el contenido, conservando tablas', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id, versionId, content } = await newEditorDoc(org.orgId, org.userId);
    const table = doc([
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H' }] }],
              },
            ],
          },
        ],
      },
    ]);
    await saveContent(
      org.orgId,
      org.userId,
      id,
      versionId,
      { contentJson: table, pageConfig: content.pageConfig },
      true,
    );
    const reopened = await getEditorContent(org.orgId, id, versionId);
    expect(JSON.stringify(reopened.contentJson)).toContain('table');
  });

  it('sanea el contenido y rechaza scripts y enlaces peligrosos', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id, versionId, content } = await newEditorDoc(org.orgId, org.userId);
    const dirty = doc([
      { type: 'script' },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'x',
            marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
          },
        ],
      },
    ]);
    await saveContent(
      org.orgId,
      org.userId,
      id,
      versionId,
      { contentJson: dirty, pageConfig: content.pageConfig },
      false,
    );
    const reopened = JSON.stringify((await getEditorContent(org.orgId, id, versionId)).contentJson);
    expect(reopened).not.toContain('script');
    expect(reopened).not.toContain('javascript:');
  });

  it('persiste la configuración de encabezado y pie', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id, versionId, content } = await newEditorDoc(org.orgId, org.userId);
    const cfg = {
      ...content.pageConfig,
      header: { ...content.pageConfig.header, style: 'tabular', companyName: 'ACME' },
    };
    await saveContent(
      org.orgId,
      org.userId,
      id,
      versionId,
      { contentJson: content.contentJson, pageConfig: cfg },
      false,
    );
    const reopened = await getEditorContent(org.orgId, id, versionId);
    expect(reopened.pageConfig.header.style).toBe('tabular');
    expect(reopened.pageConfig.header.companyName).toBe('ACME');
  });

  it('valida el tamaño máximo de contenido', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id, versionId, content } = await newEditorDoc(org.orgId, org.userId);
    process.env.DOCUMENTS_MAX_CONTENT_BYTES = '50';
    try {
      await expect(
        saveContent(org.orgId, org.userId, id, versionId, {
          contentJson: content.contentJson,
          pageConfig: content.pageConfig,
        }),
      ).rejects.toBeInstanceOf(ContentTooLargeError);
    } finally {
      delete process.env.DOCUMENTS_MAX_CONTENT_BYTES;
    }
  });

  it('crea una nueva versión copiando el contenido y deja una sola vigente', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id } = await newEditorDoc(org.orgId, org.userId);
    await createEditorVersion(org.orgId, org.userId, id, { label: 'v2', changeNotes: 'cambio' });
    const versions = await db().documentVersion.findMany({ where: { documentId: id } });
    expect(versions).toHaveLength(2);
    expect(versions.filter((v) => v.isCurrent)).toHaveLength(1);
    expect(versions.find((v) => v.isCurrent)?.label).toBe('v2');
  });

  it('una versión publicada no se puede editar (app) ni reescribir (trigger)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id, versionId, content } = await newEditorDoc(org.orgId, org.userId);
    await db().documentVersion.update({
      where: { id: versionId },
      data: { status: 'published', publishedAt: new Date() },
    });
    await expect(
      saveContent(org.orgId, org.userId, id, versionId, {
        contentJson: content.contentJson,
        pageConfig: content.pageConfig,
      }),
    ).rejects.toBeInstanceOf(DocumentNotEditableError);
    await expect(
      db().documentVersion.update({ where: { id: versionId }, data: { contentHtml: 'hack' } }),
    ).rejects.toThrow();
  });

  it('acepta imágenes PNG/JPG y rechaza otros formatos', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const { id, versionId } = await newEditorDoc(org.orgId, org.userId);
    const image = await addDocumentImage(org.orgId, org.userId, id, versionId, {
      originalName: 'foto.png',
      mimeType: 'image/png',
      data: PNG,
    });
    expect(image.url).toContain(`/dashboard/documents/${id}/files/`);
    await expect(
      addDocumentImage(org.orgId, org.userId, id, versionId, {
        originalName: 'x.pdf',
        mimeType: 'application/pdf',
        data: Buffer.from('x'),
      }),
    ).rejects.toBeInstanceOf(UnsupportedImageError);
  });

  it('otra organización no puede abrir el contenido ajeno', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const { id } = await newEditorDoc(a.orgId, a.userId);
    await expect(getEditorContent(b.orgId, id)).rejects.toBeInstanceOf(DocumentNotFoundError);
  });

  it('otra organización no puede guardar ni subir imágenes en el documento ajeno', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const { id, versionId, content } = await newEditorDoc(a.orgId, a.userId);
    await expect(
      saveContent(b.orgId, b.userId, id, versionId, {
        contentJson: content.contentJson,
        pageConfig: content.pageConfig,
      }),
    ).rejects.toBeInstanceOf(DocumentNotFoundError);
    await expect(
      addDocumentImage(b.orgId, b.userId, id, versionId, {
        originalName: 'a.png',
        mimeType: 'image/png',
        data: PNG,
      }),
    ).rejects.toBeInstanceOf(DocumentNotFoundError);
  });
});
