/**
 * HACCP-004 — helpers PUROS de la selección de medidas de control (árbol de decisión,
 * clasificación PPR/PPRO/PCC, completitud del plan). El resolver está CENTRALIZADO (no se
 * dispersa por el frontend). La metodología por defecto es un árbol de decisión configurable
 * y versionado; el resultado + camino de respuestas se guardan como snapshot para auditoría.
 * HACCP-004 NO implementa monitoreo operativo (DOC-004) ni validación (HACCP-005).
 */

// --- Clasificación -----------------------------------------------------------
export const HACCP_CLASSIFICATIONS = [
  'ppr',
  'ppro',
  'pcc',
  'other',
  'review_required',
  // HACCP-CONTROL-TREE-P1-P8: el peligro se controla en otra etapa / por sinergia / por el uso
  // previsto (desenlaces P3/P4/P5 = Sí): no es PCC/PPRO/PPR en esta medida.
  'controlled_elsewhere',
] as const;
export type HaccpClassification = (typeof HACCP_CLASSIFICATIONS)[number];

export const HACCP_CLASSIFICATION_LABEL: Record<HaccpClassification, string> = {
  ppr: 'PPR (prerrequisito)',
  ppro: 'PPRO (prerrequisito operativo)',
  pcc: 'PCC (punto crítico de control)',
  other: 'Otro',
  review_required: 'Revisión requerida',
  controlled_elsewhere: 'Controlado en otra etapa',
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
 * HACCP-CONTROL-TREE-P1-P8 — árbol de decisión REAL (P1..P8) para la determinación de la medida
 * de control (PPR/PPRO/PCC) y su desenlace «Controlado en otra etapa». Transcrito fielmente de un
 * plan HACCP en operación (basado en el árbol de decisión de ISO 22000). El resultado + el camino
 * de respuestas (con el TEXTO de cada pregunta como snapshot) quedan como EVIDENCIA de cómo se
 * tomó la decisión. Reemplaza al árbol provisional anterior. Todo es config: el resolver es genérico.
 */
export const DEFAULT_DECISION_TREE: DecisionTree = {
  key: 'iso22000-p1p8',
  version: '1',
  start: 'P1',
  questions: [
    {
      id: 'P1',
      order: 1,
      text: '¿El grado de control aplicado a esta medida es suficientemente riguroso?',
      help: 'No: modifica el grado de control, la medida, el proceso o el producto y reevalúa.',
      answers: { yes: { next: 'P2' }, no: { result: 'review_required' } },
    },
    {
      id: 'P2',
      order: 2,
      text: '¿Ha sido la medida de control diseñada específicamente para eliminar o reducir a un nivel aceptable la presencia del peligro?',
      answers: { yes: { next: 'P6' }, no: { next: 'P3' } },
    },
    {
      id: 'P3',
      order: 3,
      text: '¿Existe alguna etapa de proceso o medida de control subsecuente que elimine o reduzca a niveles aceptables el peligro identificado?',
      help: 'Sí: el peligro se controla en esa etapa posterior; identifícala en la justificación.',
      answers: { yes: { result: 'controlled_elsewhere' }, no: { next: 'P4' } },
    },
    {
      id: 'P4',
      order: 4,
      text: '¿Hay efectos de sinergia con otras medidas de control o etapas de proceso que eliminen o reduzcan a niveles aceptables el peligro identificado?',
      help: 'Sí: el peligro se controla por sinergia; identifica la medida/etapa en la justificación.',
      answers: { yes: { result: 'controlled_elsewhere' }, no: { next: 'P5' } },
    },
    {
      id: 'P5',
      order: 5,
      text: '¿El uso esperado por el consumidor elimina o reduce a niveles aceptables el peligro identificado?',
      help: 'Sí: el peligro se controla por el uso previsto; identifícalo en la justificación.',
      answers: { yes: { result: 'controlled_elsewhere' }, no: { next: 'P7' } },
    },
    {
      id: 'P6',
      order: 6,
      text: '¿Se garantiza la inocuidad aún cuando la medida de control falle?',
      help: 'Sí: no es PCC ni PPRO (el peligro queda controlado a nivel de prerrequisito, PPR).',
      answers: { yes: { result: 'ppr' }, no: { next: 'P7' } },
    },
    {
      id: 'P7',
      order: 7,
      text: 'Para esta medida de control, ¿se pueden establecer límites críticos?',
      answers: { yes: { next: 'P8' }, no: { result: 'ppro' } },
    },
    {
      id: 'P8',
      order: 8,
      text: '¿Se pueden realizar correcciones de manera inmediata cuando falla la medida de control?',
      answers: { yes: { result: 'pcc' }, no: { result: 'ppro' } },
    },
  ],
};

/** Respuesta capturada (entrada del asistente). */
export interface AnswerRecord {
  questionId: string;
  answer: TreeAnswer;
}

/**
 * Paso del camino recorrido, con el TEXTO de la pregunta como SNAPSHOT (§evidencia). Autocontenido:
 * la evidencia no depende de la versión vigente del árbol.
 */
export interface PathRecord {
  questionId: string;
  questionText: string;
  answer: TreeAnswer;
}

export interface ResolveResult {
  classification: HaccpClassification | null; // null = incompleto (falta responder)
  path: PathRecord[]; // camino efectivamente recorrido (snapshot con texto)
  nextQuestionId: string | null; // siguiente pregunta pendiente, o null si terminó
}

/** Recorre el árbol siguiendo las respuestas; devuelve la clasificación o la siguiente pregunta. */
export function resolveClassification(tree: DecisionTree, answers: AnswerRecord[]): ResolveResult {
  const byId = new Map(tree.questions.map((q) => [q.id, q]));
  const answerOf = new Map(answers.map((a) => [a.questionId, a.answer]));
  const path: PathRecord[] = [];
  let currentId: string | null = tree.start;
  const guard = new Set<string>();
  while (currentId) {
    if (guard.has(currentId)) break; // evita ciclos
    guard.add(currentId);
    const q = byId.get(currentId);
    if (!q) break;
    const answer = answerOf.get(currentId);
    if (!answer) return { classification: null, path, nextQuestionId: currentId };
    path.push({ questionId: currentId, questionText: q.text, answer }); // snapshot del texto
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
