'use client';

/**
 * Toolbar documental state-aware (DOC-UX-002 §63-66). Agrupa acciones de EDICIÓN,
 * SALIDA (Imprimir / Guardar como PDF con copia controlada) y ADMINISTRACIÓN
 * (panel). Las transiciones de WORKFLOW (revisión/aprobación/publicación) se
 * reutilizan tal cual en el panel «Control documental» (no se reinventan §64).
 *
 * Solo las versiones publicadas generan copia controlada formal (folio +
 * watermark). Borrador/obsoleto abren una salida marcada NO CONTROLADA sin folio
 * (§80-82).
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { prepareControlledCopyAction, type CopyActionState } from './copy-actions';

interface AreaOption {
  code: string | null;
  name: string;
}

interface Props {
  documentId: string;
  currentVersionId: string | null;
  currentVersionStatus: string | null; // draft | in_review | ... | published | obsolete
  documentStatus: string;
  editable: boolean;
  canEditContent: boolean;
  editorHref: string | null;
  metadataHref: string;
  areas: AreaOption[];
}

type DialogKind = 'print' | 'pdf' | null;

export function DocumentToolbar({
  documentId,
  currentVersionId,
  currentVersionStatus,
  documentStatus,
  editable,
  canEditContent,
  editorHref,
  metadataHref,
  areas,
}: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [state, action, pending] = useActionState<CopyActionState | null, FormData>(
    prepareControlledCopyAction,
    null,
  );

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      setDialog(null);
      router.push(state.redirectTo);
    }
  }, [state, router]);

  const isPublished = currentVersionStatus === 'published' && documentStatus === 'effective';
  const isObsolete = currentVersionStatus === 'obsolete' || documentStatus === 'obsolete';
  const hasVersion = Boolean(currentVersionId);

  // Salida no controlada (borrador/obsoleto): enlace directo, sin registro.
  const uncontrolledHref = (kind: 'draft' | 'obsolete') =>
    `/dashboard/documents/${documentId}/copy?uncontrolled=${kind}&version=${currentVersionId}`;

  function onOutputClick(type: 'print' | 'pdf') {
    if (isPublished) {
      setDialog(type);
      return;
    }
    if (isObsolete) {
      if (
        window.confirm(
          'Esta versión está OBSOLETA. La salida se marcará como COPIA NO CONTROLADA. ¿Continuar?',
        )
      ) {
        router.push(uncontrolledHref('obsolete'));
      }
      return;
    }
    // Borrador u otro estado no vigente: salida marcada BORRADOR — NO CONTROLADO.
    router.push(uncontrolledHref('draft'));
  }

  return (
    <div className="doc-toolbar" role="toolbar" aria-label="Acciones del documento">
      <div className="doc-toolbar__group" aria-label="Edición">
        {editable && canEditContent && editorHref && (
          <Link className="button button--ghost" href={editorHref}>
            Editar contenido
          </Link>
        )}
        {editable && (
          <Link className="button button--ghost" href={metadataHref}>
            Editar metadatos
          </Link>
        )}
      </div>

      {hasVersion && (
        <div className="doc-toolbar__group" aria-label="Salida">
          <button
            type="button"
            className="button button--ghost"
            onClick={() => onOutputClick('print')}
          >
            Imprimir
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => onOutputClick('pdf')}
          >
            Guardar como PDF
          </button>
        </div>
      )}

      <div className="doc-toolbar__group" aria-label="Administración">
        <a className="button button--ghost" href="#control-documental">
          Panel del documento
        </a>
      </div>

      {dialog && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label="Preparar copia controlada"
        >
          <div className="modal__card">
            <h2>{dialog === 'print' ? 'Preparar copia controlada' : 'Guardar como PDF'}</h2>
            <p className="muted">
              {dialog === 'print'
                ? 'Se generará una copia controlada con folio y marca de agua. Indica el área de entrega.'
                : 'El PDF se emite como copia controlada (folio + marca de agua). Indica el motivo de descarga.'}
            </p>
            {state && !state.ok && (
              <p role="status" className="msg msg--error">
                {state.message}
                {state.errors && <span> {state.errors.join(' ')}</span>}
              </p>
            )}
            <form action={action} className="doc-form">
              <input type="hidden" name="documentId" value={documentId} />
              <input type="hidden" name="versionId" value={currentVersionId ?? ''} />
              <input type="hidden" name="copyType" value={dialog} />

              {dialog === 'print' ? (
                <div className="field">
                  <label className="field__label" htmlFor="destinationAreaCode">
                    Área a la que se entrega la copia *
                  </label>
                  <select
                    id="destinationAreaCode"
                    name="destinationAreaCode"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Selecciona un área
                    </option>
                    {areas
                      .filter((a) => a.code)
                      .map((a) => (
                        <option key={a.code} value={a.code as string}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                  {areas.filter((a) => a.code).length === 0 && (
                    <p className="muted">
                      No hay áreas en el catálogo; configúralas para imprimir.
                    </p>
                  )}
                </div>
              ) : (
                <div className="field">
                  <label className="field__label" htmlFor="reason">
                    Motivo de descarga *
                  </label>
                  <input
                    id="reason"
                    name="reason"
                    required
                    maxLength={300}
                    placeholder="p. ej. Auditoría externa, envío a cliente, respaldo…"
                  />
                </div>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setDialog(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="button button--primary" disabled={pending}>
                  {pending ? 'Generando…' : 'Generar copia controlada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
