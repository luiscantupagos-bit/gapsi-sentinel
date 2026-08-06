import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getTaskSummary, listGlobalTasks, type TaskFilters } from '@/server/tasks';
import { PageHeader, StatCard } from '../_components/ui';
import { GlobalTaskTable } from './_components/TaskBits';

const TABS: { key: string; label: string; filters: (userId: string) => TaskFilters }[] = [
  { key: 'mine', label: 'Mis tareas', filters: () => ({ scope: 'mine' }) },
  { key: 'all', label: 'Todas', filters: () => ({}) },
  { key: 'pending', label: 'Pendientes', filters: () => ({ quick: 'pending' }) },
  { key: 'in_progress', label: 'En progreso', filters: () => ({ quick: 'in_progress' }) },
  { key: 'due_soon', label: 'Próximas a vencer', filters: () => ({ quick: 'due_soon' }) },
  { key: 'overdue', label: 'Vencidas', filters: () => ({ quick: 'overdue' }) },
  { key: 'blocked', label: 'Bloqueadas', filters: () => ({ quick: 'blocked' }) },
  { key: 'completed', label: 'Completadas', filters: () => ({ quick: 'completed' }) },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const session = await requireServerSession();
  const sp = await searchParams;
  const tabKey = TABS.some((t) => t.key === sp.tab) ? sp.tab! : 'mine';
  const tab = TABS.find((t) => t.key === tabKey)!;
  const search = sp.q?.trim() || undefined;

  const [summary, items] = await Promise.all([
    getTaskSummary(session.organizationId, session.userId),
    listGlobalTasks(session.organizationId, session.userId, {
      ...tab.filters(session.userId),
      search,
    }),
  ]);

  const qs = (key: string) => `?tab=${key}${search ? `&q=${encodeURIComponent(search)}` : ''}`;

  return (
    <main className="container">
      <PageHeader
        title="Tareas"
        subtitle="Gestor global: tus tareas nativas y las de CAPA, documentos y análisis en un solo lugar."
        actions={
          <Link className="button button--primary" href="/dashboard/tasks/new">
            Nueva tarea
          </Link>
        }
      />

      <div className="statcard-row">
        <StatCard label="Abiertas" value={summary.open} href="/dashboard/tasks?tab=all" />
        <StatCard
          label="Vencidas"
          value={summary.overdue}
          tone="danger"
          href="/dashboard/tasks?tab=overdue"
        />
        <StatCard
          label="Próximas a vencer"
          value={summary.dueSoon}
          tone="warning"
          href="/dashboard/tasks?tab=due_soon"
        />
        <StatCard label="Mis tareas" value={summary.mine} href="/dashboard/tasks?tab=mine" />
        <StatCard
          label="Bloqueadas"
          value={summary.blocked}
          tone={summary.blocked > 0 ? 'warning' : 'default'}
          href="/dashboard/tasks?tab=blocked"
        />
      </div>

      <nav className="tabs" aria-label="Filtros rápidos de tareas">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/tasks${qs(t.key)}`}
            className={`tab${t.key === tabKey ? ' is-active' : ''}`}
            aria-current={t.key === tabKey ? 'page' : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="toolbar">
        <form method="get" className="searchbar">
          <input type="hidden" name="tab" value={tabKey} />
          <input
            type="search"
            name="q"
            defaultValue={search ?? ''}
            placeholder="Buscar por código o título…"
            aria-label="Buscar tareas"
          />
          <button type="submit" className="button button--ghost">
            Buscar
          </button>
        </form>
        <div className="toolbar__links">
          <Link className="button button--ghost" href="/dashboard/tasks/board">
            Tablero
          </Link>
          <Link className="button button--ghost" href="/dashboard/tasks/calendar">
            Calendario
          </Link>
          <Link className="button button--ghost" href="/dashboard/tasks/workload">
            Carga de trabajo
          </Link>
        </div>
      </div>

      <GlobalTaskTable items={items} />
    </main>
  );
}
