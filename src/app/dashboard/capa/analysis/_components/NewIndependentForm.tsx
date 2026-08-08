'use client';

import { useActionState } from 'react';
import { SubmitButton } from '../../../documents/_components/SubmitButton';
import { createIndependentAnalysisAction, type FormState } from '../actions';

/** Crea un 5 Porqués o FTA independiente (sin origen) desde la biblioteca. */
export function NewIndependentForm() {
  const [state, formAction] = useActionState<FormState | null, FormData>(
    createIndependentAnalysisAction,
    null,
  );
  return (
    <details className="more-actions">
      <summary>Nuevo análisis independiente</summary>
      <form action={formAction} className="filter-bar">
        <label className="field">
          <span className="field__label">Herramienta</span>
          <select name="type" defaultValue="5whys">
            <option value="5whys">5 Porqués</option>
            <option value="fta">Árbol de Fallas (FTA)</option>
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
