/**
 * Proveedor LOCAL de almacenamiento (PLATFORM-002 §51). Sin red. Usa un directorio
 * temporal aislado; limpia al terminar.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LocalStorageProvider } from '@/server/storage/local-provider';

let dir: string;
let prevPath: string | undefined;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'c3-storage-'));
  prevPath = process.env.STORAGE_LOCAL_PATH;
  process.env.STORAGE_LOCAL_PATH = dir;
});
afterAll(async () => {
  if (prevPath === undefined) delete process.env.STORAGE_LOCAL_PATH;
  else process.env.STORAGE_LOCAL_PATH = prevPath;
  await rm(dir, { recursive: true, force: true });
});

describe('LocalStorageProvider', () => {
  const provider = new LocalStorageProvider();
  const ref = { bucket: 'b1', storageKey: 'org/o1/2026/09/file1.pdf' };
  const body = Buffer.from('%PDF-1.4 hola');

  it('no soporta URLs firmadas', () => {
    expect(provider.supportsSignedUrls).toBe(false);
    expect(provider.name).toBe('local');
  });

  it('put → head → read → delete', async () => {
    await provider.putObject({ ...ref, body, mimeType: 'application/pdf' });
    const head = await provider.headObject(ref);
    expect(head?.sizeBytes).toBe(body.byteLength);
    const read = await provider.readObject(ref);
    expect(read.equals(body)).toBe(true);
    await provider.deleteObject(ref);
    expect(await provider.headObject(ref)).toBeNull();
  });

  it('copy duplica el objeto', async () => {
    await provider.putObject({ ...ref, body, mimeType: 'application/pdf' });
    const to = { bucket: 'b1', storageKey: 'org/o1/2026/09/file2.pdf' };
    await provider.copyObject(ref, to);
    expect((await provider.readObject(to)).equals(body)).toBe(true);
  });

  it('rechaza rutas con traversal', async () => {
    await expect(
      provider.readObject({ bucket: 'b', storageKey: '../../etc/passwd' }),
    ).rejects.toThrow();
  });

  it('getSignedReadUrl lanza (no soportado en local)', async () => {
    await expect(provider.getSignedReadUrl()).rejects.toThrow();
  });
});
