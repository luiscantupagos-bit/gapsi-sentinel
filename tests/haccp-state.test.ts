/**
 * HACCP-001 — helpers PUROS del módulo HACCP (estados, versionado, detección de
 * actualización, validación de publicación, tabs). §57.
 */
import { describe, expect, it } from 'vitest';
import {
  HACCP_PLAN_STATUS_LABEL,
  HACCP_VERSION_STATUS_LABEL,
  HACCP_REFERENCE_KIND_LABEL,
  HACCP_TABS,
  HACCP_TAB_LABEL,
  isVersionEditable,
  resolveTab,
  hasSourceUpdate,
  validateHaccpPublish,
} from '@/features/haccp/haccp-state';
import { nextVersionLabel, parseVersionLabel } from '@/features/documents/versioning';

describe('estados y etiquetas', () => {
  it('etiquetas de estado del plan en español', () => {
    expect(HACCP_PLAN_STATUS_LABEL.draft).toBe('Borrador');
    expect(HACCP_PLAN_STATUS_LABEL.published).toBe('Vigente');
    expect(HACCP_PLAN_STATUS_LABEL.reevaluation_required).toBe('Reevaluación requerida');
    expect(HACCP_PLAN_STATUS_LABEL.obsolete).toBe('Obsoleto');
  });
  it('etiquetas de tipo de referencia', () => {
    expect(HACCP_REFERENCE_KIND_LABEL.product).toBe('Producto terminado');
    expect(HACCP_REFERENCE_KIND_LABEL.material).toBe('Materia prima');
    expect(HACCP_REFERENCE_KIND_LABEL.prerequisite).toBe('Prerrequisito (PPR)');
    expect(HACCP_REFERENCE_KIND_LABEL.document).toBe('Documento soporte');
  });
  it('solo borrador/en revisión es editable (publicado/obsoleto inmutable)', () => {
    expect(isVersionEditable('draft')).toBe(true);
    expect(isVersionEditable('in_review')).toBe(true);
    expect(isVersionEditable('published')).toBe(false);
    expect(isVersionEditable('obsolete')).toBe(false);
    expect(HACCP_VERSION_STATUS_LABEL.published).toBe('Vigente');
  });
});

describe('versionado (major/minor, sin float)', () => {
  it('inicial v1.0; menor 1.0→1.1; mayor 1.1→2.0', () => {
    expect(nextVersionLabel('v1.0', 'minor')).toBe('v1.1');
    expect(nextVersionLabel('v1.1', 'major')).toBe('v2.0');
    expect(parseVersionLabel('v2.3')).toEqual({ major: 2, minor: 3 });
    // no usa float: 1.9 → 1.10 (no 2.0)
    expect(nextVersionLabel('v1.9', 'minor')).toBe('v1.10');
  });
});

describe('detección de actualización de fuente (§25)', () => {
  it('marca actualización solo si la versión usada difiere de la publicada más reciente', () => {
    expect(hasSourceUpdate({ usedVersionId: 'a', latestPublishedVersionId: 'b' })).toBe(true);
    expect(hasSourceUpdate({ usedVersionId: 'a', latestPublishedVersionId: 'a' })).toBe(false);
    // sin datos → no marca
    expect(hasSourceUpdate({ usedVersionId: null, latestPublishedVersionId: 'b' })).toBe(false);
    expect(hasSourceUpdate({ usedVersionId: 'a', latestPublishedVersionId: null })).toBe(false);
  });
});

describe('validación de publicación (§35)', () => {
  const ok = {
    title: 'Plan',
    scope: 'Alcance',
    responsibleUserId: 'u1',
    productProcess: 'Huevo',
    hasTeam: true,
    hasLeader: true,
  };
  it('sin errores cuando todo está completo', () => {
    expect(validateHaccpPublish(ok)).toEqual([]);
  });
  it('exige nombre, alcance, responsable, producto/proceso, equipo con líder', () => {
    expect(validateHaccpPublish({ ...ok, title: '' })).toContain(
      'El nombre del plan es obligatorio.',
    );
    expect(validateHaccpPublish({ ...ok, scope: '  ' }).length).toBe(1);
    expect(validateHaccpPublish({ ...ok, responsibleUserId: null }).length).toBe(1);
    expect(validateHaccpPublish({ ...ok, productProcess: null }).length).toBe(1);
    expect(validateHaccpPublish({ ...ok, hasTeam: false, hasLeader: false }).length).toBe(2);
  });
});

describe('tabs', () => {
  it('7 tabs con etiquetas (incluye Diagrama de flujo)', () => {
    expect(HACCP_TABS).toHaveLength(7);
    expect(HACCP_TAB_LABEL.resumen).toBe('Resumen');
    expect(HACCP_TAB_LABEL.equipo).toBe('Equipo HACCP');
    expect(HACCP_TAB_LABEL.flujo).toBe('Diagrama de flujo');
  });
  it('resolveTab valida y cae a resumen', () => {
    expect(resolveTab('ppr')).toBe('ppr');
    expect(resolveTab('inexistente')).toBe('resumen');
    expect(resolveTab(undefined)).toBe('resumen');
  });
});
