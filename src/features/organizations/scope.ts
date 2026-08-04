/**
 * Utilidades puras para el aislamiento por organización (multi-tenancy).
 *
 * Estas funciones no dependen de UI ni de base de datos. Son la base sobre la
 * que se construirá el acceso a datos de forma que SIEMPRE se filtre por
 * `organization_id` (ver AGENTS.md y ARCHITECTURE_DECISIONS.md).
 */
import type { OrganizationScoped } from './types';

/** Error lanzado cuando un recurso no pertenece a la organización de la sesión. */
export class OrganizationAccessError extends Error {
  constructor(message = 'Acceso denegado: el recurso pertenece a otra organización.') {
    super(message);
    this.name = 'OrganizationAccessError';
  }
}

/**
 * Filtra una colección para conservar únicamente los registros de la
 * organización indicada. Nunca confía en un `organizationId` provisto por el
 * cliente para el recurso: siempre se compara contra el de la sesión.
 */
export function scopeToOrganization<T extends OrganizationScoped>(
  records: readonly T[],
  organizationId: string,
): T[] {
  if (!organizationId) return [];
  return records.filter((record) => record.organizationId === organizationId);
}

/**
 * Verifica que un recurso pertenezca a la organización de la sesión.
 * Lanza `OrganizationAccessError` en caso contrario.
 */
export function assertOrganizationAccess(
  resourceOrganizationId: string,
  sessionOrganizationId: string,
): void {
  if (!sessionOrganizationId || resourceOrganizationId !== sessionOrganizationId) {
    throw new OrganizationAccessError();
  }
}
