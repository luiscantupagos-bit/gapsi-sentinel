import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { TaskNotFoundError, getTaskDetail } from '@/server/tasks';
import { listOrgMembers } from '@/server/projects';
import { TASK_PRIORITIES, TASK_PRIORITY_LABEL } from '@/features/tasks/task-state';
import { PageHeader } from '../../../_components/ui';
import { TaskActionForm } from '../../_components/TaskActionForm';
import { updateTaskAction } from '../../actions';

export default async function EditTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const session = await requireServerSession();
  const { taskId } = await params;
  let detail;
  try {
    detail = await getTaskDetail(session.organizationId, taskId);
  } catch (error) {
    if (error instanceof TaskNotFoundError) notFound();
    throw error;
  }
  const members = await listOrgMembers(session.organizationId);
  const t = detail.task;

  return (
    <main className="container container--narrow">
      <p>
        <Link href={`/dashboard/tasks/${t.id}`}>← Volver a la tarea</Link>
      </p>
      <PageHeader title="Editar tarea" subtitle={`${t.folio} · ${t.title}`} />

      <TaskActionForm
        action={updateTaskAction}
        hidden={{ taskId: t.id }}
        button="Guardar cambios"
        variant="primary"
        className="doc-form"
      >
        <label className="field field--full">
          <span className="field__label">Título</span>
          <input name="title" defaultValue={t.title} required />
        </label>
        <label className="field field--full">
          <span className="field__label">Descripción</span>
          <textarea name="description" rows={3} defaultValue={t.description ?? ''} />
        </label>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Prioridad</span>
            <select name="priority" defaultValue={t.priority ?? 'normal'}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Responsable</span>
            <select name="responsibleUserId" defaultValue={t.responsibleUserId ?? ''}>
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
            <input type="date" name="startDate" defaultValue={t.startDate ?? ''} />
          </label>
          <label className="field">
            <span className="field__label">Fecha objetivo</span>
            <input type="date" name="targetDate" defaultValue={t.targetDate ?? ''} />
          </label>
          <label className="field">
            <span className="field__label">Avance (%)</span>
            <input type="number" name="progress" min={0} max={100} defaultValue={t.progress} />
          </label>
        </div>
      </TaskActionForm>
    </main>
  );
}
