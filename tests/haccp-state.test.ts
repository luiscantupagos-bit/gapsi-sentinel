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
  HACCP_TAB_NUMBER,
  HACCP_TAB_GROUPS,
  HACCP_FUTURE_TABS,
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

describe('WORKSPACE-REORG — 12 pasos HACCP', () => {
  it('exactamente 12 pestañas principales en el orden metodológico', () => {
    expect(HACCP_TABS).toHaveLength(12);
    expect([...HACCP_TABS]).toEqual([
      'team',
      'product',
      'intended-use',
      'flow',
      'onsite-confirmation',
      'hazards',
      'ccp',
      'limits',
      'monitoring',
      'corrective-actions',
      'validation-verification',
      'records',
    ]);
    expect(HACCP_FUTURE_TABS).toHaveLength(0);
  });
  it('5 pasos preliminares (1-5) + 7 principios (6-12) con numeración', () => {
    expect(HACCP_TAB_GROUPS).toHaveLength(2);
    expect(HACCP_TAB_GROUPS[0]!.title).toBe('Pasos preliminares');
    expect(HACCP_TAB_GROUPS[0]!.tabs).toHaveLength(5);
    expect(HACCP_TAB_GROUPS[1]!.title).toBe('Principios HACCP');
    expect(HACCP_TAB_GROUPS[1]!.tabs).toHaveLength(7);
    expect(HACCP_TAB_NUMBER.flow).toBe(4);
    expect(HACCP_TAB_NUMBER['onsite-confirmation']).toBe(5);
    expect(HACCP_TAB_NUMBER.hazards).toBe(6);
    expect(HACCP_TAB_NUMBER.records).toBe(12);
  });
  it('etiquetas metodológicas', () => {
    expect(HACCP_TAB_LABEL.flow).toBe('Diagrama de flujo');
    expect(HACCP_TAB_LABEL['onsite-confirmation']).toBe('Confirmación in situ');
    expect(HACCP_TAB_LABEL.ccp).toBe('Determinación de PCC');
    expect(HACCP_TAB_LABEL['validation-verification']).toBe('Validación y verificación');
    expect(HACCP_TAB_LABEL.records).toBe('Registros y documentación');
  });
  it('«Proceso», «Resumen», «PPR», «Documentos» ya no son pestañas principales', () => {
    expect(HACCP_TABS as readonly string[]).not.toContain('flujo');
    expect(HACCP_TABS as readonly string[]).not.toContain('resumen');
    expect(HACCP_TABS as readonly string[]).not.toContain('ppr');
    expect(HACCP_TABS as readonly string[]).not.toContain('documentos');
    expect(HACCP_TABS as readonly string[]).not.toContain('medidas');
  });
  it('deep links antiguos mapean a la nueva pestaña (backward compat)', () => {
    expect(resolveTab('producto')).toBe('product');
    expect(resolveTab('materias')).toBe('product');
    expect(resolveTab('flujo')).toBe('flow');
    expect(resolveTab('peligros')).toBe('hazards');
    expect(resolveTab('medidas')).toBe('ccp');
    expect(resolveTab('ppr')).toBe('hazards');
    expect(resolveTab('documentos')).toBe('records');
    expect(resolveTab('validacion')).toBe('validation-verification');
    expect(resolveTab('verificacion')).toBe('validation-verification');
    expect(resolveTab('resumen')).toBe('team');
  });
  it('resolveTab valida y cae a la primera pestaña (team)', () => {
    expect(resolveTab('hazards')).toBe('hazards');
    expect(resolveTab('inexistente')).toBe('team');
    expect(resolveTab(undefined)).toBe('team');
  });
});
