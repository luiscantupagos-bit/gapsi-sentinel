import { afterEach, describe, expect, it } from 'vitest';
import { selectProvider } from '@/features/auth';

// Acceso tipado laxo a process.env para poder mutar y borrar variables en las
// pruebas sin fricción con los tipos estrictos de Node/Next.
const env = process.env as Record<string, string | undefined>;
const original = { NODE_ENV: env.NODE_ENV, AUTH_PROVIDER: env.AUTH_PROVIDER };

function setEnv(nodeEnv: string, authProvider: string | undefined): void {
  env.NODE_ENV = nodeEnv;
  if (authProvider === undefined) {
    delete env.AUTH_PROVIDER;
  } else {
    env.AUTH_PROVIDER = authProvider;
  }
}

afterEach(() => {
  env.NODE_ENV = original.NODE_ENV;
  if (original.AUTH_PROVIDER === undefined) {
    delete env.AUTH_PROVIDER;
  } else {
    env.AUTH_PROVIDER = original.AUTH_PROVIDER;
  }
});

describe('selectProvider', () => {
  it('selecciona el adaptador dev cuando AUTH_PROVIDER=dev en desarrollo', () => {
    setEnv('development', 'dev');
    expect(selectProvider().name).toBe('dev');
  });

  it('usa dev por defecto cuando AUTH_PROVIDER no está definido en desarrollo', () => {
    setEnv('development', undefined);
    expect(selectProvider().name).toBe('dev');
  });

  it('lanza un error claro ante un proveedor desconocido', () => {
    setEnv('development', 'auth0');
    expect(() => selectProvider()).toThrow(/no es un proveedor soportado/i);
  });

  it('falla en producción cuando AUTH_PROVIDER no está definido', () => {
    setEnv('production', undefined);
    expect(() => selectProvider()).toThrow(/producción/i);
  });

  it('rechaza el adaptador dev en producción (no hace fail-open)', () => {
    setEnv('production', 'dev');
    expect(() => selectProvider()).toThrow(/producción/i);
  });

  it('rechaza un proveedor desconocido también en producción', () => {
    setEnv('production', 'loquesea');
    expect(() => selectProvider()).toThrow(/no es un proveedor soportado/i);
  });
});
