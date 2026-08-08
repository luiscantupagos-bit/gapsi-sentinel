import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { listDiagnostics, getDiagnosticSummary } from '@/server/diagnostics';
import { DIAGNOSTIC_STATUS_LABEL, type DiagnosticStatus } from '@/features/diagnostics/state';
import { PageHeader, StatCard } from '../_components/ui';

const day = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

export default async function DiagnosticsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await requireServerSession();
  const sp = await searchParams;
  const [items, summary] = await Promise.all([
    listDiagnostics(session.organizationId, {
      search: sp.q?.trim() || undefined,
      status: sp.status || undefined,
    }),
    getDiagnosticSummary(session.organizationId),
  ]);

  return (
    <main className="container">
      <PageHeader
        title="Diagnósticos"
        subtitle="Evalúa el cumplimiento de tu sistema de gestión frente a cada esquema y da seguimiento a las brechas."
      />

      <div className="statcard-row">
        <StatCard label="Total" value={summary.total} />
        <StatCard label="En progreso" value={summary.inProgress} tone="warning" />
        <StatCard label="Pendientes" value={summary.pending} />
        <StatCard label="Completados" value={summary.completed} tone="success" />
      </div>

      <form method="get" className="filters" aria-label="Filtros de diagnósticos">
        <input type="search" name="q" defaultValue={sp.q ?? ''} placeholder="Buscar por nombre…" />
        <select name="status" defaultValue={sp.status ?? ''}>
          <option value="">Todos los estados</option>
          {(Object.keys(DIAGNOSTIC_STATUS_LABEL) as DiagnosticStatus[]).map((s) => (
            <option key={s} value={s}>
              {DIAGNOSTIC_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button className="button button--ghost" type="submit">
          Filtrar
        </button>
      </form>

      {items.length === 0 ? (
        <p className="empty-state">No hay diagnósticos que coincidan con el filtro.</p>
      ) : (
        <div className="table-wrap">
          <table className="tbl-linkable">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Esquema</th>
                <th>Sitio</th>
                <th>Responsable</th>
                <th>Progreso</th>
                <th>Estado</th>
                <th>Fecha objetivo</th>
                <th>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/dashboard/diagnostics/${d.id}`} className="tbl-title">
                      {d.name}
                    </Link>
                  </td>
                  <td>{d.frameworkName}</td>
                  <td>{d.siteName}</td>
                  <td>{d.responsibleName ?? <span className="muted">Sin asignar</span>}</td>
                  <td>
                    <span className="tprogress" title={`${d.progress.percentage}%`}>
                      <span className="tprogress__track">
                        <span
                          className="tprogress__fill"
                          style={{ width: `${d.progress.percentage}%` }}
                        />
                      </span>
                      <span className="tprogress__num">{d.progress.percentage}%</span>
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge--diag-${d.status}`}>
                      {DIAGNOSTIC_STATUS_LABEL[d.status]}
                    </span>
                  </td>
                  <td>{day(d.targetDate)}</td>
                  <td>{day(d.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
