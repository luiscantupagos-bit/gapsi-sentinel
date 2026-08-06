'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  canTransitionTask,
  type TaskStatus,
} from '@/features/tasks/task-state';
import type { GlobalTaskItem } from '@/server/tasks';
import { transitionTaskAction, type FormState } from '../../actions';

/** Objetivos "seguros" desde el tablero (no requieren motivo/resultado extra). */
function boardTargets(from: TaskStatus): TaskStatus[] {
  return (['pending', 'in_progress', 'under_review', 'completed'] as TaskStatus[]).filter(
    (to) => to !== from && canTransitionTask(from, to),
  );
}

function MoveControl({ item }: { item: GlobalTaskItem }) {
  const [state, action] = useActionState<FormState | null, FormData>(transitionTaskAction, null);
  const targets = boardTargets(item.status as TaskStatus);
  if (targets.length === 0) return null;
  return (
    <form action={action} className="kanban__move">
      <input type="hidden" name="taskId" value={item.id} />
      <label className="sr-only" htmlFor={`mv-${item.id}`}>
        Mover {item.title}
      </label>
      <select id={`mv-${item.id}`} name="to" defaultValue="" aria-label="Mover a">
        <option value="" disabled>
          Mover a…
        </option>
        {targets.map((to) => (
          <option key={to} value={to}>
            {TASK_STATUS_LABEL[to]}
          </option>
        ))}
      </select>
      <button type="submit" className="button button--ghost button--xs">
        Mover
      </button>
      {state && !state.ok && (
        <span role="status" className="msg msg--error small">
          {state.message}
        </span>
      )}
    </form>
  );
}

export function KanbanBoard({ items }: { items: GlobalTaskItem[] }) {
  const columns = TASK_STATUSES.filter((s) => s !== 'draft').map((status) => ({
    status,
    label: TASK_STATUS_LABEL[status],
    items: items.filter((i) => i.status === status),
  }));

  return (
    <div className="kanban">
      {columns.map((col) => (
        <section className="kanban__col" key={col.status} aria-label={col.label}>
          <header className="kanban__colhead">
            <span className={`badge badge--task-${col.status}`}>{col.label}</span>
            <span className="kanban__count">{col.items.length}</span>
          </header>
          <div className="kanban__cards">
            {col.items.length === 0 ? (
              <p className="kanban__empty">—</p>
            ) : (
              col.items.map((i) => (
                <article key={i.id} className={`kanban__card${i.overdue ? ' is-overdue' : ''}`}>
                  <div className="kanban__cardtop">
                    <Link href={i.detailHref ?? i.originHref} className="kanban__title">
                      {i.title}
                    </Link>
                    {i.kind === 'aggregated' && (
                      <span className="badge badge--soft small">externo</span>
                    )}
                  </div>
                  <div className="kanban__meta">
                    {i.folio && <span className="mono">{i.folio}</span>}
                    {i.priority && (
                      <span className={`badge badge--prio-${i.priority}`}>{i.priority}</span>
                    )}
                    {i.responsibleName && <span className="muted">{i.responsibleName}</span>}
                  </div>
                  <div className="kanban__meta">
                    {i.targetDate && (
                      <span className={i.overdue ? 'due due--overdue' : 'due'}>{i.targetDate}</span>
                    )}
                    {i.progress !== null && <span className="muted small">{i.progress}%</span>}
                  </div>
                  {i.kind === 'native' ? (
                    <MoveControl item={i} />
                  ) : (
                    <Link href={i.originHref} className="muted small">
                      abrir origen ↗
                    </Link>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
