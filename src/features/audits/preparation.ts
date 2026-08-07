/**
 * Preparación para auditoría (PURO). Índice OPERATIVO de preparación — NO es un
 * porcentaje de cumplimiento certificado. La fórmula está documentada aquí y en
 * `docs/audits/AUDIT-WORKFLOW.md`.
 */

export const PREPARATION_STATES = [
  'preparado',
  'parcial',
  'sin_evidencia',
  'evidencia_vencida',
  'requiere_revision',
  'no_aplica',
] as const;
export type PreparationState = (typeof PREPARATION_STATES)[number];

export const PREPARATION_STATE_LABEL: Record<PreparationState, string> = {
  preparado: 'Preparado',
  parcial: 'Parcial',
  sin_evidencia: 'Sin evidencia',
  evidencia_vencida: 'Evidencia vencida',
  requiere_revision: 'Requiere revisión',
  no_aplica: 'No aplica',
};

/** Peso de cada estado para el índice operativo (0..1). */
const WEIGHT: Record<PreparationState, number> = {
  preparado: 1,
  parcial: 0.5,
  requiere_revision: 0.5,
  evidencia_vencida: 0.25,
  sin_evidencia: 0,
  no_aplica: 0, // excluido del denominador
};

export interface PreparationRowState {
  state: PreparationState;
}

export interface PreparationIndex {
  applicable: number;
  score: number; // suma ponderada
  indexPct: number; // 0..100
  byState: Record<PreparationState, number>;
}

/**
 * Índice operativo de preparación (documental/operativa), NO certificación.
 *
 * indexPct = round( 100 * Σ peso(estado) / (#requisitos aplicables) )
 * donde "aplicables" excluye `no_aplica`. Estados y pesos:
 *  preparado=1 · parcial=0.5 · requiere_revision=0.5 · evidencia_vencida=0.25 ·
 *  sin_evidencia=0 · no_aplica=excluido.
 */
export function preparationIndex(rows: PreparationRowState[]): PreparationIndex {
  const byState = Object.fromEntries(PREPARATION_STATES.map((s) => [s, 0])) as Record<
    PreparationState,
    number
  >;
  let score = 0;
  let applicable = 0;
  for (const r of rows) {
    byState[r.state] += 1;
    if (r.state === 'no_aplica') continue;
    applicable += 1;
    score += WEIGHT[r.state];
  }
  const indexPct = applicable === 0 ? 0 : Math.round((score / applicable) * 100);
  return { applicable, score, indexPct, byState };
}
