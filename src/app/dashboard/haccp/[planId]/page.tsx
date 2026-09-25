import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { getPrisma } from '@/server/db';
import { listResponsibles, listDocuments } from '@/server/documents';
import { HaccpNotFoundError, getHaccpPlanDetail } from '@/server/haccp';
import { getPlanFlow } from '@/server/haccp-flow';
import { resolveTab } from '@/features/haccp/haccp-state';
import { HaccpWorkspace } from './_components/HaccpWorkspace';

/**
 * HACCP-001 — workspace del Plan HACCP por TABS (Resumen / Equipo / Producto / Materias
 * primas / PPR / Documentos). Las fases futuras (flujo, peligros, PCC…) aparecen como
 * «Próximamente». La versión publicada es inmutable; solo el borrador es editable.
 */
export default async function HaccpPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireServerSession();
  const { planId } = await params;
  const initialTab = resolveTab((await searchParams).tab);

  let detail;
  try {
    detail = await getHaccpPlanDetail(session.organizationId, planId);
  } catch (error) {
    if (error instanceof HaccpNotFoundError) notFound();
    throw error;
  }

  const [documents, members, sites, membership] = await Promise.all([
    listDocuments(session.organizationId),
    listResponsibles(session.organizationId),
    getPrisma().site.findMany({
      where: { organizationId: session.organizationId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    getPrisma().membership.findFirst({
      where: { organizationId: session.organizationId, userId: session.userId },
      select: { role: true },
    }),
  ]);
  const isAdmin = membership?.role === 'owner' || membership?.role === 'admin';
  const flow = await getPlanFlow(session.organizationId, planId);
  const docPick = documents.map((d) => ({
    id: d.id,
    code: d.code,
    title: d.title,
    documentType: d.documentType,
    status: d.status,
  }));

  return (
    <main className="container">
      <nav className="doc-lib__crumb" aria-label="Ruta de navegación">
        <Link href="/dashboard/haccp">Planes HACCP</Link>
        {' › '}
        <span aria-current="page">{detail.plan.code}</span>
      </nav>
      <div className="page-head">
        <h1>
          <span className="muted">{detail.plan.code}</span> {detail.plan.title}
        </h1>
      </div>
      <HaccpWorkspace
        data={detail}
        initialTab={initialTab}
        documents={docPick}
        members={members}
        sites={sites}
        canEdit={isAdmin && detail.editable}
        isAdmin={isAdmin}
        flow={flow}
      />
    </main>
  );
}
