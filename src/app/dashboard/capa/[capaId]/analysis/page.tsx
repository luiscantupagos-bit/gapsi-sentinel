import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getCapaDetail } from '@/server/capa';
import { listAnalyses } from '@/server/quality-analysis';
import {
  ANALYSIS_STATUS_LABEL,
  ANALYSIS_TYPE_LABEL,
  type AnalysisStatus,
  type AnalysisType,
} from '@/features/capa/analysis-state';

export default async function CapaAnalysisListPage({
  params,
}: {
  params: Promise<{ capaId: string }>;
}) {
  const session = await requireServerSession();
  const { capaId } = await params;
  const [{ capa }, rows] = await Promise.all([
    getCapaDetail(session.organizationId, capaId),
    listAnalyses(session.organizationId, { capaId }),
  ]);

  return (
    <main className="container">
      <p>
        <Link href={`/dashboard/capa/${capaId}`}>← Volver a la CAPA</Link>
      </p>
      <div className="page-head">
        <div>
          <h1>Análisis · {capa.folio}</h1>
          <p className="muted">Herramientas de análisis e investigación para esta CAPA.</p>
        </div>
        <Link className="button" href={`/dashboard/capa/${capaId}/analysis/new`}>
          + Nuevo análisis
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="empty-state">
          Aún no hay análisis. Crea el primero para investigar la causa.
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Título</th>
                <th>Estado</th>
                <th>Versión</th>
                <th>Responsable</th>
                <th>Actualizado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{ANALYSIS_TYPE_LABEL[a.type as AnalysisType] ?? a.type}</td>
                  <td>{a.title}</td>
                  <td>
                    <span className={`badge badge--analysis-${a.status}`}>
                      {ANALYSIS_STATUS_LABEL[a.status as AnalysisStatus] ?? a.status}
                    </span>
                  </td>
                  <td>v{a.version}</td>
                  <td>{a.responsibleName ?? '—'}</td>
                  <td>{a.updatedAt}</td>
                  <td>
                    <Link
                      className="button button--ghost"
                      href={`/dashboard/capa/${capaId}/analysis/${a.id}`}
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
