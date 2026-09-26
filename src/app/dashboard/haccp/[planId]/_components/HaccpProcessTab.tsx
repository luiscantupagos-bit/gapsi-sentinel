'use client';

/**
 * HACCP-PROCESS-EXPANSION — pestaña «Proceso». Tres vistas: Mapa de proceso (SIPOC), Flujo
 * detallado y Descripción de etapas. En borrador, edición de entradas/salidas/destinos por etapa
 * (los cambios reinician la verificación in situ). Publicado = solo lectura.
 */
import { useActionState, useState, type ReactNode } from 'react';
import {
  INPUT_TYPES,
  INPUT_TYPE_LABEL,
  INPUT_SOURCE_TYPES,
  INPUT_SOURCE_LABEL,
  OUTPUT_TYPES,
  OUTPUT_TYPE_LABEL,
  DESTINATION_TYPES,
  DESTINATION_TYPE_LABEL,
  destinationIsInternalStep,
  inputTypeLabel,
  outputTypeLabel,
  destinationTypeLabel,
} from '@/features/haccp/haccp-process';
import type { getProcessModel } from '@/server/haccp-process';
import type { getPlanFlow } from '@/server/haccp-flow';
import { SubmitButton } from '../../../documents/_components/SubmitButton';
import {
  addInputAction,
  removeInputAction,
  addOutputAction,
  removeOutputAction,
  addDestinationAction,
  removeDestinationAction,
  type FormState,
} from '../../actions';
import { HaccpProcessMapView } from './HaccpProcessMapView';
import {
  HaccpProcessStageDescriptionView,
  HaccpSipocTableView,
} from './HaccpProcessStageDescriptionView';
import { HaccpFlowTab } from './HaccpFlowTab';

type ProcessModel = NonNullable<Awaited<ReturnType<typeof getProcessModel>>>;
type FlowData = Awaited<ReturnType<typeof getPlanFlow>>;
type Action = (prev: FormState | null, fd: FormData) => Promise<FormState>;
type Sub = 'mapa' | 'flujo' | 'descripcion';

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

function DestinationForm({
  planId,
  outputId,
  steps,
}: {
  planId: string;
  outputId: string;
  steps: ProcessModel['steps'];
}) {
  const [type, setType] = useState('next_process_step');
  return (
    <ActionForm
      action={addDestinationAction}
      hidden={{ planId, outputId }}
      button="Agregar destino"
    >
      <label>
        Tipo de destino
        <select name="destinationType" value={type} onChange={(e) => setType(e.target.value)}>
          {DESTINATION_TYPES.map((t) => (
            <option key={t} value={t}>
              {DESTINATION_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      {destinationIsInternalStep(type) ? (
        <label>
          Etapa siguiente
          <select name="destinationProcessStepId" defaultValue="" required>
            <option value="" disabled>
              — Selecciona —
            </option>
            {steps.map((s, i) => (
              <option key={s.id} value={s.processStepId}>
                {String(i + 1).padStart(2, '0')} · {s.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          Destino externo / descripción
          <input name="destinationExternalText" placeholder="p. ej. Venta a granel, Proveedor…" />
        </label>
      )}
      <label>
        Etiqueta (opcional)
        <input name="label" placeholder="p. ej. Conforme" />
      </label>
    </ActionForm>
  );
}

function StepEditor({
  planId,
  step,
  steps,
}: {
  planId: string;
  step: ProcessModel['steps'][number];
  steps: ProcessModel['steps'];
}) {
  const [inputSource, setInputSource] = useState('supplier');
  return (
    <div className="haccp-proc-editor">
      {/* ENTRADAS */}
      <h4>Entradas</h4>
      {step.inputs.length === 0 ? (
        <p className="muted">Sin entradas.</p>
      ) : (
        <ul className="history">
          {step.inputs.map((inp) => (
            <li key={inp.id}>
              <strong>{inp.name}</strong> · {inputTypeLabel(inp.inputType)}
              {inp.sourceStepName ? ` · desde ${inp.sourceStepName}` : ''}{' '}
              <ActionForm
                action={removeInputAction}
                hidden={{ planId, inputId: inp.id }}
                button="Quitar"
              />
            </li>
          ))}
        </ul>
      )}
      <details>
        <summary className="button button--ghost">Agregar entrada</summary>
        <ActionForm
          action={addInputAction}
          hidden={{ planId, stepId: step.id }}
          button="Agregar entrada"
        >
          <label>
            Nombre *
            <input name="name" required />
          </label>
          <label>
            Tipo
            <select name="inputType" defaultValue="raw_material">
              {INPUT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {INPUT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Origen
            <select
              name="sourceType"
              value={inputSource}
              onChange={(e) => setInputSource(e.target.value)}
            >
              {INPUT_SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {INPUT_SOURCE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          {inputSource === 'previous_step' ? (
            <label>
              Etapa anterior
              <select name="sourceProcessStepId" defaultValue="">
                <option value="">— Selecciona —</option>
                {steps.map((s, i) => (
                  <option key={s.id} value={s.processStepId}>
                    {String(i + 1).padStart(2, '0')} · {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : inputSource === 'supplier' ? (
            <label>
              Proveedor
              <input name="supplierName" />
            </label>
          ) : null}
        </ActionForm>
      </details>

      {/* SALIDAS + DESTINOS */}
      <h4>Salidas y destinos</h4>
      {step.outputs.length === 0 ? (
        <p className="muted">Sin salidas.</p>
      ) : (
        step.outputs.map((o) => (
          <div key={o.id} className="haccp-proc-output">
            <p>
              <strong>{o.name}</strong> · {outputTypeLabel(o.outputType)}{' '}
              <ActionForm
                action={removeOutputAction}
                hidden={{ planId, outputId: o.id }}
                button="Quitar salida"
              />
            </p>
            {o.destinations.length > 0 && (
              <ul className="history">
                {o.destinations.map((d) => (
                  <li key={d.id}>
                    →{' '}
                    {d.destinationStepName ??
                      d.destinationExternalText ??
                      destinationTypeLabel(d.destinationType)}{' '}
                    <ActionForm
                      action={removeDestinationAction}
                      hidden={{ planId, destinationId: d.id }}
                      button="Quitar"
                    />
                  </li>
                ))}
              </ul>
            )}
            <details>
              <summary className="button button--ghost">Agregar destino</summary>
              <DestinationForm planId={planId} outputId={o.id} steps={steps} />
            </details>
          </div>
        ))
      )}
      <details>
        <summary className="button button--ghost">Agregar salida</summary>
        <ActionForm
          action={addOutputAction}
          hidden={{ planId, stepId: step.id }}
          button="Agregar salida"
        >
          <label>
            Nombre *
            <input name="name" required />
          </label>
          <label>
            Tipo
            <select name="outputType" defaultValue="conforming_product">
              {OUTPUT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {OUTPUT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Condición (opcional)
            <input name="conditionStatus" />
          </label>
        </ActionForm>
      </details>
    </div>
  );
}

export function HaccpProcessTab({
  planId,
  model,
  flow,
  members,
  canEdit,
}: {
  planId: string;
  model: ProcessModel | null;
  flow: FlowData;
  members: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [sub, setSub] = useState<Sub>('mapa');
  const steps = model?.steps ?? [];
  const editable = canEdit && Boolean(model?.version.editable);

  return (
    <>
      <div className="doc-panel__tablist" role="tablist" aria-label="Vistas del proceso">
        {(
          [
            ['mapa', 'Mapa de proceso'],
            ['flujo', 'Flujo detallado'],
            ['descripcion', 'Descripción de etapas'],
          ] as [Sub, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={sub === key}
            className={`doc-panel__tab${sub === key ? ' is-active' : ''}`}
            onClick={() => setSub(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === 'mapa' && (
        <>
          <p className="muted doc-panel__hint">
            Mapa SIPOC: entradas → etapa → salidas → destinos. Las rutas externas (venta,
            devolución, procesamiento externo, disposición) se marcan explícitamente.
          </p>
          <HaccpSipocTableView steps={steps} />
          <HaccpProcessMapView steps={steps} />
          {editable && (
            <div className="haccp-proc-editors">
              <h3>Editar entradas / salidas / destinos</h3>
              {steps.length === 0 ? (
                <p className="empty-state empty-state--compact">
                  Agrega etapas en «Flujo detallado» para poder describir sus entradas y salidas.
                </p>
              ) : (
                steps.map((step, i) => (
                  <details key={step.id} className="haccp-proc-step">
                    <summary>
                      {String(i + 1).padStart(2, '0')} · {step.name} · {step.inputs.length} entradas
                      · {step.outputs.length} salidas
                    </summary>
                    <StepEditor planId={planId} step={step} steps={steps} />
                  </details>
                ))
              )}
            </div>
          )}
        </>
      )}

      {sub === 'flujo' && (
        <HaccpFlowTab planId={planId} flow={flow} members={members} canEdit={canEdit} />
      )}

      {sub === 'descripcion' && <HaccpProcessStageDescriptionView steps={steps} />}
    </>
  );
}
