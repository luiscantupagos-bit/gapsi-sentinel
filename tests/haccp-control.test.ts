/**
 * HACCP-004 — helpers PUROS de selección de medidas de control (árbol de decisión, resolver,
 * completitud del plan). §46.
 */
import { describe, expect, it } from 'vitest';
import {
  HACCP_CLASSIFICATION_LABEL,
  DEFAULT_DECISION_TREE,
  resolveClassification,
  isControlPlanComplete,
  controlMeasureCompleteness,
  classificationLabel,
} from '@/features/haccp/haccp-control';

describe('clasificación y etiquetas', () => {
  it('labels en español (incluye «Controlado en otra etapa»)', () => {
    expect(HACCP_CLASSIFICATION_LABEL.pcc).toContain('PCC');
    expect(HACCP_CLASSIFICATION_LABEL.ppro).toContain('PPRO');
    expect(HACCP_CLASSIFICATION_LABEL.ppr).toContain('PPR');
    expect(classificationLabel('review_required')).toBe('Revisión requerida');
    expect(classificationLabel('controlled_elsewhere')).toBe('Controlado en otra etapa');
  });
});

describe('HACCP-CONTROL-TREE-P1-P8 — resolver del árbol REAL', () => {
  const t = DEFAULT_DECISION_TREE;
  const A = (path: [string, 'yes' | 'no' | 'na'][]) =>
    resolveClassification(
      t,
      path.map(([questionId, answer]) => ({ questionId, answer })),
    );

  it('usa la metodología iso22000-p1p8', () => {
    expect(t.key).toBe('iso22000-p1p8');
    expect(t.questions).toHaveLength(8);
    expect(t.start).toBe('P1');
  });
  it('Salmonella (P1 Sí, P2 Sí, P6 No, P7 Sí, P8 No) → PPRO', () => {
    const r = A([
      ['P1', 'yes'],
      ['P2', 'yes'],
      ['P6', 'no'],
      ['P7', 'yes'],
      ['P8', 'no'],
    ]);
    expect(r.classification).toBe('ppro');
    // Evidencia: el camino guarda el TEXTO de cada pregunta (snapshot).
    expect(r.path.map((p) => p.questionId)).toEqual(['P1', 'P2', 'P6', 'P7', 'P8']);
    expect(r.path.every((p) => p.questionText.length > 0)).toBe(true);
  });
  it('P1 Sí, P2 Sí, P6 No, P7 Sí, P8 Sí → PCC', () => {
    expect(
      A([
        ['P1', 'yes'],
        ['P2', 'yes'],
        ['P6', 'no'],
        ['P7', 'yes'],
        ['P8', 'yes'],
      ]).classification,
    ).toBe('pcc');
  });
  it('P1 Sí, P2 Sí, P6 Sí → PPR (no es PCC ni PPRO)', () => {
    expect(
      A([
        ['P1', 'yes'],
        ['P2', 'yes'],
        ['P6', 'yes'],
      ]).classification,
    ).toBe('ppr');
  });
  it('P7 No → PPRO (sin límites críticos)', () => {
    expect(
      A([
        ['P1', 'yes'],
        ['P2', 'yes'],
        ['P6', 'no'],
        ['P7', 'no'],
      ]).classification,
    ).toBe('ppro');
  });
  it('P3/P4/P5 Sí → Controlado en otra etapa', () => {
    expect(
      A([
        ['P1', 'yes'],
        ['P2', 'no'],
        ['P3', 'yes'],
      ]).classification,
    ).toBe('controlled_elsewhere');
    expect(
      A([
        ['P1', 'yes'],
        ['P2', 'no'],
        ['P3', 'no'],
        ['P4', 'yes'],
      ]).classification,
    ).toBe('controlled_elsewhere');
    expect(
      A([
        ['P1', 'yes'],
        ['P2', 'no'],
        ['P3', 'no'],
        ['P4', 'no'],
        ['P5', 'yes'],
      ]).classification,
    ).toBe('controlled_elsewhere');
  });
  it('P1 No → revisión requerida (modificar y reevaluar)', () => {
    expect(A([['P1', 'no']]).classification).toBe('review_required');
  });
  it('incompleto → siguiente pregunta', () => {
    const r = A([['P1', 'yes']]);
    expect(r.classification).toBeNull();
    expect(r.nextQuestionId).toBe('P2');
  });
});

describe('completitud del plan (§12/§23)', () => {
  const full = {
    controlMeasure: 'x',
    criticalLimit: 'x',
    actionCriterion: 'x',
    monitoringWhat: 'x',
    monitoringHow: 'x',
    monitoringWho: 'x',
    monitoringWhen: 'x',
    correctiveAction: 'x',
  };
  it('PCC requiere límite crítico + monitoreo + acción correctiva', () => {
    expect(isControlPlanComplete('pcc', full)).toBe(true);
    expect(isControlPlanComplete('pcc', { ...full, criticalLimit: null })).toBe(false);
  });
  it('PPRO requiere criterio de acción (no límite crítico)', () => {
    expect(isControlPlanComplete('ppro', { ...full, criticalLimit: null })).toBe(true);
    expect(isControlPlanComplete('ppro', { ...full, actionCriterion: null })).toBe(false);
  });
  it('PPR requiere medida o registro relacionado', () => {
    expect(isControlPlanComplete('ppr', { controlMeasure: 'x' })).toBe(true);
    expect(isControlPlanComplete('ppr', { recordReference: 'doc' })).toBe(true);
    expect(isControlPlanComplete('ppr', {})).toBe(false);
  });
});

describe('completitud global (§24)', () => {
  it('cuenta significativos/evaluados/pendientes/clasificaciones', () => {
    const c = controlMeasureCompleteness({
      significantHazards: 4,
      evaluated: 1,
      pcc: 0,
      ppro: 1,
      ppr: 0,
      incompletePlans: 0,
    });
    expect(c.pending).toBe(3);
    expect(c.ppro).toBe(1);
  });
});
