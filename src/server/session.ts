/**
 * Acceso a la sesión desde componentes de servidor y route handlers.
 *
 * Reexpone el adaptador de autenticación leyendo la cookie del request. Es una
 * segunda capa de validación en servidor: el middleware protege el enrutado y
 * estas funciones protegen la lógica de datos.
 */
import { cookies } from 'next/headers';
import { authProvider, SESSION_COOKIE_NAME, type Session } from '@/features/auth';

/** Devuelve la sesión actual o `null` si el usuario es anónimo. */
export async function getServerSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return authProvider.getSession(token);
}

/** Devuelve la sesión o lanza si no hay una. Útil en áreas ya protegidas. */
export async function requireServerSession(): Promise<Session> {
  const session = await getServerSession();
  if (!session) {
    throw new Error('No hay sesión activa.');
  }
  return session;
}
