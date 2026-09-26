'use client';

/**
 * DOC-004 — índice de Registros (cliente). Filtros por estado (§22), lista con folio/formato/
 * versión/estado/fecha/responsable/origen/sitio, y alta de un registro nuevo a partir de un
 * formato vigente (§23). Sin UUID visible (§38).
 */
import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import {
  RECORD_STATUS_LABEL,
  recordStatusLabel,
  recordSourceLabel,
  type RecordStatus,
} from '@/features/records/record-state';
import { SubmitButton } from '../../documents/_components/SubmitButton';
import { createRecordAction, type FormState } from '../actions';
import type { RecordListItem, AvailableForm } from '@/server/records';

type Filter = 'all' | 'mine' | RecordStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'mine', label: 'Mis registros' },
  { key: 'in_progress', label: RECORD_STATUS_LABEL.in_progress },
  { key: 'submitted', label: RECORD_STATUS_LABEL.submitted },
  { key: 'closed', label: RECORD_STATUS_LABEL.closed },
];

function NewRecordForm({ forms }: { forms: AvailableForm[] }) {
  const [state, action] = useActionState<FormState | null, FormData>(createRecordAction, null);
  const [documentId, setDocumentId] = useState('');
  // Un id de cliente estable por render del formulario evita duplicados si se reintenta (§40).
  const clientId = useMemo(() => globalThis.crypto?.randomUUID?.() ?? '', []);

  if (forms.length === 0) {
    return (
      <p className="msg msg--info">
        No hay formatos vigentes con formulario diseñado. Crea un documento tipo «Formato», diseña
        su formulario y publícalo para poder capturar registros.
      </p>
    );
  }
  return (
    <form action={action} className="wf-form record-new">
      <input type="hidden" name="clientGeneratedId" value={clientId} />
      <label>
        Formato
        <select
          name="documentId"
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
          required
        >
          <option value="">— Selecciona un formato —</option>
          {forms.map((f) => (
            <option key={f.documentId} value={f.documentId}>
              {f.code} · {f.title} ({f.versionLabel})
            </option>
          ))}
        </select>
      </label>
      <SubmitButton variant="primary" pendingLabel="Creando…">
        Nuevo registro
      </SubmitButton>
      {state && !state.ok && <span className="msg msg--error">{state.message}</span>}
    </form>
  );
}

export function RecordsIndex({
  records,
  forms,
}: {
  records: RecordListItem[];
  forms: AvailableForm[];
}) {
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = records.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'mine') return r.isMine;
    return r.status === filter;
  });

  return (
    <main className="container">
      <div className="page-head">
        <h1>Registros</h1>
      </div>
      <p className="msg msg--info">
        Un registro es el llenado de un <strong>Formato</strong> usando una versión exacta de su
        formulario. El registro conserva la referencia a esa versión aunque el formato cambie
        después.
      </p>

      <section className="record-new-panel">
        <h2>Nuevo registro</h2>
        <NewRecordForm forms={forms} />
      </section>

      <div className="doc-panel__tablist" role="tablist" aria-label="Filtros de registros">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={`doc-panel__tab${filter === f.key ? ' is-active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="empty-state">No hay registros en esta vista.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Formato</th>
                <th>Versión</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Responsable</th>
                <th>Origen</th>
                <th>Sitio</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="mono">
                    <Link href={`/dashboard/records/${r.id}`}>{r.recordNumber}</Link>
                  </td>
                  <td>
                    <Link href={`/dashboard/records/${r.id}`}>
                      {r.formCode} · {r.formTitle}
                    </Link>
                  </td>
                  <td>{r.formVersionLabel}</td>
                  <td>
                    <span className={`badge badge--recstatus-${r.status}`}>
                      {recordStatusLabel(r.status)}
                    </span>
                  </td>
                  <td>{r.createdAt}</td>
                  <td>{r.assignedToName ?? r.createdByName ?? '—'}</td>
                  <td>{recordSourceLabel(r.sourceType)}</td>
                  <td>{r.siteName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
