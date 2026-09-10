/**
 * Contraste de color WCAG (DOC-UX-003 §9-16). PURO.
 *
 * Fuente única de cálculo de contraste (sin algoritmos paralelos). Se usa para:
 *  - validar server-side que el texto del cuerpo y los encabezados tengan
 *    suficiente contraste contra el fondo del documento (§9/§12);
 *  - elegir el color de texto legible de las cabeceras de tabla (§14.B).
 *
 * Fondo base del documento: por ahora TODOS los diseños (C3 Moderno, Corporativo,
 * Técnico, Minimalista) renderizan sobre fondo claro; el `.doc-render` no fija un
 * background propio. Por eso el fondo base = #FFFFFF. Si un diseño futuro cambia el
 * fondo real, pásalo explícitamente a estas funciones (no está hardcodeado en la
 * validación salvo por este default documentado).
 */
export const DOCUMENT_BACKGROUND = '#ffffff';

/** Umbral WCAG AA para texto normal. */
export const WCAG_AA_NORMAL = 4.5;

function parseHex(hex: string): [number, number, number] | null {
  if (typeof hex !== 'string') return null;
  const h = hex.replace('#', '').trim();
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Luminancia relativa WCAG (0..1). HEX inválido → 0. */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Razón de contraste WCAG entre dos colores (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

/** ¿El texto tiene contraste suficiente contra el fondo? (por defecto WCAG AA). */
export function hasSufficientContrast(
  foreground: string,
  background: string,
  threshold: number = WCAG_AA_NORMAL,
): boolean {
  return contrastRatio(foreground, background) >= threshold;
}

/**
 * Color de texto legible (blanco u oscuro) sobre un fondo dado, eligiendo el de
 * MAYOR contraste (WCAG). Reemplaza la heurística previa por cabeceras de tabla.
 */
export function readableTextColor(background: string): string {
  const dark = '#0f2440';
  const light = '#ffffff';
  return contrastRatio(dark, background) >= contrastRatio(light, background) ? dark : light;
}
