'use client';

import { ActionForm } from './ActionForm';
import { addWhyAction, updateWhyAction, discardWhyAction } from '../actions';

export interface WhyRow {
  id: string;
  statement: string;
  parentId: string | null;
  evidence: string | null;
  note: string | null;
}

/** Ordena la cadena lineal siguiendo la relación padre→hijo. */
function orderChain(rows: WhyRow[]): WhyRow[] {
  const byParent = new Map<string | null, WhyRow>();
  for (const r of rows) byParent.set(r.parentId, r);
  const out: WhyRow[] = [];
  let cur = byParent.get(null) ?? rows[0];
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur);
    cur = byParent.get(cur.id);
  }
  // Añade cualquier nivel no alcanzado (por si hay ramas).
  for (const r of rows) if (!seen.has(r.id)) out.push(r);
  return out;
}

/** Cadena de 5 Porqués (longitud variable). La causa raíz la propone el responsable. */
export function FiveWhysWorkspace({
  analysisId,
  problem,
  steps,
  editable,
}: {
  analysisId: string;
  problem: string;
  steps: WhyRow[];
  editable: boolean;
}) {
  const chain = orderChain(steps);
  const leaf = chain[chain.length - 1] ?? null;

  return (
    <div className="fivewhys">
      <div className="fivewhys__problem">
        <span className="field__label">Problema</span>
        <p>{problem || 'Define el problema en los datos del análisis.'}</p>
      </div>

      {chain.length === 0 ? (
        <p className="empty-state">Agrega el primer “¿por qué?”.</p>
      ) : (
        <ol className="fivewhys__chain">
          {chain.map((w, i) => (
            <li key={w.id} className="fivewhys__step">
              <div className="fivewhys__q">¿Por qué? {i + 1}</div>
              <p className="fivewhys__a">{w.statement}</p>
              {w.evidence && <p className="fivewhys__ev">Evidencia: {w.evidence}</p>}
              {w.note && <p className="fivewhys__note">Nota: {w.note}</p>}
              {editable && (
                <div className="fivewhys__step-actions no-print">
                  <ActionForm
                    action={updateWhyAction}
                    hidden={{ analysisId, hypothesisId: w.id }}
                    button="Guardar evidencia/nota"
                  >
                    <input
                      name="evidence"
                      defaultValue={w.evidence ?? ''}
                      placeholder="Evidencia"
                    />
                    <input name="note" defaultValue={w.note ?? ''} placeholder="Nota" />
                  </ActionForm>
                  {w.id === leaf?.id && chain.length > 1 && (
                    <ActionForm
                      action={discardWhyAction}
                      hidden={{ analysisId, hypothesisId: w.id }}
                      button="Quitar nivel"
                      confirm="¿Quitar el último nivel?"
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {editable && (
        <div className="fivewhys__add no-print">
          <h4>{chain.length === 0 ? 'Primer “¿por qué?”' : 'Agregar el siguiente “¿por qué?”'}</h4>
          <ActionForm
            action={addWhyAction}
            hidden={{
              analysisId,
              ...(leaf ? { parentHypothesisId: leaf.id } : {}),
            }}
            button="Agregar nivel"
            variant="primary"
            className="doc-form"
          >
            <label className="field field--full">
              <span className="field__label">Respuesta</span>
              <input name="statement" required placeholder="Porque…" />
            </label>
            <label className="field field--full">
              <span className="field__label">Evidencia (opcional)</span>
              <input name="evidence" placeholder="Registro, dato o hallazgo que lo respalda" />
            </label>
          </ActionForm>
          <p className="field-hint">
            La cadena no está limitada a cinco niveles: agrega los que necesites o concluye antes.
          </p>
        </div>
      )}
    </div>
  );
}
