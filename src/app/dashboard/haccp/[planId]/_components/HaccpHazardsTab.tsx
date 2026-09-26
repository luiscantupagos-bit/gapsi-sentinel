'use client';

/**
 * HACCP-003 — pestaña «Análisis de peligros» con subtabs (Materias primas / Proceso / Criterios
 * de riesgo). Vista read-only reutilizable + gestión (agregar/editar/eliminar) en borrador.
 * Score y significancia se calculan server-side desde la matriz de la versión. Filtros básicos.
 */
import { useActionState, useState, type ReactNode } from 'react';
import {
  HACCP_HAZARD_TYPES,
  HACCP_HAZARD_TYPE_LABEL,
  hazardTypeLabel,
} from '@/features/haccp/haccp-hazards';
import type { getHazardAnalysis } from '@/server/haccp-hazards';
import { SubmitButton } from '../../../documents/_components/SubmitButton';
import {
  addHazardAction,
  removeHazardAction,
  saveRiskMatrixAction,
  updateHazardAction,
  type FormState,
} from '../../actions';
import {
  HaccpHazardAnalysisView,
  type HazardGroup,
  type HazardRow,
} from './HaccpHazardAnalysisView';
import { RiskMatrixView } from './RiskMatrixView';

type Analysis = NonNullable<Awaited<ReturnType<typeof getHazardAnalysis>>>;
type Action = (prev: FormState | null, fd: FormData) => Promise<FormState>;
type Sub = 'materias' | 'proceso' | 'criterios';

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

function HazardFields({ defaults }: { defaults?: Partial<HazardRow> }) {
  const d = defaults;
  return (
    <>
      <label>
        Tipo de peligro
        <select name="hazardType" defaultValue={d?.hazardType ?? 'biological'}>
          {HACCP_HAZARD_TYPES.map((t) => (
            <option key={t} value={t}>
              {HACCP_HAZARD_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Peligro *
        <input name="name" required defaultValue={d?.name ?? ''} />
      </label>
      <label>
        Descripción
        <input name="description" defaultValue={d?.description ?? ''} />
      </label>
      <label>
        Origen / causa
        <input name="originOrCause" defaultValue={d?.originOrCause ?? ''} />
      </label>
      <label>
        Probabilidad (1-5)
        <input
          type="number"
          name="probability"
          min={1}
          max={5}
          defaultValue={d?.probability ?? 1}
        />
      </label>
      <label>
        Severidad (1-5)
        <input type="number" name="severity" min={1} max={5} defaultValue={d?.severity ?? 1} />
      </label>
      <label>
        Medida de control existente
        <input name="existingControlMeasure" defaultValue={d?.existingControlMeasure ?? ''} />
      </label>
      <label>
        Override de significancia
        <select name="overrideSignificant" defaultValue="">
          <option value="">— Calculado automáticamente —</option>
          <option value="yes">Forzar significativo</option>
          <option value="no">Forzar no significativo</option>
        </select>
      </label>
      <label>
        Justificación del override
        <input name="significanceReason" />
      </label>
    </>
  );
}

function filterHazards(hazards: HazardRow[], filter: string): HazardRow[] {
  if (filter === 'all') return hazards;
  if (filter === 'significant') return hazards.filter((h) => h.isSignificant);
  return hazards.filter((h) => h.hazardType === filter);
}

export function HaccpHazardsTab({
  planId,
  analysis,
  canEdit,
}: {
  planId: string;
  analysis: Analysis;
  canEdit: boolean;
}) {
  const [sub, setSub] = useState<Sub>('materias');
  const [filter, setFilter] = useState<string>('all');
  const version = analysis.version;
  const editable = canEdit && version.editable;
  const c = analysis.completeness;

  const materialGroups: HazardGroup[] = analysis.materialGroups.map((m) => ({
    key: m.sourceReferenceId,
    title: m.code ?? 'Materia prima',
    subtitle: [m.title, m.versionLabel].filter(Boolean).join(' · ') || null,
    href: m.sourceDocumentId ? `/dashboard/documents/${m.sourceDocumentId}` : null,
    hazards: filterHazards(m.hazards, filter),
    significantCount: m.significantCount,
  }));
  const stepGroups: HazardGroup[] = analysis.stepGroups.map((s) => ({
    key: s.processStepId,
    title: `${s.number} · ${s.name}`,
    subtitle: null,
    href: `/dashboard/haccp/${planId}?tab=flujo`,
    hazards: filterHazards(s.hazards, filter),
    significantCount: s.significantCount,
  }));

  return (
    <>
      {/* Resumen (§37). */}
      <section className="haccp-cards">
        <div className="report-card">
          <h3>Materias analizadas</h3>
          <p className="stat">
            {c.materialsAnalyzed}/{c.materialsTotal}
          </p>
        </div>
        <div className="report-card">
          <h3>Etapas analizadas</h3>
          <p className="stat">
            {c.stepsAnalyzed}/{c.stepsTotal}
          </p>
        </div>
        <div className="report-card">
          <h3>Peligros</h3>
          <p className="stat">{analysis.totals.hazards}</p>
        </div>
        <div className="report-card">
          <h3>Significativos</h3>
          <p className="stat">{analysis.totals.significant}</p>
        </div>
      </section>

      {analysis.flowChangedWarning && (
        <p className="msg msg--error">
          El diagrama de flujo cambió respecto a la versión vigente. Revise los peligros asociados a
          las etapas modificadas.
        </p>
      )}
      {c.significantWithoutControl > 0 && (
        <p className="msg msg--info">
          {c.significantWithoutControl} peligro(s) significativo(s) sin medida de control
          registrada.
        </p>
      )}

      {/* Subtabs. */}
      <div
        className="doc-panel__tablist"
        role="tablist"
        aria-label="Secciones del análisis de peligros"
      >
        {(['materias', 'proceso', 'criterios'] as Sub[]).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={sub === s}
            className={`doc-panel__tab${sub === s ? ' is-active' : ''}`}
            onClick={() => setSub(s)}
          >
            {s === 'materias'
              ? 'Materias primas'
              : s === 'proceso'
                ? 'Proceso'
                : 'Criterios de riesgo'}
          </button>
        ))}
      </div>

      {sub !== 'criterios' && (
        <label className="haccp-filter">
          Filtro
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="significant">Significativos</option>
            {HACCP_HAZARD_TYPES.map((t) => (
              <option key={t} value={t}>
                {HACCP_HAZARD_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
      )}

      {sub === 'materias' && (
        <>
          {analysis.materialGroups.length === 0 ? (
            <p className="msg msg--info">
              Este plan aún no tiene materias primas relacionadas (pestaña «Materias primas»). El
              análisis de peligros de materias primas se habilita cuando exista una ficha/fuente
              válida.
            </p>
          ) : (
            <HaccpHazardAnalysisView
              groups={materialGroups}
              emptyLabel="Sin materias primas para analizar."
            />
          )}
          {editable && analysis.materialGroups.length > 0 && (
            <details>
              <summary className="button button--ghost">Agregar peligro de materia prima</summary>
              <ActionForm
                action={addHazardAction}
                hidden={{ planId, planVersionId: version.id, sourceType: 'material' }}
                button="Agregar peligro"
                variant="primary"
              >
                <label>
                  Materia prima
                  <select name="sourceReferenceId" required defaultValue="">
                    <option value="" disabled>
                      — Selecciona —
                    </option>
                    {analysis.materialGroups.map((m) => (
                      <option key={m.sourceReferenceId} value={m.sourceReferenceId}>
                        {m.code} · {m.title}
                      </option>
                    ))}
                  </select>
                </label>
                <HazardFields />
              </ActionForm>
            </details>
          )}
        </>
      )}

      {sub === 'proceso' && (
        <>
          <HaccpHazardAnalysisView
            groups={stepGroups}
            emptyLabel="Sin etapas en el diagrama de flujo. Agrega etapas primero."
          />
          {editable && analysis.stepGroups.length > 0 && (
            <details>
              <summary className="button button--ghost">Agregar peligro de proceso</summary>
              <ActionForm
                action={addHazardAction}
                hidden={{ planId, planVersionId: version.id, sourceType: 'process_step' }}
                button="Agregar peligro"
                variant="primary"
              >
                <label>
                  Etapa
                  <select name="processStepId" required defaultValue="">
                    <option value="" disabled>
                      — Selecciona —
                    </option>
                    {analysis.stepGroups.map((s) => (
                      <option key={s.processStepId} value={s.processStepId}>
                        {s.number} · {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <HazardFields />
              </ActionForm>
            </details>
          )}

          {/* §O — peligros por ENTRADA de cada etapa (introducidos con el material). */}
          {analysis.stepGroups.some((s) => (s.inputs?.length ?? 0) > 0) && (
            <section className="haccp-input-hazards">
              <h3>Peligros por entrada</h3>
              <p className="muted doc-panel__hint">
                Distingue el peligro que <strong>entra con una entrada</strong> del peligro
                <strong> generado o intensificado en la actividad</strong> de la etapa.
              </p>
              {analysis.stepGroups
                .filter((s) => (s.inputs?.length ?? 0) > 0)
                .map((s) => (
                  <div key={s.processStepId} className="haccp-input-hazards__step">
                    <h4>
                      {s.number} · {s.name}
                    </h4>
                    {s.inputs!.map((inp) => (
                      <div key={inp.inputLogicalId} className="haccp-input-hazards__input">
                        <p>
                          <strong>{inp.name}</strong>
                          {inp.hazards.length > 0 ? (
                            <span className="muted"> · {inp.hazards.length} peligro(s)</span>
                          ) : (
                            <span className="badge badge--warn">
                              Esta entrada aún no tiene evaluación de peligros.
                            </span>
                          )}
                        </p>
                        {inp.hazards.map((h) => (
                          <span key={h.id} className="badge">
                            {h.name}
                            {h.isSignificant ? ' · significativo' : ''}
                          </span>
                        ))}
                        {editable && (
                          <details>
                            <summary className="button button--ghost">Agregar peligro</summary>
                            <ActionForm
                              action={addHazardAction}
                              hidden={{
                                planId,
                                planVersionId: version.id,
                                sourceType: 'process_step',
                                processStepId: s.processStepId,
                                contextType: 'input',
                                inputLogicalId: inp.inputLogicalId,
                              }}
                              button="Agregar peligro de entrada"
                            >
                              <HazardFields />
                            </ActionForm>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
            </section>
          )}
        </>
      )}

      {sub === 'criterios' && (
        <>
          <RiskMatrixView matrix={analysis.matrix} />
          {editable && (
            <details>
              <summary className="button button--ghost">Editar criterios de riesgo</summary>
              <ActionForm
                action={saveRiskMatrixAction}
                hidden={{ planId, planVersionId: version.id }}
                button="Guardar criterios"
                variant="primary"
              >
                <p className="muted">Etiquetas de probabilidad (niveles 1-5)</p>
                {analysis.matrix.probabilityScale.map((p) => (
                  <label key={p.value}>
                    P{p.value}
                    <input name={`prob_${p.value}`} defaultValue={p.label} />
                  </label>
                ))}
                <p className="muted">Etiquetas de severidad (niveles 1-5)</p>
                {analysis.matrix.severityScale.map((sv) => (
                  <label key={sv.value}>
                    S{sv.value}
                    <input name={`sev_${sv.value}`} defaultValue={sv.label} />
                  </label>
                ))}
                <label>
                  Fórmula del score
                  <select name="scoreFormula" defaultValue={analysis.matrix.scoreFormula}>
                    <option value="multiply">Probabilidad × Severidad</option>
                    <option value="sum">Probabilidad + Severidad</option>
                  </select>
                </label>
                <label>
                  Umbral de significancia
                  <input
                    type="number"
                    name="significanceThreshold"
                    min={1}
                    defaultValue={analysis.matrix.significanceThreshold}
                  />
                </label>
              </ActionForm>
            </details>
          )}
        </>
      )}

      {/* Gestión (editar/eliminar) — separada de la vista read-only. */}
      {editable && sub !== 'criterios' && (
        <ManageHazards
          planId={planId}
          hazards={
            sub === 'materias'
              ? analysis.materialGroups.flatMap((m) => m.hazards)
              : analysis.stepGroups.flatMap((s) => s.hazards)
          }
        />
      )}
    </>
  );
}

function ManageHazards({ planId, hazards }: { planId: string; hazards: HazardRow[] }) {
  if (hazards.length === 0) return null;
  return (
    <>
      <h3>Editar / eliminar peligros</h3>
      <ul className="history">
        {hazards.map((h) => (
          <li key={h.id}>
            {hazardTypeLabel(h.hazardType)} · {h.name} · riesgo {h.riskScore}{' '}
            {h.isSignificant ? '(significativo)' : ''}{' '}
            <details style={{ display: 'inline-block' }}>
              <summary className="button button--ghost">Editar</summary>
              <ActionForm
                action={updateHazardAction}
                hidden={{ planId, hazardId: h.id }}
                button="Guardar"
              >
                <HazardFields defaults={h} />
              </ActionForm>
            </details>
            <ActionForm
              action={removeHazardAction}
              hidden={{ planId, hazardId: h.id }}
              button="Eliminar"
            />
          </li>
        ))}
      </ul>
    </>
  );
}
