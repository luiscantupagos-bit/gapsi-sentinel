import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { DocumentNotFoundError, getStructuredContent } from '@/server/documents';

export default async function StructuredPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const session = await requireServerSession();
  const { documentId } = await params;
  const { version } = await searchParams;

  let data;
  try {
    data = await getStructuredContent(session.organizationId, documentId, version);
  } catch (error) {
    if (error instanceof DocumentNotFoundError) notFound();
    throw error;
  }

  // DOC-001: no renderizar un documento estructurado vacío para un doc que no lo
  // es; se redirige a la vista previa correcta.
  if (data.contentMode !== 'structured') {
    redirect(
      data.contentMode === 'external'
        ? `/dashboard/documents/${documentId}`
        : `/dashboard/documents/${documentId}/preview`,
    );
  }

  return (
    <main className="container">
      <p>
        <Link href={`/dashboard/documents/${documentId}/structured?version=${data.versionId}`}>
          ← Volver al editor
        </Link>{' '}
        · <Link href={`/dashboard/documents/${documentId}`}>Documento</Link>
      </p>
      <h1>Vista previa</h1>
      <p className="banner banner--info">
        Render normalizado del documento (solo lectura). Base para exportación futura a PDF/DOCX.
      </p>
      <div className="preview">
        <section className="page">
          <div
            className="page__body"
            // HTML generado en servidor desde datos estructurados (allowlist, sin scripts).
            dangerouslySetInnerHTML={{ __html: data.renderedHtml }}
          />
        </section>
      </div>
    </main>
  );
}
