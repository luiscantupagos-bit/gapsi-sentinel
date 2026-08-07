import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { getKpiDefinition, computeKpiView } from '@/server/kpis';
import { loadUnifiedEvents } from '@/server/analytics';
import {
  MEASURE_LABEL,
  PERIOD_LABEL,
  SOURCE_LABEL,
  KPI_STATUS_LABEL,
  DIRECTION_LABEL,
  TREND_LABEL,
} from '@/features/analytics/labels';
import { PageHeader, StatCard, SectionCard } from '../../_components/ui';
import { AnalyticsActionForm } from '../../analytics/_components/AnalyticsActionForm';
import { recomputeKpiAction } from '../../analytics/actions';
import { MiniBars } from '../../analytics/_components/MiniBars';

export default async function KpiDetailPage({ params }: { params: Promise<{ kpiId: string }> }) {
  const session = await requireServerSession();
  const { kpiId } = await params;
  const def = await getKpiDefinition(session.organizationId, kpiId);
  if (!def) notFound();

  const events = await loadUnifiedEvents(session.organizationId);
  const { computation: c, trend } = computeKpiView(def, events);

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/kpis">← Volver a KPI</Link>
      </p>
      <PageHeader
        title={`${def.code} · ${def.name}`}
        subtitle={def.description ?? undefined}
        actions={
          <AnalyticsActionForm
            action={recomputeKpiAction}
            hidden={{ kpiId: def.id }}
            button="Recalcular"
            variant="ghost"
          />
        }
      />

      <div className="statcard-row">
        <StatCard
          label="Valor actual"
          value={`${c.overall.value ?? '—'}${def.unit ? ` ${def.unit}` : ''}`}
          tone={
            c.overall.status === 'off_target'
              ? 'danger'
              : c.overall.status === 'on_target'
                ? 'success'
                : 'default'
          }
        />
        <StatCard label="Meta" value={def.target !== null ? String(def.target) : '—'} />
        <StatCard label="Estado" value={KPI_STATUS_LABEL[c.overall.status]} />
        <StatCard label="Tendencia" value={TREND_LABEL[trend.direction]} />
      </div>

      <SectionCard title="Definición">
        <ul className="def-list">
          <li>
            <span>Fuente</span>
            <strong>{SOURCE_LABEL[def.source] ?? def.source}</strong>
          </li>
          <li>
            <span>Medida</span>
            <strong>{MEASURE_LABEL[def.measure] ?? def.measure}</strong>
          </li>
          <li>
            <span>Periodicidad</span>
            <strong>{PERIOD_LABEL[def.period] ?? def.period}</strong>
          </li>
          <li>
            <span>Dirección deseada</span>
            <strong>{DIRECTION_LABEL[def.desiredDirection] ?? def.desiredDirection}</strong>
          </li>
          <li>
            <span>Eventos considerados</span>
            <strong>{c.totalEvents}</strong>
          </li>
        </ul>
        {c.insufficientData && (
          <p className="msg msg--error">
            Datos insuficientes para un resultado confiable. Registra o clasifica más eventos.
          </p>
        )}
      </SectionCard>

      <SectionCard title="Serie por periodo">
        <MiniBars
          points={c.series
            .filter((s) => s.value !== null)
            .map((s) => ({ label: s.label, value: s.value! }))}
        />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Periodo</th>
                <th>Valor</th>
                <th>Eventos</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {c.series.map((s) => (
                <tr key={s.label}>
                  <td>{s.label}</td>
                  <td>{s.value ?? '—'}</td>
                  <td>{s.count}</td>
                  <td>
                    <span className={`badge badge--${s.status}`}>{KPI_STATUS_LABEL[s.status]}</span>
                  </td>
                </tr>
              ))}
              {c.series.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    Sin periodos con datos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {trend.direction !== 'insufficient' && trend.percentChange !== null && (
          <p className="muted">
            Cambio del primer al último periodo: {trend.absoluteChange} ({trend.percentChange}%).
            Una tendencia señala dónde mirar; no implica causa.
          </p>
        )}
      </SectionCard>
    </main>
  );
}
