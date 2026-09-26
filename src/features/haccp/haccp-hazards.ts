/**
 * HACCP-003 — helpers PUROS del análisis de peligros (tipos, matriz de riesgo, resolver de
 * score/significancia, completitud). Sin dependencia de Prisma/servidor. La resolución de
 * riesgo se CENTRALIZA aquí (no se dispersa por componentes). El resultado termina en
 * peligro + riesgo + significancia + medida existente; la clasificación PCC/PPRO es HACCP-004.
 */

// --- Tipos de peligro --------------------------------------------------------
export const HACCP_HAZARD_TYPES = [
  'biological',
  'chemical',
  'physical',
  'allergen',
  'radiological',
  'other',
] as const;
export type HaccpHazardType = (typeof HACCP_HAZARD_TYPES)[number];

export const HACCP_HAZARD_TYPE_LABEL: Record<HaccpHazardType, string> = {
  biological: 'Biológico',
  chemical: 'Químico',
  physical: 'Físico',
  allergen: 'Alérgeno',
  radiological: 'Radiológico',
  other: 'Otro',
};

export const hazardTypeLabel = (t: string): string =>
  HACCP_HAZARD_TYPE_LABEL[t as HaccpHazardType] ?? t;

export type HazardSourceType = 'material' | 'process_step';

// --- Matriz de riesgo --------------------------------------------------------
export interface RiskScaleLevel {
  value: number;
  label: string;
}
export interface RiskMatrixConfig {
  probabilityScale: RiskScaleLevel[];
  severityScale: RiskScaleLevel[];
  scoreFormula: string; // 'multiply'
  significanceThreshold: number;
}

/** Matriz por defecto (§17/§18): 1..5. NO es el semáforo de cumplimiento (§25). */
export const DEFAULT_RISK_MATRIX: RiskMatrixConfig = {
  probabilityScale: [
    { value: 1, label: 'Remota' },
    { value: 2, label: 'Baja' },
    { value: 3, label: 'Media' },
    { value: 4, label: 'Alta' },
    { value: 5, label: 'Muy alta' },
  ],
  severityScale: [
    { value: 1, label: 'Menor' },
    { value: 2, label: 'Moderada' },
    { value: 3, label: 'Seria' },
    { value: 4, label: 'Grave' },
    { value: 5, label: 'Crítica' },
  ],
  scoreFormula: 'multiply',
  significanceThreshold: 8,
};

/** §19 — cálculo del score CENTRALIZADO (configurable por fórmula). */
export function computeRiskScore(
  probability: number,
  severity: number,
  formula = 'multiply',
): number {
  if (formula === 'sum') return probability + severity;
  return probability * severity; // multiply por defecto
}

/** §20 — significancia calculada según el umbral. */
export function resolveSignificance(score: number, threshold: number): boolean {
  return score >= threshold;
}

/** §24/§25 — banda de riesgo para colorear la celda de la matriz (semántica HACCP, NO
 *  cumplimiento). Devuelve un identificador estable + etiqueta en español. */
export type RiskBand = 'low' | 'medium' | 'high';
export function riskBand(score: number, threshold: number): RiskBand {
  if (score >= threshold) return 'high';
  if (score >= Math.ceil(threshold / 2)) return 'medium';
  return 'low';
}
export const RISK_BAND_LABEL: Record<RiskBand, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
};

/** Valida una configuración de matriz (escalas no vacías, umbral en rango). */
export function validateMatrixConfig(c: RiskMatrixConfig): string[] {
  const errors: string[] = [];
  if (!Array.isArray(c.probabilityScale) || c.probabilityScale.length < 2)
    errors.push('La escala de probabilidad debe tener al menos 2 niveles.');
  if (!Array.isArray(c.severityScale) || c.severityScale.length < 2)
    errors.push('La escala de severidad debe tener al menos 2 niveles.');
  const maxScore = computeRiskScore(
    Math.max(...c.probabilityScale.map((l) => l.value), 1),
    Math.max(...c.severityScale.map((l) => l.value), 1),
    c.scoreFormula,
  );
  if (c.significanceThreshold < 1 || c.significanceThreshold > maxScore)
    errors.push(`El umbral de significancia debe estar entre 1 y ${maxScore}.`);
  return errors;
}

// --- Completitud (§36) -------------------------------------------------------
export interface CompletenessInput {
  totalMaterials: number;
  materialsWithHazards: number;
  totalSteps: number;
  stepsWithHazards: number;
  significantWithoutControl: number;
}
export interface Completeness {
  materialsAnalyzed: number;
  materialsTotal: number;
  stepsAnalyzed: number;
  stepsTotal: number;
  significantWithoutControl: number;
}

export function hazardAnalysisCompleteness(input: CompletenessInput): Completeness {
  return {
    materialsAnalyzed: input.materialsWithHazards,
    materialsTotal: input.totalMaterials,
    stepsAnalyzed: input.stepsWithHazards,
    stepsTotal: input.totalSteps,
    significantWithoutControl: input.significantWithoutControl,
  };
}
