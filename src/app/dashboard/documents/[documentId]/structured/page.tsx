import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { DocumentNotFoundError, getStructuredContent, listResponsibles } from '@/server/documents';
import { StructuredEditor } from '../../_editor/StructuredEditor';

export default async function StructuredEditorPage({
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

  // DOC-001: no abrir el editor estructurado sobre un documento que no lo es. Se
  // redirige al editor correcto (sin conversión implícita), nunca contenido vacío.
  if (data.contentMode !== 'structured') {
    redirect(
      data.contentMode === 'external'
        ? `/dashboard/documents/${documentId}`
        : `/dashboard/documents/${documentId}/editor`,
    );
  }

  // DOC-003: miembros para el selector de responsable del editor de Programa.
  const members =
    data.documentType === 'program' ? await listResponsibles(session.organizationId) : [];

  // Mapa targetDocumentId → snapshot resuelto (para los chips del editor).
  const resolvedReferences: Record<
    string,
    { code?: string; title?: string; available?: boolean; obsolete?: boolean }
  > = {};
  for (const r of data.references) {
    resolvedReferences[r.documentId] = {
      code: r.code,
      title: r.title,
      available: r.available,
      obsolete: r.obsolete,
    };
  }

  return (
    <main className="container">
      <p>
        <Link href={`/dashboard/documents/${documentId}`}>← Volver al documento</Link>
      </p>
      <h1>Editor estructurado</h1>
      <StructuredEditor
        documentId={data.documentId}
        versionId={data.versionId}
        editable={data.editable}
        documentType={data.documentType}
        code={data.documentCode}
        title={data.documentTitle}
        label={data.label}
        ownerArea={data.ownerArea}
        initialFields={data.structuredContent.fields}
        initialRepeatables={data.structuredContent.repeatables}
        initialProgram={data.structuredContent.program ?? null}
        members={members}
        resolvedReferences={resolvedReferences}
      />
    </main>
  );
}
