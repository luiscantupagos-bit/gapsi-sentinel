'use client';

/**
 * Adjuntos reutilizables (PLATFORM-002B §9). Patrón MVP: subir / listar / descargar /
 * desvincular. Muestra nombre, tipo, tamaño, fecha y quién subió; NUNCA expone
 * provider/bucket/storageKey/UUID. Preparado para DOC-004 (mismo contrato).
 */
import { useActionState } from 'react';
import { SubmitButton } from '../documents/_components/SubmitButton';

export interface AttachmentFile {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedByName?: string | null;
  relationType: string;
}

interface ActionState {
  ok: boolean;
  message: string;
}

interface Props {
  title?: string;
  files: AttachmentFile[];
  /** Campos ocultos que identifican la entidad (validados en servidor). */
  hiddenFields: Record<string, string>;
  uploadAction: (prev: ActionState | null, formData: FormData) => Promise<ActionState>;
  deleteAction: (formData: FormData) => Promise<void>;
  /** Permitir marcar como evidencia además de adjunto (§11). */
  allowEvidence?: boolean;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const REL_LABEL: Record<string, string> = { attachment: 'Adjunto', evidence: 'Evidencia' };

export function FileAttachments({
  title = 'Archivos',
  files,
  hiddenFields,
  uploadAction,
  deleteAction,
  allowEvidence = false,
}: Props) {
  const [state, action] = useActionState<ActionState | null, FormData>(uploadAction, null);

  return (
    <section className="attachments">
      <h3>{title}</h3>
      {state && (
        <p role="status" className={`msg ${state.ok ? 'msg--ok' : 'msg--error'}`}>
          {state.message}
        </p>
      )}

      <form action={action} className="attachments__upload">
        {Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="file" name="file" aria-label="Archivo" required />
        {allowEvidence && (
          <select name="relationType" aria-label="Tipo" defaultValue="attachment">
            <option value="attachment">Adjunto</option>
            <option value="evidence">Evidencia</option>
          </select>
        )}
        <SubmitButton pendingLabel="Cargando…">Cargar archivo</SubmitButton>
      </form>

      {files.length === 0 ? (
        <p className="empty-state">Sin archivos.</p>
      ) : (
        <ul className="attachments__list">
          {files.map((f) => (
            <li key={f.id} className="attachments__item">
              <a
                className="attachments__name"
                href={`/api/files/${f.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {f.filename}
              </a>
              <span className="attachments__meta" data-label="Tipo">
                {REL_LABEL[f.relationType] ?? f.relationType}
              </span>
              <span className="attachments__meta" data-label="Tamaño">
                {humanSize(f.sizeBytes)}
              </span>
              <span className="attachments__meta" data-label="Fecha">
                {f.createdAt.slice(0, 10)}
              </span>
              <span className="attachments__meta" data-label="Subido por">
                {f.uploadedByName ?? '—'}
              </span>
              <form action={deleteAction} className="attachments__del">
                {Object.entries(hiddenFields).map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ))}
                <input type="hidden" name="fileId" value={f.id} />
                <input type="hidden" name="relationType" value={f.relationType} />
                <button type="submit" className="button button--ghost">
                  Quitar
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
