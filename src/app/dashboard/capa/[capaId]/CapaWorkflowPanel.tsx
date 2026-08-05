'use client';

import { useActionState } from 'react';
import { SubmitButton } from '../../documents/_components/SubmitButton';
import {
  ACTION_STATUSES,
  ACTION_STATUS_LABEL,
  ACTION_TYPES,
  ACTION_TYPE_LABEL,
  CAPA_EVIDENCE_TYPES,
  CAPA_EVIDENCE_TYPE_LABEL,
  CAPA_STATUS_LABEL,
  IMMEDIATE_ACTION_TYPES,
  IMMEDIATE_ACTION_TYPE_LABEL,
  RCA_METHODS,
  RCA_METHOD_LABEL,
  type CapaStatus,
} from '@/features/capa/capa-state';
import {
  addActionAction,
  addCommentAction,
  addEffectivenessAction,
  addImmediateActionAction,
  closeCapaAction,
  reopenCapaAction,
  saveRootCauseAction,
  transitionAction,
  updateActionAction,
  updateImmediateActionAction,
  uploadEvidenceAction,
  type FormState,
} from '../capa-actions';

type Action = (prev: FormState | null, fd: FormData) => Promise<FormState>;
type Member = { id: string; name: string };
type Doc = { id: string; code: string; title: string };

const FORWARD: Partial<Record<CapaStatus, CapaStatus>> = {
  draft: 'reported',
  reported: 'containment',
  containment: 'under_investigation',
  under_investigation: 'action_plan',
  action_plan: 'in_implementation',
  in_implementation: 'effectiveness_review',
};

function Form({
  action,
  hidden,
  button,
  children,
  variant = 'ghost',
}: {
  action: Action;
  hidden: Record<string, string>;
  button: string;
  children?: React.ReactNode;
  variant?: 'primary' | 'ghost';
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(action, null);
  return (
    <form action={formAction} className="wf-form" encType="multipart/form-data">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <SubmitButton variant={variant} pendingLabel="Procesando…">
        {button}
      </SubmitButton>
      {state && (
        <span role="status" className={state.ok ? 'msg msg--ok' : 'msg msg--error'}>
          {state.message}
          {state.errors && state.errors.length > 0 ? ` — ${state.errors.join(' ')}` : ''}
        </span>
      )}
    </form>
  );
}

interface Immediate {
  id: string;
  actionType: string;
  description: string;
  status: string;
}
interface PlanAction {
  id: string;
  description: string;
  status: string;
  progress: number;
}

export function CapaWorkflowPanel({
  capaId,
  status,
  isAdmin,
  canEdit,
  members,
  documents,
  immediateActions,
  actions,
}: {
  capaId: string;
  status: CapaStatus;
  isAdmin: boolean;
  canEdit: boolean;
  members: Member[];
  documents: Doc[];
  immediateActions: Immediate[];
  actions: PlanAction[];
}) {
  const base = { capaId };
  const next = FORWARD[status];
  const terminal = status === 'closed' || status === 'cancelled';

  return (
    <div className="wf-panel">
      {/* Avance de estado */}
      {canEdit && next && (
        <Form
          action={transitionAction}
          hidden={{ ...base, to: next }}
          button={`Avanzar a: ${CAPA_STATUS_LABEL[next]}`}
          variant="primary"
        >
          {status === 'containment' && (
            <input name="justification" placeholder="Justificación si no hay contención" />
          )}
        </Form>
      )}

      {/* Verificación de eficacia → cerrar (owner/admin) o volver a plan */}
      {status === 'effectiveness_review' && isAdmin && (
        <Form action={closeCapaAction} hidden={base} button="Cerrar CAPA" variant="primary">
          <input name="summary" placeholder="Conclusión de cierre (obligatoria)" required />
          <span className="muted">Acuse interno de cierre, no es una firma legal.</span>
        </Form>
      )}
      {status === 'effectiveness_review' && canEdit && (
        <Form
          action={transitionAction}
          hidden={{ ...base, to: 'action_plan' }}
          button="Volver al plan de acciones"
        />
      )}

      {/* Cancelar */}
      {canEdit && !terminal && (isAdmin || status === 'draft') && (
        <Form
          action={transitionAction}
          hidden={{ ...base, to: 'cancelled' }}
          button="Cancelar CAPA"
        >
          <input name="reason" placeholder="Motivo (obligatorio)" required />
        </Form>
      )}

      {/* Reapertura (cerrada, owner/admin) */}
      {status === 'closed' && isAdmin && (
        <Form action={reopenCapaAction} hidden={base} button="Reabrir CAPA">
          <select name="target" defaultValue="action_plan">
            <option value="action_plan">Plan de acciones</option>
            <option value="under_investigation">Investigación</option>
          </select>
          <select name="responsibleUserId" required defaultValue="">
            <option value="" disabled>
              Nuevo responsable
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input type="date" name="targetDate" required />
          <input name="reason" placeholder="Motivo (obligatorio)" required />
        </Form>
      )}

      {/* Contención / corrección inmediata */}
      {canEdit && ['reported', 'containment', 'under_investigation'].includes(status) && (
        <Form action={addImmediateActionAction} hidden={base} button="Registrar acción inmediata">
          <select name="actionType">
            {IMMEDIATE_ACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {IMMEDIATE_ACTION_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <input name="description" placeholder="Descripción" required />
          <select name="responsibleUserId" defaultValue="">
            <option value="">Responsable</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input type="date" name="committedAt" title="Fecha compromiso" />
          <span className="muted">
            Corrección: resuelve el efecto. Contención: evita que se propague.
          </span>
        </Form>
      )}
      {canEdit &&
        !terminal &&
        immediateActions.map((a) => (
          <Form
            key={a.id}
            action={updateImmediateActionAction}
            hidden={{ ...base, actionId: a.id }}
            button="Actualizar inmediata"
          >
            <span className="muted">{a.description.slice(0, 40)}</span>
            <select name="status" defaultValue={a.status}>
              <option value="pending">Pendiente</option>
              <option value="in_progress">En progreso</option>
              <option value="completed">Completada</option>
              <option value="cancelled">Cancelada</option>
            </select>
            <input type="date" name="executedAt" title="Fecha de ejecución" />
            <input name="result" placeholder="Resultado" />
          </Form>
        ))}

      {/* Causa raíz + 5 porqués */}
      {canEdit && ['under_investigation', 'action_plan'].includes(status) && (
        <Form action={saveRootCauseAction} hidden={base} button="Guardar causa raíz">
          <select name="method">
            {RCA_METHODS.map((m) => (
              <option key={m} value={m}>
                {RCA_METHOD_LABEL[m]}
              </option>
            ))}
          </select>
          <input name="immediateCause" placeholder="Causa inmediata" />
          <input name="contributingCause" placeholder="Causa contribuyente" />
          {[1, 2, 3, 4, 5].map((n) => (
            <input key={n} name={`why${n}`} placeholder={`¿Por qué ${n}?`} />
          ))}
          <input name="rootCause" placeholder="Conclusión de causa raíz" />
          <label className="props-check">
            <input type="checkbox" name="conclude" /> Concluir análisis
          </label>
        </Form>
      )}

      {/* Plan de acciones */}
      {canEdit && ['action_plan', 'in_implementation'].includes(status) && (
        <Form action={addActionAction} hidden={base} button="Agregar acción al plan">
          <select name="actionType">
            {ACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTION_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <input name="description" placeholder="Descripción" required />
          <select name="responsibleUserId" defaultValue="">
            <option value="">Responsable</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input type="date" name="dueDate" title="Fecha compromiso" />
          <select name="documentId" defaultValue="">
            <option value="">Documento relacionado (cambio documental)</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} · {d.title}
              </option>
            ))}
          </select>
          <input name="docChangeRequest" placeholder="Necesidad de cambio documental" />
        </Form>
      )}
      {canEdit &&
        !terminal &&
        ['action_plan', 'in_implementation', 'effectiveness_review'].includes(status) &&
        actions.map((a) => (
          <Form
            key={a.id}
            action={updateActionAction}
            hidden={{ ...base, actionId: a.id }}
            button="Actualizar acción"
          >
            <span className="muted">{a.description.slice(0, 40)}</span>
            <select name="status" defaultValue={a.status}>
              {ACTION_STATUSES.map((x) => (
                <option key={x} value={x}>
                  {ACTION_STATUS_LABEL[x]}
                </option>
              ))}
            </select>
            <input
              type="number"
              name="progress"
              min={0}
              max={100}
              defaultValue={a.progress}
              title="% avance"
            />
            <input name="result" placeholder="Resultado" />
          </Form>
        ))}

      {/* Verificación de eficacia */}
      {canEdit && status === 'effectiveness_review' && (
        <Form action={addEffectivenessAction} hidden={base} button="Registrar verificación">
          <input name="criterion" placeholder="Criterio de eficacia (obligatorio)" required />
          <input name="method" placeholder="Método de verificación" />
          <select name="verifierUserId" defaultValue="">
            <option value="">Verificador</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input name="followUpPeriod" placeholder="Periodo de seguimiento" />
          <input name="observedResult" placeholder="Resultado observado" />
          <select name="conclusion" defaultValue="effective">
            <option value="effective">Eficaz</option>
            <option value="partially_effective">Parcialmente eficaz</option>
            <option value="not_effective">No eficaz</option>
          </select>
          <input name="comment" placeholder="Comentario / justificación" />
          <label className="props-check">
            <input type="checkbox" name="requiresNewAction" /> Requiere acción adicional
          </label>
        </Form>
      )}

      {/* Evidencia */}
      {canEdit && !terminal && (
        <Form action={uploadEvidenceAction} hidden={base} button="Adjuntar evidencia">
          <select name="evidenceType" defaultValue="finding">
            {CAPA_EVIDENCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {CAPA_EVIDENCE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <input type="file" name="file" required />
        </Form>
      )}

      {/* Comentario */}
      <Form action={addCommentAction} hidden={base} button="Comentar">
        <input name="body" placeholder="Comentario" required />
      </Form>
    </div>
  );
}
