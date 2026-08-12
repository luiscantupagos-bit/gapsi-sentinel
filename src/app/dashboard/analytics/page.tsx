import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { loadUnifiedEvents } from '@/server/analytics';
import { listAlerts } from '@/server/quality-alerts';
import {
  paretoByDimension,
  computeTrend,
  type ParetoWeight,
} from '@/features/analytics/pareto-trends';
import { analyzeDataQuality } from '@/features/analytics/data-quality';
import {
  runBivariate,
  resolveVariable,
  NUMERIC_VARIABLES,
  CATEGORICAL_VARIABLES,
} from '@/features/analytics/bivariate';
import type { DimensionField, KpiPeriod } from '@/features/analytics/kpi-engine';
import {
  PERIOD_LABEL,
  UNIFIED_SOURCE_LABEL,
  UNIFIED_STATUS_LABEL,
} from '@/features/analytics/labels';
import { PageHeader, StatCard, SectionCard } from '../_components/ui';
import { AnalyticsActionForm } from './_components/AnalyticsActionForm';
import { evaluateAlertsAction, resolveAlertAction } from './actions';
import { ParetoPanel } from './_components/ParetoPanel';
import { MiniBars } from './_components/MiniBars';
import { BivariateView } from './_components/BivariateView';

const TABS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'pareto', label: 'Pareto' },
  { key: 'tendencias', label: 'Tendencias' },
  { key: 'relaciones', label: 'Relaciones' },
  { key: 'estadistica', label: 'Estadística' },
  { key: 'calidad', label: 'Calidad de datos' },
] as const;

const DIMENSIONS: { field: DimensionField; label: string }[] = [
  { field: 'process', label: 'Proceso' },
  { field: 'area', label: 'Área' },
  { field: 'eventType', label: 'Tipo de evento' },
  { field: 'category', label: 'Categoría' },
  { field: 'severity', label: 'Severidad' },
  { field: 'source', label: 'Origen' },
  { field: 'product', label: 'Producto' },
  { field: 'machine', label: 'Máquina' },
  { field: 'shift', label: 'Turno' },
  { field: 'supplier', label: 'Proveedor' },
];

const WEIGHTS: { key: ParetoWeight; label: string }[] = [
  { key: 'frequency', label: 'Frecuencia' },
  { key: 'cost', label: 'Costo' },
  { key: 'quantity', label: 'Cantidad afectada' },
  { key: 'duration', label: 'Duración' },
];

function countBy<T extends string>(
  items: { [k: string]: unknown }[],
  key: string,
): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) {
    const v = (it[key] as T) ?? ('—' as T);
    m.set(String(v), (m.get(String(v)) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireServerSession();
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : 'resumen';

  const events = await loadUnifiedEvents(session.organizationId);
  const today = new Date().toISOString().slice(0, 10);

  const link = (key: string) => `/dashboard/analytics?tab=${key}`;

  return (
    <main className="container">
      <PageHeader
        title="Analítica de calidad"
        subtitle="Identifica patrones, tendencias y relaciones en los datos de calidad."
        actions={
          <>
            <Link className="button button--primary" href="/dashboard/analytics/studies">
              Estudios de datos
            </Link>
            <Link className="button button--ghost" href="/dashboard/quality-events">
              Ver eventos
            </Link>
            <Link className="button button--ghost" href="/dashboard/kpis">
              Ver indicadores
            </Link>
          </>
        }
      />

      <nav className="tabs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={link(t.key)}
            className={`tab${tab === t.key ? ' is-active' : ''}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'resumen' && <ResumenTab events={events} organizationId={session.organizationId} />}
      {tab === 'pareto' && <ParetoTab events={events} sp={sp} />}
      {tab === 'tendencias' && <TendenciasTab events={events} sp={sp} />}
      {tab === 'relaciones' && <RelacionesTab events={events} />}
      {tab === 'estadistica' && <EstadisticaTab events={events} sp={sp} />}
      {tab === 'calidad' && <CalidadTab events={events} today={today} />}
    </main>
  );
}

type Ev = Awaited<ReturnType<typeof loadUnifiedEvents>>;

async function ResumenTab({ events, organizationId }: { events: Ev; organizationId: string }) {
  const alerts = await listAlerts(organizationId, 'open');
  const bySource = countBy(events as unknown as Record<string, unknown>[], 'source');
  const byStatus = countBy(events as unknown as Record<string, unknown>[], 'status');
  const open = events.filter((e) => e.status === 'open').length;

  return (
    <>
      <div className="statcard-row">
        <StatCard label="Eventos (todos los orígenes)" value={events.length} />
        <StatCard label="Abiertos" value={open} tone={open > 0 ? 'warning' : 'default'} />
        <StatCard
          label="Alertas abiertas"
          value={alerts.length}
          tone={alerts.length > 0 ? 'danger' : 'success'}
        />
        <StatCard label="Registrar evento" value="Nuevo" href="/dashboard/quality-events/new" />
      </div>

      <SectionCard
        title="Alertas internas"
        action={
          <AnalyticsActionForm
            action={evaluateAlertsAction}
            button="Evaluar ahora"
            variant="ghost"
          />
        }
      >
        {alerts.length === 0 ? (
          <p className="muted">
            Sin alertas abiertas. Evalúa para detectar desviaciones, incrementos o recurrencias.
          </p>
        ) : (
          <ul className="alert-list">
            {alerts.map((a) => (
              <li key={a.id} className={`alert alert--${a.severity}`}>
                <div>
                  <strong>{a.title}</strong>
                  <p className="muted">{a.message}</p>
                  {a.href && <Link href={a.href}>Abrir origen →</Link>}
                </div>
                <AnalyticsActionForm
                  action={resolveAlertAction}
                  hidden={{ alertId: a.id }}
                  button="Resolver"
                  variant="ghost"
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="two-col">
        <SectionCard title="Por origen">
          <DistTable rows={bySource} labels={UNIFIED_SOURCE_LABEL} />
        </SectionCard>
        <SectionCard title="Por estado">
          <DistTable rows={byStatus} labels={UNIFIED_STATUS_LABEL} />
        </SectionCard>
      </div>
    </>
  );
}

function DistTable({
  rows,
  labels,
}: {
  rows: [string, number][];
  labels?: Record<string, string>;
}) {
  if (rows.length === 0) return <p className="muted">Sin datos.</p>;
  return (
    <table className="data-table">
      <tbody>
        {rows.map(([k, n]) => (
          <tr key={k}>
            <td>{labels?.[k] ?? k}</td>
            <td>{n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ParetoTab({ events, sp }: { events: Ev; sp: Record<string, string | undefined> }) {
  const dim = (DIMENSIONS.find((d) => d.field === sp.dim)?.field ?? 'process') as DimensionField;
  const weight = (WEIGHTS.find((w) => w.key === sp.w)?.key ?? 'frequency') as ParetoWeight;
  const { result, insights } = paretoByDimension(events, dim, weight);
  const rows = result.rows.map((r) => ({
    category: r.category,
    value: r.value,
    percentage: r.percentage,
    cumulativePercentage: r.cumulativePercentage,
    vitalFew: r.vitalFew,
  }));

  return (
    <SectionCard title="Análisis de Pareto (80/20)">
      <form method="get" className="filter-bar">
        <input type="hidden" name="tab" value="pareto" />
        <label className="field">
          <span className="field__label">Dimensión</span>
          <select name="dim" defaultValue={dim}>
            {DIMENSIONS.map((d) => (
              <option key={d.field} value={d.field}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Peso</span>
          <select name="w" defaultValue={weight}>
            {WEIGHTS.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <button className="button button--ghost" type="submit">
          Aplicar
        </button>
      </form>
      {insights && (
        <p className="muted">
          {insights.vitalCount} de {insights.categories} categorías concentran el{' '}
          {insights.vitalCumulative}% (grupo vital). Prioriza esas para mayor impacto; investiga
          antes de concluir causa.
        </p>
      )}
      <ParetoPanel rows={rows} cutoff={result.cutoff} />
    </SectionCard>
  );
}

function TendenciasTab({ events, sp }: { events: Ev; sp: Record<string, string | undefined> }) {
  const period = (
    ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(sp.period ?? '')
      ? sp.period
      : 'monthly'
  ) as KpiPeriod;
  const trend = computeTrend(events, { measure: 'count', period });

  return (
    <SectionCard title="Tendencia de eventos">
      <form method="get" className="filter-bar">
        <input type="hidden" name="tab" value="tendencias" />
        <label className="field">
          <span className="field__label">Periodicidad</span>
          <select name="period" defaultValue={period}>
            {(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as KpiPeriod[]).map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <button className="button button--ghost" type="submit">
          Aplicar
        </button>
      </form>
      <MiniBars points={trend.points} />
      {trend.direction !== 'insufficient' && trend.percentChange !== null ? (
        <p className="muted">
          Del primer al último periodo: {trend.absoluteChange} ({trend.percentChange}%). La
          tendencia señala dónde mirar; no implica causa.
        </p>
      ) : (
        <p className="muted">Datos insuficientes para estimar una tendencia.</p>
      )}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Periodo</th>
              <th>Eventos</th>
            </tr>
          </thead>
          <tbody>
            {trend.points.map((p) => (
              <tr key={p.label}>
                <td>{p.label}</td>
                <td>{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function RelacionesTab({ events }: { events: Ev }) {
  const aggregated = events.filter((e) => e.origin !== 'native').slice(0, 200);
  return (
    <SectionCard title="Relaciones y trazabilidad">
      <p className="muted">
        Los registros agregados en vivo desde otros módulos. Abrir uno navega a su fuente original
        (fuente de verdad).
      </p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Origen</th>
              <th>Folio</th>
              <th>Título</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {aggregated.map((e) => (
              <tr key={e.key}>
                <td>{UNIFIED_SOURCE_LABEL[e.source] ?? e.source}</td>
                <td>{e.folio ?? '—'}</td>
                <td>{e.title}</td>
                <td>{UNIFIED_STATUS_LABEL[e.status] ?? e.status}</td>
                <td>
                  <Link href={e.href}>Abrir →</Link>
                </td>
              </tr>
            ))}
            {aggregated.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Sin registros agregados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function EstadisticaTab({ events, sp }: { events: Ev; sp: Record<string, string | undefined> }) {
  const x = resolveVariable(sp.x ?? 'cost');
  const y = resolveVariable(sp.y ?? 'durationHours');
  const result = x && y ? runBivariate(events, x, y) : null;

  const options = [
    ...NUMERIC_VARIABLES.map((v) => ({ field: v.field, label: `${v.label} (numérica)` })),
    ...CATEGORICAL_VARIABLES.map((v) => ({ field: v.field, label: `${v.label} (categórica)` })),
  ];

  return (
    <SectionCard title="Análisis estadístico interpretable">
      <p className="muted">
        Elige dos variables. Numérica↔numérica: Pearson, Spearman y regresión.
        Categórica↔categórica: contingencia y chi². Categórica↔numérica: ANOVA. Recuerda: la
        correlación no implica causalidad.
      </p>
      <form method="get" className="filter-bar">
        <input type="hidden" name="tab" value="estadistica" />
        <label className="field">
          <span className="field__label">Variable X</span>
          <select name="x" defaultValue={x?.field ?? 'cost'}>
            {options.map((o) => (
              <option key={o.field} value={o.field}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Variable Y</span>
          <select name="y" defaultValue={y?.field ?? 'durationHours'}>
            {options.map((o) => (
              <option key={o.field} value={o.field}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button className="button button--ghost" type="submit">
          Analizar
        </button>
      </form>
      {x && y && result ? (
        <BivariateView x={x} y={y} result={result} />
      ) : (
        <p className="muted">Selecciona dos variables válidas.</p>
      )}
    </SectionCard>
  );
}

function CalidadTab({ events, today }: { events: Ev; today: string }) {
  const report = analyzeDataQuality(events, { asOf: today });
  return (
    <SectionCard title="Calidad de datos">
      <div className="statcard-row">
        <StatCard label="Eventos" value={report.totalEvents} />
        <StatCard
          label="Completitud"
          value={report.completeness === null ? '—' : `${report.completeness}%`}
          tone={report.completeness !== null && report.completeness < 70 ? 'warning' : 'success'}
        />
        <StatCard label="Tipos de problema" value={report.issues.length} />
      </div>
      {report.issues.length === 0 ? (
        <p className="muted">Sin problemas detectados. Buena captura.</p>
      ) : (
        report.issues.map((issue) => (
          <div key={`${issue.type}-${issue.field ?? ''}`} className="issue-block">
            <h3>
              {issue.label} · {issue.count}
            </h3>
            <ul>
              {issue.samples.map((s) => (
                <li key={s.key}>
                  <Link href={s.href}>{s.title}</Link> — <span className="muted">{s.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <p className="muted">Este panel reporta; no corrige datos automáticamente.</p>
    </SectionCard>
  );
}
