/**
 * Tipos base de organizaciones para el modelo multi-tenant.
 *
 * En TASK-001 solo se define la forma mínima necesaria para el aislamiento por
 * organización. La administración completa de organizaciones queda fuera de
 * alcance (ver docs/tasks/TASK-001.md).
 */

/** Roles iniciales definidos en el Product Brief. */
export const ORG_ROLES = ['owner', 'admin', 'evaluator', 'viewer'] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

export function isOrgRole(value: unknown): value is OrgRole {
  return typeof value === 'string' && (ORG_ROLES as readonly string[]).includes(value);
}

/** Toda entidad de negocio pertenece a exactamente una organización. */
export interface OrganizationScoped {
  organizationId: string;
}

export interface Organization {
  id: string;
  name: string;
}
