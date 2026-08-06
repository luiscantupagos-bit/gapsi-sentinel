'use client';

import {
  TASK_STATUS_LABEL,
  canTransitionTask,
  isReopenTransition,
  type TaskStatus,
} from '@/features/tasks/task-state';
import { TaskActionForm } from '../../_components/TaskActionForm';
import {
  addTaskAssignmentAction,
  addTaskCommentAction,
  addTaskDependencyAction,
  transitionTaskAction,
  uploadTaskEvidenceAction,
} from '../../actions';

type Transition = { to: TaskStatus; label: string; needsReason?: boolean; needsResult?: boolean };

const TRANSITIONS: Record<TaskStatus, Transition[]> = {
  draft: [{ to: 'pending', label: 'Marcar pendiente' }],
  pending: [
    { to: 'in_progress', label: 'Iniciar' },
    { to: 'blocked', label: 'Bloquear', needsReason: true },
    { to: 'cancelled', label: 'Cancelar', needsReason: true },
  ],
  in_progress: [
    { to: 'under_review', label: 'Enviar a revisión' },
    { to: 'completed', label: 'Completar', needsResult: true },
    { to: 'blocked', label: 'Bloquear', needsReason: true },
    { to: 'cancelled', label: 'Cancelar', needsReason: true },
  ],
  blocked: [
    { to: 'in_progress', label: 'Reanudar' },
    { to: 'cancelled', label: 'Cancelar', needsReason: true },
  ],
  under_review: [
    { to: 'completed', label: 'Completar', needsResult: true },
    { to: 'in_progress', label: 'Devolver a progreso' },
    { to: 'cancelled', label: 'Cancelar', needsReason: true },
  ],
  completed: [{ to: 'in_progress', label: 'Reabrir' }],
  cancelled: [{ to: 'pending', label: 'Reabrir' }],
};

export function TaskWorkflow({
  taskId,
  status,
  canAct,
  isAdmin,
  members,
  nativeTasks,
}: {
  taskId: string;
  status: TaskStatus;
  canAct: boolean;
  isAdmin: boolean;
  members: { id: string; name: string }[];
  nativeTasks: { id: string; folio: string; title: string }[];
}) {
  const options = TRANSITIONS[status].filter((tr) => {
    const reopen = isReopenTransition(status, tr.to);
    if (reopen && !isAdmin) return false;
    if (!reopen && !canAct) return false;
    return canTransitionTask(status, tr.to, { reopen });
  });

  return (
    <div className="wf-panel">
      {options.length > 0 ? (
        options.map((tr) => (
          <TaskActionForm
            key={tr.to}
            action={transitionTaskAction}
            hidden={{ taskId, to: tr.to }}
            button={tr.label}
            variant={tr.to === 'completed' || tr.to === 'in_progress' ? 'primary' : 'ghost'}
          >
            {tr.needsReason && (
              <label className="field">
                <span className="field__label">Motivo</span>
                <input name="reason" placeholder="Obligatorio" required />
              </label>
            )}
            {tr.needsResult && (
              <label className="field">
                <span className="field__label">Resultado (opcional)</span>
                <input name="result" placeholder="Qué se logró" />
              </label>
            )}
          </TaskActionForm>
        ))
      ) : (
        <p className="muted">
          {status in TASK_STATUS_LABEL ? `Estado: ${TASK_STATUS_LABEL[status]}.` : ''} Sin acciones
          disponibles para tu rol.
        </p>
      )}

      {canAct && (
        <>
          <TaskActionForm
            action={addTaskAssignmentAction}
            hidden={{ taskId }}
            button="Agregar participante"
          >
            <label className="field">
              <span className="field__label">Participante</span>
              <select name="userId" required defaultValue="">
                <option value="" disabled>
                  Selecciona…
                </option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </TaskActionForm>

          {nativeTasks.length > 0 && (
            <TaskActionForm
              action={addTaskDependencyAction}
              hidden={{ taskId }}
              button="Agregar dependencia"
            >
              <label className="field">
                <span className="field__label">Depende de (predecesora)</span>
                <select name="fromTaskId" required defaultValue="">
                  <option value="" disabled>
                    Selecciona una tarea…
                  </option>
                  {nativeTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.folio} · {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="props-check">
                <input type="checkbox" name="mandatory" value="true" defaultChecked /> Obligatoria
              </label>
            </TaskActionForm>
          )}

          <TaskActionForm
            action={uploadTaskEvidenceAction}
            hidden={{ taskId, kind: 'evidence' }}
            button="Adjuntar evidencia"
            encType="multipart/form-data"
          >
            <label className="field">
              <span className="field__label">Archivo</span>
              <input type="file" name="file" required />
            </label>
          </TaskActionForm>
        </>
      )}

      <TaskActionForm action={addTaskCommentAction} hidden={{ taskId }} button="Comentar">
        <label className="field">
          <span className="field__label">Comentario</span>
          <input name="body" placeholder="Escribe un comentario" required />
        </label>
      </TaskActionForm>
    </div>
  );
}
