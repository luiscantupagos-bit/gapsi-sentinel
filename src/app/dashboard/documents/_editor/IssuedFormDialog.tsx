'use client';

/**
 * Diálogo para EMITIR un formato desde un documento (DOC-002 §14/§15/§48).
 * A diferencia de `@`, `//` crea un documento, por eso usa un modal. Muestra el
 * origen documental y hereda su área. El formato se crea como BORRADOR v1.0.
 */
import { useEffect, useRef, useState } from 'react';
import { issueFormAction } from '../reference-actions';

interface Props {
  open: boolean;
  sourceDocumentId: string;
  sourceVersionId: string;
  sourceCode: string;
  sourceTitle: string;
  defaultAreaName?: string | null;
  onClose: () => void;
  onCreated: (form: { documentId: string; code: string; title: string }) => void;
}

export function IssuedFormDialog(props: Props) {
  const [title, setTitle] = useState('');
  const [proposito, setProposito] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (props.open) {
      setTitle('');
      setProposito('');
      setError(null);
      setTimeout(() => titleRef.current?.focus(), 30);
    }
  }, [props.open]);

  if (!props.open) return null;

  const submit = async () => {
    if (!title.trim()) {
      setError('El nombre del formato es obligatorio.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await issueFormAction({
        sourceDocumentId: props.sourceDocumentId,
        sourceVersionId: props.sourceVersionId,
        title: title.trim(),
        areaName: props.defaultAreaName ?? null,
        proposito: proposito.trim() || null,
      });
      if (res.ok && res.form) {
        props.onCreated(res.form);
        props.onClose();
      } else {
        setError(res.errors?.join(' ') || res.message);
      }
    } catch {
      setError('No se pudo emitir el formato.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="issue-form-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape') props.onClose();
        }}
      >
        <h2 id="issue-form-title">Emitir nuevo formato</h2>
        <p className="field__help">
          Emitido desde <strong>{props.sourceCode}</strong> — {props.sourceTitle}. Se creará un
          formato en borrador (v1.0) que pasará por el flujo documental.
        </p>

        {error && (
          <p role="alert" className="msg msg--error">
            {error}
          </p>
        )}

        <div className="field">
          <label className="field__label" htmlFor="issue-form-name">
            Nombre del formato *
          </label>
          <input
            id="issue-form-name"
            ref={titleRef}
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="p. ej. Bitácora de producto no conforme"
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="issue-form-purpose">
            Propósito
          </label>
          <textarea
            id="issue-form-purpose"
            rows={2}
            value={proposito}
            maxLength={2000}
            onChange={(e) => setProposito(e.target.value)}
            placeholder="Opcional"
          />
        </div>
        {props.defaultAreaName && (
          <p className="field__help">
            Área heredada del documento origen: <strong>{props.defaultAreaName}</strong>. C3
            Sentinel propondrá el código <strong>FO-…</strong> al crear.
          </p>
        )}

        <div className="form-actions">
          <button type="button" className="button button--ghost" onClick={props.onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? 'Creando…' : 'Emitir formato'}
          </button>
        </div>
      </div>
    </div>
  );
}
