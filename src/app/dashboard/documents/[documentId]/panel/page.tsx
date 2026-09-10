import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  DocumentNotFoundError,
  getDocumentDetail,
  getDocumentRelations,
  getEditorContent,
  getIssuedFromSources,
  listResponsibles,
  getControlledCopyHistory,
} from '@/server/documents';
import { CopyHistory } from '../CopyHistory';
import { getDocumentControl, getUserVersionContext } from '@/server/document-workflow';
import {
  VERSION_STATUS_LABEL,
  ASSIGNMENT_STATUS_LABEL,
  ASSIGNMENT_ROLE_LABEL,
  APPROVAL_DECISION_LABEL,
  DISTRIBUTION_TARGET_LABEL,
  DISTRIBUTION_STATUS_LABEL,
  COPY_STATUS_LABEL,
  type VersionStatus,
} from '@/features/documents/workflow-state';
import {
  CONFIDENTIALITY_LEVELS,
  DOCUMENT_ORIGINS,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  labelOf,
} from '@/features/documents/catalog';
import { DocumentActions } from '../DocumentActions';
import { WorkflowPanel } from '../WorkflowPanel';
import { recoverCopyForm } from '../../workflow-actions';

const vLabel = (s: string) => VERSION_STATUS_LABEL[s as VersionStatus] ?? s;

const HISTORY_LABEL: Record<string, string> = {
  'document.created': 'Documento creado',
  'document.metadata_updated': 'Metadatos modificados',
  'file.uploaded': 'Archivo cargado',
  'version.created': 'Versión creada',
  'content.updated': 'Contenido actualizado',
  'document.archived': 'Documento archivado',
};

/**
 * Panel del documento (DOC-UX-003 §5): vista SECUNDARIA/administrativa. La vista
 * canónica del documento es la vista previa (../). Aquí viven metadatos, archivos,
 * relaciones, control documental, versiones e historial de copias.
 */
export default async function DocumentPanelPage({
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

  const [editor, control, members, copyHistory] = await Promise.all([
    getEditorContent(session.organizationId, documentId),
    getDocumentControl(session.organizationId, documentId),
    listResponsibles(session.organizationId),
    getControlledCopyHistory(session.organizationId, documentId),
  ]);
  const ctx = await getUserVersionContext(session.organizationId, session.userId, editor.versionId);

  const isExternal = doc.contentMode === 'external';

  const [relations, issuedFrom] = await Promise.all([
    getDocumentRelations(session.organizationId, documentId),
    doc.documentType === 'form'
      ? getIssuedFromSources(session.organizationId, documentId)
      : Promise.resolve([]),
  ]);
  const relRow = (r: {
    relatedDocumentId: string;
    code: string;
    title: string;
    versionLabel: string | null;
    statusLabel: string;
    obsolete: boolean;
    available: boolean;
  }) =>
    r.available ? (
      <tr key={r.relatedDocumentId}>
        <td className="mono">
          <Link href={`/dashboard/documents/${r.relatedDocumentId}`}>{r.code}</Link>
        </td>
        <td>
          <Link href={`/dashboard/documents/${r.relatedDocumentId}`}>{r.title}</Link>
        </td>
        <td>{r.versionLabel ?? '—'}</td>
        <td>
          {r.statusLabel}
          {r.obsolete ? ' · Obsoleto' : ''}
        </td>
      </tr>
    ) : (
      <tr key={r.relatedDocumentId}>
        <td colSpan={4} className="muted">
          Referencia no disponible
        </td>
      </tr>
    );

  return (
    <main className="container">
      <p className="doc-lib__crumb">
        <Link href={`/dashboard/documents/${doc.id}`}>← Ver documento</Link>
      </p>

      <div className="page-head">
        <h1>
          <span className="muted">{doc.code}</span> {doc.title} · Panel
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link className="button button--primary" href={`/dashboard/documents/${doc.id}`}>
            Ver documento
          </Link>
          {doc.editable && (
            <Link className="button button--ghost" href={`/dashboard/documents/${doc.id}/edit`}>
              Editar metadatos
            </Link>
          )}
        </div>
      </div>

      {isExternal && (
        <div className="external-doc-card">
          <p>
            <strong>Documento externo registrado.</strong> C3 Sentinel conserva el archivo y sus
            metadatos; su contenido no se transcribe.
          </p>
        </div>
      )}

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

      {(relations.references.length > 0 ||
        relations.issuedForms.length > 0 ||
        issuedFrom.length > 0) && (
        <>
          <h2>Relaciones documentales</h2>
          <div className="doc-relations">
            {issuedFrom.length > 0 && (
              <div>
                <h3>Emitido desde</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Documento</th>
                        <th>Versión</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>{issuedFrom.map(relRow)}</tbody>
                  </table>
                </div>
              </div>
            )}
            {relations.references.length > 0 && (
              <div>
                <h3>Documentos referenciados</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Documento</th>
                        <th>Versión</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>{relations.references.map(relRow)}</tbody>
                  </table>
                </div>
              </div>
            )}
            {relations.issuedForms.length > 0 && (
              <div>
                <h3>Formatos y registros relacionados</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Formato</th>
                        <th>Versión</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>{relations.issuedForms.map(relRow)}</tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <h2 id="nueva-version">Acciones</h2>
      <DocumentActions documentId={doc.id} editable={doc.editable} />

      <h2 id="control-documental">Control documental</h2>
      <p>
        Versión activa <strong>{editor.label}</strong>:{' '}
        <span className="badge">{vLabel(editor.versionStatus)}</span>
      </p>
      {ctx && (
        <WorkflowPanel
          documentId={doc.id}
          versionId={editor.versionId}
          status={editor.versionStatus}
          editable={editor.editable}
          checksum={editor.contentChecksum}
          ctx={ctx}
          members={members}
        />
      )}

      <h3>Flujo (asignaciones)</h3>
      {control.steps.length === 0 ? (
        <p className="empty-state">Sin asignaciones.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rol</th>
                <th>Usuario</th>
                <th>Orden</th>
                <th>Estado</th>
                <th>Límite</th>
              </tr>
            </thead>
            <tbody>
              {control.steps.map((st) => (
                <tr key={st.id}>
                  <td>{ASSIGNMENT_ROLE_LABEL[st.role] ?? st.role}</td>
                  <td>{control.uName.get(st.userId) ?? '—'}</td>
                  <td>{st.sequence}</td>
                  <td>{ASSIGNMENT_STATUS_LABEL[st.status] ?? st.status}</td>
                  <td>{st.dueAt ? new Date(st.dueAt).toLocaleDateString('es-MX') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Aprobaciones</h3>
      {control.approvals.length === 0 ? (
        <p className="empty-state">Sin decisiones registradas.</p>
      ) : (
        <ul className="history">
          {control.approvals.map((a) => (
            <li key={a.id}>
              <span className="muted">{new Date(a.createdAt).toLocaleString('es-MX')}</span> ·{' '}
              {a.stage === 'review' ? 'Revisión' : 'Aprobación'} ·{' '}
              {APPROVAL_DECISION_LABEL[a.decision] ?? a.decision} ·{' '}
              {control.uName.get(a.actorUserId) ?? '—'}
              {a.comment ? ` — “${a.comment}”` : ''}
            </li>
          ))}
        </ul>
      )}

      <h3>Distribución</h3>
      {control.distributions.length === 0 ? (
        <p className="empty-state">Sin distribuciones.</p>
      ) : (
        <ul className="history">
          {control.distributions.map((d) => (
            <li key={d.id}>
              {DISTRIBUTION_TARGET_LABEL[d.targetType] ?? d.targetType}{' '}
              {d.userId ? `· ${control.uName.get(d.userId) ?? d.userId}` : ''}
              {d.role ? `· rol ${d.role}` : ''} ·{' '}
              {d.readRequired ? 'lectura requerida' : 'informativa'} ·{' '}
              {DISTRIBUTION_STATUS_LABEL[d.status] ?? d.status} ·{' '}
              {new Date(d.distributedAt).toLocaleDateString('es-MX')}
            </li>
          ))}
        </ul>
      )}

      <h3>Lecturas</h3>
      {control.reads.length === 0 ? (
        <p className="empty-state">Sin acuses de lectura.</p>
      ) : (
        <ul className="history">
          {control.reads.map((r) => (
            <li key={r.id}>
              {control.uName.get(r.userId) ?? r.userId} ·{' '}
              {new Date(r.acknowledgedAt).toLocaleString('es-MX')}
            </li>
          ))}
        </ul>
      )}

      <h3>Copias controladas</h3>
      {control.copies.length === 0 ? (
        <p className="empty-state">Sin copias registradas.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>N.º</th>
                <th>Destinatario</th>
                <th>Formato</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {control.copies.map((c) => (
                <tr key={c.id}>
                  <td>{c.copyNumber}</td>
                  <td>{c.recipient}</td>
                  <td>{c.format === 'printed' ? 'Impresa' : 'Digital'}</td>
                  <td>
                    <span className={`badge badge--copy-${c.status}`}>
                      {COPY_STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td>
                    {ctx?.isAdmin && (c.status === 'active' || c.status === 'pending_recovery') && (
                      <form action={recoverCopyForm} className="wf-form">
                        <input type="hidden" name="documentId" value={doc.id} />
                        <input type="hidden" name="copyId" value={c.id} />
                        <input type="hidden" name="status" value="recovered" />
                        <button className="button button--ghost" type="submit">
                          Registrar recuperación
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CopyHistory rows={copyHistory} />

      <h3>Historial de estados</h3>
      {control.statusHistory.length === 0 ? (
        <p className="empty-state">Sin cambios de estado.</p>
      ) : (
        <ul className="history">
          {control.statusHistory.map((h) => (
            <li key={h.id.toString()}>
              <span className="muted">{new Date(h.createdAt).toLocaleString('es-MX')}</span> ·{' '}
              {h.fromStatus ? `${vLabel(h.fromStatus)} → ` : ''}
              {vLabel(h.toStatus)}
              {h.comment ? ` — ${h.comment}` : ''}
            </li>
          ))}
        </ul>
      )}

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
                <td>{vLabel(v.status)}</td>
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
