import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { DocumentNotFoundError, getEditorContent } from '@/server/documents';
import { DocumentEditor } from '../../_editor/Editor';

export default async function DocumentEditorPage({
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
    data = await getEditorContent(session.organizationId, documentId, version);
  } catch (error) {
    if (error instanceof DocumentNotFoundError) notFound();
    throw error;
  }

  return (
    <DocumentEditor
      documentId={data.documentId}
      documentCode={data.documentCode}
      documentTitle={data.documentTitle}
      versionId={data.versionId}
      label={data.label}
      editable={data.editable}
      content={data.contentJson}
      pageConfig={data.pageConfig}
      versions={data.versions}
    />
  );
}
