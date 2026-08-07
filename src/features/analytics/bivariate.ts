// TASK-011 — Selección y despacho de análisis bivariado (puro).
//
// Extrae variables del dataset unificado y elige la prueba adecuada según el tipo
// de cada variable, con lenguaje prudente (nunca causal). num↔num → Pearson +
// Spearman + regresión; cat↔cat → contingencia/chi²; cat↔num → ANOVA. Siempre en
// servidor, determinista y auditable.

import type { UnifiedEvent } from './unified-events';
import type { MetricField, DimensionField } from './kpi-engine';
import {
  contingencyChiSquare,
  linearRegression,
  oneWayAnova,
  pearson,
  spearman,
  type AnovaResult,
  type ContingencyResult,
  type CorrelationResult,
  type RegressionResult,
} from './statistics';

export const NUMERIC_VARIABLES: { field: MetricField; label: string }[] = [
  { field: 'cost', label: 'Costo' },
  { field: 'quantityAffected', label: 'Cantidad afectada' },
  { field: 'unitsProduced', label: 'Unidades producidas' },
  { field: 'durationHours', label: 'Duración (h)' },
  { field: 'npr', label: 'NPR (AMEF)' },
];

export const CATEGORICAL_VARIABLES: { field: DimensionField; label: string }[] = [
  { field: 'source', label: 'Origen' },
  { field: 'eventType', label: 'Tipo de evento' },
  { field: 'category', label: 'Categoría' },
  { field: 'status', label: 'Estado' },
  { field: 'severity', label: 'Severidad' },
  { field: 'area', label: 'Área' },
  { field: 'process', label: 'Proceso' },
  { field: 'product', label: 'Producto' },
  { field: 'machine', label: 'Máquina' },
  { field: 'shift', label: 'Turno' },
  { field: 'supplier', label: 'Proveedor' },
];

export type VariableKind = 'numeric' | 'categorical';

export interface VariableRef {
  kind: VariableKind;
  field: string;
  label: string;
}

function numericOf(ev: UnifiedEvent, field: MetricField): number | null {
  const v = ev[field];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function categoryOf(ev: UnifiedEvent, field: DimensionField): string | null {
  const v = ev[field];
  return v === null || v === undefined || v === '' ? null : String(v);
}

export type BivariateResult =
  | {
      kind: 'numeric-numeric';
      pearson: CorrelationResult;
      spearman: CorrelationResult;
      regression: RegressionResult;
    }
  | { kind: 'categorical-categorical'; contingency: ContingencyResult }
  | {
      kind: 'categorical-numeric';
      anova: AnovaResult;
      groups: { label: string; values: number[] }[];
    }
  | { kind: 'unsupported'; message: string };

/** Ejecuta el análisis bivariado apropiado según los tipos de x e y. */
export function runBivariate(
  events: UnifiedEvent[],
  x: VariableRef,
  y: VariableRef,
): BivariateResult {
  if (x.kind === 'numeric' && y.kind === 'numeric') {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const ev of events) {
      const xv = numericOf(ev, x.field as MetricField);
      const yv = numericOf(ev, y.field as MetricField);
      if (xv !== null && yv !== null) {
        xs.push(xv);
        ys.push(yv);
      }
    }
    return {
      kind: 'numeric-numeric',
      pearson: pearson(xs, ys),
      spearman: spearman(xs, ys),
      regression: linearRegression(xs, ys),
    };
  }

  if (x.kind === 'categorical' && y.kind === 'categorical') {
    const a: string[] = [];
    const b: string[] = [];
    for (const ev of events) {
      const av = categoryOf(ev, x.field as DimensionField);
      const bv = categoryOf(ev, y.field as DimensionField);
      if (av !== null && bv !== null) {
        a.push(av);
        b.push(bv);
      }
    }
    return { kind: 'categorical-categorical', contingency: contingencyChiSquare(a, b) };
  }

  // Uno categórico y uno numérico → ANOVA (numérico como respuesta).
  const catRef = x.kind === 'categorical' ? x : y;
  const numRef = x.kind === 'numeric' ? x : y;
  const grouped = new Map<string, number[]>();
  for (const ev of events) {
    const cat = categoryOf(ev, catRef.field as DimensionField);
    const num = numericOf(ev, numRef.field as MetricField);
    if (cat !== null && num !== null) {
      const arr = grouped.get(cat) ?? [];
      arr.push(num);
      grouped.set(cat, arr);
    }
  }
  const groups = [...grouped.entries()].map(([label, values]) => ({ label, values }));
  return { kind: 'categorical-numeric', anova: oneWayAnova(groups), groups };
}

export function resolveVariable(field: string): VariableRef | null {
  const num = NUMERIC_VARIABLES.find((v) => v.field === field);
  if (num) return { kind: 'numeric', field: num.field, label: num.label };
  const cat = CATEGORICAL_VARIABLES.find((v) => v.field === field);
  if (cat) return { kind: 'categorical', field: cat.field, label: cat.label };
  return null;
}
