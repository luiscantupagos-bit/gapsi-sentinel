/**
 * Semáforo global de cumplimiento (PLATFORM-001 §36-42) — motor puro.
 */
import { describe, expect, it } from 'vitest';
import {
  getComplianceBand,
  validateCompliancePolicy,
  DEFAULT_COMPLIANCE_POLICY,
  type CompliancePolicy,
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
