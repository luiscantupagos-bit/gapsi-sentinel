/**
 * Semáforo global de cumplimiento (PLATFORM-001 §36-42) — motor puro.
 */
import { describe, expect, it } from 'vitest';
import {
  getComplianceBand,
  validateCompliancePolicy,
  DEFAULT_COMPLIANCE_POLICY,
  DEFAULT_RESOLVED_POLICY,
  resolveComplianceBand,
  validateComplianceColors,
  validateResolvedPolicy,
  stylesFromColors,
  usesComplianceBand,
  resolveMetricBand,
  resolveInverseBand,
  type CompliancePolicy,
  type ResolvedCompliancePolicy,
} from '@/features/compliance/compliance-band';

describe('getComplianceBand — límites por defecto (§36)', () => {
  const cases: Array<[number, string]> = [
    [100, 'green'],
    [90, 'green'],
    [89.99, 'yellow'],
    [80, 'yellow'],
    [79.99, 'orange'],
    [70, 'orange'],
    [69.99, 'red'],
    [0, 'red'],
  ];
  it.each(cases)('valor %s → %s', (value, level) => {
    expect(getComplianceBand(value).level).toBe(level);
  });

  it('devuelve etiqueta, color, texto accesible y rango de banda', () => {
    const band = getComplianceBand(95);
    expect(band.label).toBe('Cumplimiento alto');
    expect(band.color).toMatch(/^#/);
    expect(band.accessibleText).toBeTruthy();
    expect(band).toMatchObject({ min: 90, max: 100 });
  });

  it('rangos de amarillo/naranja/rojo', () => {
    expect(getComplianceBand(85)).toMatchObject({ level: 'yellow', min: 80, max: 90 });
    expect(getComplianceBand(75)).toMatchObject({ level: 'orange', min: 70, max: 80 });
    expect(getComplianceBand(50)).toMatchObject({ level: 'red', min: 0, max: 70 });
  });

  it('acota valores fuera de rango (defensivo)', () => {
    expect(getComplianceBand(150).level).toBe('green');
    expect(getComplianceBand(-10).level).toBe('red');
    expect(getComplianceBand(Number.NaN).level).toBe('red');
  });
});

describe('política configurable (§39)', () => {
  it('usa umbrales personalizados válidos', () => {
    const policy: CompliancePolicy = { greenMin: 95, yellowMin: 85, orangeMin: 75 };
    expect(getComplianceBand(90, policy).level).toBe('yellow');
    expect(getComplianceBand(95, policy).level).toBe('green');
    expect(getComplianceBand(74.99, policy).level).toBe('red');
  });

  it('política inválida cae a la default', () => {
    const bad = { greenMin: 80, yellowMin: 90, orangeMin: 70 } as CompliancePolicy;
    // Con la default (90/80/70), 85 es amarillo (no verde como sugeriría la inválida).
    expect(getComplianceBand(85, bad).level).toBe('yellow');
  });
});

describe('validateCompliancePolicy (§39)', () => {
  it('acepta 95 > 90 > 80', () => {
    expect(validateCompliancePolicy({ greenMin: 95, yellowMin: 90, orangeMin: 80 })).toEqual([]);
  });
  it('acepta la default', () => {
    expect(validateCompliancePolicy(DEFAULT_COMPLIANCE_POLICY)).toEqual([]);
  });
  it('rechaza 80 > 90 > 70 (orden inválido)', () => {
    expect(
      validateCompliancePolicy({ greenMin: 80, yellowMin: 90, orangeMin: 70 }).length,
    ).toBeGreaterThan(0);
  });
  it('rechaza verde > 100 y naranja < 0', () => {
    expect(
      validateCompliancePolicy({ greenMin: 120, yellowMin: 90, orangeMin: 80 }).length,
    ).toBeGreaterThan(0);
    expect(
      validateCompliancePolicy({ greenMin: 90, yellowMin: 80, orangeMin: -5 }).length,
    ).toBeGreaterThan(0);
  });
  it('rechaza valores no numéricos', () => {
    expect(
      validateCompliancePolicy({ greenMin: Number.NaN, yellowMin: 80, orangeMin: 70 }).length,
    ).toBeGreaterThan(0);
  });
});

describe('política resuelta (umbrales + colores, CORE-UX-005)', () => {
  const custom: ResolvedCompliancePolicy = {
    greenMin: 95,
    yellowMin: 90,
    orangeMin: 80,
    green: '#00aa00',
    yellow: '#ffcc00',
    orange: '#ff8800',
    red: '#cc0000',
  };

  it('resolveComplianceBand usa umbrales y colores de la organización', () => {
    const band = resolveComplianceBand(92, custom);
    expect(band.level).toBe('yellow');
    expect(band.color).toBe('#ffcc00');
  });

  it('default resuelto colorea con los colores por defecto', () => {
    expect(resolveComplianceBand(95, DEFAULT_RESOLVED_POLICY).color).toBe(
      DEFAULT_RESOLVED_POLICY.green,
    );
  });

  it('stylesFromColors conserva las etiquetas globales', () => {
    const styles = stylesFromColors({
      green: '#111111',
      yellow: '#222222',
      orange: '#333333',
      red: '#444444',
    });
    expect(styles.green.label).toBe('Cumplimiento alto');
    expect(styles.red.color).toBe('#444444');
  });

  it('validateComplianceColors exige HEX válido', () => {
    expect(
      validateComplianceColors({
        green: '#1f9d55',
        yellow: '#c9a227',
        orange: '#d97706',
        red: '#c0392b',
      }),
    ).toEqual([]);
    expect(
      validateComplianceColors({
        green: 'red',
        yellow: 'rgb(0,0,0)',
        orange: 'var(--x)',
        red: '#zzz',
      }).length,
    ).toBe(4);
  });

  it('validateResolvedPolicy combina umbrales y colores', () => {
    expect(validateResolvedPolicy(custom)).toEqual([]);
    const bad: ResolvedCompliancePolicy = { ...custom, yellowMin: 96, red: 'nope' };
    expect(validateResolvedPolicy(bad).length).toBeGreaterThanOrEqual(2);
  });
});

describe('semántica de métrica (§10/§37)', () => {
  it('el semáforo aplica solo a higher_is_better', () => {
    expect(usesComplianceBand('higher_is_better')).toBe(true);
    expect(usesComplianceBand('lower_is_better')).toBe(false);
  });
});

describe('KPIs demo positivos/negativos (PLATFORM-002B §13)', () => {
  it('A. higher_is_better 95 → verde con defaults', () => {
    expect(resolveMetricBand(95, 'higher_is_better').level).toBe('green');
  });
  it('B. higher_is_better 76 → naranja con defaults', () => {
    expect(resolveMetricBand(76, 'higher_is_better').level).toBe('orange');
  });
  it('C. lower_is_better 3 → verde (favorable)', () => {
    const band = resolveMetricBand(3, 'lower_is_better');
    expect(band.level).toBe('green');
    expect(band.label).toBe('Nivel favorable');
  });
  it('D. lower_is_better 18 → rojo (crítico)', () => {
    expect(resolveMetricBand(18, 'lower_is_better').level).toBe('red');
  });
  it('E. positivo reacciona a política custom (95/90/80)', () => {
    const p: ResolvedCompliancePolicy = {
      greenMin: 95,
      yellowMin: 90,
      orangeMin: 80,
      green: '#0a0',
      yellow: '#aa0',
      orange: '#a50',
      red: '#a00',
    };
    expect(resolveMetricBand(95, 'higher_is_better', p).level).toBe('green');
    expect(resolveMetricBand(76, 'higher_is_better', p).level).toBe('red');
  });
  it('F. lower_is_better NO usa 90/80/70 (3% no es rojo)', () => {
    // Si usara la política positiva, 3 < 70 → rojo. Con semántica inversa → verde.
    expect(resolveMetricBand(3, 'lower_is_better').level).toBe('green');
    // Rangos inversos demo: 0-5 verde, >5-10 amarillo, >10-15 naranja, >15 rojo.
    expect(resolveInverseBand(8).level).toBe('yellow');
    expect(resolveInverseBand(12).level).toBe('orange');
    expect(resolveInverseBand(20).level).toBe('red');
  });
});
