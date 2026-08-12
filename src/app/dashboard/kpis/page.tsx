import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { listKpisWithComputation } from '@/server/kpis';
import {
  MEASURE_LABEL,
  PERIOD_LABEL,
  SOURCE_LABEL,
  KPI_STATUS_LABEL,
  TREND_LABEL,
} from '@/features/analytics/labels';
import { PageHeader, StatCard } from '../_components/ui';
import { AnalyticsActionForm } from '../analytics/_components/AnalyticsActionForm';
import { recomputeKpiAction } from '../analytics/actions';

export default async function KpisPage() {
  const session = await requireServerSession();
  const kpis = await listKpisWithComputation(session.organizationId);

  const offTarget = kpis.filter((k) => k.computation.overall.status === 'off_target').length;
  const noData = kpis.filter((k) => k.computation.insufficientData).length;

  return (
    <main className="container">
      <PageHeader
        title="Indicadores (KPI)"
        subtitle="Supervisa el desempeño de tus procesos y el cumplimiento de tus metas."
        actions={
          <div className="page-head__actions">
            <AnalyticsActionForm
              action={recomputeKpiAction}
              button="Recalcular todo"
              variant="ghost"
            />
            <Link className="button button--primary" href="/dashboard/kpis/new">
              Nuevo KPI
            </Link>
          </div>
        }
      />

      <div className="statcard-row">
        <StatCard label="KPI activos" value={kpis.length} />
        <StatCard
          label="Fuera de meta"
          value={offTarget}
          tone={offTarget > 0 ? 'danger' : 'success'}
        />
        <StatCard label="Sin dato" value={noData} tone={noData > 0 ? 'warning' : 'default'} />
        <StatCard label="Analítica" value="Pareto y tendencias" href="/dashboard/analytics" />
      </div>

      {kpis.length === 0 ? (
        <p className="muted">Aún no hay KPI. Crea el primero con el constructor.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table tbl-linkable">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Fuente</th>
                <th>Medida</th>
                <th>Periodo</th>
                <th>Valor actual</th>
                <th>Meta</th>
                <th>Estado</th>
                <th>Tendencia</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map(({ definition: d, computation: c, trend }) => (
                <tr key={d.id}>
                  <td className="mono">
                    <Link href={`/dashboard/kpis/${d.id}`}>{d.code}</Link>
                  </td>
                  <td>
                    <Link href={`/dashboard/kpis/${d.id}`} className="tbl-title">
                      {d.name}
                    </Link>
                  </td>
                  <td>{SOURCE_LABEL[d.source] ?? d.source}</td>
                  <td>{MEASURE_LABEL[d.measure] ?? d.measure}</td>
                  <td>{PERIOD_LABEL[d.period] ?? d.period}</td>
                  <td>
                    {c.overall.value ?? '—'}
                    {d.unit ? ` ${d.unit}` : ''}
                  </td>
                  <td>{d.target !== null ? String(d.target) : '—'}</td>
                  <td>
                    <span className={`badge badge--${c.overall.status}`}>
                      {KPI_STATUS_LABEL[c.overall.status]}
                    </span>
                  </td>
                  <td>{TREND_LABEL[trend.direction]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
