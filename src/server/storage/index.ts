/**
 * Factory de almacenamiento (PLATFORM-002 §11). Los módulos de negocio obtienen el
 * proveedor activo sin conocer el concreto (sin `if provider === 'r2'` disperso).
 * LOCAL por defecto (dev/tests); S3/R2 en staging/producción según `STORAGE_PROVIDER`.
 */
import type { StorageProvider } from './provider';
import { LocalStorageProvider } from './local-provider';
import { S3StorageProvider } from './s3-provider';

export * from './provider';

const globalForStorage = globalThis as unknown as { storageProvider?: StorageProvider };

/** Nombre del proveedor activo (para persistir en `stored_files.storage_provider`). */
export function activeProviderName(env: Record<string, string | undefined> = process.env): string {
  const raw = (env.STORAGE_PROVIDER ?? 'local').toLowerCase();
  return raw === 's3' || raw === 'r2' ? 's3' : 'local';
}

/** Proveedor activo (singleton por proceso). */
export function getStorageProvider(): StorageProvider {
  if (!globalForStorage.storageProvider) {
    globalForStorage.storageProvider =
      activeProviderName() === 's3' ? new S3StorageProvider() : new LocalStorageProvider();
  }
  return globalForStorage.storageProvider;
}

/** Bucket por defecto para nuevos objetos. */
export function defaultBucket(env: Record<string, string | undefined> = process.env): string {
  return env.STORAGE_BUCKET ?? 'c3-sentinel-local';
}

/** TTL de URLs firmadas en segundos (default 600 = 10 min; acotado 60..3600, §22). */
export function signedUrlTtlSeconds(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.STORAGE_SIGNED_URL_TTL_SECONDS);
  const ttl = Number.isFinite(raw) && raw > 0 ? raw : 600;
  return Math.min(3600, Math.max(60, Math.floor(ttl)));
}
