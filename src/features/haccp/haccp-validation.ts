/**
 * HACCP-005 — helpers PUROS de la VALIDACIÓN de medidas de control. La validación demuestra que
 * la medida ES CAPAZ de controlar el peligro (antes/al establecer el control); es distinta de la
 * verificación (HACCP-006). El STATUS del workflow se separa del RESULTADO técnico (§6). Marcar
 * «Satisfactoria» exige requisitos mínimos (§13). Sin dependencia de Prisma/servidor.
 */

// --- Estado del workflow -----------------------------------------------------
export const HACCP_VALIDATION_STATUSES = [
  'pending',
  'in_progress',
  'satisfactory',
  'unsatisfactory',
  'expired',
  'needs_review',
] as const;
export type HaccpValidationStatus = (typeof HACCP_VALIDATION_STATUSES)[number];

export const HACCP_VALIDATION_STATUS_LABEL: Record<HaccpValidationStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En proceso',
  satisfactory: 'Satisfactoria',
  unsatisfactory: 'No satisfactoria',
  expired: 'Vencida',
  needs_review: 'Revisión requerida',
};
export const validationStatusLabel = (s: string): string =>
  HACCP_VALIDATION_STATUS_LABEL[s as HaccpValidationStatus] ?? s;

// --- Resultado técnico (separado del status) ---------------------------------
export const HACCP_VALIDATION_RESULTS = ['satisfactory', 'unsatisfactory', 'inconclusive'] as const;
export type HaccpValidationResult = (typeof HACCP_VALIDATION_RESULTS)[number];

export const HACCP_VALIDATION_RESULT_LABEL: Record<HaccpValidationResult, string> = {
  satisfactory: 'Satisfactorio',
  unsatisfactory: 'No satisfactorio',
  inconclusive: 'No concluyente',
};
export const validationResultLabel = (r: string | null | undefined): string =>
  (r && HACCP_VALIDATION_RESULT_LABEL[r as HaccpValidationResult]) || '—';

// --- Método de validación ----------------------------------------------------
export const HACCP_VALIDATION_METHODS = [
  'literature',
  'legislation',
  'specification',
  'historical',
  'experimental',
  'plant_trial',
  'supplier',
  'external_study',
  'combined',
  'other',
] as const;
export type HaccpValidationMethod = (typeof HACCP_VALIDATION_METHODS)[number];

export const HACCP_VALIDATION_METHOD_LABEL: Record<HaccpValidationMethod, string> = {
  literature: 'Revisión bibliográfica / literatura científica',
  legislation: 'Legislación / norma',
  specification: 'Especificación técnica',
  historical: 'Datos históricos',
  experimental: 'Estudio experimental',
  plant_trial: 'Prueba en planta',
  supplier: 'Validación del proveedor',
  external_study: 'Estudio externo',
  combined: 'Combinación de fuentes',
  other: 'Otro',
};
export const validationMethodLabel = (m: string | null | undefined): string =>
  (m && HACCP_VALIDATION_METHOD_LABEL[m as HaccpValidationMethod]) || '—';

const filled = (v: string | null | undefined) => Boolean(v && v.trim());

/**
 * §13 — requisitos mínimos para marcar una validación como Satisfactoria: objetivo, método,
 * evidencia/fundamento, criterio de aceptación, conclusión y actor/fecha. Devuelve la lista de
 * errores (vacía = puede marcarse satisfactoria).
 */
export interface SatisfactoryCheck {
  objective?: string | null;
  methodType?: string | null;
  methodDescription?: string | null;
  evidenceSummary?: string | null;
  technicalBasis?: string | null;
  acceptanceCriteria?: string | null;
  conclusion?: string | null;
  performedAt?: string | null;
  performedByUserId?: string | null;
  performedByExternalName?: string | null;
}
export function validateSatisfactory(v: SatisfactoryCheck): string[] {
  const errors: string[] = [];
  if (!filled(v.objective)) errors.push('El objetivo de validación es obligatorio.');
  if (!filled(v.methodType) && !filled(v.methodDescription))
    errors.push('El método de validación es obligatorio.');
  if (!filled(v.evidenceSummary) && !filled(v.technicalBasis))
    errors.push('Se requiere evidencia o fundamento técnico.');
  if (!filled(v.acceptanceCriteria)) errors.push('El criterio de aceptación es obligatorio.');
  if (!filled(v.conclusion)) errors.push('La conclusión es obligatoria.');
  if (!filled(v.performedAt)) errors.push('La fecha de realización es obligatoria.');
  if (!v.performedByUserId && !filled(v.performedByExternalName))
    errors.push('Se requiere quién realizó la validación (interno o externo).');
  return errors;
}

/**
 * Deriva el status del workflow a partir del resultado técnico y los requisitos. `satisfactory`
 * solo si el resultado es satisfactorio Y cumple los requisitos; `unsatisfactory`/`in_progress`
 * en otro caso. No fuerza needs_review (eso lo decide el servidor por cambios).
 */
export function deriveValidationStatus(
  result: string | null | undefined,
  check: SatisfactoryCheck,
): HaccpValidationStatus {
  if (result === 'satisfactory' && validateSatisfactory(check).length === 0) return 'satisfactory';
  if (result === 'unsatisfactory') return 'unsatisfactory';
  if (result === 'inconclusive') return 'needs_review';
  return 'in_progress';
}

// --- Completitud (§34) -------------------------------------------------------
export interface ValidationCompletenessInput {
  controlsRequiringValidation: number;
  satisfactory: number;
  pending: number;
  needsReview: number;
}
export function validationCompleteness(i: ValidationCompletenessInput) {
  return {
    required: i.controlsRequiringValidation,
    satisfactory: i.satisfactory,
    pending: i.pending,
    needsReview: i.needsReview,
  };
}
