/**
 * Cálculo de fechas documentales (DOC-001 §8). PURO, en fechas ISO `YYYY-MM-DD`.
 *
 * - Emisión: por defecto la fecha de publicación/aprobación (la resuelve el
 *   servidor); ajustable con permiso.
 * - Próxima revisión: por defecto emisión + periodo de revisión. El periodo es
 *   configurable (6, 12, 24 meses, personalizado, o sin fecha fija). El valor por
 *   defecto (12) NO se codifica aquí: lo aporta el registro de plantillas.
 */

/** Periodos de revisión ofrecidos en la UI (meses). `null` = sin fecha fija. */
export const REVIEW_PERIODS: { value: string; label: string; months: number | null }[] = [
  { value: '6', label: '6 meses', months: 6 },
  { value: '12', label: '12 meses', months: 12 },
  { value: '24', label: '24 meses', months: 24 },
  { value: 'none', label: 'Sin fecha fija', months: null },
];

function isValidIsoDate(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso + 'T00:00:00Z'));
}

/**
 * Suma `months` meses a una fecha ISO, ajustando el día si el mes destino es más
 * corto (p. ej. 31 ene + 1 mes → 28/29 feb). Devuelve ISO `YYYY-MM-DD`.
 */
export function addMonthsIso(iso: string, months: number): string | null {
  if (!isValidIsoDate(iso) || !Number.isFinite(months)) return null;
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const base = new Date(Date.UTC(y, m - 1, d));
  const targetMonthIndex = base.getUTCMonth() + Math.trunc(months);
  const targetYear = base.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  const result = new Date(Date.UTC(targetYear, normalizedMonth, day));
  return result.toISOString().slice(0, 10);
}

/**
 * Próxima revisión = emisión + `months`. Si no hay emisión o el periodo es `null`
 * (sin fecha fija), devuelve `null`.
 */
export function computeNextReviewAt(
  issuedAt: string | null | undefined,
  months: number | null,
): string | null {
  if (!issuedAt || !isValidIsoDate(issuedAt) || months === null) return null;
  return addMonthsIso(issuedAt, months);
}

/** Resuelve el número de meses de un valor de periodo (`'6'|'12'|'24'|'none'`). */
export function reviewMonthsOf(periodValue: string, fallback: number | null): number | null {
  const found = REVIEW_PERIODS.find((p) => p.value === periodValue);
  if (found) return found.months;
  const n = Number(periodValue);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}
