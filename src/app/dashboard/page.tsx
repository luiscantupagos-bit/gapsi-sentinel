import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getDashboardData } from '@/server/diagnostics';
import { getDocSummary } from '@/server/documents';
import { getWorkflowAlerts } from '@/server/document-workflow';
import { getCapaAlerts, getCapaDashboard } from '@/server/capa';
import {
  CAPA_PRIORITY_LABEL,
  CAPA_STATUS_LABEL,
  type CapaPriority,
  type CapaStatus,
} from '@/features/capa/capa-state';
import { BarChart, DonutChart, type Segment } from './_components/Charts';
import { PageHeader, SectionCard, StatCard } from './_components/ui';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  in_progress: 'En captura',
  submitted: 'Enviado',
  reviewed: 'Revisado',
  archived: 'Archivado',
};

const STATUS_COLOR: Record<string, string> = {
  draft: '#94a3b8',
  reported: '#3b82f6',
  containment: '#0ea5e9',
  under_investigation: '#d97706',
  action_plan: '#f59e0b',
  in_implementation: '#8b5cf6',
  effectiveness_review: '#7c3aed',
  closed: '#16a34a',
  cancelled: '#64748b',
};
const PRIORITY_COLOR: Record<string, string> = {
  low: '#94a3b8',
  normal: '#3b82f6',
  high: '#d97706',
  urgent: '#dc2626',
};

export default async function DashboardPage() {
  const session = await requireServerSession();
  const [data, docSummary, alerts, capa, capaBoard] = await Promise.all([
    getDashboardData(session.organizationId),
    getDocSummary(session.organizationId),
    getWorkflowAlerts(session.organizationId, session.userId),
    getCapaAlerts(session.organizationId),
    getCapaDashboard(session.organizationId),
  ]);

  if (!data) {
    return (
      <main className="container">
        <PageHeader title="Panel" subtitle="Resumen general del sistema" />
        <div className="empty-state" role="status">
          <p>No se encontró la organización activa de desarrollo.</p>
          <p className="muted">Ejecuta `npm run db:seed` para cargar datos de ejemplo.</p>
        </div>
      </main>
    );
  }

  const statusSegments: Segment[] = capaBoard.byStatus.map((s) => ({
    label: CAPA_STATUS_LABEL[s.key as CapaStatus] ?? s.key,
    value: s.count,
    color: STATUS_COLOR[s.key] ?? '#94a3b8',
  }));
  const prioritySegments: Segment[] = capaBoard.byPriority.map((p) => ({
    label: CAPA_PRIORITY_LABEL[p.key as CapaPriority] ?? p.key,
    value: p.count,
    color: PRIORITY_COLOR[p.key] ?? '#94a3b8',
  }));

  return (
    <main className="container">
      <PageHeader title="Panel" subtitle={`Resumen general · ${data.organization.name}`} />

      <div className="statcard-row">
        <StatCard label="CAPA abiertas" value={capa.open} />
        <StatCard label="Críticas" value={capa.critical} tone="danger" />
        <StatCard label="Vencidas" value={capa.overdue} tone="warning" />
        <StatCard label="Acciones pendientes" value={capa.pendingActions} />
        <StatCard label="Verificaciones" value={capa.pendingVerifications} />
        <StatCard label="Cerradas" value={capa.recentlyClosed} tone="success" />
      </div>

      <div className="dash-grid dash-grid--2">
        <SectionCard title="CAPA por estado">
          {statusSegments.length === 0 ? (
            <p className="empty-state">Sin CAPA registradas.</p>
          ) : (
            <DonutChart segments={statusSegments} title="CAPA por estado" />
          )}
        </SectionCard>
        <SectionCard title="Abiertas por prioridad">
          {prioritySegments.length === 0 ? (
            <p className="empty-state">Sin CAPA abiertas.</p>
          ) : (
            <BarChart bars={prioritySegments} title="Abiertas por prioridad" />
          )}
        </SectionCard>
      </div>

      <div className="dash-grid dash-grid--2">
        <SectionCard
          title="Actividad reciente"
          action={
            <Link className="button button--ghost" href="/dashboard/capa">
              Ver todo
            </Link>
          }
        >
          {capaBoard.recent.length === 0 ? (
            <p className="empty-state">Sin actividad.</p>
          ) : (
            <ul className="activity">
              {capaBoard.recent.map((r) => (
                <li key={r.id}>
                  <span className="activity__dot" aria-hidden />
                  <span>
                    <strong>{r.folio}</strong> · {r.event}
                    {r.detail ? ` — ${r.detail}` : ''}
                  </span>
                  <span className="activity__at">{r.at}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard
          title="Próximas tareas"
          action={
            <Link className="button button--ghost" href="/dashboard/capa/tasks">
              Bandeja
            </Link>
          }
        >
          {capaBoard.upcoming.length === 0 ? (
            <p className="empty-state">Sin acciones próximas.</p>
          ) : (
            <ul className="activity">
              {capaBoard.upcoming.map((u) => (
                <li key={u.id}>
                  <span className="activity__dot activity__dot--warn" aria-hidden />
                  <span>
                    <Link href={`/dashboard/capa/${u.capaId}`}>
                      <strong>{u.folio}</strong>
                    </Link>{' '}
                    · {u.description}
                  </span>
                  <span className="activity__at">{u.dueDate ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Documentos"
        action={
          <Link className="button button--ghost" href="/dashboard/documents">
            Ir al listado
          </Link>
        }
      >
        <div className="statcard-row">
          <StatCard label="Total" value={docSummary.total} />
          <StatCard label="Vigentes" value={docSummary.effective} tone="success" />
          <StatCard label="Próximos a revisión" value={docSummary.dueSoon} tone="warning" />
          <StatCard label="Obsoletos" value={docSummary.obsolete} />
          <StatCard label="Revisiones pend." value={alerts.pendingReviews} />
          <StatCard label="Lecturas pend." value={alerts.pendingReads} />
        </div>
      </SectionCard>

      <SectionCard title="Diagnósticos recientes">
        {data.diagnostics.length === 0 ? (
          <div className="empty-state" role="status">
            <p>Aún no hay diagnósticos.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Diagnóstico</th>
                  <th>Sitio</th>
                  <th>Estado</th>
                  <th>Avance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.diagnostics.map((d) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td>{d.siteName}</td>
                    <td>
                      <span className={`badge badge--status-${d.status}`}>
                        {STATUS_LABEL[d.status] ?? d.status}
                      </span>
                    </td>
                    <td>{d.progress.percentage}%</td>
                    <td>
                      <Link
                        className="button button--ghost"
                        href={`/dashboard/diagnostics/${d.id}`}
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
      </SectionCard>
    </main>
  );
}
