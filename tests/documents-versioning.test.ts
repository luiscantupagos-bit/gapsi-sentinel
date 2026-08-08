import { describe, expect, it } from 'vitest';
import {
  nextVersionLabel,
  parseVersionLabel,
  INITIAL_VERSION_LABEL,
} from '@/features/documents/versioning';

describe('parseVersionLabel', () => {
  it('interpreta distintos formatos', () => {
    expect(parseVersionLabel('v1')).toEqual({ major: 1, minor: 0 });
    expect(parseVersionLabel('v1.2')).toEqual({ major: 1, minor: 2 });
    expect(parseVersionLabel('2.3')).toEqual({ major: 2, minor: 3 });
    expect(parseVersionLabel(null)).toEqual({ major: 1, minor: 0 });
    expect(parseVersionLabel('sin número')).toEqual({ major: 1, minor: 0 });
  });
});

describe('nextVersionLabel', () => {
  it('incrementa el menor en un cambio menor', () => {
    expect(nextVersionLabel('v1.0', 'minor')).toBe('v1.1');
    expect(nextVersionLabel('v1', 'minor')).toBe('v1.1');
    expect(nextVersionLabel('v2.7', 'minor')).toBe('v2.8');
  });
  it('incrementa el mayor y reinicia el menor en un cambio mayor', () => {
    expect(nextVersionLabel('v1.4', 'major')).toBe('v2.0');
    expect(nextVersionLabel('v3.0', 'major')).toBe('v4.0');
  });
  it('desde vacío parte de v1', () => {
    expect(nextVersionLabel(null, 'minor')).toBe('v1.1');
    expect(nextVersionLabel(null, 'major')).toBe('v2.0');
  });
  it('la etiqueta inicial es v1.0', () => {
    expect(INITIAL_VERSION_LABEL).toBe('v1.0');
  });
});
