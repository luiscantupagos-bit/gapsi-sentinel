/**
 * Presentación compartida de proyectos (server-safe): badges y tabla clickeable.
 */
import Link from 'next/link';
import {
  MILESTONE_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
  PROJECT_TYPE_LABEL,
  type MilestoneStatus,
  type ProjectStatus,
  type ProjectType,
} from '@/features/projects/project-state';

export function ProjectStatusBadge({ status }: { status: string }) {
  const label = PROJECT_STATUS_LABEL[status as ProjectStatus] ?? status;
  return <span className={`badge badge--proj-${status}`}>{label}</span>;
}

export function MilestoneStatusBadge({ status }: { status: string }) {
  const label = MILESTONE_STATUS_LABEL[status as MilestoneStatus] ?? status;
  return <span className={`badge badge--ms-${status}`}>{label}</span>;
}

export function projectTypeLabel(t: string): string {
  return PROJECT_TYPE_LABEL[t as ProjectType] ?? t;
}

type Row = {
  id: string;
  folio: string;
  name: string;
  projectType: string;
  status: string;
  responsibleName: string | null;
  targetDate: string | null;
  progress: number;
  openTasks: number;
  totalTasks: number;
  overdue: boolean;
};

export function ProjectTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <p className="empty-state">No hay proyectos.</p>;
  return (
    <div className="table-wrap">
      <table className="tbl-linkable">
        <thead>
          <tr>
            <th>Código</th>
            <th>Proyecto</th>
            <th>Tipo</th>
            <th>Responsable</th>
            <th>Tareas</th>
            <th>Objetivo</th>
            <th>Estado</th>
            <th>Avance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className={p.overdue ? 'is-overdue' : undefined}>
              <td className="mono">
                <Link href={`/dashboard/projects/${p.id}`}>{p.folio}</Link>
              </td>
              <td>
                <Link href={`/dashboard/projects/${p.id}`} className="tbl-title">
                  {p.name}
                </Link>
              </td>
              <td>
                <span className="badge badge--soft">{projectTypeLabel(p.projectType)}</span>
              </td>
              <td>{p.responsibleName ?? <span className="muted">—</span>}</td>
              <td>
                {p.totalTasks === 0 ? (
                  <span className="muted">—</span>
                ) : (
                  <span>
                    {p.totalTasks - p.openTasks}/{p.totalTasks}
                  </span>
                )}
              </td>
              <td className={p.overdue ? 'due due--overdue' : 'due'}>
                {p.targetDate ?? <span className="muted">—</span>}
              </td>
              <td>
                <ProjectStatusBadge status={p.status} />
              </td>
              <td>
                <span className="tprogress">
                  <span className="tprogress__track">
                    <span className="tprogress__fill" style={{ width: `${p.progress}%` }} />
                  </span>
                  <span className="tprogress__num">{p.progress}%</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
