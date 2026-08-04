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

function selectProvider(): AuthProvider {
  const configured = process.env.AUTH_PROVIDER ?? 'dev';
  switch (configured) {
    case 'dev':
      return devAuthProvider;
    default:
      // Falla de forma segura hacia el adaptador de desarrollo en local.
      // Un proveedor real se agregará con su propia tarea aprobada.
      return devAuthProvider;
  }
}

export const authProvider: AuthProvider = selectProvider();

export type { AuthProvider, Session } from './types';
export { encodeDevToken } from './dev-provider';
