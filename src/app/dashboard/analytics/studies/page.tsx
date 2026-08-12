import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import {
  listStudies,
  getStudySummary,
  STUDY_STATUS_LABEL,
  STUDY_SOURCE_LABEL,
} from '@/server/studies';
import { PageHeader, StatCard } from '../../_components/ui';

const day = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

export default async function StudiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await requireServerSession();
  const sp = await searchParams;
  const [items, summary] = await Promise.all([
    listStudies(session.organizationId, { search: sp.q?.trim() || undefined, status: sp.status }),
    getStudySummary(session.organizationId),
  ]);

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/analytics">← Volver a analítica</Link>
      </p>
      <PageHeader
        title="Estudios de datos"
        subtitle="Analiza información propia (mediciones, tiempos, desperdicio…) reutilizando las herramientas estadísticas de Sentinel."
        actions={
          <Link className="button button--primary" href="/dashboard/analytics/studies/new">
            Nuevo estudio
          </Link>
        }
      />

      <div className="statcard-row">
        <StatCard label="Total" value={summary.total} />
        <StatCard label="Borradores" value={summary.draft} />
        <StatCard label="En análisis" value={summary.analyzing} tone="warning" />
        <StatCard label="Concluidos" value={summary.concluded} tone="success" />
      </div>

      <form method="get" className="filters">
        <input type="search" name="q" defaultValue={sp.q ?? ''} placeholder="Buscar por título…" />
        <select name="status" defaultValue={sp.status ?? ''}>
          <option value="">Todos los estados</option>
          {Object.entries(STUDY_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="button button--ghost" type="submit">
          Filtrar
        </button>
      </form>

      {items.length === 0 ? (
        <p className="empty-state">
          Aún no hay estudios. Crea el primero para importar y analizar datos.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="tbl-linkable">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Título</th>
                <th>Origen</th>
                <th>Estado</th>
                <th>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td className="mono">
                    <Link href={`/dashboard/analytics/studies/${s.id}`}>{s.folio}</Link>
                  </td>
                  <td>
                    <Link href={`/dashboard/analytics/studies/${s.id}`} className="tbl-title">
                      {s.title}
                    </Link>
                  </td>
                  <td>{STUDY_SOURCE_LABEL[s.sourceType ?? 'independent'] ?? s.sourceType}</td>
                  <td>
                    <span className={`badge badge--study-${s.status}`}>
                      {STUDY_STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </td>
                  <td>{day(s.updatedAt ?? s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
