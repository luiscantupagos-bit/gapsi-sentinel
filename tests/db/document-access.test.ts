/**
 * Seguridad y reglas del módulo documental (TASK-004) contra la capa de datos
 * (`src/server/documents.ts`). Requiere `DATABASE_URL`.
 *
 * Usa organizaciones desechables (ids aleatorios) para no contaminar la demo.
 */
import { describe, expect, it } from 'vitest';
import {
  createDiagnostic,
  db,
  hasDb,
  inRollbackTx,
  newId,
  seedOrgWithPublishedTemplate,
} from './_helpers';
import { UnsupportedFileError } from '@/server/document-storage';
import {
  DocumentNotEditableError,
  DocumentNotFoundError,
  DocumentValidationError,
  DuplicateCodeError,
  RelationScopeError,
  archiveDocument,
  createDocument,
  createVersion,
  getDocumentDetail,
  getFileForDownload,
  linkDocument,
  updateDocumentMetadata,
} from '@/server/documents';

function validDoc(code: string) {
  return {
    code,
    title: 'Documento de prueba',
    documentType: 'procedure',
    versionLabel: 'v1',
    origin: 'internal',
    status: 'draft',
    confidentiality: 'internal',
  };
}

describe.skipIf(!hasDb)('módulo documental — acceso y reglas', () => {
  it('crea un documento válido', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await createDocument(org.orgId, org.userId, validDoc(`D-${newId().slice(0, 6)}`));
    const detail = await getDocumentDetail(org.orgId, id);
    expect(detail.id).toBe(id);
    expect(detail.versions).toHaveLength(1);
    expect(detail.versions[0]?.isCurrent).toBe(true);
  });

  it('exige código único dentro de la organización', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    await createDocument(org.orgId, org.userId, validDoc('DUP-1'));
    await expect(createDocument(org.orgId, org.userId, validDoc('DUP-1'))).rejects.toBeInstanceOf(
      DuplicateCodeError,
    );
  });

  it('permite el mismo código en organizaciones diferentes', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    await expect(createDocument(a.orgId, a.userId, validDoc('SHARED'))).resolves.toBeTruthy();
    await expect(createDocument(b.orgId, b.userId, validDoc('SHARED'))).resolves.toBeTruthy();
  });

  it('rechaza un documento con sitio de otra organización', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    await expect(
      createDocument(a.orgId, a.userId, { ...validDoc('X-SITE'), siteId: b.siteId }),
    ).rejects.toBeInstanceOf(RelationScopeError);
  });

  it('rechaza relacionar con un diagnóstico de otra organización', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const foreignDiagnostic = await createDiagnostic(db(), b);
    const docId = await createDocument(a.orgId, a.userId, validDoc(`REL-${newId().slice(0, 6)}`));
    await expect(
      linkDocument(a.orgId, docId, { relationType: 'diagnostic', diagnosticId: foreignDiagnostic }),
    ).rejects.toBeInstanceOf(RelationScopeError);
  });

  it('rechaza un archivo que referencia una versión de otra organización', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const docId = await createDocument(a.orgId, a.userId, validDoc(`FILE-${newId().slice(0, 6)}`));
    const version = await db().documentVersion.findFirstOrThrow({ where: { documentId: docId } });
    await expect(
      db().documentFile.create({
        data: {
          organizationId: b.orgId, // organización distinta a la de la versión
          documentVersionId: version.id,
          kind: 'attachment',
          originalName: 'x.pdf',
          storedName: 's.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 10,
          extension: 'pdf',
          storageKey: `${b.orgId}/s.pdf`,
        },
      }),
    ).rejects.toThrow();
  });

  it('RLS: con contexto de organización solo se ven sus documentos', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    await createDocument(a.orgId, a.userId, validDoc(`RLS-A-${newId().slice(0, 6)}`));
    await createDocument(b.orgId, b.userId, validDoc(`RLS-B-${newId().slice(0, 6)}`));

    await inRollbackTx(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE gapsi_app');
      await tx.$executeRaw`SELECT set_config('app.current_org', ${a.orgId}, true)`;
      const rows = await tx.$queryRaw<
        { organization_id: string }[]
      >`SELECT organization_id FROM documents`;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.organization_id === a.orgId)).toBe(true);
    });
  });

  it('crea una nueva versión y solo una queda vigente', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const docId = await createDocument(
      org.orgId,
      org.userId,
      validDoc(`VER-${newId().slice(0, 6)}`),
    );
    await createVersion(org.orgId, org.userId, docId, { label: 'v2', changeNotes: 'cambio' });
    const versions = await db().documentVersion.findMany({ where: { documentId: docId } });
    expect(versions).toHaveLength(2);
    expect(versions.filter((v) => v.isCurrent)).toHaveLength(1);
    expect(versions.find((v) => v.isCurrent)?.label).toBe('v2');
  });

  it('historial documental append-only', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const docId = await createDocument(
      org.orgId,
      org.userId,
      validDoc(`HIST-${newId().slice(0, 6)}`),
    );
    const row = await db().documentHistory.findFirstOrThrow({ where: { documentId: docId } });
    await expect(
      db().documentHistory.update({ where: { id: row.id }, data: { action: 'hack' } }),
    ).rejects.toThrow();
  });

  it('prohíbe el borrado físico de un documento', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const docId = await createDocument(
      org.orgId,
      org.userId,
      validDoc(`DEL-${newId().slice(0, 6)}`),
    );
    await expect(db().document.delete({ where: { id: docId } })).rejects.toThrow();
  });

  it('valida que la próxima revisión no sea anterior a la emisión', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    await expect(
      createDocument(org.orgId, org.userId, {
        ...validDoc(`DATE-${newId().slice(0, 6)}`),
        issuedAt: '2026-03-01',
        nextReviewAt: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(DocumentValidationError);
  });

  it('rechaza un archivo con extensión no permitida', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    await expect(
      createDocument(org.orgId, org.userId, validDoc(`EXE-${newId().slice(0, 6)}`), {
        originalName: 'malware.exe',
        mimeType: 'application/x-msdownload',
        data: Buffer.from('x'),
      }),
    ).rejects.toBeInstanceOf(UnsupportedFileError);
  });

  it('un documento archivado no puede editarse', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const docId = await createDocument(
      org.orgId,
      org.userId,
      validDoc(`ARCH-${newId().slice(0, 6)}`),
    );
    await archiveDocument(org.orgId, org.userId, docId);
    await expect(
      updateDocumentMetadata(org.orgId, org.userId, docId, {
        title: 'nuevo',
        documentType: 'procedure',
        status: 'draft',
        confidentiality: 'internal',
      }),
    ).rejects.toBeInstanceOf(DocumentNotEditableError);
  });

  it('otra organización no puede abrir el documento ajeno', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const docId = await createDocument(a.orgId, a.userId, validDoc(`OPEN-${newId().slice(0, 6)}`));
    await expect(getDocumentDetail(b.orgId, docId)).rejects.toBeInstanceOf(DocumentNotFoundError);
  });

  it('la descarga protegida rechaza un archivo de otra organización', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const docId = await createDocument(a.orgId, a.userId, validDoc(`DL-${newId().slice(0, 6)}`));
    const version = await db().documentVersion.findFirstOrThrow({ where: { documentId: docId } });
    const file = await db().documentFile.create({
      data: {
        organizationId: a.orgId,
        documentVersionId: version.id,
        kind: 'main',
        originalName: 'a.pdf',
        storedName: 's.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        extension: 'pdf',
        storageKey: `${a.orgId}/s.pdf`,
      },
    });
    await expect(getFileForDownload(b.orgId, file.id)).rejects.toBeInstanceOf(
      DocumentNotFoundError,
    );
    // la organización dueña sí obtiene la metadata:
    await expect(getFileForDownload(a.orgId, file.id)).resolves.toMatchObject({
      originalName: 'a.pdf',
    });
  });
});
