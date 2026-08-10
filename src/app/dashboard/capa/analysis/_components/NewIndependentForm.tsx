'use client';

import { useActionState } from 'react';
import { SubmitButton } from '../../../documents/_components/SubmitButton';
import { createIndependentAnalysisAction, type FormState } from '../actions';
import { TOOL_CATEGORY_LABEL, groupedTools } from '@/features/analysis/tool-catalog';

/** Crea cualquier herramienta de análisis (o un Estudio) independiente del catálogo. */
export function NewIndependentForm() {
  const [state, formAction] = useActionState<FormState | null, FormData>(
    createIndependentAnalysisAction,
    null,
  );
  const groups = groupedTools('independent');
  return (
    <details className="more-actions">
      <summary>Nuevo análisis independiente</summary>
      <form action={formAction} className="filter-bar">
        <label className="field">
          <span className="field__label">Herramienta</span>
          <select name="type" defaultValue="5whys">
            {groups.map((g) => (
              <optgroup key={g.category} label={TOOL_CATEGORY_LABEL[g.category]}>
                {g.tools.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="field field--full">
          <span className="field__label">Título / problema</span>
          <input name="title" required placeholder="p. ej. Rebaba recurrente en pieza X" />
        </label>
        <SubmitButton variant="primary" pendingLabel="Creando…">
          Crear y abrir
        </SubmitButton>
        {state && !state.ok && (
          <span role="status" className="msg msg--error">
            {state.message}
            {state.errors ? ` — ${state.errors.join(' ')}` : ''}
          </span>
        )}
      </form>
    </details>
  );
}
