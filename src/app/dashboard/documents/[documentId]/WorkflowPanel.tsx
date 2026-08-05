'use client';

import { useActionState } from 'react';
import { SubmitButton } from '../_components/SubmitButton';
import {
  acknowledgeReadAction,
  approvalAction,
  assignWorkflowAction,
  distributeAction,
  obsoleteAction,
  publishAction,
  registerCopyAction,
  reviewAction,
  submitReviewAction,
  type FormState,
} from '../workflow-actions';

type Action = (prev: FormState | null, fd: FormData) => Promise<FormState>;

function ActionForm({
  action,
  hidden,
  button,
  pendingLabel,
  children,
}: {
  action: Action;
  hidden: Record<string, string>;
  button: string;
  pendingLabel?: string;
  children?: React.ReactNode;
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(action, null);
  return (
    <form action={formAction} className="wf-form">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <SubmitButton variant="ghost" pendingLabel={pendingLabel ?? 'Procesando…'}>
        {button}
      </SubmitButton>
      {state && (
        <span role="status" className={state.ok ? 'msg msg--ok' : 'msg msg--error'}>
          {state.message}
          {state.errors && state.errors.length > 0 ? ` — ${state.errors.join(' ')}` : ''}
        </span>
      )}
    </form>
  );
}

interface Ctx {
  isAdmin: boolean;
  isAuthor: boolean;
  isAssignedReviewer: boolean;
  isAssignedApprover: boolean;
  hasPendingRead: boolean;
}

export function WorkflowPanel({
  documentId,
  versionId,
  status,
  editable,
  checksum,
  ctx,
  members,
}: {
  documentId: string;
  versionId: string;
  status: string;
  editable: boolean;
  checksum: string | null;
  ctx: Ctx;
  members: { id: string; name: string }[];
}) {
  const base = { documentId, versionId };
  return (
    <div className="wf-panel">
      {editable && (ctx.isAuthor || ctx.isAdmin) && (
        <>
          <ActionForm action={assignWorkflowAction} hidden={base} button="Asignar flujo">
            <label>
              Revisores
              <select name="reviewers" multiple size={3}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Aprobadores
              <select name="approvers" multiple size={3}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </ActionForm>
          <ActionForm action={submitReviewAction} hidden={base} button="Enviar a revisión" />
        </>
      )}

      {status === 'in_review' && ctx.isAssignedReviewer && (
        <>
          <ActionForm
            action={reviewAction}
            hidden={{ ...base, decision: 'approve' }}
            button="Aprobar revisión"
          />
          <ActionForm
            action={reviewAction}
            hidden={{ ...base, decision: 'request_changes' }}
            button="Solicitar cambios"
          >
            <input name="comment" placeholder="Comentario (obligatorio)" required />
          </ActionForm>
        </>
      )}

      {status === 'in_approval' && ctx.isAssignedApprover && (
        <>
          <ActionForm
            action={approvalAction}
            hidden={{ ...base, decision: 'approve' }}
            button="Aprobar"
          />
          <ActionForm
            action={approvalAction}
            hidden={{ ...base, decision: 'reject' }}
            button="Rechazar"
          >
            <input name="comment" placeholder="Motivo (obligatorio)" required />
          </ActionForm>
        </>
      )}

      {status === 'approved' && ctx.isAdmin && (
        <ActionForm action={publishAction} hidden={base} button="Publicar">
          <label>
            Fecha de vigencia
            <input type="date" name="effectiveAt" />
          </label>
        </ActionForm>
      )}

      {status === 'published' && ctx.isAdmin && (
        <>
          <ActionForm
            action={distributeAction}
            hidden={{ documentId, targetType: 'user' }}
            button="Distribuir"
          >
            <label>
              A usuario
              <select name="userId" required>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="props-check">
              <input type="checkbox" name="readRequired" defaultChecked /> Requiere lectura
            </label>
          </ActionForm>
          <ActionForm action={registerCopyAction} hidden={base} button="Registrar copia controlada">
            <input name="recipient" placeholder="Destinatario/ubicación" required />
            <select name="format">
              <option value="digital">Digital</option>
              <option value="printed">Impresa</option>
            </select>
          </ActionForm>
          <ActionForm action={obsoleteAction} hidden={base} button="Obsoletar">
            <input name="reason" placeholder="Motivo" required />
          </ActionForm>
        </>
      )}

      {ctx.hasPendingRead && checksum && (
        <ActionForm
          action={acknowledgeReadAction}
          hidden={{ ...base, checksum }}
          button="Confirmar lectura"
        >
          <span className="muted">
            Confirmo que he leído y comprendido esta versión del documento.
          </span>
        </ActionForm>
      )}
    </div>
  );
}
