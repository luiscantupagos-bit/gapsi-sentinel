import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { listResponsibles, listSites } from '@/server/documents';
import { DocumentForm } from '../_components/DocumentForm';
import { createDocumentAction } from '../actions';

export default async function NewDocumentPage() {
  const session = await requireServerSession();
  const [sites, responsibles] = await Promise.all([
    listSites(session.organizationId),
    listResponsibles(session.organizationId),
  ]);

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/documents">← Volver al listado</Link>
      </p>
      <h1>Nuevo documento</h1>
      <p className="muted">Los campos con * son obligatorios.</p>
      <DocumentForm
        mode="create"
        action={createDocumentAction}
        sites={sites}
        responsibles={responsibles}
      />
    </main>
  );
}
