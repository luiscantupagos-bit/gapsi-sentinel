// TASK-011 — Pareto automático y tendencias temporales (puro).
//
// Reutiliza `computePareto`/`paretoInsights` (TASK-007) para el 80/20 y añade:
//   • Agrupación de eventos unificados por dimensión con peso configurable
//     (frecuencia, costo, cantidad afectada o duración).
//   • Tendencia temporal determinista: serie por periodo + pendiente por mínimos
//     cuadrados + dirección (incremento/decremento/estable) y cambio porcentual.
//
// Interpretación prudente: una tendencia o un grupo vital señalan DÓNDE mirar; no
// afirman causa. Sin predicción ni IA.

import {
  computePareto,
  paretoInsights,
  type ParetoInput,
  type ParetoResult,
  type ParetoInsights,
} from '@/features/capa/analysis-state';
import {
  computeKpi,
  round,
  safeDivide,
  type KpiConfig,
  type KpiPeriod,
  type DimensionField,
} from './kpi-engine';
import type { UnifiedEvent } from './unified-events';

export type ParetoWeight = 'frequency' | 'cost' | 'quantity' | 'duration';

const WEIGHT_FIELD: Record<
  Exclude<ParetoWeight, 'frequency'>,
  'cost' | 'quantityAffected' | 'durationHours'
> = {
  cost: 'cost',
  quantity: 'quantityAffected',
  duration: 'durationHours',
};

function dimValue(ev: UnifiedEvent, field: DimensionField): string {
  const v = ev[field];
  return v === null || v === undefined || v === '' ? 'Sin clasificar' : String(v);
}

export interface ParetoByDimension {
  dimension: DimensionField;
  weight: ParetoWeight;
  result: ParetoResult;
  insights: ParetoInsights | null;
}

/** Agrupa eventos por una dimensión y calcula el Pareto con el peso elegido. */
export function paretoByDimension(
  events: UnifiedEvent[],
  dimension: DimensionField,
  weight: ParetoWeight = 'frequency',
  cutoff = 80,
): ParetoByDimension {
  const groups = new Map<string, { count: number; weight: number }>();
  for (const ev of events) {
    const key = dimValue(ev, dimension);
    const g = groups.get(key) ?? { count: 0, weight: 0 };
    g.count += 1;
    if (weight !== 'frequency') {
      const field = WEIGHT_FIELD[weight];
      const v = ev[field];
      if (typeof v === 'number' && Number.isFinite(v)) g.weight += v;
    }
    groups.set(key, g);
  }

  const items: ParetoInput[] = [...groups.entries()].map(([category, g]) => ({
    category,
    count: g.count,
    cost: weight === 'frequency' ? null : g.weight,
  }));

  const result = computePareto(items, {
    valueKey: weight === 'frequency' ? 'count' : 'cost',
    cutoff,
  });
  return { dimension, weight, result, insights: paretoInsights(result) };
}

export type TrendDirection = 'increasing' | 'decreasing' | 'stable' | 'insufficient';

export interface TrendPoint {
  label: string;
  value: number;
}

export interface TrendResult {
  period: KpiPeriod;
  points: TrendPoint[];
  slope: number | null;
  direction: TrendDirection;
  first: number | null;
  last: number | null;
  absoluteChange: number | null;
  percentChange: number | null;
}

/** Pendiente por mínimos cuadrados de y sobre el índice de periodo (0,1,2,...). */
export function leastSquaresSlope(values: number[]): number | null {
  const n = values.length;
  if (n < 2) return null;
  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i]! - meanX) * (values[i]! - meanY);
    den += (xs[i]! - meanX) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}

/**
 * Calcula la tendencia temporal de una medida. La dirección se decide con un
 * umbral relativo a la media (5 %) para no exagerar variaciones pequeñas.
 */
export function computeTrend(events: UnifiedEvent[], config: KpiConfig): TrendResult {
  const kpi = computeKpi(events, config);
  const points: TrendPoint[] = kpi.series
    .filter((s): s is typeof s & { value: number } => s.value !== null)
    .map((s) => ({ label: s.label, value: s.value }));

  const values = points.map((p) => p.value);
  const slopeRaw = leastSquaresSlope(values);
  const first = values.length > 0 ? values[0]! : null;
  const last = values.length > 0 ? values[values.length - 1]! : null;
  const absoluteChange =
    first !== null && last !== null ? round(last - first, config.decimals ?? 2) : null;
  const pct = first !== null && last !== null ? safeDivide(last - first, Math.abs(first)) : null;
  const percentChange = pct === null ? null : round(pct * 100, config.decimals ?? 2);

  let direction: TrendDirection;
  if (slopeRaw === null || values.length < 2) {
    direction = 'insufficient';
  } else {
    const meanY = values.reduce((a, b) => a + b, 0) / values.length;
    const threshold = Math.abs(meanY) * 0.05;
    if (slopeRaw > threshold) direction = 'increasing';
    else if (slopeRaw < -threshold) direction = 'decreasing';
    else direction = 'stable';
  }

  return {
    period: config.period,
    points,
    slope: slopeRaw === null ? null : round(slopeRaw, 4),
    direction,
    first,
    last,
    absoluteChange,
    percentChange,
  };
}
