/**
 * Proveedor de almacenamiento LOCAL (PLATFORM-002 §9). Para desarrollo y pruebas.
 * Guarda los binarios fuera del árbol de código, en una carpeta ignorada por git
 * (`/storage/` por defecto). NO apto para producción (sin durabilidad ni signed URLs).
 */
import { mkdir, readFile, writeFile, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import type {
  PutObjectInput,
  StorageObjectMeta,
  StorageObjectRef,
  StorageProvider,
} from './provider';
import { StorageObjectNotFoundError } from './provider';

function baseDir(): string {
  return process.env.STORAGE_LOCAL_PATH ?? path.join(process.cwd(), 'storage', 'objects');
}

/** Resuelve la ruta física asegurando que quede dentro de baseDir (anti-traversal). */
function resolvePath(bucket: string, storageKey: string): string {
  if (!bucket || !storageKey || storageKey.includes('..') || bucket.includes('..')) {
    throw new Error('storageKey inválido.');
  }
  const root = path.resolve(baseDir());
  const full = path.resolve(root, bucket, storageKey);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error('Ruta fuera del almacenamiento.');
  }
  return full;
}

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';
  readonly supportsSignedUrls = false;

  async putObject(input: PutObjectInput): Promise<void> {
    const full = resolvePath(input.bucket, input.storageKey);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, input.body);
  }

  async readObject(ref: StorageObjectRef): Promise<Buffer> {
    try {
      return await readFile(resolvePath(ref.bucket, ref.storageKey));
    } catch {
      throw new StorageObjectNotFoundError();
    }
  }

  async headObject(ref: StorageObjectRef): Promise<StorageObjectMeta | null> {
    try {
      const s = await stat(resolvePath(ref.bucket, ref.storageKey));
      return { sizeBytes: s.size, mimeType: null, updatedAt: s.mtime };
    } catch {
      return null;
    }
  }

  async deleteObject(ref: StorageObjectRef): Promise<void> {
    try {
      await unlink(resolvePath(ref.bucket, ref.storageKey));
    } catch {
      // idempotente: si no existe, no es error.
    }
  }

  async copyObject(from: StorageObjectRef, to: StorageObjectRef): Promise<void> {
    const data = await this.readObject(from);
    await this.putObject({
      bucket: to.bucket,
      storageKey: to.storageKey,
      body: data,
      mimeType: '',
    });
  }

  async getSignedReadUrl(): Promise<string> {
    // El proveedor local no genera URLs firmadas: la descarga se sirve por una ruta
    // autorizada que hace streaming (§21).
    throw new Error('El proveedor local no soporta URLs firmadas.');
  }
}
