/**
 * Configuración del editor documental (TASK-005): fuentes, tamaños y colores.
 * Módulo PURO, compartido por el cliente (barra de herramientas) y el servidor
 * (validación/saneado). Sin dependencias de Node ni de TipTap.
 */

export const EDITOR_FONTS = [
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Calibri', value: 'Calibri, Candara, Segoe, sans-serif' },
  { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Courier New', value: "'Courier New', Courier, monospace" },
] as const;

export const ALLOWED_FONT_VALUES = new Set<string>(EDITOR_FONTS.map((f) => f.value));

export const EDITOR_FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32] as const;
export const ALLOWED_FONT_SIZES = new Set<string>(EDITOR_FONT_SIZES.map((s) => `${s}pt`));

export const EDITOR_COLORS = [
  '#14202b',
  '#55636e',
  '#0e7c66',
  '#1a4f8a',
  '#a11a09',
  '#a5480a',
  '#7a5a00',
  '#14683a',
  '#ffffff',
] as const;

export const TEXT_ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const;
export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];

/** Acepta solo colores CSS seguros: #rgb, #rrggbb o rgb()/rgba() numérico. */
export function isSafeColor(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v) || /^#[0-9a-f]{6}$/.test(v)) return true;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/.test(v)) {
    return true;
  }
  return false;
}
