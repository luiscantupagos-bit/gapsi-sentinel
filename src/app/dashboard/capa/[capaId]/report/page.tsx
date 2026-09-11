import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { CapaNotFoundError, getCapaDetail } from '@/server/capa';
import { getPrisma } from '@/server/db';
import { renderCapaReportHtml } from '@/features/capa/capa-report';
import { PaginatedDocument } from '../../../documents/[documentId]/_components/PaginatedDocument';
import { PrintControls } from '../../../documents/[documentId]/copy/_components/PrintControls';

/**
 * CAPA-8D-OUTPUT — reporte formal 8D del expediente CAPA, en hojas físicas (mismo motor
 * de páginas que la salida documental). No incluye el historial técnico interno (§K17).
 */
export default async function CapaReportPage({ params }: { params: Promise<{ capaId: string }> }) {
  const session = await requireServerSession();
  const { capaId } = await params;

  let data;
  try {
    data = await getCapaDetail(session.organizationId, capaId);
  } catch (error) {
    if (error instanceof CapaNotFoundError) notFound();
    throw error;
  }

  const org = await getPrisma().organization.findUniqueOrThrow({
    where: { id: session.organizationId },
    select: { name: true },
  });
  const fmtDate = (d: unknown): string =>
    d ? new Date(d as string | Date).toLocaleDateString('es-MX') : '—';

  const html = renderCapaReportHtml(
    {
      capa: data.capa as unknown as Record<string, unknown>,
      immediateActions: data.immediateActions as unknown as Record<string, unknown>[],
      rca: data.rca as unknown as Record<string, unknown> | null,
      whySteps: data.whySteps as unknown as Record<string, unknown>[],
      actions: data.actions as unknown as Record<string, unknown>[],
      reviews: data.reviews as unknown as Record<string, unknown>[],
    },
    {
      organizationName: org.name,
      organizationLogoUrl: null,
      name: (id) => data.nameOf(id ?? null),
      date: fmtDate,
    },
  );

  const backHref = `/dashboard/capa/${capaId}`;
  return (
    <main className="copy-page">
      <PrintControls backHref={backHref} note="Reporte 8D del expediente CAPA." />
      <PaginatedDocument html={html} pageSize="letter" />
    </main>
  );
}
