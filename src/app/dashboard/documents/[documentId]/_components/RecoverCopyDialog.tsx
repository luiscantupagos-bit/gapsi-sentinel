'use client';

/**
 * DOC-OUTPUT §A3/§A4 — registro de RECUPERACIÓN de una copia controlada física.
 * Abre un diálogo con los datos de la copia (solo lectura) y captura la disposición
 * final (obligatoria), quién la recupera/confirma, observaciones y —si la disposición
 * es «Reemplazada»— la copia sustituta. El backend valida de nuevo (§A5).
 */
import { useEffect, useRef, useState } from 'react';
import { useActionState } from 'react';
import { COPY_DISPOSITION_OPTIONS } from '@/features/documents/workflow-state';
import { SubmitButton } from '../../_components/SubmitButton';
import { updateCopyAction, type FormState } from '../../workflow-actions';

export interface RecoverableCopyInfo {
  id: string;
  folio: string;
  versionLabel: string;
  recipient: string;
  formatLabel: string;
}

/** Copias candidatas a ser la sustituta (activas del mismo documento). */
export interface ReplacementOption {
  id: string;
  folio: string;
  recipient: string;
}

export function RecoverCopyDialog({
  documentId,
  copy,
  members,
  replacementOptions,
  today,
}: {
  documentId: string;
  copy: RecoverableCopyInfo;
  members: { id: string; name: string }[];
  replacementOptions: ReplacementOption[];
  today: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [disposition, setDisposition] = useState<string>('');
  const [state, formAction] = useActionState<FormState | null, FormData>(updateCopyAction, null);

  // Al registrarse la recuperación, cierra el diálogo (la página revalida server-side).
  useEffect(() => {
    if (state?.ok) ref.current?.close();
  }, [state]);

  const showReplacement = disposition === 'replaced';

  return (
    <>
      <button
        type="button"
        className="button button--ghost"
        onClick={() => ref.current?.showModal()}
      >
        Registrar recuperación
      </button>
      <dialog
        ref={ref}
        className="doc-dialog"
        aria-label={`Recuperación de la copia ${copy.folio}`}
      >
        <form action={formAction} className="doc-dialog__form">
          <header className="doc-dialog__head">
            <h2>Registrar recuperación</h2>
            <button
              type="button"
              className="doc-dialog__close"
              aria-label="Cerrar"
              onClick={() => ref.current?.close()}
            >
              ×
            </button>
          </header>

          <input type="hidden" name="documentId" value={documentId} />
          <input type="hidden" name="copyId" value={copy.id} />

          <dl className="doc-dialog__meta">
            <div>
              <dt>Folio</dt>
              <dd className="mono">{copy.folio}</dd>
            </div>
            <div>
              <dt>Versión</dt>
              <dd>{copy.versionLabel}</dd>
            </div>
            <div>
              <dt>Destino</dt>
              <dd>{copy.recipient}</dd>
            </div>
            <div>
              <dt>Formato</dt>
              <dd>{copy.formatLabel}</dd>
            </div>
          </dl>

          <label>
            Fecha de recuperación
            <input type="date" name="recoveredAt" defaultValue={today} />
          </label>

          <label>
            Recuperada por
            <select name="recoveredBy" defaultValue="">
              <option value="">— (el usuario actual) —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Confirmada por (opcional)
            <select name="confirmedBy" defaultValue="">
              <option value="">— Sin confirmar —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Disposición
            <select
              name="disposition"
              required
              value={disposition}
              onChange={(e) => setDisposition(e.target.value)}
            >
              <option value="" disabled>
                — Selecciona —
              </option>
              {COPY_DISPOSITION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {showReplacement && (
            <label>
              Copia sustituta
              {replacementOptions.length === 0 ? (
                <span className="muted">
                  No hay copias activas disponibles para registrar el reemplazo.
                </span>
              ) : (
                <select name="replacedByCopyId" defaultValue="">
                  <option value="">— Sin especificar —</option>
                  {replacementOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.folio} · {o.recipient}
                    </option>
                  ))}
                </select>
              )}
            </label>
          )}

          <label>
            Observaciones
            <textarea name="recoveryNotes" rows={2} />
          </label>

          {state && !state.ok && (
            <p role="status" className="msg msg--error">
              {state.message}
              {state.errors?.length ? ` — ${state.errors.join(' ')}` : ''}
            </p>
          )}

          <footer className="doc-dialog__actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => ref.current?.close()}
            >
              Cancelar
            </button>
            <SubmitButton variant="primary" pendingLabel="Registrando…">
              Registrar recuperación
            </SubmitButton>
          </footer>
        </form>
      </dialog>
    </>
  );
}
