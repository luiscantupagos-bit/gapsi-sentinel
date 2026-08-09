'use client';

import { useActionState } from 'react';
import { SubmitButton } from '../../documents/_components/SubmitButton';
import { addLinkedAnalysisAction, type FormState } from '../link-actions';

/**
 * Formulario reutilizable para iniciar un análisis (5 Porqués o FTA) vinculado a
 * un origen (proyecto/hallazgo/evento). No duplica el origen.
 */
export function AddAnalysisForm({
  relationType,
  targetId,
  revalidate,
  label = 'Agregar análisis',
}: {
  relationType: 'project' | 'audit_finding' | 'quality_event';
  targetId: string;
  revalidate: string;
  label?: string;
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(
    addLinkedAnalysisAction,
    null,
  );
  return (
    <details className="more-actions">
      <summary>{label}</summary>
      <form action={formAction} className="filter-bar">
        <input type="hidden" name="relationType" value={relationType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="revalidate" value={revalidate} />
        <label className="field">
          <span className="field__label">Herramienta</span>
          <select name="type" defaultValue="5whys">
            <option value="5whys">5 Porqués</option>
            <option value="fta">Árbol de Fallas (FTA)</option>
          </select>
        </label>
        <label className="field field--full">
          <span className="field__label">Título / problema</span>
          <input name="title" required placeholder="Describe qué se investigará" />
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
