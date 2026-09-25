'use client';

/**
 * HACCP-002 — pestaña «Diagrama de flujo». Muestra el render read-only (reutilizable) y, en
 * borrador, el editor accesible (agregar/editar/eliminar/reordenar etapas y conexiones, sin
 * depender de drag&drop) + verificación in situ. Publicado = solo lectura.
 */
import { useActionState, type ReactNode } from 'react';
import {
  HACCP_STEP_TYPES,
  HACCP_STEP_TYPE_LABEL,
  HACCP_CONNECTION_TYPES,
  HACCP_CONNECTION_TYPE_LABEL,
  orderSteps,
  stepNumber,
  stepTypeLabel,
  connectionTypeLabel,
} from '@/features/haccp/haccp-flow';
import type { getPlanFlow } from '@/server/haccp-flow';
import { SubmitButton } from '../../../documents/_components/SubmitButton';
import {
  addConnectionAction,
  addStepAction,
  moveStepAction,
  removeConnectionAction,
  removeStepAction,
  updateStepAction,
  verifyFlowAction,
  type FormState,
} from '../../actions';
import { HaccpProcessFlowView } from './HaccpProcessFlowView';

type FlowData = Awaited<ReturnType<typeof getPlanFlow>>;
type Action = (prev: FormState | null, fd: FormData) => Promise<FormState>;

function ActionForm({
  action,
  hidden,
  button,
  children,
  variant = 'ghost',
}: {
  action: Action;
  hidden: Record<string, string>;
  button: string;
  children?: ReactNode;
  variant?: 'primary' | 'ghost';
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(action, null);
  return (
    <form action={formAction} className="wf-form">
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
          {state.errors?.length ? ` — ${state.errors.join(' ')}` : ''}
        </span>
      )}
    </form>
  );
}

export function HaccpFlowTab({
  planId,
  flow,
  members,
  canEdit,
}: {
  planId: string;
  flow: FlowData;
  members: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const version = flow.version;
  const ordered = orderSteps(flow.steps);
  const editable = canEdit && Boolean(version?.editable);

  return (
    <>
      {/* Estado de verificación in situ (§E19). */}
      <div className="haccp-flow__verify">
        {version?.flowVerifiedOnSite ? (
          <span className="badge badge--haccp-published">
            Verificado en planta · {version.flowVerifiedAtLabel}
            {version.flowVerifiedByName ? ` · ${version.flowVerifiedByName}` : ''}
          </span>
        ) : (
          <span className="badge badge--warn">No verificado en planta</span>
        )}
      </div>

      <HaccpProcessFlowView steps={flow.steps} connections={flow.connections} />

      {editable && version && (
        <>
          {/* Etapas: reordenar / editar / eliminar (controles accesibles, sin drag). */}
          <h3>Etapas</h3>
          {ordered.length === 0 ? (
            <p className="empty-state empty-state--compact">Agrega la primera etapa.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Etapa</th>
                    <th>Tipo</th>
                    <th>Área / responsable</th>
                    <th>Orden</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((s, i) => (
                    <tr key={s.id}>
                      <td className="mono">{stepNumber(i)}</td>
                      <td>{s.name}</td>
                      <td>{stepTypeLabel(s.stepType)}</td>
                      <td>
                        {[s.area, s.responsibleName ?? s.responsibleRole]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>
                      <td className="doc-panel__row-actions">
                        {i > 0 && (
                          <ActionForm
                            action={moveStepAction}
                            hidden={{ planId, stepId: s.id, direction: 'up' }}
                            button="↑"
                          />
                        )}
                        {i < ordered.length - 1 && (
                          <ActionForm
                            action={moveStepAction}
                            hidden={{ planId, stepId: s.id, direction: 'down' }}
                            button="↓"
                          />
                        )}
                      </td>
                      <td className="doc-panel__row-actions">
                        <details>
                          <summary className="button button--ghost">Editar</summary>
                          <ActionForm
                            action={updateStepAction}
                            hidden={{ planId, stepId: s.id }}
                            button="Guardar"
                          >
                            <StepFields
                              members={members}
                              defaults={{
                                name: s.name,
                                stepType: s.stepType,
                                description: s.description,
                                area: s.area,
                                responsibleUserId: null,
                                responsibleRole: s.responsibleRole,
                                equipment: s.equipment,
                                inputs: s.inputs,
                                outputs: s.outputs,
                                parameters: s.parameters,
                                notes: s.notes,
                              }}
                            />
                          </ActionForm>
                        </details>
                        <ActionForm
                          action={removeStepAction}
                          hidden={{ planId, stepId: s.id }}
                          button="Eliminar"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <details>
            <summary className="button button--ghost">Agregar etapa</summary>
            <ActionForm
              action={addStepAction}
              hidden={{ planId, planVersionId: version.id }}
              button="Agregar etapa"
              variant="primary"
            >
              <StepFields members={members} />
            </ActionForm>
          </details>

          {/* Conexiones (§E6/§E17). */}
          <h3>Conexiones</h3>
          {flow.connections.length === 0 ? (
            <p className="empty-state empty-state--compact">Sin conexiones.</p>
          ) : (
            <ul className="history">
              {flow.connections.map((c) => {
                const from = ordered.find((s) => s.processStepId === c.fromStepId);
                const to = ordered.find((s) => s.processStepId === c.toStepId);
                return (
                  <li key={c.id}>
                    {from?.name ?? '—'} → {to?.name ?? '—'}
                    {c.label ? ` · «${c.label}»` : ''} · {connectionTypeLabel(c.connectionType)}{' '}
                    <ActionForm
                      action={removeConnectionAction}
                      hidden={{ planId, connectionId: c.id }}
                      button="Quitar"
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {ordered.length >= 2 && (
            <details>
              <summary className="button button--ghost">Conectar etapas</summary>
              <ActionForm
                action={addConnectionAction}
                hidden={{ planId, planVersionId: version.id }}
                button="Conectar"
              >
                <label>
                  Desde
                  <select name="fromProcessStepId" required defaultValue="">
                    <option value="" disabled>
                      — Etapa origen —
                    </option>
                    {ordered.map((s, i) => (
                      <option key={s.id} value={s.processStepId}>
                        {stepNumber(i)} · {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Hacia
                  <select name="toProcessStepId" required defaultValue="">
                    <option value="" disabled>
                      — Etapa destino —
                    </option>
                    {ordered.map((s, i) => (
                      <option key={s.id} value={s.processStepId}>
                        {stepNumber(i)} · {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tipo
                  <select name="connectionType" defaultValue="sequence">
                    {HACCP_CONNECTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {HACCP_CONNECTION_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Etiqueta (p. ej. «Conforme» / «No conforme»)
                  <input name="label" />
                </label>
              </ActionForm>
            </details>
          )}

          {/* Verificación in situ (§E18). */}
          <h3>Verificación in situ</h3>
          {version.flowVerifiedOnSite ? (
            <ActionForm
              action={verifyFlowAction}
              hidden={{ planId, planVersionId: version.id, verified: 'false' }}
              button="Retirar verificación"
            />
          ) : (
            <ActionForm
              action={verifyFlowAction}
              hidden={{ planId, planVersionId: version.id, verified: 'true' }}
              button="Marcar verificado en planta"
              variant="primary"
            >
              <input name="notes" placeholder="Notas de verificación (opcional)" />
            </ActionForm>
          )}
        </>
      )}
    </>
  );
}

function StepFields({
  members,
  defaults,
}: {
  members: { id: string; name: string }[];
  defaults?: {
    name: string;
    stepType: string;
    description: string | null;
    area: string | null;
    responsibleUserId: string | null;
    responsibleRole: string | null;
    equipment: string | null;
    inputs: string | null;
    outputs: string | null;
    parameters: string | null;
    notes: string | null;
  };
}) {
  const d = defaults;
  return (
    <>
      <label>
        Nombre *
        <input name="name" required defaultValue={d?.name ?? ''} />
      </label>
      <label>
        Tipo
        <select name="stepType" defaultValue={d?.stepType ?? 'process'}>
          {HACCP_STEP_TYPES.map((t) => (
            <option key={t} value={t}>
              {HACCP_STEP_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Descripción
        <textarea name="description" rows={2} defaultValue={d?.description ?? ''} />
      </label>
      <label>
        Área
        <input name="area" defaultValue={d?.area ?? ''} />
      </label>
      <label>
        Responsable
        <select name="responsibleUserId" defaultValue={d?.responsibleUserId ?? ''}>
          <option value="">— Sin asignar —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Rol responsable
        <input name="responsibleRole" defaultValue={d?.responsibleRole ?? ''} />
      </label>
      <label>
        Equipo utilizado
        <input name="equipment" defaultValue={d?.equipment ?? ''} />
      </label>
      <label>
        Entradas
        <input name="inputs" defaultValue={d?.inputs ?? ''} />
      </label>
      <label>
        Salidas
        <input name="outputs" defaultValue={d?.outputs ?? ''} />
      </label>
      <label>
        Parámetros relevantes
        <input name="parameters" defaultValue={d?.parameters ?? ''} />
      </label>
      <label>
        Observaciones
        <input name="notes" defaultValue={d?.notes ?? ''} />
      </label>
    </>
  );
}
