import Link from 'next/link';
import {
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  DOCUMENT_ORIGINS,
  labelOf,
} from '@/features/documents/catalog';

export interface DocRow {
  id: string;
  code: string;
  title: string;
  documentType: string;
  origin: string;
  status: string;
  currentVersionLabel: string | null;
  ownerArea: string | null;
  responsibleName: string | null;
  issuedAt: string | null;
  nextReviewAt: string | null;
  dueSoon: boolean;
  overdue: boolean;
}

/**
 * Tabla documental reutilizable (biblioteca por tipo y listado maestro). Códigos y
 * nombres clickeables; estados con badge en español (nunca estados internos §72).
 */
export function DocumentsTable({
  documents,
  variant = 'type',
  emptyText = 'No hay documentos que coincidan.',
}: {
  documents: DocRow[];
  variant?: 'type' | 'master';
  emptyText?: string;
}) {
  if (documents.length === 0) {
    return (
      <div className="empty-state" role="status">
        <p>{emptyText}</p>
      </div>
    );
  }
  const master = variant === 'master';
  return (
    <div className="table-wrap">
      <table className="tbl-linkable">
        <thead>
          <tr>
            <th>Código</th>
            <th>Documento</th>
            {master && <th>Tipo</th>}
            {master && <th>Área</th>}
            <th>Versión</th>
            <th>Estado</th>
            <th>Emisión</th>
            <th>Próxima revisión</th>
            <th>Responsable</th>
            {master && <th>Origen</th>}
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr key={d.id}>
              <td className="mono">
                <Link href={`/dashboard/documents/${d.id}`}>{d.code}</Link>
              </td>
              <td>
                <Link href={`/dashboard/documents/${d.id}`} className="tbl-title">
                  {d.title}
                </Link>
              </td>
              {master && <td>{labelOf(DOCUMENT_TYPES, d.documentType)}</td>}
              {master && <td>{d.ownerArea ?? <span className="muted">—</span>}</td>}
              <td>{d.currentVersionLabel ?? '—'}</td>
              <td>
                <span className={`badge badge--doc-${d.status}`}>
                  {labelOf(DOCUMENT_STATUSES, d.status)}
                </span>
              </td>
              <td>{d.issuedAt ?? <span className="muted">—</span>}</td>
              <td>
                {d.nextReviewAt ?? '—'}{' '}
                {d.overdue && <span className="badge badge--critical">Vencido</span>}
                {!d.overdue && d.dueSoon && (
                  <span className="badge badge--risk-moderate">Próximo</span>
                )}
              </td>
              <td>{d.responsibleName ?? <span className="muted">—</span>}</td>
              {master && <td>{labelOf(DOCUMENT_ORIGINS, d.origin)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
