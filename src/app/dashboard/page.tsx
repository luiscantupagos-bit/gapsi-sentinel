import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getDashboardData } from '@/server/diagnostics';
import { getDocSummary } from '@/server/documents';
import { getWorkflowAlerts } from '@/server/document-workflow';
import { getCapaAlerts } from '@/server/capa';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  in_progress: 'En captura',
  submitted: 'Enviado',
  reviewed: 'Revisado',
  archived: 'Archivado',
};

export default async function DashboardPage() {
  const session = await requireServerSession();
  const [data, docSummary, alerts, capa] = await Promise.all([
    getDashboardData(session.organizationId),
    getDocSummary(session.organizationId),
    getWorkflowAlerts(session.organizationId, session.userId),
    getCapaAlerts(session.organizationId),
  ]);

  if (!data) {
    return (
      <main className="container">
        <h1>Panel</h1>
        <div className="empty-state" role="status">
          <p>No se encontró la organización activa de desarrollo.</p>
          <p className="muted">Ejecuta `npm run db:seed` para cargar datos de ejemplo.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>Panel</h1>
      <p className="lead">
        Organización activa: <strong>{data.organization.name}</strong>
      </p>

      <dl className="meta-grid">
        <div>
          <dt>Sitios / plantas</dt>
          <dd>{data.sites.map((s) => s.name).join(', ') || '—'}</dd>
        </div>
        <div>
          <dt>Diagnósticos</dt>
          <dd>{data.diagnosticsCount}</dd>
        </div>
      </dl>

      <h2>Documentos</h2>
      <div className="stat-row">
        <div className="stat stat--sm">
          <span className="stat__label">Total</span>
          <span className="stat__value">{docSummary.total}</span>
        </div>
        <div className="stat stat--sm">
          <span className="stat__label">Vigentes</span>
          <span className="stat__value">{docSummary.effective}</span>
        </div>
        <div className="stat stat--sm">
          <span className="stat__label">Próximos a revisión</span>
          <span className="stat__value">{docSummary.dueSoon}</span>
        </div>
        <div className="stat stat--sm">
          <span className="stat__label">Obsoletos</span>
          <span className="stat__value">{docSummary.obsolete}</span>
        </div>
      </div>
      <p>
        <Link className="button button--ghost" href="/dashboard/documents">
          Ir al listado maestro
        </Link>
      </p>

      <h2>Alertas de control documental</h2>
      <div className="stat-row">
        <div className="stat stat--sm">
          <span className="stat__label">Revisiones pendientes</span>
          <span className="stat__value">{alerts.pendingReviews}</span>
        </div>
        <div className="stat stat--sm">
          <span className="stat__label">Aprobaciones pendientes</span>
          <span className="stat__value">{alerts.pendingApprovals}</span>
        </div>
        <div className="stat stat--sm">
          <span className="stat__label">Lecturas pendientes</span>
          <span className="stat__value">{alerts.pendingReads}</span>
        </div>
        <div className="stat stat--sm">
          <span className="stat__label">Próx. revisión</span>
          <span className="stat__value">{alerts.reviewDueSoon}</span>
        </div>
        <div className="stat stat--sm">
          <span className="stat__label">Revisión vencida</span>
          <span className="stat__value">{alerts.reviewOverdue}</span>
        </div>
      </div>
      <p>
        <Link className="button button--ghost" href="/dashboard/documents/tasks">
          Ver bandeja de tareas
        </Link>
      </p>

      <h2>Acciones correctivas (CAPA)</h2>
      <div className="stat-row">
        <div className="stat stat--sm">
          <span className="stat__label">Abiertas</span>
          <span className="stat__value">{capa.open}</span>
        </div>
        <div className="stat stat--sm">
          <span className="stat__label">Críticas</span>
          <span className="stat__value">{capa.critical}</span>
        </div>
        <div className="stat stat--sm">
          <span className="stat__label">Vencidas</span>
          <span className="stat__value">{capa.overdue}</span>
        </div>
        <div className="stat stat--sm">
          <span className="stat__label">Acciones pendientes</span>
          <span className="stat__value">{capa.pendingActions}</span>
        </div>
        <div className="stat stat--sm">
          <span className="stat__label">Verificaciones pendientes</span>
          <span className="stat__value">{capa.pendingVerifications}</span>
        </div>
        <div className="stat stat--sm">
          <span className="stat__label">Cerradas</span>
          <span className="stat__value">{capa.recentlyClosed}</span>
        </div>
      </div>
      <p>
        <Link className="button button--ghost" href="/dashboard/capa">
          Ir a acciones correctivas
        </Link>
      </p>

      <h2>Diagnósticos recientes</h2>
      {data.diagnostics.length === 0 ? (
        <div className="empty-state" role="status">
          <p>Aún no hay diagnósticos.</p>
          <p className="muted">
            La creación de diagnósticos llegará en una tarea posterior; usa el ejemplo del seed.
          </p>
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
                    <Link className="button button--ghost" href={`/dashboard/diagnostics/${d.id}`}>
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
