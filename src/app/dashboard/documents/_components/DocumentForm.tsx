'use client';

import { useActionState } from 'react';
import {
  CONFIDENTIALITY_LEVELS,
  DOCUMENT_ORIGINS,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
} from '@/features/documents/catalog';
import type { ActionState } from '../actions';
import { SubmitButton } from './SubmitButton';

export interface DocumentFormInitial {
  documentId?: string;
  code?: string;
  title?: string;
  description?: string | null;
  documentType?: string;
  origin?: string;
  status?: string;
  confidentiality?: string;
  versionLabel?: string;
  siteId?: string | null;
  responsibleUserId?: string | null;
  ownerArea?: string | null;
  issuedAt?: string | null;
  nextReviewAt?: string | null;
}

export function DocumentForm({
  mode,
  action,
  sites,
  responsibles,
  initial = {},
}: {
  mode: 'create' | 'edit';
  action: (prev: ActionState | null, formData: FormData) => Promise<ActionState>;
  sites: { id: string; name: string }[];
  responsibles: { id: string; name: string }[];
  initial?: DocumentFormInitial;
}) {
  const [state, formAction] = useActionState<ActionState | null, FormData>(action, null);

  return (
    <form action={formAction} className="doc-form" encType="multipart/form-data">
      {mode === 'edit' && <input type="hidden" name="documentId" value={initial.documentId} />}

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
        {mode === 'create' ? (
          <label>
            Código *
            <input name="code" required defaultValue={initial.code ?? ''} />
          </label>
        ) : (
          <label>
            Código
            <input value={initial.code ?? ''} disabled />
          </label>
        )}

        <label>
          Título *
          <input name="title" required defaultValue={initial.title ?? ''} />
        </label>

        <label>
          Tipo documental *
          <select name="documentType" defaultValue={initial.documentType ?? 'procedure'}>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Origen
          <select
            name="origin"
            defaultValue={initial.origin ?? 'internal'}
            disabled={mode === 'edit'}
          >
            {DOCUMENT_ORIGINS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Estado
          <select name="status" defaultValue={initial.status ?? 'draft'}>
            {DOCUMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Confidencialidad
          <select name="confidentiality" defaultValue={initial.confidentiality ?? 'internal'}>
            {CONFIDENTIALITY_LEVELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        {mode === 'create' && (
          <label>
            Versión inicial *
            <input name="versionLabel" required defaultValue={initial.versionLabel ?? 'v1'} />
          </label>
        )}

        <label>
          Sitio / alcance
          <select name="siteId" defaultValue={initial.siteId ?? ''}>
            <option value="">— Sin sitio —</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Responsable
          <select name="responsibleUserId" defaultValue={initial.responsibleUserId ?? ''}>
            <option value="">— Sin responsable —</option>
            {responsibles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Área responsable
          <input name="ownerArea" defaultValue={initial.ownerArea ?? ''} />
        </label>

        <label>
          Fecha de emisión
          <input type="date" name="issuedAt" defaultValue={initial.issuedAt ?? ''} />
        </label>

        <label>
          Próxima revisión
          <input type="date" name="nextReviewAt" defaultValue={initial.nextReviewAt ?? ''} />
        </label>
      </div>

      <label className="doc-form__full">
        Descripción
        <textarea name="description" rows={3} defaultValue={initial.description ?? ''} />
      </label>

      {mode === 'create' && (
        <label className="doc-form__full">
          Archivo principal (opcional; PDF, DOC(X), XLS(X), PNG, JPG — máx. 10 MB)
          <input type="file" name="mainFile" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" />
        </label>
      )}

      <div className="form-actions">
        <SubmitButton pendingLabel={mode === 'create' ? 'Registrando…' : 'Guardando…'}>
          {mode === 'create' ? 'Registrar documento' : 'Guardar cambios'}
        </SubmitButton>
      </div>
    </form>
  );
}
