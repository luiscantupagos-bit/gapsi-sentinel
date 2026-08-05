import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getCreateOptions } from '@/server/capa';
import { CapaForm } from '../_components/CapaForm';
import { createCapaAction } from '../capa-actions';

export default async function NewCapaPage() {
  const session = await requireServerSession();
  const options = await getCreateOptions(session.organizationId);

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/capa">← Volver al listado</Link>
      </p>
      <h1>Nueva acción correctiva (CAPA)</h1>
      <p className="muted">
        El folio se genera automáticamente al registrar. Los campos con * son obligatorios.
      </p>
      <CapaForm action={createCapaAction} options={options} mode="create" />
    </main>
  );
}
