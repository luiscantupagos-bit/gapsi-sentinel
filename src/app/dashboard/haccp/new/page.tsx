import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getPrisma } from '@/server/db';
import { listResponsibles } from '@/server/documents';
import { NewPlanForm } from './NewPlanForm';

/** HACCP-001 — asistente mínimo para crear un Plan HACCP (§32). */
export default async function NewHaccpPlanPage() {
  const session = await requireServerSession();
  const [members, sites] = await Promise.all([
    listResponsibles(session.organizationId),
    getPrisma().site.findMany({
      where: { organizationId: session.organizationId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <main className="container">
      <nav className="doc-lib__crumb" aria-label="Ruta de navegación">
        <Link href="/dashboard/haccp">Planes HACCP</Link>
        {' › '}
        <span aria-current="page">Nuevo</span>
      </nav>
      <h1>Nuevo Plan HACCP</h1>
      <p className="msg msg--info">
        El código <strong>PL-HACCP-###</strong> se asigna automáticamente. Podrás completar el
        equipo, el producto, las materias primas, los prerrequisitos y los documentos en el
        workspace del plan antes de publicarlo.
      </p>
      <NewPlanForm members={members} sites={sites} />
    </main>
  );
}
