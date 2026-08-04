/**
 * Contrato del adaptador de autenticación.
 *
 * El dominio NO debe acoplarse a un proveedor concreto (Auth0, Clerk, propio,
 * etc.). Todo el resto de la aplicación consume esta interfaz; cambiar de
 * proveedor implica solo escribir un nuevo adaptador (ver TASK-001 y
 * ARCHITECTURE_DECISIONS.md — "proveedor de autenticación" es una decisión
 * aún abierta).
 */
import type { OrgRole } from '@/features/organizations/types';

/** Identidad autenticada asociada a una organización. */
export interface Session {
  userId: string;
  organizationId: string;
  role: OrgRole;
}

export interface AuthProvider {
  /** Identificador del adaptador, útil para diagnóstico. */
  readonly name: string;

  /**
   * Resuelve la sesión a partir del valor crudo de la cookie/token.
   * Devuelve `null` si no hay sesión válida. Debe ser seguro ejecutarlo en el
   * servidor (incluido el edge runtime del middleware).
   */
  getSession(rawToken: string | undefined): Session | null;
}
