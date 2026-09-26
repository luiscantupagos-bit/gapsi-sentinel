/**
 * HACCP-005 — vista read-only reutilizable del detalle de validación (workspace + futuro PDF
 * HACCP-007). Print-safe. Muestra estado, resultado y todos los campos de la validación, con el
 * contexto del control (peligro, clasificación, medida, límite/criterio).
 */
import Link from 'next/link';

export interface ValidationView {
  id: string;
  hazardName: string;
  classification: string;
  classificationLabel: string;
  sourceLabel: string;
  controlMeasure: string | null;
  criticalLimit: string | null;
  actionCriterion: string | null;
  status: string;
  statusLabel: string;
  result: string | null;
  resultLabel: string;
  objective: string | null;
  scope: string | null;
  methodType: string | null;
  methodLabel: string;
  methodDescription: string | null;
  evidenceSummary: string | null;
  technicalBasis: string | null;
  acceptanceCriteria: string | null;
  conclusion: string | null;
  evidenceDocumentId: string | null;
  performedAtLabel: string | null;
  performedByName: string | null;
  reviewedByName: string | null;
  nextValidationAtLabel: string | null;
  needsReview: boolean;
}

const field = (label: string, value: string | null | undefined) =>
  value && value.trim() ? (
    <div className="doc-report__field">
      <span className="doc-report__field-label">{label}</span>
      <p>{value}</p>
    </div>
  ) : null;

export function HaccpValidationView({
  validations,
  emptyLabel,
}: {
  validations: ValidationView[];
  emptyLabel: string;
}) {
  if (validations.length === 0) {
    return <p className="empty-state empty-state--compact">{emptyLabel}</p>;
  }
  return (
    <div className="haccp-validations">
      {validations.map((v) => (
        <section key={v.id} className="haccp-control-card">
          <header className="haccp-control-card__head">
            <strong>{v.hazardName}</strong>
            <span className={`badge badge--class-${v.classification}`}>
              {v.classificationLabel}
            </span>
            <span className="muted"> · {v.sourceLabel}</span>
            <span className={`badge badge--valstatus-${v.status}`}>{v.statusLabel}</span>
            {v.result && <span className="badge">Resultado: {v.resultLabel}</span>}
            {v.needsReview && <span className="badge badge--warn">Revisión requerida</span>}
          </header>
          <div className="haccp-plan-fields">
            {field('Medida de control', v.controlMeasure)}
            {v.classification === 'pcc' && field('Límite crítico', v.criticalLimit)}
            {v.classification === 'ppro' && field('Criterio de acción', v.actionCriterion)}
            {field('Objetivo de validación', v.objective)}
            {field('Alcance', v.scope)}
            {field('Método', [v.methodLabel, v.methodDescription].filter(Boolean).join(' — '))}
            {field('Fundamento técnico', v.technicalBasis)}
            {field('Criterio de aceptación', v.acceptanceCriteria)}
            {field('Evidencia', v.evidenceSummary)}
            {v.evidenceDocumentId && (
              <div className="doc-report__field">
                <span className="doc-report__field-label">Documento de evidencia</span>
                <p>
                  <Link href={`/dashboard/documents/${v.evidenceDocumentId}`}>Ver documento</Link>
                </p>
              </div>
            )}
            {field('Conclusión', v.conclusion)}
            {field('Realizado por', v.performedByName)}
            {field('Fecha', v.performedAtLabel)}
            {field('Revisado por', v.reviewedByName)}
            {field('Próxima validación', v.nextValidationAtLabel)}
          </div>
        </section>
      ))}
    </div>
  );
}
