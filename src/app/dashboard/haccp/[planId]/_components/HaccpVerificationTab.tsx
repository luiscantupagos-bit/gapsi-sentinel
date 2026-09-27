'use client';

/**
 * HACCP-006 — pestaña «Verificación». Sub-vistas Programa / Próximas / Vencidas / Completadas /
 * Resultados. Cada ocurrencia se materializa como Task nativa (reutiliza el motor de recurrencia
 * y el Gantt existentes); al ejecutar puede crear un Record (DOC-004) y capturar un resultado
 * técnico. Publicado = solo lectura. La verificación demuestra que el sistema SE EJECUTA (distinta
 * de la validación, HACCP-005).
 */
import { useActionState, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  VERIFICATION_SCOPES,
  VERIFICATION_SCOPE_LABEL,
  VERIFICATION_FREQUENCIES,
  RECORD_STRATEGIES,
  RECORD_STRATEGY_LABEL,
  verificationFrequencyLabel,
  verificationScopeLabel,
  verificationResultLabel,
  verificationDefStatusLabel,
  resultRequiresConclusion,
} from '@/features/haccp/haccp-verification';
import type { getVerifications } from '@/server/haccp-verification';
import { GanttChart } from '../../../_components/GanttChart';
import { SubmitButton } from '../../../documents/_components/SubmitButton';
import {
  saveVerificationDefinitionAction,
  setVerificationStatusAction,
  removeVerificationDefinitionAction,
  materializeVerificationAction,
  createVerificationRecordAction,
  recordVerificationResultAction,
  type FormState,
} from '../../actions';

type Data = NonNullable<Awaited<ReturnType<typeof getVerifications>>>;
type Action = (prev: FormState | null, fd: FormData) => Promise<FormState>;
type Sub = 'programa' | 'proximas' | 'vencidas' | 'completadas' | 'resultados';

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

function DefinitionForm({
  planId,
  versionId,
  controls,
  members,
  documents,
}: {
  planId: string;
  versionId: string;
  controls: Data['controls'];
  members: { id: string; name: string }[];
  documents: { id: string; code: string; title: string }[];
}) {
  const [scope, setScope] = useState('plan');
  const [strategy, setStrategy] = useState('none');
  return (
    <ActionForm
      action={saveVerificationDefinitionAction}
      hidden={{ planId, planVersionId: versionId }}
      button="Guardar verificación"
      variant="primary"
    >
      <label>
        Actividad *
        <input
          name="title"
          required
          placeholder="p. ej. Revisión de registros de control operacional"
        />
      </label>
      <label>
        Propósito
        <textarea name="purpose" rows={2} />
      </label>
      <label>
        Relacionado con
        <select name="scopeType" value={scope} onChange={(e) => setScope(e.target.value)}>
          {VERIFICATION_SCOPES.map((sc) => (
            <option key={sc} value={sc}>
              {VERIFICATION_SCOPE_LABEL[sc]}
            </option>
          ))}
        </select>
      </label>
      {(scope === 'pcc' || scope === 'ppro' || scope === 'control_measure') && (
        <label>
          Control (PCC/PPRO)
          <select name="controlMeasureLogicalId" defaultValue="">
            <option value="">— Selecciona —</option>
            {controls.map((c) => (
              <option key={c.controlMeasureLogicalId} value={c.controlMeasureLogicalId}>
                {c.classificationLabel} · {c.hazardName}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Método
        <input name="method" />
      </label>
      <label>
        Responsable
        <select name="responsibleUserId" defaultValue="">
          <option value="">— Sin asignar —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Frecuencia
        <select name="frequencyType" defaultValue="monthly">
          {VERIFICATION_FREQUENCIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Fecha de inicio
        <input type="date" name="startAt" />
      </label>
      <label>
        Formato requerido
        <select name="requiredDocumentId" defaultValue="">
          <option value="">— Sin formato —</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} · {d.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Estrategia de versión del formato
        <select
          name="recordStrategy"
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
        >
          {RECORD_STRATEGIES.map((s) => (
            <option key={s} value={s}>
              {RECORD_STRATEGY_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="record-check">
        <input type="checkbox" name="evidenceRequired" />
        <span>Evidencia requerida</span>
      </label>
    </ActionForm>
  );
}

function ResultForm({ planId, occurrenceId }: { planId: string; occurrenceId: string }) {
  const [result, setResult] = useState('conforme');
  return (
    <ActionForm
      action={recordVerificationResultAction}
      hidden={{ planId, occurrenceId }}
      button="Registrar resultado"
    >
      <label>
        Resultado
        <select name="result" value={result} onChange={(e) => setResult(e.target.value)}>
          <option value="conforme">Conforme</option>
          <option value="no_conforme">No conforme</option>
          <option value="no_concluyente">No concluyente</option>
        </select>
      </label>
      <label>
        Conclusión / observaciones{resultRequiresConclusion(result) ? ' *' : ''}
        <textarea name="conclusion" rows={2} required={resultRequiresConclusion(result)} />
      </label>
    </ActionForm>
  );
}

function OccurrenceCard({
  planId,
  o,
  editable,
}: {
  planId: string;
  o: Data['occurrences'][number];
  editable: boolean;
}) {
  return (
    <div className="haccp-verif-occcard">
      <p>
        <strong>{o.title}</strong> · {o.dueAtLabel ?? 'sin fecha'}
        {o.overdue && <span className="badge badge--warn">Vencida</span>}
        {o.result && <span className="badge">Resultado: {verificationResultLabel(o.result)}</span>}
        {o.taskId && (
          <Link className="button button--ghost" href={`/dashboard/tasks/${o.taskId}`}>
            Ver tarea
          </Link>
        )}
        {o.recordId && (
          <Link className="button button--ghost" href={`/dashboard/records/${o.recordId}`}>
            Abrir registro
          </Link>
        )}
      </p>
      {editable && !o.completed && (
        <div className="haccp-verif-exec">
          {!o.recordId && (
            <ActionForm
              action={createVerificationRecordAction}
              hidden={{ planId, occurrenceId: o.id }}
              button="Crear registro"
            />
          )}
          <details>
            <summary className="button button--ghost">Registrar resultado</summary>
            <ResultForm planId={planId} occurrenceId={o.id} />
          </details>
        </div>
      )}
      {o.conclusion && <p className="muted">{o.conclusion}</p>}
    </div>
  );
}

export function HaccpVerificationTab({
  planId,
  data,
  members,
  documents,
  canEdit,
}: {
  planId: string;
  data: Data;
  members: { id: string; name: string }[];
  documents: { id: string; code: string; title: string }[];
  canEdit: boolean;
}) {
  const [sub, setSub] = useState<Sub>('programa');
  const editable = canEdit && data.version.editable;
  const c = data.completeness;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = data.occurrences.filter((o) => !o.completed && !o.overdue);
  const overdue = data.occurrences.filter((o) => o.overdue);
  const completed = data.occurrences.filter((o) => o.completed);
  const results = data.occurrences.filter((o) => o.result);

  return (
    <>
      <section className="haccp-cards">
        <div className="report-card">
          <h3>Activas</h3>
          <p className="stat">{c.active}</p>
        </div>
        <div className="report-card">
          <h3>Próximas</h3>
          <p className="stat">{upcoming.length}</p>
        </div>
        <div className="report-card">
          <h3>Vencidas</h3>
          <p className="stat">{c.overdue}</p>
        </div>
        <div className="report-card">
          <h3>Completadas</h3>
          <p className="stat">{completed.length}</p>
        </div>
        <div className="report-card">
          <h3>No conformes</h3>
          <p className="stat">{c.nonConforming}</p>
        </div>
      </section>
      <p className="muted doc-panel__hint">
        La verificación demuestra que el sistema SE EJECUTA conforme a lo establecido (distinta de
        la validación, HACCP-005, que demuestra que una medida ES CAPAZ de controlar el peligro).
      </p>

      <div className="doc-panel__tablist" role="tablist" aria-label="Verificación">
        {(
          [
            ['programa', 'Programa'],
            ['proximas', 'Próximas'],
            ['vencidas', 'Vencidas'],
            ['completadas', 'Completadas'],
            ['resultados', 'Resultados'],
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

      {sub === 'programa' && (
        <>
          {editable && (
            <div className="haccp-verif-actions">
              <details>
                <summary className="button button--primary">Nueva verificación</summary>
                <DefinitionForm
                  planId={planId}
                  versionId={data.version.id}
                  controls={data.controls}
                  members={members}
                  documents={documents}
                />
              </details>
              <ActionForm
                action={materializeVerificationAction}
                hidden={{ planId }}
                button="Generar programa de verificación"
              />
            </div>
          )}

          {data.definitions.length === 0 ? (
            <p className="empty-state">Aún no hay definiciones de verificación.</p>
          ) : (
            data.definitions.map((d) => (
              <section key={d.id} className="haccp-control-card">
                <header className="haccp-control-card__head">
                  <strong>{d.title}</strong>
                  <span className="badge">{verificationScopeLabel(d.scopeType)}</span>
                  <span className="badge">{verificationFrequencyLabel(d.frequencyType)}</span>
                  <span className={`badge badge--vdef-${d.status}`}>
                    {verificationDefStatusLabel(d.status)}
                  </span>
                  {d.controlContext?.needsReview && (
                    <span className="badge badge--warn">Control en revisión</span>
                  )}
                </header>
                {d.purpose && <p>{d.purpose}</p>}
                <p className="muted">
                  Responsable: {d.responsibleName ?? 'Sin asignar'} · Formato:{' '}
                  {RECORD_STRATEGY_LABEL[d.recordStrategy as keyof typeof RECORD_STRATEGY_LABEL] ??
                    d.recordStrategy}
                </p>
                {/* §27 contexto de control read-only. */}
                {d.controlContext && (
                  <p className="muted">
                    {d.controlContext.classificationLabel} · {d.controlContext.hazardName}
                    {d.controlContext.criticalLimit
                      ? ` · Límite crítico: ${d.controlContext.criticalLimit}`
                      : ''}
                    {d.controlContext.actionCriterion
                      ? ` · Criterio: ${d.controlContext.actionCriterion}`
                      : ''}
                  </p>
                )}
                {editable && (
                  <div className="haccp-verif-defactions">
                    {d.status !== 'archived' && (
                      <ActionForm
                        action={setVerificationStatusAction}
                        hidden={{
                          planId,
                          definitionId: d.id,
                          status: d.status === 'active' ? 'paused' : 'active',
                        }}
                        button={d.status === 'active' ? 'Pausar' : 'Activar'}
                      />
                    )}
                    <ActionForm
                      action={setVerificationStatusAction}
                      hidden={{ planId, definitionId: d.id, status: 'archived' }}
                      button="Archivar"
                    />
                    <ActionForm
                      action={removeVerificationDefinitionAction}
                      hidden={{ planId, definitionId: d.id }}
                      button="Eliminar"
                    />
                  </div>
                )}
              </section>
            ))
          )}

          {data.ganttRows.length > 0 && (
            <div className="haccp-verif-gantt">
              <h3>Cronograma</h3>
              <GanttChart
                rows={data.ganttRows}
                rangeStart={data.ganttRows.reduce(
                  (min, r) => (r.start && r.start < min ? r.start : min),
                  today,
                )}
                rangeEnd={data.ganttRows.reduce(
                  (max, r) => (r.end && r.end > max ? r.end : max),
                  today,
                )}
                today={today}
              />
            </div>
          )}
        </>
      )}

      {sub === 'proximas' && (
        <OccList
          planId={planId}
          list={upcoming}
          editable={editable}
          empty="Sin verificaciones próximas."
        />
      )}
      {sub === 'vencidas' && (
        <OccList
          planId={planId}
          list={overdue}
          editable={editable}
          empty="Sin verificaciones vencidas."
        />
      )}
      {sub === 'completadas' && (
        <OccList
          planId={planId}
          list={completed}
          editable={false}
          empty="Sin verificaciones completadas."
        />
      )}
      {sub === 'resultados' && (
        <OccList
          planId={planId}
          list={results}
          editable={false}
          empty="Aún no hay resultados registrados."
        />
      )}
    </>
  );
}

function OccList({
  planId,
  list,
  editable,
  empty,
}: {
  planId: string;
  list: Data['occurrences'];
  editable: boolean;
  empty: string;
}) {
  if (list.length === 0) return <p className="empty-state empty-state--compact">{empty}</p>;
  return (
    <>
      {list.map((o) => (
        <OccurrenceCard key={o.id} planId={planId} o={o} editable={editable} />
      ))}
    </>
  );
}
