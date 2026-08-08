/**
 * Motor de resultado de evaluación del diagnóstico (dominio puro, determinista).
 *
 * Reglas explícitas y auditables:
 *
 * - yes/no y selección única: usan la fracción de la opción elegida (0..1).
 * - "No aplica": se excluye del denominador.
 * - texto: no puntúa (informativo).
 * - conforme = fracción === 1; no conforme = fracción < 1 (entre las puntuables).
 * - cualquier pregunta crítica incumplida (fracción < 1) eleva el riesgo a
 *   `high` como mínimo.
 * - escala de riesgo: 90–100 low · 75–89.99 moderate · 50–74.99 high · <50 critical.
 *
 * Se calcula al consultar (no se persiste), para reflejar siempre el estado
 * actual de las respuestas. Sin BD ni UI. No constituye certificación.
 */

export type PreviewRiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface PreviewQuestion {
  questionId: string;
  code: string;
  sectionId: string;
  sectionCode: string;
  sectionTitle: string;
  requirementCode: string;
  isCritical: boolean;
  isScored: boolean;
  weight: number;
}

export interface PreviewAnswer {
  questionId: string;
  status: 'pending' | 'answered' | 'not_applicable';
  /** Fracción de cumplimiento de la opción elegida (0..1) o null. */
  scoreFraction: number | null;
}

export interface PreviewSectionResult {
  sectionId: string;
  code: string;
  title: string;
  numerator: number;
  denominator: number;
  percentage: number;
  applicableScored: number;
  excluded: number;
}

export interface PreviewGap {
  questionCode: string;
  requirementCode: string;
  sectionCode: string;
  isCritical: boolean;
  scoreFraction: number;
  gapScore: number;
}

export interface PreviewResult {
  numerator: number;
  denominator: number;
  percentage: number;
  conforming: number;
  nonConforming: number;
  notApplicable: number;
  criticalUnmet: number;
  riskLevel: PreviewRiskLevel;
  sections: PreviewSectionResult[];
  gaps: PreviewGap[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Umbrales de riesgo + regla de crítico incumplido. */
export function previewRiskLevel(percentage: number, criticalUnmet: number): PreviewRiskLevel {
  let level: PreviewRiskLevel =
    percentage >= 90
      ? 'low'
      : percentage >= 75
        ? 'moderate'
        : percentage >= 50
          ? 'high'
          : 'critical';
  if (criticalUnmet > 0 && (level === 'low' || level === 'moderate')) {
    level = 'high';
  }
  return level;
}

export function computePreview(
  questions: readonly PreviewQuestion[],
  answers: readonly PreviewAnswer[],
): PreviewResult {
  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));

  let numerator = 0;
  let denominator = 0;
  let conforming = 0;
  let nonConforming = 0;
  let notApplicable = 0;
  let criticalUnmet = 0;

  const sectionAcc = new Map<string, PreviewSectionResult>();
  const gaps: PreviewGap[] = [];

  for (const q of questions) {
    if (!sectionAcc.has(q.sectionId)) {
      sectionAcc.set(q.sectionId, {
        sectionId: q.sectionId,
        code: q.sectionCode,
        title: q.sectionTitle,
        numerator: 0,
        denominator: 0,
        percentage: 0,
        applicableScored: 0,
        excluded: 0,
      });
    }
    const section = sectionAcc.get(q.sectionId)!;
    const answer = answerByQuestion.get(q.questionId);

    // Texto o no puntuable: informativo, fuera del cálculo.
    if (!q.isScored) {
      section.excluded += 1;
      continue;
    }

    // No aplica: excluida del denominador.
    if (answer?.status === 'not_applicable') {
      notApplicable += 1;
      section.excluded += 1;
      continue;
    }

    // Sin responder o sin fracción: no suma al numerador pero sí al denominador
    // (cuenta como no conforme para el cálculo de cumplimiento).
    const fraction =
      answer?.status === 'answered' && typeof answer.scoreFraction === 'number'
        ? answer.scoreFraction
        : 0;

    numerator += q.weight * fraction;
    denominator += q.weight;
    section.numerator += q.weight * fraction;
    section.denominator += q.weight;
    section.applicableScored += 1;

    if (fraction >= 1) {
      conforming += 1;
    } else {
      nonConforming += 1;
      if (q.isCritical) criticalUnmet += 1;
      gaps.push({
        questionCode: q.code,
        requirementCode: q.requirementCode,
        sectionCode: q.sectionCode,
        isCritical: q.isCritical,
        scoreFraction: fraction,
        gapScore: round2(q.weight * (1 - fraction)),
      });
    }
  }

  for (const section of sectionAcc.values()) {
    section.numerator = round2(section.numerator);
    section.denominator = round2(section.denominator);
    section.percentage =
      section.denominator > 0 ? round2((section.numerator / section.denominator) * 100) : 0;
  }

  const percentage = denominator > 0 ? round2((numerator / denominator) * 100) : 0;

  // Brechas: primero críticas, luego por mayor gapScore.
  gaps.sort((a, b) => Number(b.isCritical) - Number(a.isCritical) || b.gapScore - a.gapScore);

  return {
    numerator: round2(numerator),
    denominator: round2(denominator),
    percentage,
    conforming,
    nonConforming,
    notApplicable,
    criticalUnmet,
    riskLevel: previewRiskLevel(percentage, criticalUnmet),
    sections: [...sectionAcc.values()],
    gaps,
  };
}
