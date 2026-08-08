'use client';

import { useActionState, useState } from 'react';
import { SubmitButton } from '../../../../documents/_components/SubmitButton';
import {
  ANALYSIS_TYPES,
  ANALYSIS_TYPE_HELP,
  ANALYSIS_TYPE_LABEL,
  type AnalysisType,
} from '@/features/capa/analysis-state';
import { createAnalysisAction, type FormState } from '../analysis-actions';

const ICON: Partial<Record<AnalysisType, string>> = {
  ishikawa: '🐟',
  cause_tree: '🌳',
  pareto: '📊',
  fmea: '🧮',
  recurrence: '🔁',
  comparative: '🔀',
  freeform: '📝',
};

export function NewAnalysisForm({
  capaId,
  members,
}: {
  capaId: string;
  members: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(
    createAnalysisAction,
    null,
  );
  const [type, setType] = useState<AnalysisType>('ishikawa');

  return (
    <form action={formAction} className="doc-form">
      <input type="hidden" name="capaId" value={capaId} />
      <input type="hidden" name="type" value={type} />
      <fieldset className="tool-cards">
        <legend>Elige una herramienta</legend>
        <div className="tool-grid">
          {ANALYSIS_TYPES.map((t) => (
            <button
              type="button"
              key={t}
              className={`tool-card${type === t ? ' is-active' : ''}`}
              onClick={() => setType(t)}
              aria-pressed={type === t}
            >
              <span className="tool-card__icon" aria-hidden>
                {ICON[t] ?? '•'}
              </span>
              <span className="tool-card__title">{ANALYSIS_TYPE_LABEL[t]}</span>
              <span className="tool-card__help">{ANALYSIS_TYPE_HELP[t]}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="doc-form__full">
        Título *
        <input name="title" required placeholder={`${ANALYSIS_TYPE_LABEL[type]} de…`} />
      </label>
      <div className="form-grid">
        <label>
          Objetivo
          <input name="objective" />
        </label>
        <label>
          Alcance
          <input name="scope" />
        </label>
        <label>
          Responsable
          <select name="responsibleUserId" defaultValue="">
            <option value="">— Yo —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-actions">
        <SubmitButton pendingLabel="Creando…">Crear análisis</SubmitButton>
        {state && !state.ok && (
          <span role="status" className="msg msg--error">
            {state.message}
            {state.errors && state.errors.length > 0 ? ` — ${state.errors.join(' ')}` : ''}
          </span>
        )}
      </div>
    </form>
  );
}
