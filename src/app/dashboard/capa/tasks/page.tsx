import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getCapaTasks } from '@/server/capa';

interface Row {
  id: string;
  folio: string;
  title: string;
  targetDate: string | null;
}
interface ActionRow {
  id: string;
  capaId: string;
  description: string;
  dueDate: string | null;
}

function CapaTable({ items }: { items: Row[] }) {
  if (items.length === 0) return <p className="empty-state">Nada pendiente.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Folio</th>
            <th>Título</th>
            <th>Fecha objetivo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td>{t.folio}</td>
              <td>{t.title}</td>
              <td>{t.targetDate ?? '—'}</td>
              <td>
                <Link className="button button--ghost" href={`/dashboard/capa/${t.id}`}>
                  Abrir
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionTable({ items }: { items: ActionRow[] }) {
  if (items.length === 0) return <p className="empty-state">Nada pendiente.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Acción</th>
            <th>Fecha compromiso</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td>{t.description}</td>
              <td>{t.dueDate ?? '—'}</td>
              <td>
                <Link className="button button--ghost" href={`/dashboard/capa/${t.capaId}`}>
                  Abrir
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function CapaTasksPage() {
  const session = await requireServerSession();
  const inbox = await getCapaTasks(session.organizationId, session.userId);

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/capa">← Volver al listado</Link>
      </p>
      <h1>Bandeja de tareas CAPA</h1>

      <h2>CAPA asignadas ({inbox.assigned.length})</h2>
      <CapaTable items={inbox.assigned} />

      <h2>Contenciones pendientes ({inbox.pendingContainment.length})</h2>
      <CapaTable items={inbox.pendingContainment} />

      <h2>Investigaciones pendientes ({inbox.pendingInvestigation.length})</h2>
      <CapaTable items={inbox.pendingInvestigation} />

      <h2>Acciones vencidas ({inbox.overdueActions.length})</h2>
      <ActionTable items={inbox.overdueActions} />

      <h2>Acciones próximas ({inbox.upcomingActions.length})</h2>
      <ActionTable items={inbox.upcomingActions} />

      <h2>Verificaciones de eficacia ({inbox.verifications.length})</h2>
      <CapaTable items={inbox.verifications} />

      <h2>Cierres pendientes ({inbox.closures.length})</h2>
      <CapaTable items={inbox.closures} />
    </main>
  );
}
