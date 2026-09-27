/**
 * HACCP-006 — vista READ-ONLY reutilizable del programa de verificación (workspace + futuro PDF
 * HACCP-007, §48). Print-safe, sin estado. Muestra las definiciones con su alcance/contexto de
 * control y las ejecuciones con su resultado técnico.
 */
import {
  verificationScopeLabel,
  verificationFrequencyLabel,
  verificationDefStatusLabel,
  verificationResultLabel,
  recordStrategyLabel,
} from '@/features/haccp/haccp-verification';

export interface VerificationDefinitionView {
  id: string;
  scopeType: string;
  title: string;
  purpose: string | null;
  method: string | null;
  status: string;
  frequencyType: string;
  responsibleName: string | null;
  recordStrategy: string;
  controlContext: {
    classificationLabel: string;
    hazardName: string;
    criticalLimit: string | null;
    actionCriterion: string | null;
    needsReview: boolean;
  } | null;
}
export interface VerificationOccurrenceView {
  id: string;
  title: string;
  dueAtLabel: string | null;
  responsibleName: string | null;
  result: string | null;
  conclusion: string | null;
  completedAtLabel: string | null;
  overdue: boolean;
}

const field = (label: string, value: string | null | undefined) =>
  value && value.trim() ? (
    <div className="doc-report__field">
      <span className="doc-report__field-label">{label}</span>
      <p>{value}</p>
    </div>
  ) : null;

export function HaccpVerificationView({
  definitions,
  occurrences,
}: {
  definitions: VerificationDefinitionView[];
  occurrences: VerificationOccurrenceView[];
}) {
  if (definitions.length === 0) {
    return <p className="empty-state empty-state--compact">Sin definiciones de verificación.</p>;
  }
  return (
    <div className="haccp-verifications">
      {definitions.map((d) => {
        const occ = occurrences.filter((o) => o.title === d.title);
        return (
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
            <div className="haccp-plan-fields">
              {field('Propósito', d.purpose)}
              {field('Método', d.method)}
              {field('Responsable', d.responsibleName)}
              {field('Formato', recordStrategyLabel(d.recordStrategy))}
              {d.controlContext && field('Peligro', d.controlContext.hazardName)}
              {d.controlContext && field('Clasificación', d.controlContext.classificationLabel)}
              {d.controlContext && field('Límite crítico', d.controlContext.criticalLimit)}
              {d.controlContext && field('Criterio de acción', d.controlContext.actionCriterion)}
            </div>
            {occ.length > 0 && (
              <div className="haccp-verif-occ">
                <h4>Ejecuciones</h4>
                <ul>
                  {occ.map((o) => (
                    <li key={o.id}>
                      {o.dueAtLabel ?? '—'} · {o.responsibleName ?? 'Sin responsable'}
                      {o.result ? (
                        <span className="badge">
                          {' '}
                          Resultado: {verificationResultLabel(o.result)}
                        </span>
                      ) : o.overdue ? (
                        <span className="badge badge--warn"> Vencida</span>
                      ) : (
                        <span className="badge"> Próxima</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
