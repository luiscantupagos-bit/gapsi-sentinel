/**
 * Tema documental por organización (DOC-UX-001 §18-24). PURO.
 *
 * Solo colores HEX validados (`#RGB` o `#RRGGBB`); nunca CSS arbitrario (§22).
 * Se aplica con moderación al RENDER de documentos (encabezados, títulos,
 * cabeceras de tabla, acentos), no al tema global de la app.
 */
import type { DocumentTheme } from './structured-render';

export type { DocumentTheme };

/** Paleta neutra/azul de C3 Sentinel (fallback §21). */
export const DEFAULT_DOCUMENT_THEME: DocumentTheme = {
  primary: '#0f2440',
  secondary: '#e3e8ef',
  accent: '#2563eb',
  text: '#1f2937',
  heading: '#0f2440',
};

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_RE.test(value.trim());
}

/** Normaliza un color a HEX en minúsculas, o el fallback si es inválido. */
function normalizeHex(value: unknown, fallback: string): string {
  return isHexColor(value) ? (value as string).trim().toLowerCase() : fallback;
}

/** Sanea un tema (allowlist HEX). Devuelve siempre un tema válido. */
export function sanitizeDocumentTheme(input: unknown): DocumentTheme {
  const t = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  return {
    primary: normalizeHex(t.primary, DEFAULT_DOCUMENT_THEME.primary),
    secondary: normalizeHex(t.secondary, DEFAULT_DOCUMENT_THEME.secondary),
    accent: normalizeHex(t.accent, DEFAULT_DOCUMENT_THEME.accent),
    text: normalizeHex(t.text, DEFAULT_DOCUMENT_THEME.text),
    heading: normalizeHex(t.heading, DEFAULT_DOCUMENT_THEME.heading),
  };
}

/** Valida un tema para guardar. Mensajes en español (vacío = válido). */
export function validateDocumentTheme(input: unknown): string[] {
  const t = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const check = (v: unknown, label: string) => {
    if (!isHexColor(v)) errors.push(`El color ${label} debe ser un HEX válido (p. ej. #005BAA).`);
  };
  check(t.primary, 'principal');
  check(t.secondary, 'secundario');
  check(t.accent, 'de acento');
  check(t.text, 'del texto');
  check(t.heading, 'del texto en encabezados');
  return errors;
}
