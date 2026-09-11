/**
 * Política transversal de archivos (PLATFORM-002) — motor puro + factory.
 */
import { describe, expect, it } from 'vitest';
import {
  ENTITY_TYPES,
  RELATION_TYPES,
  isEntityType,
  isRelationType,
  isAllowedMime,
  extForMime,
  magicBytesMatch,
  sanitizeFilename,
  storageKeyFor,
  resolveMaxUploadBytes,
  validateUploadMeta,
  computeStorageQuota,
  fitsInQuota,
  DEFAULT_MAX_UPLOAD_MB,
} from '@/features/storage/file-policy';
import { activeProviderName, defaultBucket, signedUrlTtlSeconds } from '@/server/storage';
import { readS3Config } from '@/server/storage/s3-provider';

describe('vocabulario (§5/§6)', () => {
  it('valida entity/relation types y rechaza libres', () => {
    expect(isEntityType('document')).toBe(true);
    expect(isEntityType('hacker')).toBe(false);
    expect(isRelationType('evidence')).toBe(true);
    expect(isRelationType('rm -rf')).toBe(false);
    expect(ENTITY_TYPES).toContain('organization');
    expect(RELATION_TYPES).toContain('logo');
  });
});

describe('MIME (§14)', () => {
  it('permite la lista y da extensión; rechaza otros', () => {
    expect(isAllowedMime('application/pdf')).toBe(true);
    expect(isAllowedMime('application/x-msdownload')).toBe(false);
    expect(extForMime('image/png')).toBe('png');
    expect(extForMime('application/octet-stream')).toBe('bin');
  });
});

describe('magic bytes (§15)', () => {
  it('acepta firmas correctas', () => {
    expect(magicBytesMatch('application/pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(true);
    expect(magicBytesMatch('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe(true);
    expect(
      magicBytesMatch(
        'image/png',
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe(true);
    expect(
      magicBytesMatch(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      ),
    ).toBe(true);
    expect(magicBytesMatch('text/plain', new Uint8Array([0x61]))).toBe(true);
  });
  it('rechaza firmas incoherentes con el MIME', () => {
    expect(magicBytesMatch('application/pdf', new Uint8Array([0x00, 0x01]))).toBe(false);
    expect(magicBytesMatch('image/png', new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(false);
  });
});

describe('nombre y storageKey (§12/§13)', () => {
  it('sanea nombre anti-traversal', () => {
    expect(sanitizeFilename('../../etc/passwd')).not.toContain('/');
    expect(sanitizeFilename('../../etc/passwd')).not.toContain('..');
    expect(sanitizeFilename('')).toBe('archivo');
  });
  it('genera storageKey server-side por org/fecha/uuid', () => {
    const key = storageKeyFor('org1', 'pdf', 'uuid1', new Date(Date.UTC(2026, 8, 5)));
    expect(key).toBe('org/org1/2026/09/uuid1.pdf');
  });
  it('acota extensiones peligrosas', () => {
    expect(storageKeyFor('o', '../x', 'u')).toContain('.bin');
  });
});

describe('tamaño y validación (§16)', () => {
  it('resuelve el máximo desde env', () => {
    expect(resolveMaxUploadBytes({})).toBe(DEFAULT_MAX_UPLOAD_MB * 1024 * 1024);
    expect(resolveMaxUploadBytes({ MAX_UPLOAD_MB: '10' })).toBe(10 * 1024 * 1024);
  });
  it('valida MIME + tamaño', () => {
    expect(
      validateUploadMeta({ filename: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 100 }).ok,
    ).toBe(true);
    expect(
      validateUploadMeta({
        filename: 'a.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 100,
      }).ok,
    ).toBe(false);
    expect(
      validateUploadMeta({
        filename: 'a.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 999,
        maxBytes: 100,
      }).ok,
    ).toBe(false);
  });
});

describe('cuota (§33/§34/§35)', () => {
  it('sin límite → ilimitado; con límite → porcentaje', () => {
    expect(computeStorageQuota(50, null).percentage).toBeNull();
    expect(computeStorageQuota(50, 100)).toMatchObject({ remainingBytes: 50, percentage: 50 });
  });
  it('fitsInQuota respeta el límite', () => {
    expect(fitsInQuota(90, 20, 100)).toBe(false);
    expect(fitsInQuota(90, 10, 100)).toBe(true);
    expect(fitsInQuota(90, 1000, null)).toBe(true);
  });
});

describe('factory (§11) y config', () => {
  it('activeProviderName default local; s3/r2 → s3', () => {
    expect(activeProviderName({})).toBe('local');
    expect(activeProviderName({ STORAGE_PROVIDER: 'r2' })).toBe('s3');
    expect(activeProviderName({ STORAGE_PROVIDER: 'S3' })).toBe('s3');
  });
  it('bucket y TTL configurables con default', () => {
    expect(defaultBucket({})).toBe('c3-sentinel-local');
    expect(signedUrlTtlSeconds({})).toBe(600);
    expect(signedUrlTtlSeconds({ STORAGE_SIGNED_URL_TTL_SECONDS: '999999' })).toBe(3600);
    expect(signedUrlTtlSeconds({ STORAGE_SIGNED_URL_TTL_SECONDS: '5' })).toBe(60);
  });
  it('readS3Config exige STORAGE_*', () => {
    expect(() => readS3Config({})).toThrow();
    expect(
      readS3Config({
        STORAGE_ENDPOINT: 'https://x.r2.dev',
        STORAGE_BUCKET: 'b',
        STORAGE_ACCESS_KEY_ID: 'k',
        STORAGE_SECRET_ACCESS_KEY: 's',
      }).defaultBucket,
    ).toBe('b');
  });
});
