// CORE-ALIGN-003 Fase 5 — 5 Porqués, dominio puro.
//
// Herramienta FORMAL e independiente de 5W2H. Un problema inicial y una cadena de
// "por qué" de longitud VARIABLE (no forzada a cinco). Cada nivel admite evidencia
// y notas. Se puede concluir antes o añadir más niveles. La causa raíz la PROPONE
// el responsable: nunca se infiere automáticamente. Interpretación prudente.

export interface WhyStep {
  id: string;
  order: number;
  statement: string; // la respuesta al "¿por qué?" de ese nivel
  evidence?: string | null;
  note?: string | null;
}

export interface FiveWhysModel {
  problem: string;
  steps: WhyStep[];
  /** Causa raíz propuesta explícitamente por una persona (texto libre). */
  proposedRootCause: string | null;
  /** Marca de que la causa raíz fue capturada por el responsable, no inferida. */
  rootCauseByUser: boolean;
  conclusion: string | null;
}

/** Ordena los niveles y renumera de forma estable (1..n). */
export function orderedSteps(steps: WhyStep[]): WhyStep[] {
  return [...steps]
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((s, i) => ({ ...s, order: i + 1 }));
}

/** Valida el modelo. Devuelve errores (vacío = válido). No infiere causa raíz. */
export function validateFiveWhys(model: FiveWhysModel): string[] {
  const errors: string[] = [];
  if (!model.problem?.trim()) errors.push('Define el problema inicial.');
  const steps = orderedSteps(model.steps);
  if (steps.length === 0) errors.push('Agrega al menos un "por qué".');
  for (const s of steps) {
    if (!s.statement?.trim()) errors.push(`El nivel ${s.order} está vacío.`);
  }
  // La causa raíz, si se marca como propuesta, debe tener texto capturado por una
  // persona: el sistema nunca la deduce.
  if (model.proposedRootCause !== null && !model.proposedRootCause.trim())
    errors.push('La causa raíz propuesta no puede estar vacía.');
  return [...new Set(errors)];
}

/** ¿Puede concluirse? Requiere problema, ≥1 nivel y causa raíz propuesta por el responsable. */
export function canConclude(model: FiveWhysModel): boolean {
  return (
    validateFiveWhys(model).length === 0 &&
    model.rootCauseByUser &&
    Boolean(model.proposedRootCause && model.proposedRootCause.trim())
  );
}

export interface FiveWhysSummary {
  principal: string;
  detail: string;
  nextStep: string;
}

export function interpretFiveWhys(model: FiveWhysModel): FiveWhysSummary {
  const steps = orderedSteps(model.steps);
  const depth = steps.length;
  return {
    principal: model.problem
      ? `Cadena de ${depth} nivel(es) desde "${truncate(model.problem, 60)}".`
      : '5 Porqués en construcción.',
    detail: model.proposedRootCause
      ? `Causa raíz propuesta por el responsable: "${truncate(model.proposedRootCause, 80)}".`
      : 'Aún no se ha propuesto una causa raíz. Sentinel no la deduce automáticamente.',
    nextStep: model.rootCauseByUser
      ? 'Verifica la causa raíz con evidencia y define acciones. El número de niveles es orientativo, no una regla fija.'
      : 'Continúa preguntando "por qué" o concluye cuando el responsable identifique la causa raíz.',
  };
}

function truncate(s: string, n: number): string {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}
