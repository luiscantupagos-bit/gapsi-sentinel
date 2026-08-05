import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getTasksInbox } from '@/server/document-workflow';

interface Task {
  versionId: string;
  documentId: string;
  code: string;
  title: string;
  label: string;
  dueAt: string | null;
}

function TaskList({ items, href }: { items: Task[]; href: (t: Task) => string }) {
  if (items.length === 0) return <p className="empty-state">Nada pendiente.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Documento</th>
            <th>Versión</th>
            <th>Límite</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={`${t.documentId}-${t.versionId}`}>
              <td>{t.code}</td>
              <td>{t.title}</td>
              <td>{t.label}</td>
              <td>{t.dueAt ?? '—'}</td>
              <td>
                <Link className="button button--ghost" href={href(t)}>
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

export default async function DocumentTasksPage() {
  const session = await requireServerSession();
  const inbox = await getTasksInbox(session.organizationId, session.userId);

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/documents">← Volver al listado</Link>
      </p>
      <h1>Bandeja de tareas y Mis documentos</h1>

      <h2>Revisiones pendientes ({inbox.reviews.length})</h2>
      <TaskList items={inbox.reviews} href={(t) => `/dashboard/documents/${t.documentId}`} />

      <h2>Aprobaciones pendientes ({inbox.approvals.length})</h2>
      <TaskList items={inbox.approvals} href={(t) => `/dashboard/documents/${t.documentId}`} />

      <h2>Con cambios solicitados ({inbox.changesRequested.length})</h2>
      <TaskList
        items={inbox.changesRequested}
        href={(t) => `/dashboard/documents/${t.documentId}/editor`}
      />

      <h2>Lecturas pendientes ({inbox.pendingReads.length})</h2>
      <p className="muted">Abre la vista previa y confirma la lectura.</p>
      <TaskList
        items={inbox.pendingReads}
        href={(t) => `/dashboard/documents/${t.documentId}/preview?version=${t.versionId}`}
      />
    </main>
  );
}
