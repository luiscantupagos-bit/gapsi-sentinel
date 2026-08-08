/**
 * Herramientas de calidad y análisis avanzado de causa (TASK-008). Módulo PURO
 * y central: máquina de estados del análisis, catálogos (enums text + CHECK) y
 * cálculos deterministas (NPR, Pareto, detección de ciclos del árbol de causas).
 * No decide automáticamente la causa raíz: solo estructura la investigación.
 */

// --- Tipos de análisis -------------------------------------------------------

export const ANALYSIS_TYPES = [
  'ishikawa',
  'cause_tree',
  'pareto',
  'fmea',
  'recurrence',
  'comparative',
  'freeform',
  '5whys',
  'fta',
] as const;
export type AnalysisType = (typeof ANALYSIS_TYPES)[number];

export const ANALYSIS_TYPE_LABEL: Record<AnalysisType, string> = {
  ishikawa: 'Diagrama de Ishikawa',
  cause_tree: 'Árbol de causas',
  pareto: 'Análisis de Pareto',
  fmea: 'AMEF',
  recurrence: 'Análisis de recurrencia',
  comparative: 'Comparación de casos',
  freeform: 'Análisis libre',
  '5whys': '5 Porqués',
  fta: 'Árbol de Fallas (FTA)',
};

/** Ayuda breve por herramienta (se muestra en la interfaz). */
export const ANALYSIS_TYPE_HELP: Record<AnalysisType, string> = {
  ishikawa: 'Organiza posibles causas por categorías para facilitar su investigación.',
  cause_tree:
    'Relaciona eventos, condiciones y controles fallidos para identificar causas sistémicas.',
  pareto:
    'Ordena los problemas por frecuencia o impacto para identificar las principales prioridades.',
  fmea: 'Evalúa modos de falla, efectos, causas y controles para priorizar acciones.',
  recurrence: 'Revisa si el problema o sus causas ya se habían presentado.',
  comparative: 'Compara varias CAPA para identificar patrones y causas sistémicas.',
  freeform: 'Análisis personalizado con hipótesis y evidencia estructuradas.',
  '5whys':
    'Encadena preguntas "¿por qué?" para profundizar de los síntomas hacia una causa raíz propuesta.',
  fta: 'Descompone un evento no deseado en eventos intermedios y básicos mediante compuertas AND/OR.',
};

export function isAnalysisType(value: unknown): value is AnalysisType {
  return typeof value === 'string' && (ANALYSIS_TYPES as readonly string[]).includes(value);
}

// --- Máquina de estados del análisis -----------------------------------------

export const ANALYSIS_STATUSES = [
  'draft',
  'in_progress',
  'under_review',
  'changes_requested',
  'approved',
  'cancelled',
] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const ANALYSIS_STATUS_LABEL: Record<AnalysisStatus, string> = {
  draft: 'Borrador',
  in_progress: 'En desarrollo',
  under_review: 'En revisión',
  changes_requested: 'Cambios solicitados',
  approved: 'Aprobado',
  cancelled: 'Cancelado',
};

export function isAnalysisStatus(value: unknown): value is AnalysisStatus {
  return typeof value === 'string' && (ANALYSIS_STATUSES as readonly string[]).includes(value);
}

/** Estados en los que la estructura del análisis puede editarse. */
export function isAnalysisEditable(status: AnalysisStatus): boolean {
  return status === 'draft' || status === 'in_progress' || status === 'changes_requested';
}

/** Un análisis aprobado o cancelado queda en solo lectura. */
export function isAnalysisReadOnly(status: AnalysisStatus): boolean {
  return status === 'approved' || status === 'cancelled';
}

const ALLOWED: Record<AnalysisStatus, readonly AnalysisStatus[]> = {
  draft: ['in_progress', 'cancelled'],
  in_progress: ['under_review', 'cancelled'],
  under_review: ['approved', 'changes_requested', 'cancelled'],
  changes_requested: ['in_progress', 'under_review', 'cancelled'],
  approved: [],
  cancelled: [],
};

export function canTransitionAnalysis(from: AnalysisStatus, to: AnalysisStatus): boolean {
  return ALLOWED[from].includes(to);
}

export class InvalidAnalysisTransitionError extends Error {
  constructor(from: AnalysisStatus, to: AnalysisStatus) {
    super(`Transición de análisis no permitida: ${from} → ${to}.`);
    this.name = 'InvalidAnalysisTransitionError';
  }
}

export function assertAnalysisTransition(from: AnalysisStatus, to: AnalysisStatus): void {
  if (!canTransitionAnalysis(from, to)) throw new InvalidAnalysisTransitionError(from, to);
}

// --- Hipótesis / causas ------------------------------------------------------

export const HYPOTHESIS_STATUSES = [
  'pending',
  'evaluating',
  'discarded',
  'contributing',
  'probable',
  'confirmed',
] as const;
export type HypothesisStatus = (typeof HYPOTHESIS_STATUSES)[number];
export const HYPOTHESIS_STATUS_LABEL: Record<HypothesisStatus, string> = {
  pending: 'Pendiente',
  evaluating: 'En evaluación',
  discarded: 'Descartada',
  contributing: 'Contribuyente',
  probable: 'Causa probable',
  confirmed: 'Causa raíz confirmada',
};

export const QUAL_PROBABILITIES = ['low', 'medium', 'high', 'undetermined'] as const;
export type QualProbability = (typeof QUAL_PROBABILITIES)[number];
export const QUAL_PROBABILITY_LABEL: Record<QualProbability, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  undetermined: 'No determinada',
};

// --- Ishikawa ----------------------------------------------------------------

/** Categorías predeterminadas (6M). */
export const ISHIKAWA_DEFAULT_CATEGORIES = [
  'Mano de obra',
  'Método',
  'Maquinaria',
  'Materiales',
  'Medición',
  'Medio ambiente',
] as const;

// --- Árbol de causas ---------------------------------------------------------

export const CAUSE_NODE_TYPES = [
  'event',
  'consequence',
  'immediate_cause',
  'contributing_cause',
  'systemic_cause',
  'failed_control',
  'missing_barrier',
  'human_factor',
  'organizational_factor',
  'evidence',
  'other',
] as const;
export type CauseNodeType = (typeof CAUSE_NODE_TYPES)[number];
export const CAUSE_NODE_TYPE_LABEL: Record<CauseNodeType, string> = {
  event: 'Evento',
  consequence: 'Consecuencia',
  immediate_cause: 'Causa inmediata',
  contributing_cause: 'Causa contribuyente',
  systemic_cause: 'Causa sistémica',
  failed_control: 'Control fallido',
  missing_barrier: 'Barrera ausente',
  human_factor: 'Factor humano',
  organizational_factor: 'Factor organizacional',
  evidence: 'Evidencia',
  other: 'Otro',
};

export const CAUSE_EDGE_RELATIONS = [
  'caused',
  'contributed',
  'enabled',
  'aggravated',
  'evidence',
  'contradicts',
] as const;
export type CauseEdgeRelation = (typeof CAUSE_EDGE_RELATIONS)[number];
export const CAUSE_EDGE_RELATION_LABEL: Record<CauseEdgeRelation, string> = {
  caused: 'causó',
  contributed: 'contribuyó',
  enabled: 'permitió',
  aggravated: 'agravó',
  evidence: 'evidencia',
  contradicts: 'contradice',
};

/** Estado de validación reutilizable (nodos, causas, filas). */
export const VALIDATION_STATUSES = ['hypothesis', 'confirmed_fact', 'discarded'] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];
export const VALIDATION_STATUS_LABEL: Record<ValidationStatus, string> = {
  hypothesis: 'Hipótesis',
  confirmed_fact: 'Hecho confirmado',
  discarded: 'Descartada',
};

// --- AMEF --------------------------------------------------------------------

export const ACTION_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];
export const ACTION_PRIORITY_LABEL: Record<ActionPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

/** Configuración de escala AMEF por defecto (1–10). */
export const FMEA_DEFAULT_SCALE = {
  severityMax: 10,
  occurrenceMax: 10,
  detectionMax: 10,
  nprThresholds: { medium: 50, high: 100, critical: 200 },
} as const;

/** NPR = severidad × ocurrencia × detección (calculado en servidor). */
export function computeNpr(severity: number, occurrence: number, detection: number): number {
  return severity * occurrence * detection;
}

/** Valida que un valor de escala esté en el rango [1, max]. */
export function isValidScaleValue(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= max;
}

// --- Recurrencia -------------------------------------------------------------

export const RECURRENCE_CONFIRMATIONS = [
  'recurrent',
  'possibly_recurrent',
  'not_recurrent',
  'insufficient_evidence',
] as const;
export type RecurrenceConfirmation = (typeof RECURRENCE_CONFIRMATIONS)[number];
export const RECURRENCE_CONFIRMATION_LABEL: Record<RecurrenceConfirmation, string> = {
  recurrent: 'Recurrente',
  possibly_recurrent: 'Posiblemente recurrente',
  not_recurrent: 'No recurrente',
  insufficient_evidence: 'Evidencia insuficiente',
};

// --- Evidencia ---------------------------------------------------------------

export const ANALYSIS_EVIDENCE_ENTITIES = [
  'analysis',
  'ishikawa_category',
  'hypothesis',
  'cause_tree_node',
  'fmea_row',
  'recurrence',
  'conclusion',
] as const;
export type AnalysisEvidenceEntity = (typeof ANALYSIS_EVIDENCE_ENTITIES)[number];

// --- Participantes -----------------------------------------------------------

export const PARTICIPANT_ROLES = ['participant', 'reviewer', 'approver'] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

// --- Historial ---------------------------------------------------------------

export const ANALYSIS_HISTORY_EVENTS = [
  'analysis_created',
  'type_selected',
  'participant_added',
  'hypothesis_created',
  'cause_modified',
  'cause_discarded',
  'evidence_added',
  'node_created',
  'edge_created',
  'fmea_row_created',
  'npr_recalculated',
  'pareto_updated',
  'recurrence_confirmed',
  'conclusion_submitted',
  'changes_requested',
  'analysis_approved',
  'root_cause_sent_to_capa',
  'capa_action_created',
  'new_version',
  'analysis_cancelled',
] as const;
export type AnalysisHistoryEvent = (typeof ANALYSIS_HISTORY_EVENTS)[number];

// --- Cálculo de Pareto (puro) ------------------------------------------------

export interface ParetoInput {
  id?: string;
  category: string;
  count: number;
  cost?: number | null;
}

export interface ParetoRow extends ParetoInput {
  value: number;
  percentage: number;
  cumulativePercentage: number;
  vitalFew: boolean;
}

export interface ParetoResult {
  rows: ParetoRow[];
  total: number;
  cutoff: number;
  vitalFewCount: number;
}

/**
 * Calcula el Pareto: ordena descendente por valor (cantidad o costo), agrega
 * porcentaje individual y acumulado, y marca el "grupo vital" hasta el corte
 * (predeterminado 80 %). Determinista; empates se ordenan por categoría.
 */
export function computePareto(
  items: ParetoInput[],
  opts: { valueKey?: 'count' | 'cost'; cutoff?: number } = {},
): ParetoResult {
  const valueKey = opts.valueKey ?? 'count';
  const cutoff = opts.cutoff ?? 80;
  const valued = items.map((it) => ({
    ...it,
    value: valueKey === 'cost' ? (it.cost ?? 0) : it.count,
  }));
  const total = valued.reduce((sum, it) => sum + it.value, 0);
  const sorted = [...valued].sort((a, b) =>
    b.value !== a.value ? b.value - a.value : a.category.localeCompare(b.category),
  );

  let cumulative = 0;
  let reachedCutoff = false;
  const rows: ParetoRow[] = sorted.map((it) => {
    const percentage = total > 0 ? (it.value / total) * 100 : 0;
    cumulative += percentage;
    // El grupo vital incluye elementos hasta que el acumulado alcanza el corte.
    const vitalFew = !reachedCutoff;
    if (cumulative >= cutoff) reachedCutoff = true;
    return {
      ...it,
      percentage: round2(percentage),
      cumulativePercentage: round2(Math.min(cumulative, 100)),
      vitalFew: total > 0 ? vitalFew : false,
    };
  });

  return {
    rows,
    total: round2(total),
    cutoff,
    vitalFewCount: rows.filter((r) => r.vitalFew).length,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ParetoInsights {
  total: number;
  categories: number;
  vitalCount: number;
  vitalCumulative: number; // % acumulado del grupo vital
  topCategory: string | null;
  topPercentage: number;
  cutoff: number;
  cutoffPosition: number | null; // ranking (1-based) donde se supera el corte
}

/**
 * Resumen de interpretación del Pareto a partir de datos YA calculados por
 * `computePareto` (no recalcula ni inventa métricas). Devuelve null si no hay
 * datos.
 */
export function paretoInsights(result: ParetoResult): ParetoInsights | null {
  if (result.rows.length === 0 || result.total <= 0) return null;
  const vital = result.rows.filter((r) => r.vitalFew);
  const last = vital[vital.length - 1];
  const cutoffIdx = result.rows.findIndex((r) => r.cumulativePercentage >= result.cutoff);
  const top = result.rows[0];
  return {
    total: result.total,
    categories: result.rows.length,
    vitalCount: result.vitalFewCount,
    vitalCumulative: last?.cumulativePercentage ?? 0,
    topCategory: top?.category ?? null,
    topPercentage: top?.percentage ?? 0,
    cutoff: result.cutoff,
    cutoffPosition: cutoffIdx >= 0 ? cutoffIdx + 1 : null,
  };
}

// --- Detección de ciclos del árbol de causas (puro) --------------------------

export interface Edge {
  fromNodeId: string;
  toNodeId: string;
}

/**
 * Indica si agregar la arista `from → to` crearía un ciclo dirigido, es decir,
 * si ya existe un camino de `to` de vuelta a `from` (o si from === to).
 */
export function wouldCreateCycle(edges: Edge[], from: string, to: string): boolean {
  if (from === to) return true;
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    const list = adjacency.get(e.fromNodeId) ?? [];
    list.push(e.toNodeId);
    adjacency.set(e.fromNodeId, list);
  }
  // ¿Existe camino de `to` a `from`?
  const seen = new Set<string>();
  const stack = [to];
  while (stack.length > 0) {
    const node = stack.pop() as string;
    if (node === from) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    for (const next of adjacency.get(node) ?? []) stack.push(next);
  }
  return false;
}
