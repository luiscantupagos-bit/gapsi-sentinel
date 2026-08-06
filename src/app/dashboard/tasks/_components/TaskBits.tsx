/**
 * Presentación compartida de tareas (server-safe): badges de estado/prioridad,
 * etiquetas de tipo/origen y la tabla del gestor global con filas clickeables.
 */
import Link from 'next/link';
import {
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_TYPE_LABEL,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
} from '@/features/tasks/task-state';
import type { GlobalTaskItem } from '@/server/tasks';

export function TaskStatusBadge({ status }: { status: string }) {
  const label = TASK_STATUS_LABEL[status as TaskStatus] ?? status;
  return <span className={`badge badge--task-${status}`}>{label}</span>;
}

export function TaskPriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return <span className="muted">—</span>;
  const label = TASK_PRIORITY_LABEL[priority as TaskPriority] ?? priority;
  return <span className={`badge badge--prio-${priority}`}>{label}</span>;
}

export function taskTypeLabel(t: string): string {
  return TASK_TYPE_LABEL[t as TaskType] ?? t;
}

function Progress({ value }: { value: number | null }) {
  if (value === null) return <span className="muted">—</span>;
  return (
    <span className="progress" title={`${value}%`}>
      <span className="progress__track">
        <span
          className="progress__fill"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </span>
      <span className="progress__num">{value}%</span>
    </span>
  );
}

/** Tabla del gestor global. Cada fila abre su detalle (nativa) u origen (agregada). */
export function GlobalTaskTable({ items }: { items: GlobalTaskItem[] }) {
  if (items.length === 0) {
    return <p className="empty-state">No hay tareas para este filtro.</p>;
  }
  return (
    <div className="table-wrap">
      <table className="tbl-linkable">
        <thead>
          <tr>
            <th>Código</th>
            <th>Tarea</th>
            <th>Origen</th>
            <th>Proyecto</th>
            <th>Responsable</th>
            <th>Prioridad</th>
            <th>Vencimiento</th>
            <th>Estado</th>
            <th>Avance</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className={i.overdue ? 'is-overdue' : undefined}>
              <td className="mono">
                {i.folio ? (
                  <Link href={i.detailHref ?? i.originHref}>{i.folio}</Link>
                ) : i.sourceFolio ? (
                  <Link href={i.originHref}>{i.sourceFolio}</Link>
                ) : (
                  <Link href={i.originHref} className="muted">
                    ver
                  </Link>
                )}
              </td>
              <td>
                <Link href={i.detailHref ?? i.originHref} className="tbl-title">
                  {i.title}
                </Link>
              </td>
              <td>
                <span className="badge badge--soft">{taskTypeLabel(i.taskType)}</span>
                {i.kind === 'aggregated' && (
                  <>
                    {' '}
                    <Link href={i.originHref} className="muted small">
                      abrir origen ↗
                    </Link>
                  </>
                )}
              </td>
              <td>
                {i.projectId && i.projectName ? (
                  <Link href={`/dashboard/projects/${i.projectId}`}>{i.projectName}</Link>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td>{i.responsibleName ?? <span className="muted">—</span>}</td>
              <td>
                <TaskPriorityBadge priority={i.priority} />
              </td>
              <td className={i.overdue ? 'due due--overdue' : 'due'}>
                {i.targetDate ?? <span className="muted">—</span>}
              </td>
              <td>
                <TaskStatusBadge status={i.status} />
              </td>
              <td>
                <Progress value={i.progress} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
