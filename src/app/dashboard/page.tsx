import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getDashboardData } from '@/server/diagnostics';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  in_progress: 'En captura',
  submitted: 'Enviado',
  reviewed: 'Revisado',
  archived: 'Archivado',
};

export default async function DashboardPage() {
  const session = await requireServerSession();
  const data = await getDashboardData(session.organizationId);

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
