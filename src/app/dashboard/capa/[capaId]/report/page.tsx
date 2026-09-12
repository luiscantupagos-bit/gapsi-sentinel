import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { CapaNotFoundError, getCapaDetail } from '@/server/capa';
import { getAnalysisDetail, listAnalyses } from '@/server/quality-analysis';
import { getPrisma } from '@/server/db';
import { renderCapaReportHtml } from '@/features/capa/capa-report';
import { buildIshikawaSvg } from '@/features/capa/ishikawa-svg';
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

  // §D — Ishikawa embebido en D4: reutiliza el ÚNICO constructor de SVG (el mismo que usa
  // el componente del análisis). Toma el análisis Ishikawa más reciente vinculado a la CAPA.
  let ishikawaSvg: string | null = null;
  const ishikawaList = await listAnalyses(session.organizationId, {
    capaId,
    type: 'ishikawa',
  });
  if (ishikawaList.length > 0) {
    const detail = await getAnalysisDetail(session.organizationId, ishikawaList[0]!.id);
    const categories = detail.categories
      .filter((c) => c.active)
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        causes: detail.hypotheses
          .filter((h) => h.ishikawaCategoryId === cat.id)
          .map((h) => ({ id: h.id, description: h.description, status: h.status })),
      }));
    if (categories.length > 0) {
      ishikawaSvg = buildIshikawaSvg({
        effect: (data.capa.title as string) ?? 'Efecto',
        categories,
      });
    }
  }

  const html = renderCapaReportHtml(
    {
      capa: data.capa as unknown as Record<string, unknown>,
      immediateActions: data.immediateActions as unknown as Record<string, unknown>[],
      rca: data.rca as unknown as Record<string, unknown> | null,
      whySteps: data.whySteps as unknown as Record<string, unknown>[],
      actions: data.actions as unknown as Record<string, unknown>[],
      reviews: data.reviews as unknown as Record<string, unknown>[],
      ishikawaSvg,
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
