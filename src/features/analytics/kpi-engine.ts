// TASK-011 — Motor de KPI (puro, determinista, auditable).
//
// Calcula indicadores sobre el dataset unificado de eventos. Reglas de PRECISIÓN
// documentadas y explícitas:
//   • Redondeo: half-up a `decimals` decimales (2 por defecto).
//   • División entre cero: devuelve `null` (dato no disponible), nunca 0 ni NaN.
//   • Nulos: en suma/promedio/mediana se IGNORAN los valores nulos del campo;
//     si no queda ningún valor, el resultado es `null` (no 0) para no engañar.
//   • Muestra insuficiente: se marca `insufficientData` y el estado es `no_data`.
//   • Fechas: se agrupa por `eventDate` (YYYY-MM-DD, UTC) para evitar corrimientos.
//
// Sin IA, sin predicción: solo agregaciones aritméticas explicables.

import type { UnifiedEvent, UnifiedSource, UnifiedStatus } from './unified-events';

export type KpiMeasure =
  | 'count'
  | 'sum'
  | 'average'
  | 'median'
  | 'percentage'
  | 'rate'
  | 'proportion'
  | 'avg_duration'
  | 'compliance'
  | 'recurrence';

export type KpiPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type DesiredDirection = 'higher' | 'lower' | 'target';
export type KpiResultStatus = 'on_target' | 'warning' | 'off_target' | 'no_data';
export type MetricField = 'quantityAffected' | 'unitsProduced' | 'cost' | 'durationHours' | 'npr';

/** Dimensiones textuales/categóricas por las que se puede agrupar/recurrir. */
export type DimensionField =
  | 'source'
  | 'eventType'
  | 'category'
  | 'status'
  | 'severity'
  | 'area'
  | 'process'
  | 'product'
  | 'machine'
  | 'shift'
  | 'supplier'
  | 'responsibleUserId';

export interface EventFilter {
  source?: UnifiedSource[];
  eventType?: string[];
  status?: UnifiedStatus[];
  severity?: string[];
  category?: string[];
  area?: string[];
  process?: string[];
  product?: string[];
  machine?: string[];
  shift?: string[];
  supplier?: string[];
  responsibleUserId?: string[];
  /** Fecha ISO (YYYY-MM-DD) inclusiva. */
  from?: string;
  /** Fecha ISO (YYYY-MM-DD) inclusiva. */
  to?: string;
}

export interface KpiConfig {
  measure: KpiMeasure;
  measureField?: MetricField;
  filters?: EventFilter;
  numeratorFilter?: EventFilter;
  denominatorFilter?: EventFilter;
  rateMultiplier?: number;
  period: KpiPeriod;
  target?: number | null;
  warningThreshold?: number | null;
  criticalThreshold?: number | null;
  desiredDirection?: DesiredDirection;
  decimals?: number;
  /** Campos que definen "el mismo hecho" para la medida de recurrencia. */
  recurrenceKeyFields?: DimensionField[];
}

export interface KpiPeriodResult {
  label: string;
  start: string;
  end: string;
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  count: number;
  target: number | null;
  status: KpiResultStatus;
}

export interface KpiComputation {
  measure: KpiMeasure;
  period: KpiPeriod;
  decimals: number;
  series: KpiPeriodResult[];
  overall: {
    value: number | null;
    numerator: number | null;
    denominator: number | null;
    count: number;
    status: KpiResultStatus;
  };
  totalEvents: number;
  insufficientData: boolean;
}

// ---------------------------------------------------------------------------
// Precisión
// ---------------------------------------------------------------------------

/** Redondeo half-up estable a `decimals` decimales. */
export function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  // Épsilon para corregir representación binaria (p. ej. 1.005).
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** División segura: denominador 0/nulo → null. */
export function safeDivide(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  const r = numerator / denominator;
  return Number.isFinite(r) ? r : null;
}

function metricValue(ev: UnifiedEvent, field: MetricField): number | null {
  const v = ev[field];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function collectMetric(events: UnifiedEvent[], field: MetricField): number[] {
  const out: number[] = [];
  for (const ev of events) {
    const v = metricValue(ev, field);
    if (v !== null) out.push(v);
  }
  return out;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

// ---------------------------------------------------------------------------
// Filtrado
// ---------------------------------------------------------------------------

function inList(value: string | null, list?: string[]): boolean {
  if (!list || list.length === 0) return true;
  return value !== null && list.includes(value);
}

export function matchesFilter(ev: UnifiedEvent, f?: EventFilter): boolean {
  if (!f) return true;
  if (!inList(ev.source, f.source)) return false;
  if (!inList(ev.eventType, f.eventType)) return false;
  if (!inList(ev.status, f.status)) return false;
  if (!inList(ev.severity, f.severity)) return false;
  if (!inList(ev.category, f.category)) return false;
  if (!inList(ev.area, f.area)) return false;
  if (!inList(ev.process, f.process)) return false;
  if (!inList(ev.product, f.product)) return false;
  if (!inList(ev.machine, f.machine)) return false;
  if (!inList(ev.shift, f.shift)) return false;
  if (!inList(ev.supplier, f.supplier)) return false;
  if (!inList(ev.responsibleUserId, f.responsibleUserId)) return false;
  if (f.from && ev.eventDate < f.from) return false;
  if (f.to && ev.eventDate > f.to) return false;
  return true;
}

export function applyFilter(events: UnifiedEvent[], f?: EventFilter): UnifiedEvent[] {
  if (!f) return events;
  return events.filter((ev) => matchesFilter(ev, f));
}

// ---------------------------------------------------------------------------
// Periodos
// ---------------------------------------------------------------------------

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Devuelve {label, start, end} (YYYY-MM-DD) del periodo que contiene la fecha. */
export function periodBucket(
  isoDate: string,
  period: KpiPeriod,
): { label: string; start: string; end: string } {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0-11
  switch (period) {
    case 'daily':
      return { label: isoDate, start: isoDate, end: isoDate };
    case 'weekly': {
      const { year, week, monday } = isoWeek(d);
      const sunday = new Date(monday);
      sunday.setUTCDate(sunday.getUTCDate() + 6);
      return {
        label: `${year}-W${pad(week)}`,
        start: monday.toISOString().slice(0, 10),
        end: sunday.toISOString().slice(0, 10),
      };
    }
    case 'monthly': {
      const start = new Date(Date.UTC(y, m, 1));
      const end = new Date(Date.UTC(y, m + 1, 0));
      return {
        label: `${y}-${pad(m + 1)}`,
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      };
    }
    case 'quarterly': {
      const q = Math.floor(m / 3); // 0-3
      const start = new Date(Date.UTC(y, q * 3, 1));
      const end = new Date(Date.UTC(y, q * 3 + 3, 0));
      return {
        label: `${y}-Q${q + 1}`,
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      };
    }
    case 'yearly':
      return { label: `${y}`, start: `${y}-01-01`, end: `${y}-12-31` };
  }
}

/** Semana ISO 8601 (lunes como inicio). */
export function isoWeek(date: Date): { year: number; week: number; monday: Date } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // domingo=7
  // Lunes de esta semana.
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (day - 1));
  // Jueves de esta semana define el año ISO.
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const isoYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDay = firstThursday.getUTCDay() || 7;
  const firstMonday = new Date(firstThursday);
  firstMonday.setUTCDate(firstThursday.getUTCDate() - (firstDay - 1));
  const week = 1 + Math.round((thursday.getTime() - firstMonday.getTime()) / (7 * 86400000));
  return { year: isoYear, week, monday };
}

// ---------------------------------------------------------------------------
// Medidas
// ---------------------------------------------------------------------------

interface MeasureResult {
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  count: number;
}

function dimValue(ev: UnifiedEvent, field: DimensionField): string {
  const v = ev[field];
  return v === null || v === undefined ? '∅' : String(v);
}

/** Calcula la medida sobre un conjunto de eventos ya filtrado por la base. */
export function computeMeasure(events: UnifiedEvent[], config: KpiConfig): MeasureResult {
  const decimals = config.decimals ?? 2;
  const count = events.length;

  switch (config.measure) {
    case 'count':
      return { value: count, numerator: null, denominator: null, count };

    case 'sum': {
      const vals = collectMetric(events, config.measureField ?? 'quantityAffected');
      const value =
        vals.length === 0
          ? null
          : round(
              vals.reduce((a, b) => a + b, 0),
              decimals,
            );
      return { value, numerator: null, denominator: null, count };
    }

    case 'average':
    case 'avg_duration': {
      const field =
        config.measure === 'avg_duration'
          ? 'durationHours'
          : (config.measureField ?? 'quantityAffected');
      const vals = collectMetric(events, field);
      const m = mean(vals);
      return {
        value: m === null ? null : round(m, decimals),
        numerator: null,
        denominator: null,
        count,
      };
    }

    case 'median': {
      const vals = collectMetric(events, config.measureField ?? 'quantityAffected');
      const m = median(vals);
      return {
        value: m === null ? null : round(m, decimals),
        numerator: null,
        denominator: null,
        count,
      };
    }

    case 'percentage':
    case 'compliance':
    case 'proportion':
    case 'rate': {
      // Denominador: subconjunto por denominatorFilter (o todos los eventos base).
      const denomEvents = config.denominatorFilter
        ? applyFilter(events, config.denominatorFilter)
        : events;
      // Numerador: por numeratorFilter; para compliance por defecto = estados cerrados.
      const numFilter =
        config.numeratorFilter ??
        (config.measure === 'compliance' ? ({ status: ['closed'] } as EventFilter) : undefined);
      const numEvents = numFilter ? applyFilter(denomEvents, numFilter) : denomEvents;
      const numerator = numEvents.length;
      const denominator = denomEvents.length;
      const ratio = safeDivide(numerator, denominator);
      let value: number | null;
      if (ratio === null) value = null;
      else if (config.measure === 'rate')
        value = round(ratio * (config.rateMultiplier ?? 1), decimals);
      else if (config.measure === 'proportion') value = round(ratio, decimals);
      else value = round(ratio * 100, decimals); // percentage / compliance
      return { value, numerator, denominator, count };
    }

    case 'recurrence': {
      const fields = config.recurrenceKeyFields ?? ['process'];
      const freq = new Map<string, number>();
      for (const ev of events) {
        const key = fields.map((f) => dimValue(ev, f)).join('¦');
        freq.set(key, (freq.get(key) ?? 0) + 1);
      }
      // Recurrencia = ocurrencias que se repiten (total - grupos distintos):
      // cuántos eventos "extra" comparten clave con otro.
      let repeated = 0;
      for (const n of freq.values()) if (n >= 2) repeated += n;
      return { value: repeated, numerator: repeated, denominator: count, count };
    }
  }
}

// ---------------------------------------------------------------------------
// Evaluación de estado contra meta/umbrales
// ---------------------------------------------------------------------------

export function evaluateStatus(
  value: number | null,
  config: Pick<KpiConfig, 'target' | 'warningThreshold' | 'criticalThreshold' | 'desiredDirection'>,
): KpiResultStatus {
  const { target, warningThreshold, criticalThreshold } = config;
  const dir = config.desiredDirection ?? 'lower';
  if (value === null || target === null || target === undefined) return 'no_data';

  if (dir === 'lower') {
    if (value <= target) return 'on_target';
    if (criticalThreshold != null && value >= criticalThreshold) return 'off_target';
    if (warningThreshold != null) return value <= warningThreshold ? 'warning' : 'off_target';
    return 'warning';
  }
  if (dir === 'higher') {
    if (value >= target) return 'on_target';
    if (criticalThreshold != null && value <= criticalThreshold) return 'off_target';
    if (warningThreshold != null) return value >= warningThreshold ? 'warning' : 'off_target';
    return 'warning';
  }
  // dir === 'target': umbrales como desviación absoluta permitida.
  const dev = Math.abs(value - target);
  if (warningThreshold != null && dev <= warningThreshold) return 'on_target';
  if (criticalThreshold != null && dev >= criticalThreshold) return 'off_target';
  if (warningThreshold == null && dev === 0) return 'on_target';
  return 'warning';
}

// ---------------------------------------------------------------------------
// Cálculo completo del KPI (serie temporal + total)
// ---------------------------------------------------------------------------

export function computeKpi(events: UnifiedEvent[], config: KpiConfig): KpiComputation {
  const decimals = config.decimals ?? 2;
  const base = applyFilter(events, config.filters);

  // Agrupar por periodo.
  const buckets = new Map<string, { start: string; end: string; events: UnifiedEvent[] }>();
  for (const ev of base) {
    const b = periodBucket(ev.eventDate, config.period);
    const entry = buckets.get(b.label) ?? { start: b.start, end: b.end, events: [] };
    entry.events.push(ev);
    buckets.set(b.label, entry);
  }

  const series: KpiPeriodResult[] = [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([label, entry]) => {
      const m = computeMeasure(entry.events, config);
      return {
        label,
        start: entry.start,
        end: entry.end,
        value: m.value,
        numerator: m.numerator,
        denominator: m.denominator,
        count: m.count,
        target: config.target ?? null,
        status: evaluateStatus(m.value, config),
      };
    });

  const overallMeasure = computeMeasure(base, config);
  const overall = {
    value: overallMeasure.value,
    numerator: overallMeasure.numerator,
    denominator: overallMeasure.denominator,
    count: overallMeasure.count,
    status: evaluateStatus(overallMeasure.value, config),
  };

  return {
    measure: config.measure,
    period: config.period,
    decimals,
    series,
    overall,
    totalEvents: base.length,
    insufficientData: base.length === 0 || overallMeasure.value === null,
  };
}
