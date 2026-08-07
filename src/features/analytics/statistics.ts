// TASK-011 — Motor de estadística INTERPRETABLE y DETERMINISTA (puro).
//
// Alcance confirmado: Pearson, Spearman, regresión lineal simple, tabla de
// contingencia + chi-cuadrada, ANOVA de una vía y estadística descriptiva.
// Todo se calcula en servidor, es auditable y explicable. NO hay IA, ML,
// predicción ni causalidad automática. Cada resultado incluye una interpretación
// prudente que jamás afirma causa ("… no implica causalidad; se requiere
// investigación adicional"). Ante datos insuficientes o condiciones no válidas se
// devuelve `insufficient`/descriptivo con una advertencia clara, nunca un
// resultado engañoso.
//
// Referencias de significancia: valores críticos α=0.05 tabulados y documentados
// (dos colas para t; cola superior para chi²). No se inventan valores-p.

// ---------------------------------------------------------------------------
// Utilidades numéricas
// ---------------------------------------------------------------------------

function round(value: number, decimals = 4): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function meanOf(xs: number[]): number {
  return sum(xs) / xs.length;
}

// ---------------------------------------------------------------------------
// Estadística descriptiva
// ---------------------------------------------------------------------------

export interface Descriptive {
  count: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  stdDev: number | null; // desviación estándar muestral (n-1)
  variance: number | null;
}

/** Descriptiva de una muestra numérica. stdDev requiere n≥2. */
export function describe(values: number[]): Descriptive {
  const xs = values.filter((v) => Number.isFinite(v));
  const n = xs.length;
  if (n === 0) {
    return {
      count: 0,
      mean: null,
      median: null,
      min: null,
      max: null,
      stdDev: null,
      variance: null,
    };
  }
  const m = meanOf(xs);
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const med = n % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  let variance: number | null = null;
  let stdDev: number | null = null;
  if (n >= 2) {
    variance = sum(xs.map((x) => (x - m) ** 2)) / (n - 1);
    stdDev = Math.sqrt(variance);
  }
  return {
    count: n,
    mean: round(m),
    median: round(med),
    min: sorted[0]!,
    max: sorted[n - 1]!,
    stdDev: stdDev === null ? null : round(stdDev),
    variance: variance === null ? null : round(variance),
  };
}

// ---------------------------------------------------------------------------
// Correlación de Pearson
// ---------------------------------------------------------------------------

export type CorrelationStrength = 'muy débil' | 'débil' | 'moderada' | 'fuerte' | 'muy fuerte';

export function correlationStrength(r: number): CorrelationStrength {
  const a = Math.abs(r);
  if (a < 0.2) return 'muy débil';
  if (a < 0.4) return 'débil';
  if (a < 0.6) return 'moderada';
  if (a < 0.8) return 'fuerte';
  return 'muy fuerte';
}

// t crítico de dos colas para α=0.05 por grados de libertad (1..30), luego z=1.96.
const T_CRIT_005: Record<number, number> = {
  1: 12.706,
  2: 4.303,
  3: 3.182,
  4: 2.776,
  5: 2.571,
  6: 2.447,
  7: 2.365,
  8: 2.306,
  9: 2.262,
  10: 2.228,
  11: 2.201,
  12: 2.179,
  13: 2.16,
  14: 2.145,
  15: 2.131,
  16: 2.12,
  17: 2.11,
  18: 2.101,
  19: 2.093,
  20: 2.086,
  21: 2.08,
  22: 2.074,
  23: 2.069,
  24: 2.064,
  25: 2.06,
  26: 2.056,
  27: 2.052,
  28: 2.048,
  29: 2.045,
  30: 2.042,
};

function tCritical005(df: number): number {
  if (df <= 0) return Infinity;
  if (df <= 30) return T_CRIT_005[df]!;
  return 1.96;
}

export interface CorrelationResult {
  ok: boolean;
  reason?: string;
  method: 'pearson' | 'spearman';
  n: number;
  r: number | null;
  strength: CorrelationStrength | null;
  /** Notable a α=0.05 según prueba t sobre r (referencia, no causal). */
  significantAt005: boolean | null;
  interpretation: string;
}

function pearsonR(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  const mx = meanOf(xs);
  const my = meanOf(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const den = Math.sqrt(sxx * syy);
  if (den === 0) return null; // sin varianza en alguna variable
  return sxy / den;
}

function buildCorrelation(
  method: 'pearson' | 'spearman',
  n: number,
  r: number | null,
): CorrelationResult {
  if (r === null) {
    return {
      ok: false,
      reason: 'no_variance',
      method,
      n,
      r: null,
      strength: null,
      significantAt005: null,
      interpretation:
        'No se puede calcular la correlación: alguna variable no presenta variación. Se requiere más datos con variabilidad.',
    };
  }
  const strength = correlationStrength(r);
  const df = n - 2;
  let significant: boolean | null = null;
  if (df >= 1 && Math.abs(r) < 1) {
    const t = Math.abs(r) * Math.sqrt(df / (1 - r * r));
    significant = t >= tCritical005(df);
  } else if (Math.abs(r) === 1 && n >= 3) {
    significant = true;
  }
  const dir = r > 0 ? 'positiva' : r < 0 ? 'negativa' : 'nula';
  const label = method === 'pearson' ? 'lineal (Pearson)' : 'monótona (Spearman)';
  const sig =
    significant === null
      ? ''
      : significant
        ? ' La asociación es notable a α=0.05 (referencia, no prueba de causa).'
        : ' La asociación NO es notable a α=0.05.';
  return {
    ok: true,
    method,
    n,
    r: round(r),
    strength,
    significantAt005: significant,
    interpretation:
      `Correlación ${label} ${dir} ${strength} (r=${round(r)}, n=${n}).` +
      sig +
      ' La correlación no implica causalidad; se requiere investigación adicional.',
  };
}

/** Correlación de Pearson entre dos variables numéricas emparejadas (n≥3). */
export function pearson(xs: number[], ys: number[]): CorrelationResult {
  const { a, b } = pairFinite(xs, ys);
  if (a.length < 3) return insufficientCorrelation('pearson', a.length);
  return buildCorrelation('pearson', a.length, pearsonR(a, b));
}

// ---------------------------------------------------------------------------
// Correlación de Spearman (sobre rangos)
// ---------------------------------------------------------------------------

/** Rangos con promedio en empates. */
export function rankData(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((p, q) => p.v - q.v);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1]!.v === indexed[i]!.v) j += 1;
    const avgRank = (i + j) / 2 + 1; // rangos base 1
    for (let k = i; k <= j; k += 1) ranks[indexed[k]!.i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

/** Correlación de Spearman: Pearson sobre los rangos (n≥3). */
export function spearman(xs: number[], ys: number[]): CorrelationResult {
  const { a, b } = pairFinite(xs, ys);
  if (a.length < 3) return insufficientCorrelation('spearman', a.length);
  return buildCorrelation('spearman', a.length, pearsonR(rankData(a), rankData(b)));
}

function insufficientCorrelation(method: 'pearson' | 'spearman', n: number): CorrelationResult {
  return {
    ok: false,
    reason: 'insufficient_data',
    method,
    n,
    r: null,
    strength: null,
    significantAt005: null,
    interpretation: `Datos insuficientes para calcular la correlación (n=${n}; se requieren al menos 3 pares).`,
  };
}

function pairFinite(xs: number[], ys: number[]): { a: number[]; b: number[] } {
  const a: number[] = [];
  const b: number[] = [];
  const n = Math.min(xs.length, ys.length);
  for (let i = 0; i < n; i += 1) {
    if (Number.isFinite(xs[i]!) && Number.isFinite(ys[i]!)) {
      a.push(xs[i]!);
      b.push(ys[i]!);
    }
  }
  return { a, b };
}

// ---------------------------------------------------------------------------
// Regresión lineal simple
// ---------------------------------------------------------------------------

export interface RegressionResult {
  ok: boolean;
  reason?: string;
  n: number;
  slope: number | null;
  intercept: number | null;
  r2: number | null;
  points: { x: number; y: number }[];
  line: { x: number; y: number }[] | null; // dos extremos para dibujar
  interpretation: string;
}

/** Regresión lineal simple y = a + b·x (mínimos cuadrados, n≥3). */
export function linearRegression(xs: number[], ys: number[]): RegressionResult {
  const { a: X, b: Y } = pairFinite(xs, ys);
  const n = X.length;
  const points = X.map((x, i) => ({ x, y: Y[i]! }));
  if (n < 3) {
    return {
      ok: false,
      reason: 'insufficient_data',
      n,
      slope: null,
      intercept: null,
      r2: null,
      points,
      line: null,
      interpretation: `Datos insuficientes para la regresión (n=${n}; se requieren al menos 3 puntos).`,
    };
  }
  const mx = meanOf(X);
  const my = meanOf(Y);
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    sxx += (X[i]! - mx) ** 2;
    sxy += (X[i]! - mx) * (Y[i]! - my);
  }
  if (sxx === 0) {
    return {
      ok: false,
      reason: 'no_variance_x',
      n,
      slope: null,
      intercept: null,
      r2: null,
      points,
      line: null,
      interpretation:
        'La variable independiente no presenta variación; no se puede ajustar una recta.',
    };
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r = pearsonR(X, Y);
  const r2 = r === null ? 0 : r * r;
  const minX = Math.min(...X);
  const maxX = Math.max(...X);
  const line = [
    { x: minX, y: round(intercept + slope * minX) },
    { x: maxX, y: round(intercept + slope * maxX) },
  ];
  return {
    ok: true,
    n,
    slope: round(slope),
    intercept: round(intercept),
    r2: round(r2),
    points,
    line,
    interpretation:
      `Recta ajustada: y = ${round(intercept)} + ${round(slope)}·x (n=${n}, R²=${round(r2)}). ` +
      `El modelo explica ${round(r2 * 100, 1)}% de la variación observada. ` +
      'La relación es estadística, no causal; se requiere investigación adicional antes de establecer causalidad.',
  };
}

// ---------------------------------------------------------------------------
// Tabla de contingencia + chi-cuadrada
// ---------------------------------------------------------------------------

// chi² crítico cola superior α=0.05 por df (1..20).
const CHI2_CRIT_005: Record<number, number> = {
  1: 3.841,
  2: 5.991,
  3: 7.815,
  4: 9.488,
  5: 11.07,
  6: 12.592,
  7: 14.067,
  8: 15.507,
  9: 16.919,
  10: 18.307,
  11: 19.675,
  12: 21.026,
  13: 22.362,
  14: 23.685,
  15: 24.996,
  16: 26.296,
  17: 27.587,
  18: 28.869,
  19: 30.144,
  20: 31.41,
};

export interface ContingencyResult {
  ok: boolean;
  reason?: string;
  rowLabels: string[];
  colLabels: string[];
  observed: number[][];
  expected: number[][] | null;
  chiSquare: number | null;
  degreesOfFreedom: number | null;
  n: number;
  minExpected: number | null;
  lowExpectedWarning: boolean;
  significantAt005: boolean | null;
  interpretation: string;
}

/** Tabla de contingencia y chi-cuadrada de independencia para dos categóricas. */
export function contingencyChiSquare(catA: string[], catB: string[]): ContingencyResult {
  const n = Math.min(catA.length, catB.length);
  const pairs: [string, string][] = [];
  for (let i = 0; i < n; i += 1) {
    if (catA[i] != null && catB[i] != null) pairs.push([catA[i]!, catB[i]!]);
  }
  const rowLabels = [...new Set(pairs.map((p) => p[0]))].sort();
  const colLabels = [...new Set(pairs.map((p) => p[1]))].sort();

  const observed = rowLabels.map(() => colLabels.map(() => 0));
  const rowIndex = new Map(rowLabels.map((l, i) => [l, i]));
  const colIndex = new Map(colLabels.map((l, i) => [l, i]));
  for (const [ra, cb] of pairs) {
    const ri = rowIndex.get(ra)!;
    const ci = colIndex.get(cb)!;
    observed[ri]![ci] = observed[ri]![ci]! + 1;
  }

  const total = pairs.length;
  if (rowLabels.length < 2 || colLabels.length < 2 || total === 0) {
    return {
      ok: false,
      reason: 'insufficient_categories',
      rowLabels,
      colLabels,
      observed,
      expected: null,
      chiSquare: null,
      degreesOfFreedom: null,
      n: total,
      minExpected: null,
      lowExpectedWarning: false,
      interpretation:
        'Datos insuficientes: se requieren al menos 2 categorías por variable y observaciones suficientes.',
      significantAt005: null,
    };
  }

  const rowTotals = observed.map((r) => sum(r));
  const colTotals = colLabels.map((_, j) => sum(observed.map((r) => r[j]!)));
  const expected = rowTotals.map((rt) => colTotals.map((ct) => (rt * ct) / total));
  let chi = 0;
  let minExpected = Infinity;
  for (let i = 0; i < rowLabels.length; i += 1) {
    for (let j = 0; j < colLabels.length; j += 1) {
      const e = expected[i]![j]!;
      minExpected = Math.min(minExpected, e);
      if (e > 0) chi += (observed[i]![j]! - e) ** 2 / e;
    }
  }
  const df = (rowLabels.length - 1) * (colLabels.length - 1);
  const lowExpected = minExpected < 5;
  const crit = CHI2_CRIT_005[df];
  const significant = crit === undefined ? null : chi >= crit;

  let interpretation = `Chi-cuadrada de independencia: χ²=${round(chi, 3)}, gl=${df}, n=${total}.`;
  if (lowExpected) {
    interpretation +=
      ' ADVERTENCIA: alguna frecuencia esperada es menor a 5; la prueba pierde validez y el resultado debe tomarse como descriptivo.';
  } else if (significant === true) {
    interpretation +=
      ' Existe asociación estadísticamente notable (α=0.05) entre las variables; la asociación no implica causalidad.';
  } else if (significant === false) {
    interpretation += ' No se detecta asociación notable (α=0.05).';
  } else {
    interpretation += ' Consulte una tabla de χ² para evaluar la significancia con estos gl.';
  }

  return {
    ok: true,
    rowLabels,
    colLabels,
    observed,
    expected: expected.map((r) => r.map((e) => round(e, 3))),
    chiSquare: round(chi, 3),
    degreesOfFreedom: df,
    n: total,
    minExpected: round(minExpected, 3),
    lowExpectedWarning: lowExpected,
    significantAt005: lowExpected ? null : significant,
    interpretation,
  };
}

// ---------------------------------------------------------------------------
// ANOVA de una vía
// ---------------------------------------------------------------------------

export interface AnovaGroupStat {
  label: string;
  n: number;
  mean: number | null;
  stdDev: number | null;
}

export interface AnovaResult {
  ok: boolean;
  reason?: string;
  groups: AnovaGroupStat[];
  fStatistic: number | null;
  dfBetween: number | null;
  dfWithin: number | null;
  grandMean: number | null;
  conditionsValid: boolean;
  interpretation: string;
}

/**
 * ANOVA de una vía. Solo reporta F cuando las condiciones son razonablemente
 * válidas (≥2 grupos, cada grupo n≥2, N-k≥1). En caso contrario devuelve la
 * descriptiva por grupo con advertencia. No se calcula valor-p (requiere tabla F);
 * el usuario evalúa F contra una tabla de referencia.
 */
export function oneWayAnova(groups: { label: string; values: number[] }[]): AnovaResult {
  const clean = groups.map((g) => ({
    label: g.label,
    values: g.values.filter((v) => Number.isFinite(v)),
  }));
  const stats: AnovaGroupStat[] = clean.map((g) => {
    const d = describe(g.values);
    return { label: g.label, n: d.count, mean: d.mean, stdDev: d.stdDev };
  });
  const usable = clean.filter((g) => g.values.length >= 2);
  const k = usable.length;
  const N = sum(usable.map((g) => g.values.length));
  const conditionsValid = k >= 2 && N - k >= 1;

  if (!conditionsValid) {
    return {
      ok: false,
      reason: 'conditions_not_met',
      groups: stats,
      fStatistic: null,
      dfBetween: null,
      dfWithin: null,
      grandMean: null,
      conditionsValid: false,
      interpretation:
        'Condiciones no válidas para ANOVA (se requieren ≥2 grupos con ≥2 observaciones cada uno). Se muestra la descriptiva por grupo como referencia.',
    };
  }

  const allValues = usable.flatMap((g) => g.values);
  const grand = meanOf(allValues);
  let ssBetween = 0;
  let ssWithin = 0;
  for (const g of usable) {
    const gm = meanOf(g.values);
    ssBetween += g.values.length * (gm - grand) ** 2;
    for (const v of g.values) ssWithin += (v - gm) ** 2;
  }
  const dfB = k - 1;
  const dfW = N - k;
  const msB = ssBetween / dfB;
  const msW = ssWithin / dfW;
  const f = msW === 0 ? null : msB / msW;

  return {
    ok: true,
    groups: stats,
    fStatistic: f === null ? null : round(f, 3),
    dfBetween: dfB,
    dfWithin: dfW,
    grandMean: round(grand),
    conditionsValid: true,
    interpretation:
      f === null
        ? `Sin variación dentro de los grupos; no se puede calcular F (gl=${dfB},${dfW}). Se muestra la descriptiva por grupo.`
        : `ANOVA de una vía: F=${round(f, 3)} (gl=${dfB},${dfW}). Compare F contra una tabla F (α=0.05) para juzgar si las medias difieren; ` +
          'una diferencia entre medias no implica causalidad y requiere investigación adicional.',
  };
}
