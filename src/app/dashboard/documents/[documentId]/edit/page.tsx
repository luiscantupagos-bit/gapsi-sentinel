import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  DocumentNotFoundError,
  getDocumentForEdit,
  listResponsibles,
  listSites,
} from '@/server/documents';
import { DocumentForm } from '../../_components/DocumentForm';
import { updateMetadataAction } from '../../actions';

export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const session = await requireServerSession();
  const { documentId } = await params;

  let initial;
  try {
    initial = await getDocumentForEdit(session.organizationId, documentId);
  } catch (error) {
    if (error instanceof DocumentNotFoundError) notFound();
    throw error;
  }
  if (initial.archived) redirect(`/dashboard/documents/${documentId}`);

  const [sites, responsibles] = await Promise.all([
    listSites(session.organizationId),
    listResponsibles(session.organizationId),
  ]);

  return (
    <main className="container">
      <p>
        <Link href={`/dashboard/documents/${documentId}`}>← Volver al documento</Link>
      </p>
      <h1>Editar documento</h1>
      <DocumentForm
        mode="edit"
        action={updateMetadataAction}
        sites={sites}
        responsibles={responsibles}
        initial={initial}
      />
    </main>
  );
}
