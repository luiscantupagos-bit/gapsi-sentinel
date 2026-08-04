/**
 * Punto de acceso único al adaptador de autenticación activo.
 *
 * El resto de la aplicación importa `authProvider` desde aquí y nunca conoce
 * el proveedor concreto. Para añadir un proveedor real en el futuro basta con
 * implementar `AuthProvider` y seleccionarlo según `AUTH_PROVIDER`.
 */
import { devAuthProvider } from './dev-provider';
import type { AuthProvider } from './types';

/** Nombre de la cookie de sesión. Debe coincidir con `.env.example`. */
export const SESSION_COOKIE_NAME = process.env.AUTH_SESSION_COOKIE ?? 'gapsi_session';

/** Proveedores de autenticación soportados hoy. Aún no existe uno real. */
export const SUPPORTED_AUTH_PROVIDERS = ['dev'] as const;

/**
 * Resuelve el adaptador de autenticación según `AUTH_PROVIDER`.
 *
 * Reglas:
 * - `dev` o sin definir → adaptador de desarrollo, solo fuera de producción.
 * - El adaptador `dev` NUNCA es válido en producción (es inseguro y simulado).
 * - Cualquier valor desconocido lanza un error claro.
 * - En producción, una configuración inválida (sin definir o desconocida)
 *   siempre falla en lugar de degradar silenciosamente (evita "fail-open").
 *
 * No implementa todavía ningún proveedor real; eso corresponde a una tarea
 * futura que solo deberá añadir su caso aquí.
 */
export function selectProvider(): AuthProvider {
  const configured = process.env.AUTH_PROVIDER;
  const isProduction = process.env.NODE_ENV === 'production';

  if (configured === undefined || configured === 'dev') {
    if (isProduction) {
      throw new Error(
        'Configuración de autenticación inválida: el adaptador "dev" es solo para ' +
          'desarrollo y no puede usarse en producción. Define un AUTH_PROVIDER real.',
      );
    }
    return devAuthProvider;
  }

  throw new Error(
    `Configuración de autenticación inválida: AUTH_PROVIDER="${configured}" no es un ` +
      `proveedor soportado (${SUPPORTED_AUTH_PROVIDERS.join(', ')}).`,
  );
}

/**
 * Resolución diferida y memorizada: `selectProvider()` se ejecuta en el primer
 * uso real (tiempo de request), no al importar el módulo. Así el `build` no
 * evalúa la configuración de producción, pero cualquier request con una
 * configuración inválida en producción falla de inmediato.
 */
let cachedProvider: AuthProvider | null = null;
function resolveProvider(): AuthProvider {
  cachedProvider ??= selectProvider();
  return cachedProvider;
}

export const authProvider: AuthProvider = {
  get name() {
    return resolveProvider().name;
  },
  getSession(rawToken) {
    return resolveProvider().getSession(rawToken);
  },
};

export type { AuthProvider, Session } from './types';
export { encodeDevToken } from './dev-provider';
