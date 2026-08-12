// CORE-ALIGN-003 — Parseo y clasificación de datasets (puro, sin dependencias).
//
// CSV/TSV se parsean aquí (comillas, delimitadores, saltos escapados). XLSX se
// convierte a matriz en el servidor con exceljs y luego pasa por estas mismas
// funciones. La clasificación de variables es determinista y ajustable por el
// usuario. Límites del MVP validados en el servidor (20k filas / 100 col / 10MB).

export type VariableType = 'numeric' | 'categorical' | 'temporal' | 'text';

export const VARIABLE_TYPE_LABEL: Record<VariableType, string> = {
  numeric: 'Numérica',
  categorical: 'Categórica',
  temporal: 'Fecha/temporal',
  text: 'Texto',
};

export interface ParsedDataset {
  headers: string[];
  rows: string[][];
}

export const DATASET_LIMITS = { maxRows: 20000, maxColumns: 100, maxBytes: 10 * 1024 * 1024 };

/** Detecta el delimitador más probable en la primera línea no vacía. */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = -1;
  for (const d of candidates) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

/**
 * Parsea texto delimitado a una matriz de celdas. Soporta campos entre comillas
 * dobles con delimitadores, saltos de línea y comillas escapadas ("").
 */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  // Último campo/fila si el archivo no termina en salto de línea.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Descarta filas totalmente vacías.
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/** Parsea CSV con detección de delimitador; la primera fila es el encabezado. */
export function parseCsv(text: string): ParsedDataset {
  return toDataset(parseDelimited(text, detectDelimiter(text)));
}

/** Parsea datos pegados (TSV: separados por tabulador). */
export function parseTsv(text: string): ParsedDataset {
  return toDataset(parseDelimited(text, '\t'));
}

/** Convierte una matriz en dataset (primera fila = encabezados normalizados). */
export function toDataset(matrix: string[][]): ParsedDataset {
  if (matrix.length === 0) return { headers: [], rows: [] };
  const rawHeaders = matrix[0]!;
  const headers = rawHeaders.map((h, i) => {
    const t = (h ?? '').trim();
    return t.length > 0 ? t : `col_${i + 1}`;
  });
  const width = headers.length;
  const rows = matrix.slice(1).map((r) => {
    const cells = r.slice(0, width).map((c) => (c ?? '').trim());
    while (cells.length < width) cells.push('');
    return cells;
  });
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Coerción y clasificación
// ---------------------------------------------------------------------------

/** Convierte una celda a número (admite miles con coma y decimal con punto). */
export function toNumber(value: string): number | null {
  if (value === null || value === undefined) return null;
  const t = value.trim();
  if (t === '') return null;
  // Quita separadores de miles simples; no intenta interpretar formatos locales.
  const cleaned = t.replace(/\s/g, '').replace(/,(?=\d{3}\b)/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Detecta una fecha razonable (ISO o dd/mm/yyyy, dd-mm-yyyy). */
export function toDateISO(value: string): string | null {
  const t = value.trim();
  if (t === '') return null;
  if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(t)) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const [, a, b, y] = m;
    const year = Number(y!.length === 2 ? `20${y}` : y);
    const day = Number(a);
    const month = Number(b);
    if (day > 12 && month <= 12) {
      const d = new Date(Date.UTC(year, month - 1, day));
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }
    // Ambiguo dd/mm vs mm/dd: se asume dd/mm (formato local común).
    const d = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return null;
}

/**
 * Clasifica una columna por sus valores no vacíos. Determinista: numérica si la
 * mayoría son números; temporal si la mayoría son fechas; categórica si la
 * cardinalidad es baja; en otro caso texto.
 */
export function classifyColumn(values: string[]): VariableType {
  const nonEmpty = values.filter((v) => v.trim() !== '');
  if (nonEmpty.length === 0) return 'text';
  const numeric = nonEmpty.filter((v) => toNumber(v) !== null).length;
  const temporal = nonEmpty.filter((v) => toDateISO(v) !== null).length;
  const ratio = (x: number) => x / nonEmpty.length;

  if (ratio(numeric) >= 0.8) return 'numeric';
  if (ratio(temporal) >= 0.8) return 'temporal';
  const distinct = new Set(nonEmpty.map((v) => v.toLowerCase())).size;
  // Baja cardinalidad relativa → categórica.
  if (distinct <= Math.max(2, Math.min(30, Math.ceil(nonEmpty.length * 0.5)))) return 'categorical';
  return 'text';
}

/** Clasifica todas las columnas de un dataset. */
export function classifyDataset(ds: ParsedDataset): VariableType[] {
  return ds.headers.map((_, col) => classifyColumn(ds.rows.map((r) => r[col] ?? '')));
}
