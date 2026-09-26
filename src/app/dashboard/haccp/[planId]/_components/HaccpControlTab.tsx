'use client';

/**
 * HACCP-004 — pestaña «Medidas de control». Sub-vistas: Pendientes / Evaluados / PCC / PPRO /
 * PPR. Wizard de clasificación (árbol de decisión, paso a paso, con resultado explicable) y
 * editor del plan de control por clasificación. Publicado = read-only. El resolver es puro y
 * compartido con el servidor.
 */
import { useActionState, useState, type ReactNode } from 'react';
import {
  ANSWER_LABEL,
  classificationLabel,
  resolveClassification,
  type AnswerRecord,
  type TreeAnswer,
} from '@/features/haccp/haccp-control';
import { hazardTypeLabel } from '@/features/haccp/haccp-hazards';
import type { getControlMeasures } from '@/server/haccp-control';
import { SubmitButton } from '../../../documents/_components/SubmitButton';
import {
  removeAssessmentAction,
  saveAssessmentAction,
  saveControlPlanAction,
  type FormState,
} from '../../actions';
import { HaccpControlMeasuresView, type AssessmentView } from './HaccpControlMeasuresView';

type ControlData = NonNullable<Awaited<ReturnType<typeof getControlMeasures>>>;
type Action = (prev: FormState | null, fd: FormData) => Promise<FormState>;
type Sub = 'pendientes' | 'evaluados' | 'pcc' | 'ppro' | 'ppr';

function Status({ state }: { state: FormState | null }) {
  if (!state) return null;
  return (
    <span role="status" className={state.ok ? 'msg msg--ok' : 'msg msg--error'}>
      {state.message}
      {state.errors?.length ? ` — ${state.errors.join(' ')}` : ''}
    </span>
  );
}

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
      <Status state={state} />
    </form>
  );
}

/** Wizard de clasificación: muestra solo las preguntas del camino y previsualiza el resultado. */
function HazardWizard({
  planId,
  versionId,
  tree,
  hazard,
}: {
  planId: string;
  versionId: string;
  tree: ControlData['tree'];
  hazard: ControlData['pending'][number];
}) {
  const [answers, setAnswers] = useState<Record<string, TreeAnswer>>({});
  const [state, formAction] = useActionState<FormState | null, FormData>(
    saveAssessmentAction,
    null,
  );
  const answerList: AnswerRecord[] = Object.entries(answers).map(([questionId, answer]) => ({
    questionId,
    answer,
  }));
  const res = resolveClassification(tree, answerList);
  const visibleIds = [...res.path.map((p) => p.questionId)];
  if (res.nextQuestionId) visibleIds.push(res.nextQuestionId);
  const byId = new Map(tree.questions.map((q) => [q.id, q]));

  return (
    <form action={formAction} className="wf-form haccp-wizard">
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="planVersionId" value={versionId} />
      <input type="hidden" name="hazardLogicalId" value={hazard.hazardLogicalId} />
      {Object.entries(answers).map(([qid, ans]) => (
        <input key={qid} type="hidden" name={`answer_${qid}`} value={ans} />
      ))}
      {visibleIds.map((qid, i) => {
        const q = byId.get(qid);
        if (!q) return null;
        return (
          <div key={qid} className="haccp-wizard__q">
            <p className="haccp-wizard__progress">
              Pregunta {i + 1} de {tree.questions.length}
            </p>
            <p>
              <strong>{q.text}</strong>
            </p>
            {q.help && <p className="muted">{q.help}</p>}
            <div className="haccp-wizard__answers">
              {(['yes', 'no', ...(q.answers.na ? (['na'] as const) : [])] as TreeAnswer[]).map(
                (a) => (
                  <label key={a} className="props-check">
                    <input
                      type="radio"
                      name={`ui_${qid}`}
                      checked={answers[qid] === a}
                      onChange={() => setAnswers((prev) => ({ ...prev, [qid]: a }))}
                    />{' '}
                    {ANSWER_LABEL[a]}
                  </label>
                ),
              )}
            </div>
          </div>
        );
      })}

      {res.classification && (
        <div className="haccp-wizard__result">
          <p>
            Clasificación resultante:{' '}
            <span className={`badge badge--class-${res.classification}`}>
              {classificationLabel(res.classification)}
            </span>
          </p>
          <label>
            Justificación / explicación
            <input name="justification" />
          </label>
          {/* §9: override manual de la clasificación (opcional, con justificación). */}
          <label>
            Ajustar clasificación (opcional)
            <select name="overrideClassification" defaultValue="">
              <option value="">— Usar la clasificación calculada —</option>
              <option value="pcc">PCC</option>
              <option value="ppro">PPRO</option>
              <option value="ppr">PPR</option>
              <option value="other">Otro</option>
            </select>
          </label>
          <label>
            Justificación del override
            <input name="overrideReason" />
          </label>
          <SubmitButton variant="primary" pendingLabel="Guardando…">
            Guardar evaluación
          </SubmitButton>
          <Status state={state} />
        </div>
      )}
    </form>
  );
}

function PlanEditor({ planId, assessment }: { planId: string; assessment: AssessmentView }) {
  const p = assessment.plan;
  const cls = assessment.classification;
  return (
    <details>
      <summary className="button button--ghost">
        {assessment.planComplete ? 'Editar plan de control' : 'Completar plan de control'}
      </summary>
      <ActionForm
        action={saveControlPlanAction}
        hidden={{ planId, assessmentId: assessment.id }}
        button="Guardar plan"
        variant="primary"
      >
        <label>
          Medida de control
          <input name="controlMeasure" defaultValue={p?.controlMeasure ?? ''} />
        </label>
        {cls === 'pcc' && (
          <label>
            Límite crítico
            <input name="criticalLimit" defaultValue={p?.criticalLimit ?? ''} />
          </label>
        )}
        {cls === 'ppro' && (
          <label>
            Criterio de acción
            <input name="actionCriterion" defaultValue={p?.actionCriterion ?? ''} />
          </label>
        )}
        {(cls === 'pcc' || cls === 'ppro') && (
          <>
            <label>
              Monitoreo — Qué
              <input name="monitoringWhat" defaultValue={p?.monitoringWhat ?? ''} />
            </label>
            <label>
              Monitoreo — Cómo
              <input name="monitoringHow" defaultValue={p?.monitoringHow ?? ''} />
            </label>
            <label>
              Monitoreo — Quién
              <input name="monitoringWho" defaultValue={p?.monitoringWho ?? ''} />
            </label>
            <label>
              Monitoreo — Cuándo
              <input name="monitoringWhen" defaultValue={p?.monitoringWhen ?? ''} />
            </label>
            <label>
              Corrección
              <input name="correction" defaultValue={p?.correction ?? ''} />
            </label>
            <label>
              Acción correctiva
              <input name="correctiveAction" defaultValue={p?.correctiveAction ?? ''} />
            </label>
          </>
        )}
        <label>
          Registro relacionado (documento/programa)
          <input name="recordReference" defaultValue={p?.recordReference ?? ''} />
        </label>
      </ActionForm>
    </details>
  );
}

export function HaccpControlTab({
  planId,
  data,
  canEdit,
}: {
  planId: string;
  data: ControlData;
  canEdit: boolean;
}) {
  const [sub, setSub] = useState<Sub>('pendientes');
  const editable = canEdit && data.version.editable;
  const c = data.completeness;
  const byClass: Record<string, AssessmentView[]> = {
    evaluados: data.assessments,
    pcc: data.pcc,
    ppro: data.ppro,
    ppr: data.ppr,
  };

  return (
    <>
      <section className="haccp-cards">
        <div className="report-card">
          <h3>Significativos</h3>
          <p className="stat">{c.significant}</p>
        </div>
        <div className="report-card">
          <h3>Evaluados</h3>
          <p className="stat">{c.evaluated}</p>
        </div>
        <div className="report-card">
          <h3>Pendientes</h3>
          <p className="stat">{c.pending}</p>
        </div>
        <div className="report-card">
          <h3>PCC / PPRO / PPR</h3>
          <p className="stat">
            {c.pcc}/{c.ppro}/{c.ppr}
          </p>
        </div>
      </section>
      {c.incompletePlans > 0 && (
        <p className="msg msg--info">{c.incompletePlans} plan(es) de control incompleto(s).</p>
      )}

      <div className="doc-panel__tablist" role="tablist" aria-label="Medidas de control">
        {(['pendientes', 'evaluados', 'pcc', 'ppro', 'ppr'] as Sub[]).map((sName) => (
          <button
            key={sName}
            type="button"
            role="tab"
            aria-selected={sub === sName}
            className={`doc-panel__tab${sub === sName ? ' is-active' : ''}`}
            onClick={() => setSub(sName)}
          >
            {sName === 'pendientes'
              ? 'Pendientes'
              : sName === 'evaluados'
                ? 'Evaluados'
                : sName.toUpperCase()}
          </button>
        ))}
      </div>

      {sub === 'pendientes' && (
        <>
          {data.pending.length === 0 ? (
            <p className="empty-state empty-state--compact">
              No hay peligros significativos pendientes de evaluación.
            </p>
          ) : (
            data.pending.map((h) => (
              <div key={h.hazardLogicalId} className="haccp-pending">
                <p>
                  <strong>{h.name}</strong> · {hazardTypeLabel(h.hazardType)} · {h.sourceLabel} ·
                  riesgo {h.riskScore}
                </p>
                {h.existingControlMeasure && (
                  <p className="muted">Medida existente: {h.existingControlMeasure}</p>
                )}
                {editable ? (
                  <details>
                    <summary className="button button--ghost">Evaluar medida de control</summary>
                    <HazardWizard
                      planId={planId}
                      versionId={data.version.id}
                      tree={data.tree}
                      hazard={h}
                    />
                  </details>
                ) : (
                  <span className="badge badge--warn">Pendiente</span>
                )}
              </div>
            ))
          )}
        </>
      )}

      {sub !== 'pendientes' && (
        <>
          <HaccpControlMeasuresView
            assessments={byClass[sub] ?? []}
            emptyLabel="Sin evaluaciones en esta categoría."
          />
          {editable &&
            (byClass[sub] ?? []).map((a) => (
              <div key={a.id} className="haccp-control-actions">
                <PlanEditor planId={planId} assessment={a} />
                <ActionForm
                  action={removeAssessmentAction}
                  hidden={{ planId, assessmentId: a.id }}
                  button="Eliminar evaluación"
                />
              </div>
            ))}
        </>
      )}
    </>
  );
}
