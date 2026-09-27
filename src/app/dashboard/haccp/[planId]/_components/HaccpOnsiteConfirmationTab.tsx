'use client';

/**
 * WORKSPACE-REORG paso 5 — «Confirmación in situ». Extrae la verificación en planta del diagrama
 * (verified_on_site/at/by/notes) para que no quede escondida dentro del flujo. Cualquier cambio en
 * etapas/conexiones/entradas/salidas/destinos reinicia esta confirmación (regla existente). Sin
 * cambios de modelo de datos.
 */
import { useActionState } from 'react';
import type { getPlanFlow } from '@/server/haccp-flow';
import { SubmitButton } from '../../../documents/_components/SubmitButton';
import { verifyFlowAction, type FormState } from '../../actions';

type FlowData = Awaited<ReturnType<typeof getPlanFlow>>;

function VerifyForm({
  planId,
  versionId,
  verified,
  button,
  variant = 'ghost',
  withNotes = false,
}: {
  planId: string;
  versionId: string;
  verified: boolean;
  button: string;
  variant?: 'primary' | 'ghost';
  withNotes?: boolean;
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(verifyFlowAction, null);
  return (
    <form action={formAction} className="wf-form">
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="planVersionId" value={versionId} />
      <input type="hidden" name="verified" value={verified ? 'true' : 'false'} />
      {withNotes && <input name="notes" placeholder="Notas de verificación (opcional)" />}
      <SubmitButton variant={variant} pendingLabel="Procesando…">
        {button}
      </SubmitButton>
      {state && !state.ok && <span className="msg msg--error">{state.message}</span>}
    </form>
  );
}

export function HaccpOnsiteConfirmationTab({
  planId,
  flow,
  canEdit,
}: {
  planId: string;
  flow: FlowData;
  canEdit: boolean;
}) {
  const version = flow.version;
  if (!version) {
    return <p className="empty-state empty-state--compact">Sin versión activa.</p>;
  }
  const editable = canEdit && version.editable;

  return (
    <>
      <p className="muted doc-panel__hint">
        La confirmación in situ verifica que el diagrama de flujo corresponde a la operación real en
        planta. Cualquier cambio posterior en el proceso reinicia esta confirmación.
      </p>

      <section className="haccp-onsite">
        <div className="haccp-onsite__status">
          <span className="doc-report__field-label">Estado</span>
          {version.flowVerifiedOnSite ? (
            <span className="badge badge--haccp-published">Confirmado en planta</span>
          ) : (
            <span className="badge badge--warn">No confirmado en planta</span>
          )}
        </div>
        {version.flowVerifiedOnSite && (
          <dl className="haccp-onsite__meta">
            <div>
              <dt>Fecha</dt>
              <dd>{version.flowVerifiedAtLabel ?? '—'}</dd>
            </div>
            <div>
              <dt>Responsable</dt>
              <dd>{version.flowVerifiedByName ?? '—'}</dd>
            </div>
            <div>
              <dt>Observaciones</dt>
              <dd>{version.flowVerificationNotes ?? '—'}</dd>
            </div>
          </dl>
        )}
      </section>

      {editable && (
        <div className="haccp-onsite__actions">
          {version.flowVerifiedOnSite ? (
            <VerifyForm
              planId={planId}
              versionId={version.id}
              verified={false}
              button="Retirar confirmación"
            />
          ) : (
            <VerifyForm
              planId={planId}
              versionId={version.id}
              verified
              button="Confirmar diagrama en planta"
              variant="primary"
              withNotes
            />
          )}
        </div>
      )}
    </>
  );
}
