'use client';

import { useActionState } from 'react';
import type { ActionState } from '../actions';
import { addAttachmentAction, archiveDocumentAction, createVersionAction } from '../actions';
import { SubmitButton } from '../_components/SubmitButton';

function Message({ state }: { state: ActionState | null }) {
  if (!state) return null;
  return (
    <span role="status" className={state.ok ? 'msg msg--ok' : 'msg msg--error'}>
      {state.message}
    </span>
  );
}

export function DocumentActions({
  documentId,
  editable,
}: {
  documentId: string;
  editable: boolean;
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

      <form action={versionAction} className="doc-action">
        <input type="hidden" name="documentId" value={documentId} />
        <label>
          Tipo de cambio
          <select name="bump" defaultValue="minor">
            <option value="minor">Cambio menor (p. ej. 1.0 → 1.1)</option>
            <option value="major">Cambio mayor (p. ej. 1.0 → 2.0)</option>
          </select>
        </label>
        <label>
          Motivo del cambio
          <input name="changeNotes" placeholder="Describe el motivo del cambio" required />
        </label>
        <SubmitButton variant="ghost" pendingLabel="Creando…">
          Crear nueva versión
        </SubmitButton>
        <p className="field-hint">El número de versión se calcula automáticamente.</p>
        <Message state={versionState} />
      </form>

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
