// CORE-ALIGN-003 — Calidad de datos de un dataset de estudio (puro).
//
// Reporta —sin corregir ni eliminar— filas/columnas, faltantes, duplicados,
// valores no numéricos en columnas numéricas, cardinalidad, rango y posibles
// atípicos (regla descriptiva de rango intercuartílico). El usuario decide qué
// excluir; nada se altera automáticamente.

import { toNumber, type VariableType } from './dataset';

export interface ColumnQuality {
  key: string;
  label: string;
  type: VariableType;
  missing: number;
  nonNumeric: number; // valores no numéricos en columnas numéricas
  distinct: number;
  min: number | null;
  max: number | null;
  outliers: number; // posibles atípicos (solo numéricas), regla 1.5·IQR
}

export interface DatasetQualityReport {
  rowCount: number;
  columnCount: number;
  duplicateRows: number;
  totalMissing: number;
  columns: ColumnQuality[];
}

function quartile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const lo = sorted[base]!;
  const hi = sorted[base + 1] ?? lo;
  return lo + (hi - lo) * rest;
}

export interface QualityInput {
  columns: { key: string; label: string; type: VariableType }[];
  rows: string[][];
}

/** Genera el reporte de calidad de datos. */
export function analyzeDatasetQuality(input: QualityInput): DatasetQualityReport {
  const { columns, rows } = input;
  const columnQuality: ColumnQuality[] = columns.map((col, idx) => {
    const raw = rows.map((r) => (r[idx] ?? '').trim());
    const nonEmpty = raw.filter((v) => v !== '');
    const missing = raw.length - nonEmpty.length;
    const distinct = new Set(nonEmpty).size;

    let nonNumeric = 0;
    let min: number | null = null;
    let max: number | null = null;
    let outliers = 0;

    if (col.type === 'numeric') {
      const nums: number[] = [];
      for (const v of nonEmpty) {
        const n = toNumber(v);
        if (n === null) nonNumeric += 1;
        else nums.push(n);
      }
      if (nums.length > 0) {
        min = Math.min(...nums);
        max = Math.max(...nums);
        if (nums.length >= 4) {
          const sorted = [...nums].sort((a, b) => a - b);
          const q1 = quartile(sorted, 0.25);
          const q3 = quartile(sorted, 0.75);
          const iqr = q3 - q1;
          const lo = q1 - 1.5 * iqr;
          const hi = q3 + 1.5 * iqr;
          outliers = nums.filter((n) => n < lo || n > hi).length;
        }
      }
    }

    return {
      key: col.key,
      label: col.label,
      type: col.type,
      missing,
      nonNumeric,
      distinct,
      min,
      max,
      outliers,
    };
  });

  // Filas duplicadas exactas.
  const seen = new Set<string>();
  let duplicateRows = 0;
  for (const r of rows) {
    const k = r.join('');
    if (seen.has(k)) duplicateRows += 1;
    else seen.add(k);
  }

  return {
    rowCount: rows.length,
    columnCount: columns.length,
    duplicateRows,
    totalMissing: columnQuality.reduce((acc, c) => acc + c.missing, 0),
    columns: columnQuality,
  };
}
