/**
 * Resultados por requisito y cálculo de progreso/resumen del checklist (PURO).
 */

export const CHECKLIST_RESULTS = [
  'conforme',
  'parcial',
  'no_conforme',
  'no_aplica',
  'no_evaluado',
  'evidencia_insuficiente',
  'verificacion_campo',
] as const;
export type ChecklistResult = (typeof CHECKLIST_RESULTS)[number];

export const CHECKLIST_RESULT_LABEL: Record<ChecklistResult, string> = {
  conforme: 'Conforme',
  parcial: 'Parcialmente conforme',
  no_conforme: 'No conforme',
  no_aplica: 'No aplica',
  no_evaluado: 'No evaluado',
  evidencia_insuficiente: 'Evidencia insuficiente',
  verificacion_campo: 'Requiere verificación en campo',
};

export function isChecklistResult(v: unknown): v is ChecklistResult {
  return typeof v === 'string' && (CHECKLIST_RESULTS as readonly string[]).includes(v);
}

/** Un requisito se considera "evaluado" si tiene un resultado distinto de no_evaluado. */
export function isEvaluated(result: string): boolean {
  return result !== 'no_evaluado';
}

export interface ChecklistSummary {
  total: number;
  evaluated: number;
  pending: number;
  progressPct: number;
  byResult: Record<ChecklistResult, number>;
}

/** Resumen del checklist a partir de los resultados (sin BD ni UI). */
export function summarizeChecklist(results: string[]): ChecklistSummary {
  const byResult = Object.fromEntries(CHECKLIST_RESULTS.map((r) => [r, 0])) as Record<
    ChecklistResult,
    number
  >;
  for (const r of results) {
    if (isChecklistResult(r)) byResult[r] += 1;
  }
  const total = results.length;
  const evaluated = results.filter((r) => isEvaluated(r)).length;
  const pending = total - evaluated;
  const progressPct = total === 0 ? 0 : Math.round((evaluated / total) * 100);
  return { total, evaluated, pending, progressPct, byResult };
}
