import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { DocumentNotFoundError, getDocumentDetail, getEditorContent } from '@/server/documents';
import { getUserVersionContext } from '@/server/document-workflow';
import { renderContentHtml } from '@/features/documents/content-schema';
import { DOCUMENT_STATUSES, labelOf } from '@/features/documents/catalog';
import { acknowledgeReadForm } from '../../workflow-actions';

export default async function DocumentPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const session = await requireServerSession();
  const { documentId } = await params;
  const { version } = await searchParams;

  let detail;
  let editor;
  try {
    [detail, editor] = await Promise.all([
      getDocumentDetail(session.organizationId, documentId),
      getEditorContent(session.organizationId, documentId, version),
    ]);
  } catch (error) {
    if (error instanceof DocumentNotFoundError) notFound();
    throw error;
  }

  const ctx = await getUserVersionContext(session.organizationId, session.userId, editor.versionId);
  const cfg = editor.pageConfig;
  const html = editor.contentHtml ?? renderContentHtml(editor.contentJson);
  const statusLabel = labelOf(DOCUMENT_STATUSES, detail.status);

  const header =
    cfg.header.style === 'none' ? null : cfg.header.style === 'tabular' ? (
      <table className="doc-header doc-header--tabular">
        <tbody>
          <tr>
            <td rowSpan={2} className="doc-header__logo">
              {cfg.header.showLogo ? 'LOGO' : ''}
            </td>
            <td>
              <strong>{cfg.header.companyName || editor.organizationName}</strong>
            </td>
            <td>
              {detail.code} · {editor.label}
            </td>
          </tr>
          <tr>
            <td>{detail.title}</td>
            <td>
              {detail.siteName ?? '—'} · {statusLabel}
            </td>
          </tr>
        </tbody>
      </table>
    ) : (
      <div className="doc-header">
        <span>
          {cfg.header.showLogo ? '🏢 ' : ''}
          {cfg.header.companyName || editor.organizationName}
        </span>
        <span>
          {detail.title} — {detail.code} · {editor.label} · {statusLabel}
        </span>
      </div>
    );

  const footer = (
    <div className="doc-footer">
      <span>{cfg.footer.confidentiality}</span>
      {cfg.footer.controlledLegend && <span>Documento controlado</span>}
      {cfg.footer.showCodeVersion && (
        <span>
          {detail.code} · {editor.label}
        </span>
      )}
      {cfg.footer.showPagination && <span>Página 1</span>}
      <span>{editor.organizationName}</span>
    </div>
  );

  return (
    <main className="container">
      <p>
        <Link href={`/dashboard/documents/${documentId}/editor?version=${editor.versionId}`}>
          ← Volver al editor
        </Link>{' '}
        · <Link href={`/dashboard/documents/${documentId}`}>Documento</Link>
      </p>
      <h1>Vista previa</h1>
      <p className="banner banner--provisional">
        Vista previa de demostración (tamaño carta). No genera todavía un PDF real.
      </p>

      {ctx?.hasPendingRead && editor.contentChecksum && (
        <form action={acknowledgeReadForm} className="wf-form banner">
          <input type="hidden" name="documentId" value={documentId} />
          <input type="hidden" name="versionId" value={editor.versionId} />
          <input type="hidden" name="checksum" value={editor.contentChecksum} />
          <span>Confirmo que he leído y comprendido esta versión del documento.</span>
          <button className="button button--primary" type="submit">
            Confirmar lectura
          </button>
        </form>
      )}

      <div className="preview">
        {cfg.cover.enabled && (
          <section className="page page--cover" aria-label="Portada">
            <div className="cover__logo">{cfg.header.showLogo ? 'LOGO' : ''}</div>
            <h2>{detail.title}</h2>
            <p>
              {detail.code} · {editor.label}
            </p>
            <p>{cfg.header.companyName || editor.organizationName}</p>
            <p>{detail.siteName ?? ''}</p>
            <p>{detail.issuedAt ?? ''}</p>
            <dl className="cover__signs">
              <div>
                <dt>Elaboró</dt>
                <dd>{detail.responsibleName ?? '—'}</dd>
              </div>
              <div>
                <dt>Revisó</dt>
                <dd>—</dd>
              </div>
              <div>
                <dt>Aprobó</dt>
                <dd>—</dd>
              </div>
            </dl>
          </section>
        )}

        <section className="page">
          {header}
          <div
            className="page__body"
            // El HTML se genera en servidor desde JSON con un allowlist (sin scripts).
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {footer}
        </section>
      </div>
    </main>
  );
}
