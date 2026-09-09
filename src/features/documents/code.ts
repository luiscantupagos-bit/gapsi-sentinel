/**
 * Código automático de documentos (DOC-001 §5/§30). PURO.
 *
 * Formato MVP: `[TIPO]-[ÁREA]-[CONSECUTIVO]` (p. ej. `PR-CA-001`). El prefijo de
 * TIPO viene del registro de plantillas; el ÁREA es un código corto (del catálogo
 * de áreas o escrito por el usuario); el CONSECUTIVO lo reserva el servidor de
 * forma atómica por organización + prefijo + área (ver `document-structured.ts`).
 *
 * El sistema PROPONE el código; el usuario puede editarlo antes de publicar. Si
 * lo edita manualmente, se respeta y NO se regenera al cambiar tipo/área (§30).
 * La unicidad por organización la garantiza la BD (`@@unique`).
 */

/** Longitud máxima de un código (propuesto o personalizado). */
export const CODE_MAX_LENGTH = 40;

/** Dígitos del consecutivo (relleno con ceros). */
export const CODE_SEQ_PADDING = 3;

/** Caracteres permitidos en un código personalizado (mayúsculas, dígitos y `-._/`). */
const CUSTOM_CODE_RE = /^[A-Z0-9][A-Z0-9._/-]*$/;

/** Normaliza un código de área: mayúsculas, solo alfanumérico, 1–4 caracteres. */
export function normalizeAreaCode(raw: string | null | undefined): string {
  return (raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}

/** Formatea el consecutivo con relleno de ceros (p. ej. 1 → `001`). */
export function formatSeq(seq: number): string {
  const n = Number.isFinite(seq) && seq > 0 ? Math.trunc(seq) : 1;
  return String(n).padStart(CODE_SEQ_PADDING, '0');
}

/**
 * Compone el código a partir del prefijo, el área (opcional) y el consecutivo.
 * Sin área válida, el formato colapsa a `[TIPO]-[CONSECUTIVO]`.
 */
export function formatDocumentCode(
  prefix: string,
  areaCode: string | null | undefined,
  seq: number,
): string {
  const area = normalizeAreaCode(areaCode);
  const parts = area ? [prefix, area, formatSeq(seq)] : [prefix, formatSeq(seq)];
  return parts.join('-');
}

/**
 * ¿El código personalizado es válido en forma? (longitud y caracteres). La
 * unicidad se valida por separado en la BD.
 */
export function isValidCustomCode(code: string | null | undefined): boolean {
  const c = (code ?? '').trim();
  if (c.length === 0 || c.length > CODE_MAX_LENGTH) return false;
  return CUSTOM_CODE_RE.test(c);
}

/** Mensaje de error de forma para un código inválido (o `null` si es válido). */
export function codeFormatError(code: string | null | undefined): string | null {
  const c = (code ?? '').trim();
  if (c.length === 0) return 'El código es obligatorio.';
  if (c.length > CODE_MAX_LENGTH)
    return `El código no puede exceder ${CODE_MAX_LENGTH} caracteres.`;
  if (!CUSTOM_CODE_RE.test(c)) {
    return 'El código solo admite mayúsculas, dígitos y los signos - . _ /.';
  }
  return null;
}
