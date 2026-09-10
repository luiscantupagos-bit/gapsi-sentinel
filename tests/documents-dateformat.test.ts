import { describe, expect, it } from 'vitest';
import {
  formatIsoDate,
  sanitizeDateFormat,
  DEFAULT_DATE_FORMAT,
  isValidDateFormat,
} from '@/features/documents/date-format';
import { sanitizeStructuredContent } from '@/features/documents/structured-content';
import { renderStructuredHtml } from '@/features/documents/structured-render';

const identity = {
  organizationName: 'Alimentos Demo',
  typeLabel: 'Procedimiento',
  code: 'PR-CA-001',
  versionLabel: 'v1.0',
  title: 'Control de PNC',
  areaLabel: 'Calidad',
};
const proc = sanitizeStructuredContent('procedure', {
  fields: { objetivo: 'O', alcance: 'A' },
  repeatables: {},
});

describe('formato de fecha documental (§9)', () => {
  it('el formato por defecto es DD/MM/AAAA', () => {
    expect(DEFAULT_DATE_FORMAT).toBe('DD/MM/YYYY');
    expect(formatIsoDate('2026-12-31')).toBe('31/12/2026');
  });

  it('formatea en los tres formatos soportados', () => {
    expect(formatIsoDate('2026-12-31', 'DD/MM/YYYY')).toBe('31/12/2026');
    expect(formatIsoDate('2026-12-31', 'YYYY-MM-DD')).toBe('2026-12-31');
    expect(formatIsoDate('2026-12-31', 'MM/DD/YYYY')).toBe('12/31/2026');
  });

  it('tolera nulos y cadenas no ISO', () => {
    expect(formatIsoDate(null)).toBeNull();
    expect(formatIsoDate('')).toBeNull();
    expect(formatIsoDate('no-fecha')).toBe('no-fecha');
    // Acepta ISO con hora (toma la fecha).
    expect(formatIsoDate('2026-01-05T10:00:00Z', 'DD/MM/YYYY')).toBe('05/01/2026');
  });

  it('valida y sanea el formato con fallback al default', () => {
    expect(isValidDateFormat('DD/MM/YYYY')).toBe(true);
    expect(isValidDateFormat('raro')).toBe(false);
    expect(sanitizeDateFormat('MM/DD/YYYY')).toBe('MM/DD/YYYY');
    expect(sanitizeDateFormat('inventado')).toBe(DEFAULT_DATE_FORMAT);
  });
});

describe('contraste de cabeceras de tabla (§10)', () => {
  const render = (secondary: string) =>
    renderStructuredHtml('procedure', proc, identity, {
      theme: {
        primary: '#0f2440',
        secondary,
        accent: '#2563eb',
        text: '#1f2937',
        heading: '#0f2440',
      },
    });

  it('un color secundario OSCURO usa texto blanco', () => {
    expect(render('#111827')).toContain('--doc-table-head-text:#ffffff');
  });

  it('un color secundario CLARO usa texto oscuro', () => {
    expect(render('#e5e7eb')).toContain('--doc-table-head-text:#0f2440');
  });
});
