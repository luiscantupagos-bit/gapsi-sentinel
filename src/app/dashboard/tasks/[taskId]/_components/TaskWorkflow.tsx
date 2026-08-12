'use client';

import { useState } from 'react';
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
  // Qué acción contextual (que requiere motivo/resultado) está seleccionada.
  const [pending, setPending] = useState<TaskStatus | null>(null);

  const options = TRANSITIONS[status].filter((tr) => {
    const reopen = isReopenTransition(status, tr.to);
    if (reopen && !isAdmin) return false;
    if (!reopen && !canAct) return false;
    return canTransitionTask(status, tr.to, { reopen });
  });
  // Acciones directas (sin datos extra) vs. las que abren un formulario contextual.
  const direct = options.filter((o) => !o.needsReason && !o.needsResult);
  const contextual = options.filter((o) => o.needsReason || o.needsResult);
  const selected = contextual.find((o) => o.to === pending) ?? null;

  return (
    <div className="wf-panel wf-panel--grouped">
      {/* --- Estado y acciones --- */}
      <section className="wf-group">
        <h4 className="wf-group__title">Estado y acciones</h4>
        <p className="wf-group__state">
          Estado actual: <strong>{TASK_STATUS_LABEL[status] ?? status}</strong>
        </p>
        {options.length === 0 ? (
          <p className="muted">Sin acciones disponibles para tu rol.</p>
        ) : (
          <>
            <div className="wf-actions">
              {direct.map((tr) => (
                <TaskActionForm
                  key={tr.to}
                  action={transitionTaskAction}
                  hidden={{ taskId, to: tr.to }}
                  button={tr.label}
                  variant={tr.to === 'in_progress' ? 'primary' : 'ghost'}
                />
              ))}
            </div>

            {contextual.length > 0 && (
              <div className="wf-more">
                <span className="wf-more__label">Más acciones:</span>
                <div className="wf-more__buttons">
                  {contextual.map((tr) => (
                    <button
                      key={tr.to}
                      type="button"
                      className={`button button--ghost${pending === tr.to ? ' is-active' : ''}`}
                      aria-expanded={pending === tr.to}
                      onClick={() => setPending(pending === tr.to ? null : tr.to)}
                    >
                      {tr.label}
                    </button>
                  ))}
                </div>
                {/* Formulario contextual: solo el de la acción seleccionada. */}
                {selected && (
                  <TaskActionForm
                    key={selected.to}
                    action={transitionTaskAction}
                    hidden={{ taskId, to: selected.to }}
                    button={`Confirmar: ${selected.label}`}
                    variant={selected.to === 'completed' ? 'primary' : 'ghost'}
                    className="wf-form wf-context"
                  >
                    {selected.needsReason && (
                      <label className="field">
                        <span className="field__label">
                          Motivo de {selected.label.toLowerCase()}
                        </span>
                        <input name="reason" placeholder="Obligatorio" required autoFocus />
                      </label>
                    )}
                    {selected.needsResult && (
                      <label className="field">
                        <span className="field__label">Resultado (opcional)</span>
                        <input name="result" placeholder="Qué se logró" autoFocus />
                      </label>
                    )}
                  </TaskActionForm>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* --- Participantes --- */}
      {canAct && (
        <section className="wf-group">
          <h4 className="wf-group__title">Participantes</h4>
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
        </section>
      )}

      {/* --- Dependencias --- */}
      {canAct && nativeTasks.length > 0 && (
        <section className="wf-group">
          <h4 className="wf-group__title">Dependencias</h4>
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
        </section>
      )}

      {/* --- Evidencia --- */}
      {canAct && (
        <section className="wf-group">
          <h4 className="wf-group__title">Evidencia</h4>
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
        </section>
      )}

      {/* --- Comentarios --- */}
      <section className="wf-group">
        <h4 className="wf-group__title">Comentarios</h4>
        <TaskActionForm action={addTaskCommentAction} hidden={{ taskId }} button="Comentar">
          <label className="field">
            <span className="field__label">Comentario</span>
            <input name="body" placeholder="Escribe un comentario" required />
          </label>
        </TaskActionForm>
      </section>
    </div>
  );
}
