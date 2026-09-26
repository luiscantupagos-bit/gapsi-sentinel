/**
 * HACCP-003 — helpers PUROS del análisis de peligros. §48.
 */
import { describe, expect, it } from 'vitest';
import {
  HACCP_HAZARD_TYPE_LABEL,
  DEFAULT_RISK_MATRIX,
  computeRiskScore,
  resolveSignificance,
  riskBand,
  RISK_BAND_LABEL,
  validateMatrixConfig,
  hazardAnalysisCompleteness,
  hazardTypeLabel,
} from '@/features/haccp/haccp-hazards';

describe('tipos de peligro', () => {
  it('labels en español (biológico/químico/físico/alérgeno/radiológico)', () => {
    expect(HACCP_HAZARD_TYPE_LABEL.biological).toBe('Biológico');
    expect(HACCP_HAZARD_TYPE_LABEL.allergen).toBe('Alérgeno');
    expect(HACCP_HAZARD_TYPE_LABEL.radiological).toBe('Radiológico');
    expect(hazardTypeLabel('chemical')).toBe('Químico');
    expect(hazardTypeLabel('x')).toBe('x');
  });
});

describe('resolver de riesgo (§19/§20)', () => {
  it('score = P × S por defecto; suma si se configura', () => {
    expect(computeRiskScore(4, 5)).toBe(20);
    expect(computeRiskScore(3, 2, 'sum')).toBe(5);
  });
  it('significativo si score ≥ umbral', () => {
    expect(resolveSignificance(20, 8)).toBe(true);
    expect(resolveSignificance(6, 8)).toBe(false);
  });
  it('banda de riesgo (independiente del semáforo de cumplimiento)', () => {
    expect(riskBand(20, 8)).toBe('high');
    expect(riskBand(5, 8)).toBe('medium'); // >= ceil(8/2)=4
    expect(riskBand(3, 8)).toBe('low');
    expect(RISK_BAND_LABEL.high).toBe('Alto');
  });
});

describe('matriz por defecto y validación', () => {
  it('matriz por defecto 1-5', () => {
    expect(DEFAULT_RISK_MATRIX.probabilityScale).toHaveLength(5);
    expect(DEFAULT_RISK_MATRIX.probabilityScale[0]?.label).toBe('Remota');
    expect(DEFAULT_RISK_MATRIX.significanceThreshold).toBe(8);
  });
  it('valida escalas y rango del umbral', () => {
    expect(validateMatrixConfig(DEFAULT_RISK_MATRIX)).toEqual([]);
    const bad = { ...DEFAULT_RISK_MATRIX, significanceThreshold: 999 };
    expect(validateMatrixConfig(bad).length).toBe(1);
    const short = { ...DEFAULT_RISK_MATRIX, probabilityScale: [{ value: 1, label: 'x' }] };
    expect(validateMatrixConfig(short).length).toBeGreaterThan(0);
  });
});

describe('completitud (§36)', () => {
  it('cuenta MP/etapas analizadas y significativos sin control', () => {
    const c = hazardAnalysisCompleteness({
      totalMaterials: 2,
      materialsWithHazards: 1,
      totalSteps: 9,
      stepsWithHazards: 3,
      significantWithoutControl: 2,
    });
    expect(c.materialsAnalyzed).toBe(1);
    expect(c.stepsTotal).toBe(9);
    expect(c.significantWithoutControl).toBe(2);
  });
});
