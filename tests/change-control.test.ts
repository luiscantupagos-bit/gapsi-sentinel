/**
 * DOC-CHANGE-CONTROL-FOLLOWUP — reglas puras del control de cambios y versionado.
 */
import { describe, expect, it } from 'vitest';
import { nextVersionLabel, parseVersionLabel } from '@/features/documents/versioning';
import {
  isFormalVersion,
  isInProgressVersion,
  requiresChangeNotes,
  changeDescription,
  FORMAL_VERSION_STATUSES,
  IN_PROGRESS_VERSION_STATUSES,
} from '@/features/documents/change-control';

describe('versionado major.minor (§18)', () => {
  it('parsea etiquetas', () => {
    expect(parseVersionLabel('v1.0')).toEqual({ major: 1, minor: 0 });
    expect(parseVersionLabel('2.4')).toEqual({ major: 2, minor: 4 });
  });
  it('incremento menor', () => {
    expect(nextVersionLabel('v1.0', 'minor')).toBe('v1.1');
    expect(nextVersionLabel('v1.3', 'minor')).toBe('v1.4');
  });
  it('incremento mayor reinicia el menor', () => {
    expect(nextVersionLabel('v1.0', 'major')).toBe('v2.0');
    expect(nextVersionLabel('v1.3', 'major')).toBe('v2.0');
    expect(nextVersionLabel('v2.4', 'major')).toBe('v3.0');
  });
  it('trata la versión como major.minor, NO como float', () => {
    // v1.9 → menor → v1.10 (minor=10), no "v2.0" ni el float 1.1.
    expect(nextVersionLabel('v1.9', 'minor')).toBe('v1.10');
    expect(parseVersionLabel('v1.10')).toEqual({ major: 1, minor: 10 });
    // 1.10 ≠ 1.1 (si fuera float coincidirían).
    expect(parseVersionLabel('v1.10')).not.toEqual(parseVersionLabel('v1.1'));
  });
});

describe('requiresChangeNotes (§15)', () => {
  it('la v1.0 no requiere descripción; toda versión posterior sí', () => {
    expect(requiresChangeNotes('v1.0')).toBe(false);
    expect(requiresChangeNotes('v1.1')).toBe(true);
    expect(requiresChangeNotes('v2.0')).toBe(true);
    expect(requiresChangeNotes('v3.0')).toBe(true);
  });
});

describe('clasificación de estados de versión', () => {
  it('formales = published/obsolete', () => {
    expect(FORMAL_VERSION_STATUSES).toEqual(['published', 'obsolete']);
    expect(isFormalVersion('published')).toBe(true);
    expect(isFormalVersion('obsolete')).toBe(true);
    expect(isFormalVersion('draft')).toBe(false);
    expect(isFormalVersion('in_review')).toBe(false);
  });
  it('en preparación = draft/en flujo (guard de segundo borrador §19)', () => {
    expect(IN_PROGRESS_VERSION_STATUSES).toContain('draft');
    expect(isInProgressVersion('draft')).toBe(true);
    expect(isInProgressVersion('in_review')).toBe(true);
    expect(isInProgressVersion('approved')).toBe(true);
    expect(isInProgressVersion('published')).toBe(false);
    expect(isInProgressVersion('obsolete')).toBe(false);
  });
});

describe('changeDescription (columna Modificación §21)', () => {
  it('v1.0 sin notas = «Documento nuevo»', () => {
    expect(changeDescription('v1.0', null)).toBe('Documento nuevo');
    expect(changeDescription('v1.0', '  ')).toBe('Documento nuevo');
  });
  it('usa las notas cuando existen', () => {
    expect(changeDescription('v2.0', 'Se incorpora una etapa nueva.')).toBe(
      'Se incorpora una etapa nueva.',
    );
    expect(changeDescription('v1.0', 'Documento inicial de calidad.')).toBe(
      'Documento inicial de calidad.',
    );
  });
  it('versión posterior sin notas queda marcada explícitamente', () => {
    expect(changeDescription('v2.0', null)).toBe('Cambio sin descripción registrada');
  });
});
