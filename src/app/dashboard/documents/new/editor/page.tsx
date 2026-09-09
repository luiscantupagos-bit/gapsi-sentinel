import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { listDocumentAreas, listResponsibles, listSites } from '@/server/documents';
import { StructuredCreateWizard } from '../../_editor/StructuredCreateWizard';

export default async function NewEditorDocumentPage() {
  const session = await requireServerSession();
  const [areas, sites, responsibles] = await Promise.all([
    listDocumentAreas(session.organizationId),
    listSites(session.organizationId),
    listResponsibles(session.organizationId),
  ]);

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/documents">← Volver al listado</Link>
      </p>
      <h1>Crear documento en C3 Sentinel</h1>
      <p className="muted">
        Elige el tipo de documento. C3 Sentinel propone un código, calcula las fechas de control y
        te lleva al editor estructurado por tipo.
      </p>
      <StructuredCreateWizard areas={areas} sites={sites} responsibles={responsibles} />
    </main>
  );
}
