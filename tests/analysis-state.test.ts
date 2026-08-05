/**
 * Pruebas del módulo puro de análisis de calidad (TASK-008). Sin BD.
 */
import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_STATUSES,
  ANALYSIS_STATUS_LABEL,
  ANALYSIS_TYPES,
  ANALYSIS_TYPE_HELP,
  InvalidAnalysisTransitionError,
  assertAnalysisTransition,
  canTransitionAnalysis,
  computeNpr,
  computePareto,
  isAnalysisEditable,
  isAnalysisReadOnly,
  isValidScaleValue,
  wouldCreateCycle,
} from '@/features/capa/analysis-state';

describe('máquina de estados del análisis', () => {
  it('cada estado y tipo tiene etiqueta/ayuda', () => {
    for (const s of ANALYSIS_STATUSES) expect(ANALYSIS_STATUS_LABEL[s]).toBeTruthy();
    for (const t of ANALYSIS_TYPES) expect(ANALYSIS_TYPE_HELP[t]).toBeTruthy();
  });

  it('permite el flujo de revisión y aprobación', () => {
    expect(canTransitionAnalysis('draft', 'in_progress')).toBe(true);
    expect(canTransitionAnalysis('in_progress', 'under_review')).toBe(true);
    expect(canTransitionAnalysis('under_review', 'approved')).toBe(true);
    expect(canTransitionAnalysis('under_review', 'changes_requested')).toBe(true);
    expect(canTransitionAnalysis('changes_requested', 'in_progress')).toBe(true);
  });

  it('rechaza saltos arbitrarios y desde estados terminales', () => {
    expect(canTransitionAnalysis('draft', 'approved')).toBe(false);
    expect(canTransitionAnalysis('approved', 'in_progress')).toBe(false);
    expect(canTransitionAnalysis('cancelled', 'draft')).toBe(false);
    expect(() => assertAnalysisTransition('draft', 'approved')).toThrow(
      InvalidAnalysisTransitionError,
    );
  });

  it('editable vs solo lectura', () => {
    expect(isAnalysisEditable('draft')).toBe(true);
    expect(isAnalysisEditable('in_progress')).toBe(true);
    expect(isAnalysisEditable('changes_requested')).toBe(true);
    expect(isAnalysisEditable('under_review')).toBe(false);
    expect(isAnalysisReadOnly('approved')).toBe(true);
    expect(isAnalysisReadOnly('cancelled')).toBe(true);
  });
});

describe('AMEF: NPR y validación de escala', () => {
  it('calcula NPR como producto', () => {
    expect(computeNpr(10, 5, 4)).toBe(200);
    expect(computeNpr(1, 1, 1)).toBe(1);
  });
  it('valida rangos 1–10', () => {
    expect(isValidScaleValue(1, 10)).toBe(true);
    expect(isValidScaleValue(10, 10)).toBe(true);
    expect(isValidScaleValue(0, 10)).toBe(false);
    expect(isValidScaleValue(11, 10)).toBe(false);
    expect(isValidScaleValue(3.5, 10)).toBe(false);
  });
});

describe('Pareto (cálculo puro)', () => {
  it('ordena descendente, calcula % individual y acumulado', () => {
    const r = computePareto([
      { category: 'A', count: 50 },
      { category: 'B', count: 30 },
      { category: 'C', count: 20 },
    ]);
    expect(r.total).toBe(100);
    expect(r.rows.map((x) => x.category)).toEqual(['A', 'B', 'C']);
    expect(r.rows[0]?.percentage).toBe(50);
    expect(r.rows[1]?.cumulativePercentage).toBe(80);
    expect(r.rows[2]?.cumulativePercentage).toBe(100);
  });

  it('marca el grupo vital hasta el corte del 80%', () => {
    const r = computePareto(
      [
        { category: 'A', count: 60 },
        { category: 'B', count: 25 },
        { category: 'C', count: 10 },
        { category: 'D', count: 5 },
      ],
      { cutoff: 80 },
    );
    // A (60) + B (25) = 85 ≥ 80 → grupo vital = A, B.
    expect(r.vitalFewCount).toBe(2);
    expect(r.rows[0]?.vitalFew).toBe(true);
    expect(r.rows[1]?.vitalFew).toBe(true);
    expect(r.rows[2]?.vitalFew).toBe(false);
  });

  it('soporta datos vacíos sin dividir por cero', () => {
    const r = computePareto([]);
    expect(r.total).toBe(0);
    expect(r.rows).toEqual([]);
    expect(r.vitalFewCount).toBe(0);
  });

  it('puede ordenar por costo', () => {
    const r = computePareto(
      [
        { category: 'A', count: 1, cost: 10 },
        { category: 'B', count: 100, cost: 90 },
      ],
      { valueKey: 'cost' },
    );
    expect(r.rows[0]?.category).toBe('B');
    expect(r.total).toBe(100);
  });
});

describe('árbol de causas: detección de ciclos', () => {
  it('detecta auto-referencia', () => {
    expect(wouldCreateCycle([], 'n1', 'n1')).toBe(true);
  });
  it('detecta ciclo indirecto', () => {
    // a→b, b→c; agregar c→a cerraría el ciclo.
    const edges = [
      { fromNodeId: 'a', toNodeId: 'b' },
      { fromNodeId: 'b', toNodeId: 'c' },
    ];
    expect(wouldCreateCycle(edges, 'c', 'a')).toBe(true);
    expect(wouldCreateCycle(edges, 'a', 'c')).toBe(false); // rama válida
  });
});
