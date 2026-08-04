/**
 * Adaptador de autenticación para DESARROLLO LOCAL.
 *
 * ⚠️ No es un proveedor real ni apto para producción. Simula una sesión
 * codificando su contenido en base64 dentro de una cookie. Su único propósito
 * en TASK-001 es demostrar el flujo de ruta pública vs. ruta protegida sin
 * contratar ni configurar un servicio externo.
 *
 * Usa `btoa`/`atob` (disponibles tanto en Node como en el edge runtime del
 * middleware) en lugar de `Buffer`, que no existe en el edge runtime.
 */
import { isOrgRole } from '@/features/organizations/types';
import type { AuthProvider, Session } from './types';

export function encodeDevToken(session: Session): string {
  return btoa(JSON.stringify(session));
}

function decodeDevSession(rawToken: string | undefined): Session | null {
  if (!rawToken) return null;
  try {
    const parsed: unknown = JSON.parse(atob(rawToken));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'userId' in parsed &&
      'organizationId' in parsed &&
      'role' in parsed &&
      typeof (parsed as Record<string, unknown>).userId === 'string' &&
      typeof (parsed as Record<string, unknown>).organizationId === 'string' &&
      isOrgRole((parsed as Record<string, unknown>).role)
    ) {
      const record = parsed as Record<string, unknown>;
      return {
        userId: record.userId as string,
        organizationId: record.organizationId as string,
        role: record.role as Session['role'],
      };
    }
    return null;
  } catch {
    return null;
  }
}

export const devAuthProvider: AuthProvider = {
  name: 'dev',
  getSession(rawToken) {
    return decodeDevSession(rawToken);
  },
};
