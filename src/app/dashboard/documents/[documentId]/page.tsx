import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { DocumentNotFoundError, getDocumentDetail } from '@/server/documents';
import {
  CONFIDENTIALITY_LEVELS,
  DOCUMENT_ORIGINS,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  labelOf,
} from '@/features/documents/catalog';
import { DocumentActions } from './DocumentActions';

const HISTORY_LABEL: Record<string, string> = {
  'document.created': 'Documento creado',
  'document.metadata_updated': 'Metadatos modificados',
  'file.uploaded': 'Archivo cargado',
  'version.created': 'Versión creada',
  'document.archived': 'Documento archivado',
};

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const session = await requireServerSession();
  const { documentId } = await params;

  let doc;
  try {
    doc = await getDocumentDetail(session.organizationId, documentId);
  } catch (error) {
    if (error instanceof DocumentNotFoundError) notFound();
    throw error;
  }

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/documents">← Volver al listado</Link>
      </p>

      <div className="page-head">
        <h1>
          <span className="muted">{doc.code}</span> {doc.title}
        </h1>
        {doc.editable && (
          <Link className="button button--ghost" href={`/dashboard/documents/${doc.id}/edit`}>
            Editar metadatos
          </Link>
        )}
      </div>

      <dl className="meta-grid">
        <div>
          <dt>Estado</dt>
          <dd>
            <span className={`badge badge--doc-${doc.status}`}>
              {labelOf(DOCUMENT_STATUSES, doc.status)}
            </span>
          </dd>
        </div>
        <div>
          <dt>Tipo</dt>
          <dd>{labelOf(DOCUMENT_TYPES, doc.documentType)}</dd>
        </div>
        <div>
          <dt>Origen</dt>
          <dd>{labelOf(DOCUMENT_ORIGINS, doc.origin)}</dd>
        </div>
        <div>
          <dt>Versión vigente</dt>
          <dd>{doc.currentVersionLabel ?? '—'}</dd>
        </div>
        <div>
          <dt>Responsable</dt>
          <dd>{doc.responsibleName ?? '—'}</dd>
        </div>
        <div>
          <dt>Sitio</dt>
          <dd>{doc.siteName ?? '—'}</dd>
        </div>
        <div>
          <dt>Confidencialidad</dt>
          <dd>{labelOf(CONFIDENTIALITY_LEVELS, doc.confidentiality)}</dd>
        </div>
        <div>
          <dt>Emisión</dt>
          <dd>{doc.issuedAt ?? '—'}</dd>
        </div>
        <div>
          <dt>Próxima revisión</dt>
          <dd>{doc.nextReviewAt ?? '—'}</dd>
        </div>
      </dl>

      {doc.description && <p className="lead">{doc.description}</p>}

      <h2>Archivos de la versión vigente</h2>
      {doc.currentFiles.length === 0 ? (
        <p className="empty-state">Sin archivos en la versión vigente.</p>
      ) : (
        <ul className="file-list">
          {doc.currentFiles.map((f) => (
            <li key={f.id}>
              <span className="badge">{f.kind === 'main' ? 'Principal' : 'Anexo'}</span>{' '}
              {f.originalName} <span className="muted">({Math.round(f.sizeBytes / 1024)} KB)</span>{' '}
              <a href={`/dashboard/documents/${doc.id}/files/${f.id}`}>Descargar</a>
            </li>
          ))}
        </ul>
      )}

      <h2>Acciones</h2>
      <DocumentActions documentId={doc.id} editable={doc.editable} />

      <h2>Versiones</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Versión</th>
              <th>Estado</th>
              <th>Vigente</th>
              <th>Notas</th>
              <th>Archivos</th>
            </tr>
          </thead>
          <tbody>
            {doc.versions.map((v) => (
              <tr key={v.id}>
                <td>{v.label}</td>
                <td>{v.status}</td>
                <td>{v.isCurrent ? 'Sí' : '—'}</td>
                <td>{v.changeNotes ?? '—'}</td>
                <td>{v.files.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Historial</h2>
      {doc.history.length === 0 ? (
        <p className="empty-state">Sin eventos.</p>
      ) : (
        <ul className="history">
          {doc.history.map((h) => (
            <li key={h.id}>
              <span className="muted">{new Date(h.createdAt).toLocaleString('es-MX')}</span> —{' '}
              {HISTORY_LABEL[h.action] ?? h.action}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
