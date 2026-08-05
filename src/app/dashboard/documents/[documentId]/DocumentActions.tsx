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
          Nueva versión (etiqueta)
          <input name="label" placeholder="v2" required />
        </label>
        <label>
          Notas de cambio
          <input name="changeNotes" placeholder="Motivo del cambio" />
        </label>
        <SubmitButton variant="ghost" pendingLabel="Creando…">
          Crear versión
        </SubmitButton>
        <Message state={versionState} />
      </form>

      <form action={archiveAction} className="doc-action">
        <input type="hidden" name="documentId" value={documentId} />
        <SubmitButton variant="ghost" pendingLabel="Archivando…">
          Archivar documento
        </SubmitButton>
        <Message state={archiveState} />
      </form>
    </div>
  );
}
