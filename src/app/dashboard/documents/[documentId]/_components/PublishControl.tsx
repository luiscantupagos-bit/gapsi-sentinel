'use client';

/**
 * DOC-OUTPUT §B/§C — experiencia de publicación con el candado de recuperación de
 * copias. Si existen copias físicas de versiones anteriores pendientes de recuperación,
 * al publicar se abre un diálogo que las lista (no un error técnico) y ofrece: registrar
 * su recuperación (misma UI que la pestaña Copias) o, solo para el propietario, publicar
 * CON EXCEPCIÓN con una justificación obligatoria. El backend revalida ambas rutas.
 */
import { useEffect, useRef, useState } from 'react';
import { useActionState } from 'react';
import { SubmitButton } from '../../_components/SubmitButton';
import { publishAction, type FormState } from '../../workflow-actions';
import {
  RecoverCopyDialog,
  type RecoverableCopyInfo,
  type ReplacementOption,
} from './RecoverCopyDialog';

export interface PendingPhysicalCopy {
  id: string;
  folio: string;
  recipient: string;
  versionLabel: string;
  dateLabel: string;
  statusLabel: string;
}

export function PublishControl({
  documentId,
  versionId,
  pendingPhysicalCopies,
  isOwner,
  members,
  replacementOptions,
  today,
}: {
  documentId: string;
  versionId: string;
  pendingPhysicalCopies: PendingPhysicalCopy[];
  isOwner: boolean;
  members: { id: string; name: string }[];
  replacementOptions: ReplacementOption[];
  today: string;
}) {
  const blockRef = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState<FormState | null, FormData>(publishAction, null);
  const [exceptionReason, setExceptionReason] = useState('');
  const [showException, setShowException] = useState(false);
  const hasPending = pendingPhysicalCopies.length > 0;

  useEffect(() => {
    if (state?.ok) blockRef.current?.close();
  }, [state]);

  // Sin copias pendientes: publicación normal (fecha de vigencia opcional).
  if (!hasPending) {
    return (
      <form action={formAction} className="wf-form">
        <input type="hidden" name="documentId" value={documentId} />
        <input type="hidden" name="versionId" value={versionId} />
        <label>
          Fecha de vigencia
          <input type="date" name="effectiveAt" />
        </label>
        <SubmitButton variant="ghost" pendingLabel="Publicando…">
          Publicar
        </SubmitButton>
        {state && (
          <span role="status" className={state.ok ? 'msg msg--ok' : 'msg msg--error'}>
            {state.message}
            {state.errors?.length ? ` — ${state.errors.join(' ')}` : ''}
          </span>
        )}
      </form>
    );
  }

  return (
    <div className="wf-form">
      <button
        type="button"
        className="button button--ghost"
        onClick={() => blockRef.current?.showModal()}
      >
        Publicar
      </button>

      <dialog
        ref={blockRef}
        className="doc-dialog doc-dialog--wide"
        aria-label="Copias pendientes de recuperación"
      >
        <div className="doc-dialog__form">
          <header className="doc-dialog__head">
            <h2>No es posible hacer vigente esta versión</h2>
            <button
              type="button"
              className="doc-dialog__close"
              aria-label="Cerrar"
              onClick={() => blockRef.current?.close()}
            >
              ×
            </button>
          </header>

          <p>
            No es posible hacer vigente esta versión porque existen copias controladas de la versión
            anterior pendientes de recuperación. Registra su recuperación para continuar.
          </p>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Destino</th>
                  <th>Versión</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pendingPhysicalCopies.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">{c.folio}</td>
                    <td>{c.recipient}</td>
                    <td>{c.versionLabel}</td>
                    <td>{c.dateLabel}</td>
                    <td>{c.statusLabel}</td>
                    <td>
                      <RecoverCopyDialog
                        documentId={documentId}
                        copy={
                          {
                            id: c.id,
                            folio: c.folio,
                            versionLabel: c.versionLabel,
                            recipient: c.recipient,
                            formatLabel: 'Impresa',
                          } satisfies RecoverableCopyInfo
                        }
                        members={members}
                        replacementOptions={replacementOptions}
                        today={today}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="doc-dialog__actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => blockRef.current?.close()}
            >
              Volver
            </button>

            {/* §C: solo el propietario ve la publicación con excepción. */}
            {isOwner &&
              (showException ? (
                <form action={formAction} className="doc-dialog__exception">
                  <input type="hidden" name="documentId" value={documentId} />
                  <input type="hidden" name="versionId" value={versionId} />
                  <p className="muted">
                    Esta versión se hará vigente aunque existan copias controladas de la versión
                    anterior pendientes de recuperación.
                  </p>
                  <label>
                    Justificación
                    <textarea
                      name="exceptionReason"
                      rows={2}
                      required
                      value={exceptionReason}
                      onChange={(e) => setExceptionReason(e.target.value)}
                    />
                  </label>
                  <SubmitButton variant="primary" pendingLabel="Publicando…">
                    Publicar con excepción
                  </SubmitButton>
                </form>
              ) : (
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() => setShowException(true)}
                >
                  Publicar con excepción
                </button>
              ))}
          </footer>

          {state && !state.ok && (
            <p role="status" className="msg msg--error">
              {state.message}
              {state.errors?.length ? ` — ${state.errors.join(' ')}` : ''}
            </p>
          )}
        </div>
      </dialog>
    </div>
  );
}
