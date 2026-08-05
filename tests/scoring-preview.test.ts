import { describe, expect, it } from 'vitest';
import {
  computePreview,
  previewRiskLevel,
  type PreviewAnswer,
  type PreviewQuestion,
} from '@/features/diagnostics/scoring-preview';

function q(partial: Partial<PreviewQuestion> & { questionId: string }): PreviewQuestion {
  return {
    code: partial.questionId,
    sectionId: 's1',
    sectionCode: 'S1',
    sectionTitle: 'Sección 1',
    requirementCode: 'R1',
    isCritical: false,
    isScored: true,
    weight: 1,
    ...partial,
  };
}

describe('previewRiskLevel (umbrales preliminares)', () => {
  it('mapea porcentaje a nivel', () => {
    expect(previewRiskLevel(95, 0)).toBe('low');
    expect(previewRiskLevel(80, 0)).toBe('moderate');
    expect(previewRiskLevel(60, 0)).toBe('high');
    expect(previewRiskLevel(30, 0)).toBe('critical');
  });

  it('un crítico incumplido eleva a high como mínimo', () => {
    expect(previewRiskLevel(95, 1)).toBe('high');
    expect(previewRiskLevel(80, 2)).toBe('high');
    expect(previewRiskLevel(30, 1)).toBe('critical'); // no baja
  });
});

describe('computePreview', () => {
  it('calcula el ejemplo del diseño (66.67 %, Alto)', () => {
    const questions = [
      q({ questionId: 'q1', isCritical: true, weight: 1 }),
      q({ questionId: 'q2', weight: 2 }),
      q({ questionId: 'q3', isScored: false, weight: 1 }), // texto
      q({ questionId: 'q4', weight: 1 }), // N/A
    ];
    const answers: PreviewAnswer[] = [
      { questionId: 'q1', status: 'answered', scoreFraction: 1 },
      { questionId: 'q2', status: 'answered', scoreFraction: 0.5 },
      { questionId: 'q3', status: 'answered', scoreFraction: null },
      { questionId: 'q4', status: 'not_applicable', scoreFraction: null },
    ];
    const r = computePreview(questions, answers);
    expect(r.numerator).toBe(2);
    expect(r.denominator).toBe(3);
    expect(r.percentage).toBe(66.67);
    expect(r.conforming).toBe(1);
    expect(r.nonConforming).toBe(1);
    expect(r.notApplicable).toBe(1);
    expect(r.criticalUnmet).toBe(0);
    expect(r.riskLevel).toBe('high');
  });

  it('un crítico en No cuenta como incumplido y aparece como brecha crítica', () => {
    const questions = [
      q({ questionId: 'q1', isCritical: true, weight: 1 }),
      q({ questionId: 'q2', weight: 1 }),
    ];
    const answers: PreviewAnswer[] = [
      { questionId: 'q1', status: 'answered', scoreFraction: 0 },
      { questionId: 'q2', status: 'answered', scoreFraction: 1 },
    ];
    const r = computePreview(questions, answers);
    expect(r.criticalUnmet).toBe(1);
    expect(r.percentage).toBe(50);
    expect(r.riskLevel).toBe('high'); // 50% -> high, crítico lo mantiene
    expect(r.gaps[0]?.isCritical).toBe(true);
  });

  it('texto no puntúa y N/A se excluye del denominador', () => {
    const questions = [q({ questionId: 'q1', isScored: false }), q({ questionId: 'q2' })];
    const answers: PreviewAnswer[] = [
      { questionId: 'q1', status: 'answered', scoreFraction: null },
      { questionId: 'q2', status: 'not_applicable', scoreFraction: null },
    ];
    const r = computePreview(questions, answers);
    expect(r.denominator).toBe(0);
    expect(r.percentage).toBe(0);
    expect(r.notApplicable).toBe(1);
  });

  it('una pregunta sin responder cuenta en el denominador como no conforme', () => {
    const questions = [q({ questionId: 'q1', weight: 1 })];
    const r = computePreview(questions, []);
    expect(r.denominator).toBe(1);
    expect(r.numerator).toBe(0);
    expect(r.nonConforming).toBe(1);
  });

  it('agrega resultados por sección', () => {
    const questions = [
      q({ questionId: 'a', sectionId: 's1', sectionCode: 'S1' }),
      q({ questionId: 'b', sectionId: 's2', sectionCode: 'S2' }),
    ];
    const answers: PreviewAnswer[] = [
      { questionId: 'a', status: 'answered', scoreFraction: 1 },
      { questionId: 'b', status: 'answered', scoreFraction: 0 },
    ];
    const r = computePreview(questions, answers);
    expect(r.sections).toHaveLength(2);
    expect(r.sections.find((s) => s.code === 'S1')?.percentage).toBe(100);
    expect(r.sections.find((s) => s.code === 'S2')?.percentage).toBe(0);
  });
});
