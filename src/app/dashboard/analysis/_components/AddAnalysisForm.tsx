'use client';

import { useActionState } from 'react';
import { SubmitButton } from '../../documents/_components/SubmitButton';
import { addLinkedAnalysisAction, type FormState } from '../link-actions';
import {
  TOOL_CATEGORY_LABEL,
  groupedTools,
  type OriginType,
} from '@/features/analysis/tool-catalog';

/**
 * Formulario reutilizable para iniciar un análisis vinculado a un origen
 * (proyecto/hallazgo/evento). Consume el catálogo COMPARTIDO de herramientas con
 * selector agrupado. No duplica el origen ni obliga a crear CAPA.
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
  const groups = groupedTools(relationType as OriginType);
  const firstTool = groups[0]?.tools[0]?.id ?? '5whys';

  return (
    <details className="more-actions">
      <summary>{label}</summary>
      <form action={formAction} className="filter-bar">
        <input type="hidden" name="relationType" value={relationType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="revalidate" value={revalidate} />
        <label className="field">
          <span className="field__label">Herramienta</span>
          <select name="type" defaultValue={firstTool}>
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
