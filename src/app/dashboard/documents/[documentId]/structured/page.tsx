import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { DocumentNotFoundError, getStructuredContent } from '@/server/documents';
import { isStructuredType } from '@/features/documents/template-registry';
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

  if (!isStructuredType(data.documentType)) notFound();

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
        initialFields={data.structuredContent.fields}
        initialRepeatables={data.structuredContent.repeatables}
      />
    </main>
  );
}
