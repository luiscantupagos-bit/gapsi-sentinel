import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { NewEditorForm } from '../../_editor/NewEditorForm';

export default async function NewEditorDocumentPage() {
  await requireServerSession();
  return (
    <main className="container">
      <p>
        <Link href="/dashboard/documents">← Volver al listado</Link>
      </p>
      <h1>Crear documento dentro de Sentinel</h1>
      <p className="muted">
        Elige una plantilla; se creará un documento interno editable en el editor enriquecido.
      </p>
      <NewEditorForm />
    </main>
  );
}
