/**
 * PLATFORM-002 — almacenamiento de archivos transversal (servicio + aislamiento).
 * Requiere `DATABASE_URL`. Usa el proveedor LOCAL en un directorio temporal (sin red).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { db, hasDb, newId, seedOrgWithPublishedTemplate } from './_helpers';
import {
  uploadFile,
  getFile,
  getDownloadTarget,
  deleteFile,
  linkFile,
  unlinkFile,
  listFilesForEntity,
  getOrganizationStorageUsage,
  FileNotFoundError,
  FileValidationError,
} from '@/server/files';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF');
const PDF2 = Buffer.from('%PDF-1.7\ndistinto contenido\n%%EOF');

let dir: string;
let prev: string | undefined;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'c3-db-storage-'));
  prev = process.env.STORAGE_LOCAL_PATH;
  process.env.STORAGE_LOCAL_PATH = dir;
});
afterAll(async () => {
  if (prev === undefined) delete process.env.STORAGE_LOCAL_PATH;
  else process.env.STORAGE_LOCAL_PATH = prev;
  await rm(dir, { recursive: true, force: true });
});

function pdfInput(over: Record<string, unknown> = {}) {
  return { filename: 'evidencia.pdf', mimeType: 'application/pdf', data: PDF, ...over } as never;
}

describe.skipIf(!hasDb)('almacenamiento de archivos (PLATFORM-002)', () => {
  it('A. sube un archivo y persiste metadata', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const meta = await uploadFile(org.orgId, org.userId, pdfInput());
    expect(meta.id).toBeTruthy();
    expect(meta.filename).toBe('evidencia.pdf');
    expect(meta.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect((await getFile(org.orgId, meta.id)).sizeBytes).toBe(PDF.byteLength);
  });

  it('B/C. relaciona con una entidad y lista por entidad', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const entityId = newId();
    await uploadFile(
      org.orgId,
      org.userId,
      pdfInput({
        relation: { entityType: 'task', entityId, relationType: 'evidence' },
      }),
    );
    const list = await listFilesForEntity(org.orgId, 'task', entityId);
    expect(list).toHaveLength(1);
    expect(list[0]?.relationType).toBe('evidence');
  });

  it('D/E. aislamiento por organización (archivo y relación)', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const entityId = newId();
    const meta = await uploadFile(
      a.orgId,
      a.userId,
      pdfInput({
        relation: { entityType: 'task', entityId, relationType: 'evidence' },
      }),
    );
    await expect(getFile(b.orgId, meta.id)).rejects.toBeInstanceOf(FileNotFoundError);
    expect(await listFilesForEntity(b.orgId, 'task', entityId)).toHaveLength(0);
  });

  it('F. relación cross-tenant rechazada', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const meta = await uploadFile(a.orgId, a.userId, pdfInput());
    // B no puede relacionar el archivo de A (no lo ve).
    await expect(
      linkFile(b.orgId, b.userId, meta.id, {
        entityType: 'task',
        entityId: newId(),
        relationType: 'evidence',
      }),
    ).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it('G/H. soft delete: metadata marcada y descarga negada', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const meta = await uploadFile(org.orgId, org.userId, pdfInput());
    // Descarga funciona antes de borrar.
    const before = await getDownloadTarget(org.orgId, meta.id);
    expect(before.kind).toBe('stream');
    await deleteFile(org.orgId, meta.id);
    await expect(getFile(org.orgId, meta.id)).rejects.toBeInstanceOf(FileNotFoundError);
    await expect(getDownloadTarget(org.orgId, meta.id)).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it('I. uso de almacenamiento (bytes + cantidad), excluye borrados', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const m1 = await uploadFile(org.orgId, org.userId, pdfInput());
    await uploadFile(org.orgId, org.userId, pdfInput({ data: PDF2 }));
    const usage = await getOrganizationStorageUsage(org.orgId);
    expect(usage.fileCount).toBe(2);
    expect(usage.usedBytes).toBe(PDF.byteLength + PDF2.byteLength);
    await deleteFile(org.orgId, m1.id);
    expect((await getOrganizationStorageUsage(org.orgId)).fileCount).toBe(1);
  });

  it('J. idempotencia por clientUploadId (no duplica metadata)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const cid = newId();
    const a = await uploadFile(org.orgId, org.userId, pdfInput({ clientUploadId: cid }));
    const b = await uploadFile(org.orgId, org.userId, pdfInput({ clientUploadId: cid }));
    expect(a.id).toBe(b.id);
    const count = await db().storedFile.count({
      where: { organizationId: org.orgId, clientUploadId: cid },
    });
    expect(count).toBe(1);
  });

  it('K. mismo hash en dos organizaciones es independiente', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const ma = await uploadFile(a.orgId, a.userId, pdfInput());
    const mb = await uploadFile(b.orgId, b.userId, pdfInput());
    expect(ma.sha256).toBe(mb.sha256); // mismo contenido
    expect(ma.id).not.toBe(mb.id); // filas independientes
    await expect(getFile(b.orgId, ma.id)).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it('L. mismo hash en la misma organización se permite (sin dedup físico)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const m1 = await uploadFile(org.orgId, org.userId, pdfInput());
    const m2 = await uploadFile(org.orgId, org.userId, pdfInput());
    expect(m1.id).not.toBe(m2.id);
    expect(m1.sha256).toBe(m2.sha256);
  });

  it('M/N. tipos de entidad/relación inválidos rechazados', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const meta = await uploadFile(org.orgId, org.userId, pdfInput());
    await expect(
      linkFile(org.orgId, org.userId, meta.id, {
        entityType: 'hacker' as never,
        entityId: newId(),
        relationType: 'evidence',
      }),
    ).rejects.toBeInstanceOf(FileValidationError);
    await expect(
      linkFile(org.orgId, org.userId, meta.id, {
        entityType: 'task',
        entityId: newId(),
        relationType: 'malware' as never,
      }),
    ).rejects.toBeInstanceOf(FileValidationError);
  });

  it('O. rechaza MIME/firma no permitidos', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    await expect(
      uploadFile(org.orgId, org.userId, {
        filename: 'x.exe',
        mimeType: 'application/x-msdownload',
        data: Buffer.from('MZ'),
      } as never),
    ).rejects.toBeInstanceOf(FileValidationError);
    // MIME permitido pero firma incoherente (no es PDF real).
    await expect(
      uploadFile(org.orgId, org.userId, {
        filename: 'fake.pdf',
        mimeType: 'application/pdf',
        data: Buffer.from('no soy pdf'),
      } as never),
    ).rejects.toBeInstanceOf(FileValidationError);
  });

  it('P. unlink elimina la relación sin borrar el archivo', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const entityId = newId();
    const meta = await uploadFile(
      org.orgId,
      org.userId,
      pdfInput({
        relation: { entityType: 'document', entityId, relationType: 'attachment' },
      }),
    );
    await unlinkFile(org.orgId, meta.id, {
      entityType: 'document',
      entityId,
      relationType: 'attachment',
    });
    expect(await listFilesForEntity(org.orgId, 'document', entityId)).toHaveLength(0);
    expect((await getFile(org.orgId, meta.id)).id).toBe(meta.id); // el archivo sigue
  });
});
