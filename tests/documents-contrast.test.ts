import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  hasSufficientContrast,
  readableTextColor,
  DOCUMENT_BACKGROUND,
} from '@/features/documents/contrast';
import { validateDocumentTheme } from '@/features/documents/document-theme';

const okColors = {
  primary: '#0f2440',
  secondary: '#e5e7eb',
  accent: '#2563eb',
};

describe('contraste WCAG (§9-16)', () => {
  it('negro sobre blanco es válido; blanco sobre blanco no', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeGreaterThan(20);
    expect(hasSufficientContrast('#000000', '#ffffff')).toBe(true);
    expect(hasSufficientContrast('#ffffff', '#ffffff')).toBe(false);
  });

  it('near-white sobre blanco es insuficiente (§11)', () => {
    expect(hasSufficientContrast('#f9f9f9', '#ffffff')).toBe(false);
  });

  it('blanco sobre negro es válido', () => {
    expect(hasSufficientContrast('#ffffff', '#000000')).toBe(true);
  });

  it('readableTextColor elige el de mayor contraste (§14.B)', () => {
    expect(readableTextColor('#111827')).toBe('#ffffff'); // fondo oscuro → texto claro
    expect(readableTextColor('#e5e7eb')).toBe('#0f2440'); // fondo claro → texto oscuro
  });
});

describe('validación server-side de contraste del cuerpo (§12/§18)', () => {
  it('acepta texto/encabezado oscuros sobre fondo blanco', () => {
    expect(validateDocumentTheme({ ...okColors, text: '#1f2937', heading: '#0f2440' })).toEqual([]);
  });

  it('rechaza texto blanco (o casi blanco) sobre el fondo del documento', () => {
    const errWhite = validateDocumentTheme({ ...okColors, text: '#ffffff', heading: '#0f2440' });
    expect(errWhite.length).toBeGreaterThan(0);
    expect(errWhite.some((e) => e.includes('contraste con el fondo'))).toBe(true);

    const errNearWhite = validateDocumentTheme({
      ...okColors,
      text: '#f9f9f9',
      heading: '#0f2440',
    });
    expect(errNearWhite.length).toBeGreaterThan(0);
  });

  it('rechaza encabezado sin contraste pero mantiene válido el texto (§14)', () => {
    const errs = validateDocumentTheme({ ...okColors, text: '#1f2937', heading: '#fefefe' });
    expect(errs.some((e) => e.includes('encabezados'))).toBe(true);
    expect(errs.some((e) => e.includes('El color de texto seleccionado'))).toBe(false);
  });

  it('el fondo base del documento es blanco (§16)', () => {
    expect(DOCUMENT_BACKGROUND).toBe('#ffffff');
  });
});
