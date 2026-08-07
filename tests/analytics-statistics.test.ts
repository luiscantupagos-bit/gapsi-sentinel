import { describe, expect, it } from 'vitest';
import {
  contingencyChiSquare,
  correlationStrength,
  describe as describeStats,
  linearRegression,
  oneWayAnova,
  pearson,
  rankData,
  spearman,
} from '@/features/analytics/statistics';

describe('describe', () => {
  it('calcula conteo, media, mediana, min, max y desviación muestral', () => {
    const d = describeStats([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(d.count).toBe(8);
    expect(d.mean).toBe(5);
    expect(d.median).toBe(4.5);
    expect(d.min).toBe(2);
    expect(d.max).toBe(9);
    expect(d.stdDev).toBeCloseTo(2.138, 2); // muestral (n-1)
  });
  it('sin datos → nulos; un dato → sin desviación', () => {
    expect(describeStats([]).mean).toBeNull();
    expect(describeStats([5]).stdDev).toBeNull();
  });
});

describe('pearson', () => {
  it('correlación perfecta positiva', () => {
    const r = pearson([1, 2, 3, 4], [2, 4, 6, 8]);
    expect(r.ok).toBe(true);
    expect(r.r).toBe(1);
    expect(r.strength).toBe('muy fuerte');
    expect(r.interpretation).toContain('no implica causalidad');
  });
  it('datos insuficientes (n<3)', () => {
    const r = pearson([1, 2], [2, 4]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('insufficient_data');
  });
  it('sin varianza → no calculable', () => {
    const r = pearson([3, 3, 3, 3], [1, 2, 3, 4]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_variance');
  });
});

describe('rankData / spearman', () => {
  it('promedia rangos en empates', () => {
    expect(rankData([10, 20, 20, 40])).toEqual([1, 2.5, 2.5, 4]);
  });
  it('spearman detecta relación monótona no lineal', () => {
    const r = spearman([1, 2, 3, 4, 5], [1, 4, 9, 16, 25]);
    expect(r.ok).toBe(true);
    expect(r.r).toBe(1); // monótona creciente perfecta
  });
});

describe('correlationStrength', () => {
  it('bandas por |r|', () => {
    expect(correlationStrength(0.1)).toBe('muy débil');
    expect(correlationStrength(0.5)).toBe('moderada');
    expect(correlationStrength(0.9)).toBe('muy fuerte');
  });
});

describe('linearRegression', () => {
  it('ajusta y = a + b·x con R²=1 en datos lineales', () => {
    const reg = linearRegression([1, 2, 3, 4], [3, 5, 7, 9]);
    expect(reg.ok).toBe(true);
    expect(reg.slope).toBe(2);
    expect(reg.intercept).toBe(1);
    expect(reg.r2).toBe(1);
    expect(reg.line).toHaveLength(2);
    expect(reg.interpretation).toContain('causalidad');
  });
  it('rechaza x sin varianza', () => {
    const reg = linearRegression([2, 2, 2], [1, 2, 3]);
    expect(reg.ok).toBe(false);
    expect(reg.reason).toBe('no_variance_x');
  });
});

describe('contingencyChiSquare', () => {
  it('calcula χ² y gl; advierte esperadas < 5', () => {
    const a = ['turno1', 'turno1', 'turno2', 'turno2'];
    const b = ['defecto', 'ok', 'defecto', 'ok'];
    const res = contingencyChiSquare(a, b);
    expect(res.ok).toBe(true);
    expect(res.degreesOfFreedom).toBe(1);
    expect(res.lowExpectedWarning).toBe(true);
    expect(res.interpretation).toContain('ADVERTENCIA');
  });
  it('detecta asociación notable con muestra adecuada', () => {
    const a: string[] = [];
    const b: string[] = [];
    // Máquina A: 30 defecto / 5 ok ; Máquina B: 5 defecto / 30 ok.
    for (let i = 0; i < 30; i += 1) {
      a.push('A');
      b.push('defecto');
    }
    for (let i = 0; i < 5; i += 1) {
      a.push('A');
      b.push('ok');
    }
    for (let i = 0; i < 5; i += 1) {
      a.push('B');
      b.push('defecto');
    }
    for (let i = 0; i < 30; i += 1) {
      a.push('B');
      b.push('ok');
    }
    const res = contingencyChiSquare(a, b);
    expect(res.lowExpectedWarning).toBe(false);
    expect(res.significantAt005).toBe(true);
    expect(res.interpretation).toContain('no implica causalidad');
  });
  it('menos de 2 categorías → insuficiente', () => {
    const res = contingencyChiSquare(['x', 'x'], ['y', 'y']);
    expect(res.ok).toBe(false);
  });
});

describe('oneWayAnova', () => {
  it('calcula F con condiciones válidas', () => {
    const res = oneWayAnova([
      { label: 'A', values: [1, 2, 3] },
      { label: 'B', values: [5, 6, 7] },
      { label: 'C', values: [9, 10, 11] },
    ]);
    expect(res.ok).toBe(true);
    expect(res.dfBetween).toBe(2);
    expect(res.dfWithin).toBe(6);
    expect(res.fStatistic).toBeGreaterThan(0);
    expect(res.interpretation).toContain('causalidad');
  });
  it('condiciones no válidas → descriptiva + advertencia', () => {
    const res = oneWayAnova([
      { label: 'A', values: [1] },
      { label: 'B', values: [5] },
    ]);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('conditions_not_met');
    expect(res.groups).toHaveLength(2);
  });
});
