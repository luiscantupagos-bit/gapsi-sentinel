import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  DocumentNotFoundError,
  getDocumentDetail,
  getEditorContent,
  getStructuredContent,
  listDocumentAreas,
} from '@/server/documents';
import { getUserVersionContext } from '@/server/document-workflow';
import { DocumentToolbar } from './DocumentToolbar';

/**
 * Vista canónica del documento (DOC-UX-003 §3-4). Es la VISTA PREVIA/render del
 * documento como contenido principal, con la toolbar de acciones ARRIBA. El panel
 * administrativo vive en `./panel`. Todos los enlaces de la app (código, nombre,
 * biblioteca, maestro, relaciones, referencias) llegan aquí.
 */
export default async function DocumentViewPage({
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

  const isExternal = doc.contentMode === 'external';
  const isStructured = doc.contentMode === 'structured';

  const [editor, areas] = await Promise.all([
    getEditorContent(session.organizationId, documentId),
    listDocumentAreas(session.organizationId),
  ]);
  const ctx = await getUserVersionContext(session.organizationId, session.userId, editor.versionId);
  const currentVersionStatus = doc.versions.find((v) => v.id === editor.versionId)?.status ?? null;
  const canSubmitReview = editor.editable && Boolean(ctx?.isAuthor || ctx?.isAdmin);

  // Render principal según el modo de la versión vigente.
  let renderedHtml: string | null = null;
  if (isStructured) {
    const data = await getStructuredContent(session.organizationId, documentId);
    renderedHtml = data.renderedHtml;
  } else if (!isExternal) {
    renderedHtml = editor.contentHtml ?? null;
  }

  const panelHref = `/dashboard/documents/${doc.id}/panel`;

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/documents">← Volver al listado</Link>
      </p>

      <div className="page-head">
        <h1>
          <span className="muted">{doc.code}</span> {doc.title}
        </h1>
      </div>

      <DocumentToolbar
        documentId={doc.id}
        currentVersionId={isStructured ? editor.versionId : null}
        currentVersionStatus={currentVersionStatus}
        documentStatus={doc.status}
        editable={doc.editable}
        canEditContent={!isExternal}
        canSubmitReview={canSubmitReview}
        editorHref={
          isStructured
            ? `/dashboard/documents/${doc.id}/structured`
            : isExternal
              ? null
              : `/dashboard/documents/${doc.id}/editor`
        }
        metadataHref={`/dashboard/documents/${doc.id}/edit`}
        panelHref={panelHref}
        areas={areas}
      />

      {isExternal ? (
        <div className="external-doc-card">
          <p>
            <strong>Documento externo registrado.</strong> C3 Sentinel conserva el archivo y sus
            metadatos; su contenido no se transcribe.
          </p>
          <p className="muted">
            Consulta el archivo y sus datos desde el{' '}
            <Link href={panelHref}>panel del documento</Link>.
          </p>
        </div>
      ) : renderedHtml ? (
        <div className="doc-view">
          {/* HTML generado en servidor desde datos estructurados (allowlist, sin scripts). */}
          <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        </div>
      ) : (
        <p className="empty-state">
          Este documento aún no tiene contenido para mostrar.{' '}
          <Link href={panelHref}>Ir al panel del documento</Link>.
        </p>
      )}
    </main>
  );
}
