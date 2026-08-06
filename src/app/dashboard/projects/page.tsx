import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getProjectSummary, listProjects } from '@/server/projects';
import { PageHeader, StatCard } from '../_components/ui';
import { ProjectTable } from './_components/ProjectBits';

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await requireServerSession();
  const sp = await searchParams;
  const [summary, rows] = await Promise.all([
    getProjectSummary(session.organizationId),
    listProjects(session.organizationId, {
      search: sp.q?.trim() || undefined,
      status: sp.status || undefined,
    }),
  ]);

  return (
    <main className="container">
      <PageHeader
        title="Proyectos"
        subtitle="Iniciativas transversales: mejora continua, cumplimiento, implementación y más."
        actions={
          <Link className="button button--primary" href="/dashboard/projects/new">
            Nuevo proyecto
          </Link>
        }
      />

      <div className="statcard-row">
        <StatCard label="Total" value={summary.total} href="/dashboard/projects" />
        <StatCard
          label="Activos"
          value={summary.active}
          tone="success"
          href="/dashboard/projects?status=active"
        />
        <StatCard
          label="En riesgo"
          value={summary.atRisk}
          tone={summary.atRisk > 0 ? 'danger' : 'default'}
          href="/dashboard/projects?status=active"
        />
        <StatCard
          label="Planeados"
          value={summary.planned}
          href="/dashboard/projects?status=planned"
        />
        <StatCard
          label="Completados"
          value={summary.completed}
          href="/dashboard/projects?status=completed"
        />
      </div>

      <div className="list-toolbar">
        <form method="get" className="searchbar">
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="Buscar por código o nombre…"
            aria-label="Buscar proyectos"
          />
          <button type="submit" className="button button--ghost">
            Buscar
          </button>
        </form>
      </div>

      <ProjectTable rows={rows} />
    </main>
  );
}
