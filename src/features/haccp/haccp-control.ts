/**
 * HACCP-004 — helpers PUROS de la selección de medidas de control (árbol de decisión,
 * clasificación PPR/PPRO/PCC, completitud del plan). El resolver está CENTRALIZADO (no se
 * dispersa por el frontend). La metodología por defecto es un árbol de decisión configurable
 * y versionado; el resultado + camino de respuestas se guardan como snapshot para auditoría.
 * HACCP-004 NO implementa monitoreo operativo (DOC-004) ni validación (HACCP-005).
 */

// --- Clasificación -----------------------------------------------------------
export const HACCP_CLASSIFICATIONS = ['ppr', 'ppro', 'pcc', 'other', 'review_required'] as const;
export type HaccpClassification = (typeof HACCP_CLASSIFICATIONS)[number];

export const HACCP_CLASSIFICATION_LABEL: Record<HaccpClassification, string> = {
  ppr: 'PPR (prerrequisito)',
  ppro: 'PPRO (prerrequisito operativo)',
  pcc: 'PCC (punto crítico de control)',
  other: 'Otro',
  review_required: 'Revisión requerida',
};

export const classificationLabel = (c: string): string =>
  HACCP_CLASSIFICATION_LABEL[c as HaccpClassification] ?? c;

export type TreeAnswer = 'yes' | 'no' | 'na';
export const ANSWER_LABEL: Record<TreeAnswer, string> = { yes: 'Sí', no: 'No', na: 'N.A.' };

// --- Árbol de decisión (config versionada) -----------------------------------
export interface TreeBranch {
  next?: string;
  result?: HaccpClassification;
}
export interface TreeQuestion {
  id: string;
  order: number;
  text: string;
  help?: string;
  answers: { yes: TreeBranch; no: TreeBranch; na?: TreeBranch };
}
export interface DecisionTree {
  key: string;
  version: string;
  start: string;
  questions: TreeQuestion[];
}

/**
 * Árbol por defecto (ISO 22000 / Codex-flavored). PLACEHOLDER metodológico razonable y
 * DEFENDIBLE, no una invención arbitraria: distingue PPR/PPRO/PCC. Puede reemplazarse por el
 * P1..P8 real de la organización sin tocar el resolver (todo es config).
 */
export const DEFAULT_DECISION_TREE: DecisionTree = {
  key: 'default',
  version: '1',
  start: 'P1',
  questions: [
    {
      id: 'P1',
      order: 1,
      text: '¿La medida de control actúa específicamente sobre este peligro significativo (y no es un prerrequisito general de higiene)?',
      help: 'Si el peligro se gestiona con un programa de prerrequisitos general, se clasifica como PPR.',
      answers: { yes: { next: 'P2' }, no: { result: 'ppr' }, na: { result: 'review_required' } },
    },
    {
      id: 'P2',
      order: 2,
      text: '¿Es posible establecer un límite crítico medible u observable para esta medida en esta etapa?',
      help: 'Un PCC requiere un límite crítico. Si solo hay un criterio de acción, tiende a PPRO.',
      answers: { yes: { next: 'P3' }, no: { result: 'ppro' } },
    },
    {
      id: 'P3',
      order: 3,
      text: '¿La pérdida de control en esta etapa podría permitir que el peligro alcance al consumidor sin que una etapa posterior lo elimine o reduzca a un nivel aceptable?',
      help: 'Si una etapa posterior controla el peligro, esta etapa no es PCC.',
      answers: { yes: { result: 'pcc' }, no: { result: 'ppro' } },
    },
  ],
};

export interface AnswerRecord {
  questionId: string;
  answer: TreeAnswer;
}

export interface ResolveResult {
  classification: HaccpClassification | null; // null = incompleto (falta responder)
  path: AnswerRecord[]; // camino efectivamente recorrido (snapshot)
  nextQuestionId: string | null; // siguiente pregunta pendiente, o null si terminó
}

/** Recorre el árbol siguiendo las respuestas; devuelve la clasificación o la siguiente pregunta. */
export function resolveClassification(tree: DecisionTree, answers: AnswerRecord[]): ResolveResult {
  const byId = new Map(tree.questions.map((q) => [q.id, q]));
  const answerOf = new Map(answers.map((a) => [a.questionId, a.answer]));
  const path: AnswerRecord[] = [];
  let currentId: string | null = tree.start;
  const guard = new Set<string>();
  while (currentId) {
    if (guard.has(currentId)) break; // evita ciclos
    guard.add(currentId);
    const q = byId.get(currentId);
    if (!q) break;
    const answer = answerOf.get(currentId);
    if (!answer) return { classification: null, path, nextQuestionId: currentId };
    path.push({ questionId: currentId, answer });
    const branch = q.answers[answer];
    if (!branch) return { classification: null, path, nextQuestionId: currentId };
    if (branch.result) return { classification: branch.result, path, nextQuestionId: null };
    currentId = branch.next ?? null;
  }
  return { classification: null, path, nextQuestionId: null };
}

// --- Completitud del plan de control (§12/§23) -------------------------------
export interface ControlPlanFields {
  controlMeasure?: string | null;
  criticalLimit?: string | null;
  actionCriterion?: string | null;
  monitoringWhat?: string | null;
  monitoringHow?: string | null;
  monitoringWho?: string | null;
  monitoringWhen?: string | null;
  correctiveAction?: string | null;
  recordReference?: string | null;
}

const filled = (v: string | null | undefined) => Boolean(v && v.trim());

/** ¿El plan de control está completo según su clasificación? (No se fuerzan los mismos campos). */
export function isControlPlanComplete(
  classification: string,
  plan: ControlPlanFields | null | undefined,
): boolean {
  if (!plan) return false;
  const mon =
    filled(plan.monitoringWhat) &&
    filled(plan.monitoringHow) &&
    filled(plan.monitoringWho) &&
    filled(plan.monitoringWhen);
  if (classification === 'pcc')
    return (
      filled(plan.controlMeasure) &&
      filled(plan.criticalLimit) &&
      mon &&
      filled(plan.correctiveAction)
    );
  if (classification === 'ppro')
    return (
      filled(plan.controlMeasure) &&
      filled(plan.actionCriterion) &&
      mon &&
      filled(plan.correctiveAction)
    );
  if (classification === 'ppr') return filled(plan.controlMeasure) || filled(plan.recordReference);
  return filled(plan.controlMeasure);
}

// --- Completitud global (§24) ------------------------------------------------
export interface ControlCompletenessInput {
  significantHazards: number;
  evaluated: number;
  pcc: number;
  ppro: number;
  ppr: number;
  incompletePlans: number;
}
export function controlMeasureCompleteness(i: ControlCompletenessInput) {
  return {
    significant: i.significantHazards,
    evaluated: i.evaluated,
    pending: Math.max(0, i.significantHazards - i.evaluated),
    pcc: i.pcc,
    ppro: i.ppro,
    ppr: i.ppr,
    incompletePlans: i.incompletePlans,
  };
}
