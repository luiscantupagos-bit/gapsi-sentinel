/**
 * HACCP-004 — vista read-only reutilizable de las medidas de control (workspace y futuro PDF
 * HACCP-007). Muestra por evaluación: peligro, clasificación, camino de auditoría (respuestas)
 * y el plan de control con los campos según la clasificación (PCC: límite crítico; PPRO: criterio
 * de acción; PPR: medida/registro). Print-safe.
 */
import { ANSWER_LABEL, classificationLabel, type TreeAnswer } from '@/features/haccp/haccp-control';
import { hazardTypeLabel } from '@/features/haccp/haccp-hazards';

export interface AssessmentPathItem {
  questionId: string;
  questionText: string;
  answer: string;
}
export interface ControlPlanView {
  controlMeasure?: string | null;
  criticalLimit?: string | null;
  actionCriterion?: string | null;
  monitoringWhat?: string | null;
  monitoringHow?: string | null;
  monitoringWho?: string | null;
  monitoringWhen?: string | null;
  correction?: string | null;
  correctiveAction?: string | null;
  recordReference?: string | null;
}
export interface AssessmentView {
  id: string;
  hazardName: string;
  hazardType: string | null;
  sourceLabel: string;
  classification: string;
  classificationLabel: string;
  path: AssessmentPathItem[];
  needsReview: boolean;
  plan: ControlPlanView | null;
  planComplete: boolean;
}

const field = (label: string, value: string | null | undefined) =>
  value && value.trim() ? (
    <div className="doc-report__field">
      <span className="doc-report__field-label">{label}</span>
      <p>{value}</p>
    </div>
  ) : null;

function PlanFields({ classification, plan }: { classification: string; plan: ControlPlanView }) {
  return (
    <div className="haccp-plan-fields">
      {field('Medida de control', plan.controlMeasure)}
      {classification === 'pcc' && field('Límite crítico', plan.criticalLimit)}
      {classification === 'ppro' && field('Criterio de acción', plan.actionCriterion)}
      {(classification === 'pcc' || classification === 'ppro') && (
        <>
          {field('Monitoreo — Qué', plan.monitoringWhat)}
          {field('Monitoreo — Cómo', plan.monitoringHow)}
          {field('Monitoreo — Quién', plan.monitoringWho)}
          {field('Monitoreo — Cuándo', plan.monitoringWhen)}
          {field('Corrección', plan.correction)}
          {field('Acción correctiva', plan.correctiveAction)}
        </>
      )}
      {field('Registro relacionado', plan.recordReference)}
      {/* §36: placeholder de registro operativo (DOC-004 futuro). */}
      {(classification === 'pcc' || classification === 'ppro') &&
        !(plan.recordReference && plan.recordReference.trim()) && (
          <p className="muted">Registro de monitoreo: No configurado</p>
        )}
    </div>
  );
}

export function HaccpControlMeasuresView({
  assessments,
  emptyLabel,
}: {
  assessments: AssessmentView[];
  emptyLabel: string;
}) {
  if (assessments.length === 0) {
    return <p className="empty-state empty-state--compact">{emptyLabel}</p>;
  }
  return (
    <div className="haccp-controls">
      {assessments.map((a) => (
        <section key={a.id} className="haccp-control-card">
          <header className="haccp-control-card__head">
            <strong>{a.hazardName}</strong>
            {a.hazardType && <span className="muted"> · {hazardTypeLabel(a.hazardType)}</span>}
            <span className="muted"> · {a.sourceLabel}</span>
            <span className={`badge badge--class-${a.classification}`}>
              {classificationLabel(a.classification)}
            </span>
            {a.needsReview && <span className="badge badge--warn">Revisión requerida</span>}
            {!a.planComplete && <span className="badge badge--warn">Plan incompleto</span>}
          </header>
          {/* §21 explicabilidad: camino de respuestas del árbol. */}
          {a.path.length > 0 && (
            <p className="muted haccp-control-card__path">
              {a.path
                .map((p) => `${p.questionId} ${ANSWER_LABEL[p.answer as TreeAnswer] ?? p.answer}`)
                .join(' · ')}
            </p>
          )}
          {a.plan ? (
            <PlanFields classification={a.classification} plan={a.plan} />
          ) : (
            <p className="empty-state empty-state--compact">
              Plan de control pendiente de configurar.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
