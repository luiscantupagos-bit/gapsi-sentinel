import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { listProjects, listOrgMembers } from '@/server/projects';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_TYPES,
  TASK_TYPE_LABEL,
} from '@/features/tasks/task-state';
import { PageHeader } from '../../_components/ui';
import { TaskActionForm } from '../_components/TaskActionForm';
import { createTaskAction } from '../actions';

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const session = await requireServerSession();
  const sp = await searchParams;
  const [members, projects] = await Promise.all([
    listOrgMembers(session.organizationId),
    listProjects(session.organizationId),
  ]);

  return (
    <main className="container container--narrow">
      <p>
        <Link href="/dashboard/tasks">← Volver a tareas</Link>
      </p>
      <PageHeader title="Nueva tarea" subtitle="Crea una tarea manual o de proyecto." />

      <TaskActionForm
        action={createTaskAction}
        button="Crear tarea"
        variant="primary"
        className="doc-form"
      >
        <label className="field field--full">
          <span className="field__label">Título</span>
          <input name="title" required placeholder="¿Qué hay que hacer?" />
        </label>
        <label className="field field--full">
          <span className="field__label">Descripción</span>
          <textarea name="description" rows={3} />
        </label>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Tipo</span>
            <select name="taskType" defaultValue="manual">
              {TASK_TYPES.filter(
                (t) => t === 'manual' || t === 'follow_up' || t === 'project' || t === 'other',
              ).map((t) => (
                <option key={t} value={t}>
                  {TASK_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Prioridad</span>
            <select name="priority" defaultValue="normal">
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Proyecto</span>
            <select name="projectId" defaultValue={sp.projectId ?? ''}>
              <option value="">— Sin proyecto —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.folio} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Responsable</span>
            <select name="responsibleUserId" defaultValue="">
              <option value="">— Sin asignar —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Fecha de inicio</span>
            <input type="date" name="startDate" />
          </label>
          <label className="field">
            <span className="field__label">Fecha objetivo</span>
            <input type="date" name="targetDate" />
          </label>
          <label className="field">
            <span className="field__label">Esfuerzo estimado (h)</span>
            <input type="number" name="estimatedHours" min={0} step={0.5} />
          </label>
        </div>
      </TaskActionForm>
    </main>
  );
}
