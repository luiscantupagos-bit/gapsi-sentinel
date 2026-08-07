import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { listQualityEvents, EVENT_TYPE_LABEL } from '@/server/quality-events';
import { PageHeader, StatCard } from '../_components/ui';

const SEVERITY_LABEL: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};
const STATUS_LABEL: Record<string, string> = {
  open: 'Abierto',
  in_progress: 'En progreso',
  closed: 'Cerrado',
  cancelled: 'Cancelado',
};

export default async function QualityEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await requireServerSession();
  const sp = await searchParams;
  const events = await listQualityEvents(session.organizationId, {
    search: sp.q?.trim() || undefined,
    status: sp.status || undefined,
  });

  const open = events.filter((e) => e.status === 'open').length;
  const inProgress = events.filter((e) => e.status === 'in_progress').length;

  return (
    <main className="container">
      <PageHeader
        title="Eventos de calidad"
        subtitle="Registro nativo de eventos manuales. Los datos de otros módulos se agregan en vivo en Analítica."
        actions={
          <Link className="button button--primary" href="/dashboard/quality-events/new">
            Registrar evento
          </Link>
        }
      />

      <div className="statcard-row">
        <StatCard label="Total" value={events.length} />
        <StatCard label="Abiertos" value={open} tone={open > 0 ? 'warning' : 'default'} />
        <StatCard label="En progreso" value={inProgress} />
        <StatCard label="Analítica" value="Ver KPI y Pareto" href="/dashboard/analytics" />
      </div>

      {events.length === 0 ? (
        <p className="muted">
          Aún no hay eventos nativos. Registra el primero para empezar a analizarlo.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Título</th>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Severidad</th>
                <th>Estado</th>
                <th>Área / Proceso</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{e.folio}</td>
                  <td>{e.title}</td>
                  <td>{EVENT_TYPE_LABEL[e.eventType] ?? e.eventType}</td>
                  <td>{e.eventDate.toISOString().slice(0, 10)}</td>
                  <td>{SEVERITY_LABEL[e.severity] ?? e.severity}</td>
                  <td>{STATUS_LABEL[e.status] ?? e.status}</td>
                  <td>{[e.area, e.process].filter(Boolean).join(' / ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
