import { describe, expect, it } from 'vitest';
import {
  assertOrganizationAccess,
  OrganizationAccessError,
  scopeToOrganization,
} from '@/features/organizations/scope';

interface Record {
  id: string;
  organizationId: string;
}

const records: Record[] = [
  { id: 'a', organizationId: 'org-1' },
  { id: 'b', organizationId: 'org-2' },
  { id: 'c', organizationId: 'org-1' },
];

describe('scopeToOrganization', () => {
  it('conserva solo los registros de la organización indicada', () => {
    expect(scopeToOrganization(records, 'org-1').map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('devuelve vacío cuando no hay coincidencias', () => {
    expect(scopeToOrganization(records, 'org-3')).toEqual([]);
  });

  it('devuelve vacío ante un organizationId ausente', () => {
    expect(scopeToOrganization(records, '')).toEqual([]);
  });
});

describe('assertOrganizationAccess', () => {
  it('no lanza cuando el recurso pertenece a la organización de la sesión', () => {
    expect(() => assertOrganizationAccess('org-1', 'org-1')).not.toThrow();
  });

  it('lanza al cruzar organizaciones', () => {
    expect(() => assertOrganizationAccess('org-2', 'org-1')).toThrow(OrganizationAccessError);
  });

  it('lanza cuando la sesión no tiene organización', () => {
    expect(() => assertOrganizationAccess('org-1', '')).toThrow(OrganizationAccessError);
  });
});
