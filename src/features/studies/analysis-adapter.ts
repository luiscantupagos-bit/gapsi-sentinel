// CORE-ALIGN-003 — Adaptador de análisis para Estudios de Datos (puro).
//
// Convierte las filas de un dataset en las series que consumen los MOTORES YA
// EXISTENTES (TASK-011: statistics.ts; TASK-007: computePareto) y no reimplementa
// matemática. Devuelve un resultado serializable por método. Sin causalidad, sin
// IA. La interpretación determinista vive en interpretation.ts.

import {
  describe as describeStats,
  pearson,
  spearman,
  linearRegression,
  oneWayAnova,
  contingencyChiSquare,
  type Descriptive,
  type CorrelationResult,
  type RegressionResult,
  type AnovaResult,
  type ContingencyResult,
} from '@/features/analytics/statistics';
import { computePareto, type ParetoResult } from '@/features/capa/analysis-state';
import { toNumber } from './dataset';

export type StudyMethod =
  | 'descriptive'
  | 'pareto'
  | 'trend'
  | 'correlation'
  | 'regression'
  | 'group_compare'
  | 'anova'
  | 'chi_square';

export const STUDY_METHOD_LABEL: Record<StudyMethod, string> = {
  descriptive: 'Descriptivos',
  pareto: 'Pareto',
  trend: 'Tendencia',
  correlation: 'Correlación',
  regression: 'Regresión lineal',
  group_compare: 'Comparación de grupos',
  anova: 'ANOVA',
  chi_square: 'Chi-cuadrada',
};

export interface StudyRowValues {
  [columnKey: string]: string;
}

export interface AnalysisConfig {
  variable?: string; // descriptive
  category?: string; // pareto / chi x
  weight?: string; // pareto: '__count__' o columna numérica
  value?: string; // trend/group/anova: columna numérica ('__count__' en trend)
  date?: string; // trend
  period?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  x?: string; // correlación/regresión/chi
  y?: string;
}

export type StudyAnalysisResult =
  | { kind: 'descriptive-numeric'; n: number; stats: Descriptive }
  | {
      kind: 'descriptive-categorical';
      n: number;
      frequencies: { label: string; count: number; pct: number }[];
    }
  | { kind: 'pareto'; result: ParetoResult; weightLabel: string }
  | { kind: 'trend'; points: { label: string; value: number }[]; changePct: number | null }
  | { kind: 'correlation'; pearson: CorrelationResult; spearman: CorrelationResult }
  | { kind: 'regression'; regression: RegressionResult }
  | { kind: 'group_compare'; groups: { label: string; stats: Descriptive }[] }
  | { kind: 'anova'; anova: AnovaResult }
  | { kind: 'chi_square'; contingency: ContingencyResult }
  | { kind: 'insufficient'; message: string };

function numericColumn(rows: StudyRowValues[], key: string): number[] {
  const out: number[] = [];
  for (const r of rows) {
    const n = toNumber(r[key] ?? '');
    if (n !== null) out.push(n);
  }
  return out;
}

function categoricalColumn(rows: StudyRowValues[], key: string): string[] {
  return rows.map((r) => (r[key] ?? '').trim()).filter((v) => v !== '');
}

/**
 * Semana ISO 8601 (semana empieza el lunes; la semana 1 contiene el primer jueves
 * del año). Devuelve el AÑO-SEMANA ISO, que puede diferir del año calendario cerca
 * del cambio de año (p. ej. 2025-01-01 puede ser 2024-W01). Determinista, en UTC.
 */
function isoWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7; // domingo=7, lunes=1
  date.setUTCDate(date.getUTCDate() + 4 - dayNum); // avanza al jueves de esta semana
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

function periodBucket(iso: string, period: NonNullable<AnalysisConfig['period']>): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  switch (period) {
    case 'yearly':
      return `${y}`;
    case 'quarterly':
      return `${y}-Q${Math.floor(m / 3) + 1}`;
    case 'monthly':
      return `${y}-${String(m + 1).padStart(2, '0')}`;
    case 'weekly': {
      const { year, week } = isoWeek(d);
      return `${year}-W${String(week).padStart(2, '0')}`;
    }
    default:
      return iso; // daily → por fecha exacta
  }
}

/** Ejecuta el método sobre las filas y devuelve un resultado serializable. */
export function runAnalysis(
  method: StudyMethod,
  config: AnalysisConfig,
  rows: StudyRowValues[],
): StudyAnalysisResult {
  switch (method) {
    case 'descriptive': {
      if (!config.variable) return insufficient('Selecciona una variable.');
      const nums = numericColumn(rows, config.variable);
      if (nums.length > 0 && nums.length >= Math.ceil(rows.length * 0.5)) {
        return { kind: 'descriptive-numeric', n: nums.length, stats: describeStats(nums) };
      }
      const cats = categoricalColumn(rows, config.variable);
      const freq = new Map<string, number>();
      for (const c of cats) freq.set(c, (freq.get(c) ?? 0) + 1);
      const frequencies = [...freq.entries()]
        .map(([label, count]) => ({ label, count, pct: round((count / cats.length) * 100) }))
        .sort((a, b) => b.count - a.count);
      return { kind: 'descriptive-categorical', n: cats.length, frequencies };
    }

    case 'pareto': {
      if (!config.category) return insufficient('Selecciona una categoría.');
      const useWeight = config.weight && config.weight !== '__count__';
      const groups = new Map<string, { count: number; weight: number }>();
      for (const r of rows) {
        const cat = (r[config.category] ?? '').trim() || 'Sin clasificar';
        const g = groups.get(cat) ?? { count: 0, weight: 0 };
        g.count += 1;
        if (useWeight) {
          const n = toNumber(r[config.weight!] ?? '');
          if (n !== null) g.weight += n;
        }
        groups.set(cat, g);
      }
      const items = [...groups.entries()].map(([category, g]) => ({
        category,
        count: g.count,
        cost: useWeight ? g.weight : null,
      }));
      const result = computePareto(items, { valueKey: useWeight ? 'cost' : 'count' });
      return { kind: 'pareto', result, weightLabel: useWeight ? 'suma' : 'frecuencia' };
    }

    case 'trend': {
      if (!config.date) return insufficient('Selecciona una variable de fecha.');
      const period = config.period ?? 'monthly';
      const countMode = !config.value || config.value === '__count__';
      const buckets = new Map<string, { sum: number; n: number }>();
      for (const r of rows) {
        const iso = normalizeDate(r[config.date] ?? '');
        if (!iso) continue;
        const label = periodBucket(iso, period);
        const b = buckets.get(label) ?? { sum: 0, n: 0 };
        if (countMode) {
          b.sum += 1;
          b.n += 1;
        } else {
          const v = toNumber(r[config.value!] ?? '');
          if (v !== null) {
            b.sum += v;
            b.n += 1;
          }
        }
        buckets.set(label, b);
      }
      const points = [...buckets.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([label, b]) => ({ label, value: countMode ? b.sum : b.n ? round(b.sum / b.n) : 0 }));
      const first = points[0]?.value ?? null;
      const last = points[points.length - 1]?.value ?? null;
      const changePct =
        first !== null && last !== null && first !== 0
          ? round(((last - first) / Math.abs(first)) * 100)
          : null;
      if (points.length < 2) return insufficient('Se requieren al menos dos periodos con datos.');
      return { kind: 'trend', points, changePct };
    }

    case 'correlation': {
      if (!config.x || !config.y) return insufficient('Selecciona dos variables numéricas.');
      const { a, b } = pairFinite(rows, config.x, config.y);
      return { kind: 'correlation', pearson: pearson(a, b), spearman: spearman(a, b) };
    }

    case 'regression': {
      if (!config.x || !config.y) return insufficient('Selecciona X e Y numéricas.');
      const { a, b } = pairFinite(rows, config.x, config.y);
      return { kind: 'regression', regression: linearRegression(a, b) };
    }

    case 'group_compare':
    case 'anova': {
      if (!config.category || !config.value)
        return insufficient('Selecciona un grupo (categórica) y una medida (numérica).');
      const grouped = new Map<string, number[]>();
      for (const r of rows) {
        const cat = (r[config.category] ?? '').trim();
        const v = toNumber(r[config.value] ?? '');
        if (cat === '' || v === null) continue;
        const arr = grouped.get(cat) ?? [];
        arr.push(v);
        grouped.set(cat, arr);
      }
      const groups = [...grouped.entries()].map(([label, values]) => ({ label, values }));
      if (method === 'anova') return { kind: 'anova', anova: oneWayAnova(groups) };
      return {
        kind: 'group_compare',
        groups: groups.map((g) => ({ label: g.label, stats: describeStats(g.values) })),
      };
    }

    case 'chi_square': {
      if (!config.x || !config.y) return insufficient('Selecciona dos variables categóricas.');
      const a: string[] = [];
      const b: string[] = [];
      for (const r of rows) {
        const av = (r[config.x] ?? '').trim();
        const bv = (r[config.y] ?? '').trim();
        if (av && bv) {
          a.push(av);
          b.push(bv);
        }
      }
      return { kind: 'chi_square', contingency: contingencyChiSquare(a, b) };
    }
  }
}

function pairFinite(
  rows: StudyRowValues[],
  xKey: string,
  yKey: string,
): { a: number[]; b: number[] } {
  const a: number[] = [];
  const b: number[] = [];
  for (const r of rows) {
    const xv = toNumber(r[xKey] ?? '');
    const yv = toNumber(r[yKey] ?? '');
    if (xv !== null && yv !== null) {
      a.push(xv);
      b.push(yv);
    }
  }
  return { a, b };
}

function normalizeDate(v: string): string | null {
  const t = v.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const [, a, b, y] = m;
    const year = y!.length === 2 ? `20${y}` : y!;
    return `${year}-${b!.padStart(2, '0')}-${a!.padStart(2, '0')}`;
  }
  return null;
}

function insufficient(message: string): StudyAnalysisResult {
  return { kind: 'insufficient', message };
}

function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e4) / 1e4;
}
