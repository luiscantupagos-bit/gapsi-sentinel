/**
 * Formato de fecha documental por organización (DOC-UX-003 §9). PURO.
 *
 * El render documental y las salidas muestran las fechas con el formato elegido
 * por la organización; por defecto **DD/MM/AAAA**. Determinista, sin locale ni
 * dependencias. La entrada es una fecha ISO `YYYY-MM-DD` (o con hora); se toman
 * solo los 10 primeros caracteres.
 */
export const DATE_FORMATS = ['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const DEFAULT_DATE_FORMAT: DateFormat = 'DD/MM/YYYY';

export const DATE_FORMAT_LABEL: Record<DateFormat, string> = {
  'DD/MM/YYYY': 'DD/MM/AAAA (31/12/2026)',
  'YYYY-MM-DD': 'AAAA-MM-DD (2026-12-31)',
  'MM/DD/YYYY': 'MM/DD/AAAA (12/31/2026)',
};

export function isValidDateFormat(value: unknown): value is DateFormat {
  return typeof value === 'string' && (DATE_FORMATS as readonly string[]).includes(value);
}

export function sanitizeDateFormat(value: unknown): DateFormat {
  return isValidDateFormat(value) ? value : DEFAULT_DATE_FORMAT;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Formatea una fecha ISO (`YYYY-MM-DD`) al formato pedido. Si la entrada es nula o
 * no parseable, devuelve `null` (o la cadena original si tenía algo pero no era
 * ISO, para no perder información).
 */
export function formatIsoDate(
  iso: string | null | undefined,
  format: DateFormat = DEFAULT_DATE_FORMAT,
): string | null {
  if (!iso) return null;
  const m = ISO_RE.exec(iso);
  if (!m) return iso;
  const [, yyyy, mm, dd] = m;
  switch (format) {
    case 'YYYY-MM-DD':
      return `${yyyy}-${mm}-${dd}`;
    case 'MM/DD/YYYY':
      return `${mm}/${dd}/${yyyy}`;
    case 'DD/MM/YYYY':
    default:
      return `${dd}/${mm}/${yyyy}`;
  }
}
