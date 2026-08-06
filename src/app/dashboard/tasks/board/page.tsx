import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { listGlobalTasks } from '@/server/tasks';
import { PageHeader } from '../../_components/ui';
import { KanbanBoard } from './_components/KanbanBoard';

export default async function TaskBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; scope?: string }>;
}) {
  const session = await requireServerSession();
  const sp = await searchParams;
  const items = await listGlobalTasks(session.organizationId, session.userId, {
    projectId: sp.projectId,
    scope: sp.scope === 'mine' ? 'mine' : undefined,
  });

  return (
    <main className="container">
      <PageHeader
        title="Tablero de tareas"
        subtitle="Kanban por estado. Mueve las tareas con el selector (validado en servidor)."
        actions={
          <Link className="button button--ghost" href="/dashboard/tasks">
            Ver lista
          </Link>
        }
      />
      <KanbanBoard items={items} />
    </main>
  );
}
