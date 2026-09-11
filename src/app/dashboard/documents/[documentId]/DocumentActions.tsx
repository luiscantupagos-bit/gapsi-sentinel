'use client';

import { useActionState, useState } from 'react';
import type { ActionState } from '../actions';
import { addAttachmentAction, archiveDocumentAction, createVersionAction } from '../actions';
import { SubmitButton } from '../_components/SubmitButton';
import { nextVersionLabel, type VersionBump } from '@/features/documents/versioning';

function Message({ state }: { state: ActionState | null }) {
  if (!state) return null;
  return (
    <span role="status" className={state.ok ? 'msg msg--ok' : 'msg msg--error'}>
      {state.message}
    </span>
  );
}

/**
 * Formulario de nueva versión (DOC-CHANGE-CONTROL §17): el usuario elige menor/mayor y
 * la UI calcula y muestra la versión resultante; la descripción de los cambios es
 * obligatoria (se valida también en el servidor al publicar > v1.0).
 */
function NewVersionForm({
  documentId,
  latestVersionLabel,
  action,
  state,
}: {
  documentId: string;
  latestVersionLabel: string;
  action: (formData: FormData) => void;
  state: ActionState | null;
}) {
  const [bump, setBump] = useState<VersionBump>('minor');
  const nextLabel = nextVersionLabel(latestVersionLabel, bump);

  return (
    <form action={action} className="doc-action">
      <input type="hidden" name="documentId" value={documentId} />
      <p className="field-hint">
        Versión actual: <strong>{latestVersionLabel}</strong> → nueva versión:{' '}
        <strong>{nextLabel}</strong>
      </p>
      <label>
        Tipo de cambio
        <select
          name="bump"
          value={bump}
          onChange={(e) => setBump(e.target.value === 'major' ? 'major' : 'minor')}
        >
          <option value="minor">Cambio menor (p. ej. 1.0 → 1.1)</option>
          <option value="major">Cambio mayor (p. ej. 1.0 → 2.0)</option>
        </select>
      </label>
      <label>
        Descripción de los cambios
        <textarea
          name="changeNotes"
          rows={2}
          placeholder="Describe qué cambió en esta versión"
          required
        />
      </label>
      <details className="field-help">
        <summary>¿Cuándo es menor y cuándo es mayor?</summary>
        <p>
          <strong>Cambio menor</strong> (1.0 → 1.1): ajuste que no modifica sustancialmente el
          proceso (redacción, formato, aclaración, referencia).
        </p>
        <p>
          <strong>Cambio mayor</strong> (1.0 → 2.0): modificación sustancial del proceso, del
          alcance, de responsabilidades críticas o de requisitos.
        </p>
      </details>
      <SubmitButton variant="ghost" pendingLabel="Creando…">
        Crear nueva versión
      </SubmitButton>
      <Message state={state} />
    </form>
  );
}

export function DocumentActions({
  documentId,
  editable,
  latestVersionLabel = 'v1.0',
  existingDraft = null,
}: {
  documentId: string;
  editable: boolean;
  latestVersionLabel?: string | null;
  existingDraft?: { label: string; href: string } | null;
}) {
  const [attachState, attachAction] = useActionState<ActionState | null, FormData>(
    addAttachmentAction,
    null,
  );
  const [versionState, versionAction] = useActionState<ActionState | null, FormData>(
    createVersionAction,
    null,
  );
  const [archiveState, archiveAction] = useActionState<ActionState | null, FormData>(
    archiveDocumentAction,
    null,
  );

  if (!editable) {
    return (
      <p className="msg msg--info" role="status">
        Documento archivado: no admite nuevas acciones de edición.
      </p>
    );
  }

  return (
    <div className="doc-actions">
      <form action={attachAction} encType="multipart/form-data" className="doc-action">
        <input type="hidden" name="documentId" value={documentId} />
        <label>
          Agregar anexo
          <input
            type="file"
            name="attachment"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            required
          />
        </label>
        <SubmitButton variant="ghost" pendingLabel="Subiendo…">
          Subir anexo
        </SubmitButton>
        <Message state={attachState} />
      </form>

      {existingDraft ? (
        <div className="doc-action doc-action--draft-notice">
          <p className="msg msg--info" role="status">
            Ya existe un borrador <strong>{existingDraft.label}</strong> en preparación. No se crea
            otra versión mientras haya un borrador en curso.
          </p>
          <a className="button button--ghost" href={existingDraft.href}>
            Continuar edición
          </a>
        </div>
      ) : (
        <NewVersionForm
          documentId={documentId}
          latestVersionLabel={latestVersionLabel ?? 'v1.0'}
          action={versionAction}
          state={versionState}
        />
      )}

      <details className="more-actions">
        <summary>Más acciones</summary>
        <form action={archiveAction} className="doc-action">
          <input type="hidden" name="documentId" value={documentId} />
          <label>
            Motivo del archivado
            <input name="reason" placeholder="Motivo por el que se archiva" required />
          </label>
          <p className="field-hint">
            Archivar deja el documento en solo lectura; no elimina versiones ni historial.
          </p>
          <SubmitButton variant="ghost" pendingLabel="Archivando…">
            Archivar este documento
          </SubmitButton>
          <Message state={archiveState} />
        </form>
      </details>
    </div>
  );
}
