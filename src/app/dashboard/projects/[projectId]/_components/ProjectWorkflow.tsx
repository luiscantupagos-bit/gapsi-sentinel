'use client';

import {
  MILESTONE_STATUSES,
  MILESTONE_STATUS_LABEL,
  canTransitionProject,
  isProjectReopen,
  type ProjectStatus,
} from '@/features/projects/project-state';
import { ProjectActionForm } from '../../_components/ProjectActionForm';
import {
  addMilestoneAction,
  addProjectCommentAction,
  addProjectMemberAction,
  transitionProjectAction,
  updateMilestoneStatusAction,
  uploadProjectEvidenceAction,
} from '../../actions';

type Transition = {
  to: ProjectStatus;
  label: string;
  needsReason?: boolean;
  needsJustification?: boolean;
};

const TRANSITIONS: Record<ProjectStatus, Transition[]> = {
  draft: [
    { to: 'planned', label: 'Planear' },
    { to: 'active', label: 'Activar' },
    { to: 'cancelled', label: 'Cancelar', needsReason: true },
  ],
  planned: [
    { to: 'active', label: 'Activar' },
    { to: 'on_hold', label: 'Pausar' },
    { to: 'cancelled', label: 'Cancelar', needsReason: true },
  ],
  active: [
    { to: 'under_review', label: 'Enviar a revisión' },
    { to: 'completed', label: 'Completar', needsJustification: true },
    { to: 'on_hold', label: 'Pausar' },
    { to: 'cancelled', label: 'Cancelar', needsReason: true },
  ],
  on_hold: [
    { to: 'active', label: 'Reanudar' },
    { to: 'cancelled', label: 'Cancelar', needsReason: true },
  ],
  under_review: [
    { to: 'completed', label: 'Completar', needsJustification: true },
    { to: 'active', label: 'Devolver a activo' },
    { to: 'cancelled', label: 'Cancelar', needsReason: true },
  ],
  completed: [{ to: 'active', label: 'Reabrir' }],
  cancelled: [{ to: 'planned', label: 'Reabrir' }],
};

export function ProjectWorkflow({
  projectId,
  status,
  canManage,
  isAdmin,
  members,
  milestones,
}: {
  projectId: string;
  status: ProjectStatus;
  canManage: boolean;
  isAdmin: boolean;
  members: { id: string; name: string }[];
  milestones: { id: string; name: string; status: string }[];
}) {
  const options = TRANSITIONS[status].filter((tr) => {
    const reopen = isProjectReopen(status, tr.to);
    if (reopen && !isAdmin) return false;
    if (!reopen && !canManage) return false;
    return canTransitionProject(status, tr.to, { reopen });
  });

  return (
    <div className="wf-panel">
      {options.length > 0 ? (
        options.map((tr) => (
          <ProjectActionForm
            key={tr.to}
            action={transitionProjectAction}
            hidden={{ projectId, to: tr.to }}
            button={tr.label}
            variant={tr.to === 'active' || tr.to === 'completed' ? 'primary' : 'ghost'}
          >
            {tr.needsReason && (
              <label className="field">
                <span className="field__label">Motivo</span>
                <input name="reason" placeholder="Obligatorio" required />
              </label>
            )}
            {tr.needsJustification && (
              <label className="field">
                <span className="field__label">Justificación (si hay tareas abiertas)</span>
                <input name="justification" placeholder="Opcional si todo está cerrado" />
              </label>
            )}
          </ProjectActionForm>
        ))
      ) : (
        <p className="muted">Sin acciones disponibles para tu rol.</p>
      )}

      {canManage && (
        <>
          <ProjectActionForm
            action={addMilestoneAction}
            hidden={{ projectId }}
            button="Agregar hito"
          >
            <label className="field">
              <span className="field__label">Nombre del hito</span>
              <input name="name" required placeholder="Hito" />
            </label>
            <label className="field">
              <span className="field__label">Fecha objetivo</span>
              <input type="date" name="targetDate" />
            </label>
          </ProjectActionForm>

          {milestones.length > 0 && (
            <ProjectActionForm
              action={updateMilestoneStatusAction}
              hidden={{ projectId }}
              button="Actualizar hito"
            >
              <label className="field">
                <span className="field__label">Hito</span>
                <select name="milestoneId" required defaultValue="">
                  <option value="" disabled>
                    Selecciona…
                  </option>
                  {milestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Estado</span>
                <select name="status" defaultValue="reached">
                  {MILESTONE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {MILESTONE_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
            </ProjectActionForm>
          )}

          <ProjectActionForm
            action={addProjectMemberAction}
            hidden={{ projectId }}
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
            <label className="field">
              <span className="field__label">Rol</span>
              <select name="role" defaultValue="member">
                <option value="lead">Líder</option>
                <option value="member">Miembro</option>
                <option value="viewer">Observador</option>
              </select>
            </label>
          </ProjectActionForm>

          <ProjectActionForm
            action={uploadProjectEvidenceAction}
            hidden={{ projectId, kind: 'evidence' }}
            button="Adjuntar archivo"
            encType="multipart/form-data"
          >
            <label className="field">
              <span className="field__label">Archivo</span>
              <input type="file" name="file" required />
            </label>
          </ProjectActionForm>
        </>
      )}

      <ProjectActionForm action={addProjectCommentAction} hidden={{ projectId }} button="Comentar">
        <label className="field">
          <span className="field__label">Comentario</span>
          <input name="body" placeholder="Escribe un comentario" required />
        </label>
      </ProjectActionForm>
    </div>
  );
}
