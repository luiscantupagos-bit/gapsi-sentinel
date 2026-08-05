'use client';

import { useActionState } from 'react';
import { DOC_TEMPLATES } from '@/features/documents/templates';
import { DOCUMENT_TYPES } from '@/features/documents/catalog';
import { createEditorDocumentAction, type FormState } from '../editor-actions';
import { SubmitButton } from '../_components/SubmitButton';

export function NewEditorForm() {
  const [state, action] = useActionState<FormState | null, FormData>(
    createEditorDocumentAction,
    null,
  );

  return (
    <form action={action} className="doc-form">
      {state && !state.ok && (
        <div role="alert" className="msg msg--error">
          <p>{state.message}</p>
          {state.errors && (
            <ul>
              {state.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="form-grid">
        <label>
          Plantilla *
          <select name="templateKey" defaultValue="procedure" required>
            {DOC_TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo documental *
          <select name="documentType" defaultValue="procedure">
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Código *
          <input name="code" required />
        </label>
        <label>
          Título *
          <input name="title" required />
        </label>
      </div>
      <div className="form-actions">
        <SubmitButton pendingLabel="Creando…">Crear y editar</SubmitButton>
      </div>
    </form>
  );
}
