import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { CapaNotFoundError, getCapaDetail } from '@/server/capa';
import { getAnalysisDetail, listAnalyses } from '@/server/quality-analysis';
import { getPrisma } from '@/server/db';
import { renderCapaReportHtml } from '@/features/capa/capa-report';
import { buildIshikawa6MHtml } from '@/features/capa/ishikawa-6m';
import {
  ANALYSIS_TYPE_LABEL,
  ANALYSIS_STATUS_LABEL,
  type AnalysisType,
  type AnalysisStatus,
} from '@/features/capa/analysis-state';
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

  // §16 — análisis de causas 6M embebido en D4 (constructor único). §5 — otras herramientas
  // de análisis aplicadas a la CAPA, listadas después. Toma el Ishikawa más reciente.
  const allAnalyses = await listAnalyses(session.organizationId, { capaId });
  const ishikawaList = allAnalyses.filter((a) => a.type === 'ishikawa');
  const otherAnalyses = allAnalyses
    .filter((a) => a.type !== 'ishikawa')
    .map((a) => ({
      tool: ANALYSIS_TYPE_LABEL[a.type as AnalysisType] ?? a.type,
      title: a.title,
      status: ANALYSIS_STATUS_LABEL[a.status as AnalysisStatus] ?? a.status,
    }));

  let ishikawa6MHtml: string | null = null;
  if (ishikawaList.length > 0) {
    const detail = await getAnalysisDetail(session.organizationId, ishikawaList[0]!.id);
    const categories = detail.categories
      .filter((c) => c.active)
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        causes: detail.hypotheses
          .filter((h) => h.ishikawaCategoryId === cat.id)
          .map((h) => ({
            id: h.id,
            description: h.description,
            status: h.status,
            probability: h.probability,
          })),
      }));
    if (categories.length > 0) {
      ishikawa6MHtml = buildIshikawa6MHtml(categories, { withHeading: false });
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
      ishikawa6MHtml,
      otherAnalyses,
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
