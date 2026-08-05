import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getCapaDetail } from '@/server/capa';
import { listAnalysisMembers } from '@/server/quality-analysis';
import { NewAnalysisForm } from '../_components/NewAnalysisForm';

export default async function NewAnalysisPage({ params }: { params: Promise<{ capaId: string }> }) {
  const session = await requireServerSession();
  const { capaId } = await params;
  const [{ capa }, members] = await Promise.all([
    getCapaDetail(session.organizationId, capaId),
    listAnalysisMembers(session.organizationId),
  ]);

  return (
    <main className="container">
      <p>
        <Link href={`/dashboard/capa/${capaId}/analysis`}>← Volver a análisis</Link>
      </p>
      <h1>Nuevo análisis</h1>
      <p className="muted">
        {capa.folio} · {capa.title}. Las herramientas ayudan a investigar; no deciden la causa raíz.
      </p>
      <NewAnalysisForm capaId={capaId} members={members} />
    </main>
  );
}
