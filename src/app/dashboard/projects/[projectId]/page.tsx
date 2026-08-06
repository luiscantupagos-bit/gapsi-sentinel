import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  ProjectNotFoundError,
  getProjectDetail,
  getUserProjectContext,
  listOrgMembers,
} from '@/server/projects';
import { type ProjectStatus } from '@/features/projects/project-state';
import { PageHeader, SectionCard } from '../../_components/ui';
import {
  MilestoneStatusBadge,
  ProjectStatusBadge,
  projectTypeLabel,
} from '../_components/ProjectBits';
import { TaskStatusBadge } from '../../tasks/_components/TaskBits';
import { ProjectWorkflow } from './_components/ProjectWorkflow';

const dt = (d: Date) => new Date(d).toLocaleString('es-MX');

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await requireServerSession();
  const { projectId } = await params;

  let detail;
  try {
    detail = await getProjectDetail(session.organizationId, projectId);
  } catch (error) {
    if (error instanceof ProjectNotFoundError) notFound();
    throw error;
  }
  const [ctx, members] = await Promise.all([
    getUserProjectContext(session.organizationId, session.userId, projectId),
    listOrgMembers(session.organizationId),
  ]);
  const p = detail.project;

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/projects">← Volver a proyectos</Link>
      </p>

      <PageHeader
        title={p.name}
        subtitle={`${p.folio} · ${projectTypeLabel(p.projectType)}`}
        actions={
          <div className="page-head__actions">
            <Link className="button button--ghost" href={`/dashboard/projects/${p.id}/gantt`}>
              Gantt
            </Link>
            <Link
              className="button button--ghost"
              href={`/dashboard/tasks/board?projectId=${p.id}`}
            >
              Tablero
            </Link>
            {!p.readOnly && ctx.canManage && (
              <Link className="button button--ghost" href={`/dashboard/projects/${p.id}/edit`}>
                Editar
              </Link>
            )}
            {ctx.canManage && (
              <Link
                className="button button--primary"
                href={`/dashboard/tasks/new?projectId=${p.id}`}
              >
                Nueva tarea
              </Link>
            )}
          </div>
        }
      />

      <dl className="meta-grid">
        <div>
          <dt>Estado</dt>
          <dd>
            <ProjectStatusBadge status={p.status} />
          </dd>
        </div>
        <div>
          <dt>Responsable</dt>
          <dd>{p.responsibleName ?? '—'}</dd>
        </div>
        <div>
          <dt>Patrocinador</dt>
          <dd>{p.sponsorName ?? '—'}</dd>
        </div>
        <div>
          <dt>Inicio</dt>
          <dd>{p.startDate ?? '—'}</dd>
        </div>
        <div>
          <dt>Objetivo</dt>
          <dd>{p.targetDate ?? '—'}</dd>
        </div>
        <div>
          <dt>Avance</dt>
          <dd>{p.progress}%</dd>
        </div>
        <div>
          <dt>Sitio</dt>
          <dd>{p.siteName ?? '—'}</dd>
        </div>
      </dl>

      {p.description && <p className="lead">{p.description}</p>}
      {p.objective && (
        <p>
          <strong>Objetivo:</strong> {p.objective}
        </p>
      )}

      <div className="two-col">
        <div>
          <SectionCard title="Estado del proyecto">
            <ProjectWorkflow
              projectId={p.id}
              status={p.status as ProjectStatus}
              canManage={ctx.canManage}
              isAdmin={ctx.isAdmin}
              members={members}
              milestones={detail.milestones.map((m) => ({
                id: m.id,
                name: m.name,
                status: m.status,
              }))}
            />
          </SectionCard>

          <SectionCard
            title="Tareas del proyecto"
            action={
              ctx.canManage ? (
                <Link
                  className="button button--ghost"
                  href={`/dashboard/tasks/new?projectId=${p.id}`}
                >
                  Agregar
                </Link>
              ) : undefined
            }
          >
            {detail.tasks.length === 0 ? (
              <p className="empty-state">Sin tareas.</p>
            ) : (
              <ul className="dep-list">
                {detail.tasks.map((t) => (
                  <li key={t.id}>
                    <TaskStatusBadge status={t.status} />{' '}
                    <Link href={`/dashboard/tasks/${t.id}`}>
                      {t.folio} · {t.title}
                    </Link>{' '}
                    <span className="muted small">
                      {t.responsibleName ?? 'sin asignar'} · {t.progress}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div>
          <SectionCard title="Hitos">
            {detail.milestones.length === 0 ? (
              <p className="empty-state">Sin hitos.</p>
            ) : (
              <ul className="dep-list">
                {detail.milestones.map((m) => (
                  <li key={m.id}>
                    <MilestoneStatusBadge status={m.status} /> <strong>{m.name}</strong>{' '}
                    <span className="muted small">{m.targetDate ?? 'sin fecha'}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Equipo">
            {detail.members.length === 0 ? (
              <p className="empty-state">Sin participantes.</p>
            ) : (
              <ul className="dep-list">
                {detail.members.map((m) => (
                  <li key={m.id}>
                    <span className="badge badge--soft">{m.role}</span> {m.name}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Relaciones">
            {detail.relations.length === 0 ? (
              <p className="empty-state">Sin relaciones.</p>
            ) : (
              <ul className="rel-list">
                {detail.relations.map((r) => (
                  <li key={r.id}>
                    <span className="badge badge--soft">{r.relationType}</span>{' '}
                    {r.relationType === 'capa' && r.targetId ? (
                      <Link href={`/dashboard/capa/${r.targetId}`}>Abrir CAPA ↗</Link>
                    ) : r.relationType === 'document' && r.targetId ? (
                      <Link href={`/dashboard/documents/${r.targetId}`}>Abrir documento ↗</Link>
                    ) : (
                      <span className="muted">{r.externalRef ?? r.note ?? '—'}</span>
                    )}
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
