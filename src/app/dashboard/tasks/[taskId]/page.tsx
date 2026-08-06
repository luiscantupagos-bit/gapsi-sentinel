import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  TaskNotFoundError,
  getTaskDetail,
  getUserTaskContext,
  listNativeTasksBrief,
} from '@/server/tasks';
import { listOrgMembers } from '@/server/projects';
import { type TaskStatus } from '@/features/tasks/task-state';
import { PageHeader, SectionCard } from '../../_components/ui';
import { TaskPriorityBadge, TaskStatusBadge, taskTypeLabel } from '../_components/TaskBits';
import { TaskWorkflow } from './_components/TaskWorkflow';

const dt = (d: Date) => new Date(d).toLocaleString('es-MX');

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const session = await requireServerSession();
  const { taskId } = await params;

  let detail;
  try {
    detail = await getTaskDetail(session.organizationId, taskId);
  } catch (error) {
    if (error instanceof TaskNotFoundError) notFound();
    throw error;
  }
  const [ctx, members, nativeTasks] = await Promise.all([
    getUserTaskContext(session.organizationId, session.userId, taskId),
    listOrgMembers(session.organizationId),
    listNativeTasksBrief(session.organizationId, taskId),
  ]);
  const t = detail.task;

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/tasks">← Volver a tareas</Link>
      </p>

      <PageHeader
        title={t.title}
        subtitle={`${t.folio} · ${taskTypeLabel(t.taskType)}`}
        actions={
          !t.readOnly && ctx.canAct ? (
            <Link className="button button--ghost" href={`/dashboard/tasks/${t.id}/edit`}>
              Editar
            </Link>
          ) : undefined
        }
      />

      <dl className="meta-grid">
        <div>
          <dt>Estado</dt>
          <dd>
            <TaskStatusBadge status={t.status} />
          </dd>
        </div>
        <div>
          <dt>Prioridad</dt>
          <dd>
            <TaskPriorityBadge priority={t.priority} />
          </dd>
        </div>
        <div>
          <dt>Responsable</dt>
          <dd>{t.responsibleName ?? '—'}</dd>
        </div>
        <div>
          <dt>Proyecto</dt>
          <dd>
            {detail.project ? (
              <Link href={`/dashboard/projects/${detail.project.id}`}>
                {detail.project.folio} · {detail.project.name}
              </Link>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt>Inicio</dt>
          <dd>{t.startDate ?? '—'}</dd>
        </div>
        <div>
          <dt>Vencimiento</dt>
          <dd>{t.targetDate ?? '—'}</dd>
        </div>
        <div>
          <dt>Avance</dt>
          <dd>{t.progress}%</dd>
        </div>
        <div>
          <dt>Sitio</dt>
          <dd>{t.siteName ?? '—'}</dd>
        </div>
      </dl>

      {t.description && <p className="lead">{t.description}</p>}
      {t.blockedReason && (
        <p className="msg msg--error" role="status">
          Bloqueada: {t.blockedReason}
        </p>
      )}
      {t.result && <p className="msg msg--ok">Resultado: {t.result}</p>}

      <div className="two-col">
        <div>
          <SectionCard title="Siguiente acción">
            <TaskWorkflow
              taskId={t.id}
              status={t.status as TaskStatus}
              canAct={ctx.canAct}
              isAdmin={ctx.isAdmin}
              members={members}
              nativeTasks={nativeTasks.map((n) => ({ id: n.id, folio: n.folio, title: n.title }))}
            />
          </SectionCard>

          <SectionCard title="Dependencias">
            {detail.dependencies.length === 0 ? (
              <p className="empty-state">Sin dependencias.</p>
            ) : (
              <ul className="dep-list">
                {detail.dependencies.map((d) => (
                  <li key={d.id}>
                    <span className={`badge ${d.satisfied ? 'badge--sev-low' : 'badge--soft'}`}>
                      {d.satisfied ? 'Cumplida' : 'Pendiente'}
                    </span>{' '}
                    <Link href={`/dashboard/tasks/${d.fromTaskId}`}>
                      {d.folio ?? 'tarea'} · {d.title}
                    </Link>
                    {d.mandatory ? ' · obligatoria' : ' · informativa'}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div>
          <SectionCard title="Origen y trazabilidad">
            {detail.relations.length === 0 && !t.sourceType ? (
              <p className="empty-state">Tarea nativa sin origen externo.</p>
            ) : (
              <ul className="rel-list">
                {t.sourceType && (
                  <li>
                    <span className="badge badge--soft">{taskTypeLabel(t.taskType)}</span> origen:{' '}
                    {t.sourceType}
                  </li>
                )}
                {detail.relations.map((r) => (
                  <li key={r.id}>
                    <span className="badge badge--soft">{r.relationType}</span>{' '}
                    {r.href ? (
                      <Link href={r.href}>Abrir origen ↗</Link>
                    ) : (
                      <span className="muted">{r.externalRef ?? r.note ?? '—'}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Evidencia">
            {detail.files.length === 0 ? (
              <p className="empty-state">Sin evidencia.</p>
            ) : (
              <ul className="file-list">
                {detail.files.map((f) => (
                  <li key={f.id}>
                    <span className="badge">{f.kind === 'evidence' ? 'Evidencia' : 'Anexo'}</span>{' '}
                    {f.originalName}{' '}
                    <span className="muted">({Math.round(f.sizeBytes / 1024)} KB)</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Comentarios">
        {detail.comments.length === 0 ? (
          <p className="empty-state">Sin comentarios.</p>
        ) : (
          <ul className="history">
            {detail.comments.map((c) => (
              <li key={c.id}>
                <span className="muted">{dt(c.createdAt)}</span> · {c.author ?? '—'}: {c.body}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Historial">
        {detail.history.length === 0 ? (
          <p className="empty-state">Sin eventos.</p>
        ) : (
          <ul className="history history--compact">
            {detail.history.map((h) => (
              <li key={h.id}>
                <span className="muted">{dt(h.createdAt)}</span> · {h.event}
                {h.toStatus ? ` → ${h.toStatus}` : ''}
                {h.detail ? ` · ${h.detail}` : ''} · {h.actorName ?? 'sistema'}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </main>
  );
}
