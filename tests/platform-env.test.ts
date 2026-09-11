/**
 * Catálogo y reporte de entorno (PLATFORM-001 §31). Motor puro (presencia, sin valores).
 */
import { describe, expect, it } from 'vitest';
import { ENV_CATALOG, envReport, hasEnv, resolveEnvScope } from '@/server/env';

describe('catálogo de entorno', () => {
  it('no tiene nombres duplicados', () => {
    const names = ENV_CATALOG.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });
  it('los secretos están marcados (DATABASE_URL, AUTH_SECRET, STORAGE_SECRET_ACCESS_KEY)', () => {
    const secret = (n: string) => ENV_CATALOG.find((e) => e.name === n)?.secret;
    expect(secret('DATABASE_URL')).toBe(true);
    expect(secret('AUTH_SECRET')).toBe(true);
    expect(secret('STORAGE_SECRET_ACCESS_KEY')).toBe(true);
    expect(secret('APP_URL')).toBe(false);
  });
});

describe('resolveEnvScope', () => {
  it('respeta APP_ENV cuando está presente', () => {
    const prev = process.env.APP_ENV;
    process.env.APP_ENV = 'staging';
    expect(resolveEnvScope()).toBe('staging');
    process.env.APP_ENV = 'production';
    expect(resolveEnvScope()).toBe('production');
    if (prev === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prev;
  });
});

describe('envReport (sin exponer valores)', () => {
  it('en producción reporta faltantes requeridos (auth/storage/cron secrets)', () => {
    const report = envReport('production');
    // En el entorno de test no hay AUTH_SECRET/STORAGE_*; deben aparecer como faltantes.
    expect(report.ok).toBe(false);
    expect(report.missingRequired).toEqual(
      expect.arrayContaining(['AUTH_SECRET', 'STORAGE_BUCKET', 'CRON_SECRET']),
    );
    // Nunca se exponen valores, solo presencia.
    for (const e of report.entries) {
      expect(Object.keys(e)).toEqual(
        expect.arrayContaining(['name', 'present', 'secret', 'requiredHere', 'usedToday']),
      );
      expect(e).not.toHaveProperty('value');
    }
  });

  it('hasEnv refleja presencia real', () => {
    const prev = process.env.__PLATFORM_TEST__;
    delete process.env.__PLATFORM_TEST__;
    expect(hasEnv('__PLATFORM_TEST__')).toBe(false);
    process.env.__PLATFORM_TEST__ = 'x';
    expect(hasEnv('__PLATFORM_TEST__')).toBe(true);
    if (prev === undefined) delete process.env.__PLATFORM_TEST__;
    else process.env.__PLATFORM_TEST__ = prev;
  });
});
