/**
 * PLATFORM-002B — logo de organización + adjuntos (integración visual del storage).
 * Requiere `DATABASE_URL`. Proveedor LOCAL en directorio temporal (sin red).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { db, hasDb, newId, seedOrgWithPublishedTemplate } from './_helpers';
import {
  uploadFile,
  getFile,
  listFilesForEntity,
  linkFile,
  unlinkAndCleanup,
  getOrganizationStorageUsage,
  FileNotFoundError,
} from '@/server/files';
import {
  uploadOrganizationLogo,
  removeOrganizationLogo,
  getOrganizationProfile,
  resolveLogoSource,
} from '@/server/organization';

// PNG mínimo válido (firma de 8 bytes + relleno).
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PNG2 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const PDF = Buffer.from('%PDF-1.4\nx\n%%EOF');

let dir: string;
let prev: string | undefined;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'c3-ui-storage-'));
  prev = process.env.STORAGE_LOCAL_PATH;
  process.env.STORAGE_LOCAL_PATH = dir;
});
afterAll(async () => {
  if (prev === undefined) delete process.env.STORAGE_LOCAL_PATH;
  else process.env.STORAGE_LOCAL_PATH = prev;
  await rm(dir, { recursive: true, force: true });
});

function logo(data = PNG) {
  return { filename: 'logo.png', mimeType: 'image/png', data };
}

describe.skipIf(!hasDb)('logo de organización (PLATFORM-002B)', () => {
  it('resolveLogoSource: prioridad file → url → null (§3)', () => {
    expect(resolveLogoSource({ logoFileId: 'abc', logoUrl: 'https://x/y.png' })).toBe(
      '/api/files/abc',
    );
    expect(resolveLogoSource({ logoFileId: null, logoUrl: 'https://x/y.png' })).toBe(
      'https://x/y.png',
    );
    expect(resolveLogoSource({ logoFileId: null, logoUrl: '' })).toBeNull();
  });

  it('A/B. sube logo, perfil apunta a logo_file_id y hay relación organization/logo', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const meta = await uploadOrganizationLogo(org.orgId, org.userId, logo());
    const profile = await getOrganizationProfile(org.orgId);
    expect(profile.logoFileId).toBe(meta.id);
    expect(profile.logoSource).toBe(`/api/files/${meta.id}`);
    const rel = await listFilesForEntity(org.orgId, 'organization', org.orgId);
    expect(rel).toHaveLength(1);
    expect(rel[0]?.relationType).toBe('logo');
  });

  it('C. aislamiento: org B no ve el logo de A', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const meta = await uploadOrganizationLogo(a.orgId, a.userId, logo());
    await expect(getFile(b.orgId, meta.id)).rejects.toBeInstanceOf(FileNotFoundError);
    expect((await getOrganizationProfile(b.orgId)).logoFileId).toBeNull();
  });

  it('D/F. reemplazar: apunta al nuevo; el anterior queda borrado (huérfano)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const first = await uploadOrganizationLogo(org.orgId, org.userId, logo(PNG));
    const second = await uploadOrganizationLogo(org.orgId, org.userId, logo(PNG2));
    expect((await getOrganizationProfile(org.orgId)).logoFileId).toBe(second.id);
    await expect(getFile(org.orgId, first.id)).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it('E/H. fallback a logo_url legacy y a nombre; quitar logo', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    // Sin logo → source null (fallback al nombre en UI).
    expect((await getOrganizationProfile(org.orgId)).logoSource).toBeNull();
    // Con logo_url legacy → source = url.
    await db().organizationProfile.upsert({
      where: { organizationId: org.orgId },
      update: { logoUrl: 'https://cdn/x.png' },
      create: { organizationId: org.orgId, logoUrl: 'https://cdn/x.png' },
    });
    expect((await getOrganizationProfile(org.orgId)).logoSource).toBe('https://cdn/x.png');
    // Subir file gana sobre url; quitar vuelve a url.
    const meta = await uploadOrganizationLogo(org.orgId, org.userId, logo());
    expect((await getOrganizationProfile(org.orgId)).logoSource).toBe(`/api/files/${meta.id}`);
    await removeOrganizationLogo(org.orgId, org.userId);
    const after = await getOrganizationProfile(org.orgId);
    expect(after.logoFileId).toBeNull();
    expect(after.logoSource).toBe('https://cdn/x.png');
  });

  it('rechaza no-imagen para logo', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    await expect(
      uploadOrganizationLogo(org.orgId, org.userId, {
        filename: 'x.pdf',
        mimeType: 'application/pdf',
        data: PDF,
      }),
    ).rejects.toThrow();
  });
});

describe.skipIf(!hasDb)('adjuntos de tarea (PLATFORM-002B §10)', () => {
  it('I/J/K. sube, lista y usa el almacenamiento', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const taskId = newId();
    const meta = await uploadFile(org.orgId, org.userId, {
      filename: 'nota.pdf',
      mimeType: 'application/pdf',
      data: PDF,
      relation: { entityType: 'task', entityId: taskId, relationType: 'attachment' },
    });
    const list = await listFilesForEntity(org.orgId, 'task', taskId);
    expect(list.map((f) => f.id)).toContain(meta.id);
    expect((await getOrganizationStorageUsage(org.orgId)).fileCount).toBeGreaterThanOrEqual(1);
  });

  it('L/M. unlink borra si es la última relación; conserva si es compartida (§16)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const taskId = newId();
    const docId = newId();
    const meta = await uploadFile(org.orgId, org.userId, {
      filename: 'compartido.pdf',
      mimeType: 'application/pdf',
      data: PDF,
      relation: { entityType: 'task', entityId: taskId, relationType: 'attachment' },
    });
    // Compartir el mismo archivo con un documento.
    await linkFile(org.orgId, org.userId, meta.id, {
      entityType: 'document',
      entityId: docId,
      relationType: 'attachment',
    });
    // Unlink de la tarea: sigue compartido → NO se borra.
    const r1 = await unlinkAndCleanup(org.orgId, meta.id, {
      entityType: 'task',
      entityId: taskId,
      relationType: 'attachment',
    });
    expect(r1.deleted).toBe(false);
    expect((await getFile(org.orgId, meta.id)).id).toBe(meta.id);
    // Unlink de la última relación → se borra (soft).
    const r2 = await unlinkAndCleanup(org.orgId, meta.id, {
      entityType: 'document',
      entityId: docId,
      relationType: 'attachment',
    });
    expect(r2.deleted).toBe(true);
    await expect(getFile(org.orgId, meta.id)).rejects.toBeInstanceOf(FileNotFoundError);
  });
});
