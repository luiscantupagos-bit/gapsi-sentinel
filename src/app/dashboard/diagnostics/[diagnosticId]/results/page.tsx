import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { DiagnosticNotFoundError, getPreviewResult } from '@/server/diagnostics';

const RISK_LABEL: Record<string, string> = {
  low: 'Bajo',
  moderate: 'Moderado',
  high: 'Alto',
  critical: 'Crítico',
};

export default async function DiagnosticResultsPage({
  params,
}: {
  params: Promise<{ diagnosticId: string }>;
}) {
  const session = await requireServerSession();
  const { diagnosticId } = await params;

  let result;
  try {
    result = await getPreviewResult(session.organizationId, diagnosticId);
  } catch (error) {
    if (error instanceof DiagnosticNotFoundError) notFound();
    throw error;
  }

  return (
    <main className="container">
      <p>
        <Link href={`/dashboard/diagnostics/${diagnosticId}`}>← Volver al diagnóstico</Link>
      </p>

      <h1>{result.diagnosticName}</h1>
      <p className="banner banner--provisional" role="note">
        <strong>Resultado preliminar de demostración.</strong> Reglas de cálculo provisionales; no
        es el motor de puntuación definitivo.
      </p>

      <div className="stat-row">
        <div className="stat">
          <span className="stat__label">Cumplimiento preliminar</span>
          <span className="stat__value">{result.percentage}%</span>
        </div>
        <div className="stat">
          <span className="stat__label">Riesgo preliminar</span>
          <span className={`stat__value badge badge--risk-${result.riskLevel}`}>
            {RISK_LABEL[result.riskLevel] ?? result.riskLevel}
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Críticos incumplidos</span>
          <span className="stat__value">{result.criticalUnmet}</span>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat stat--sm">
          <span className="stat__label">Conformes</span>
          <span className="stat__value">{result.conforming}</span>
        </div>
        <div className="stat stat--sm">
          <span className="stat__label">No conformes</span>
          <span className="stat__value">{result.nonConforming}</span>
        </div>
        <div className="stat stat--sm">
          <span className="stat__label">No aplica</span>
          <span className="stat__value">{result.notApplicable}</span>
        </div>
      </div>

      <h2>Resumen por sección</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sección</th>
              <th>Cumplimiento</th>
              <th>Puntuables</th>
              <th>Excluidas</th>
            </tr>
          </thead>
          <tbody>
            {result.sections.map((s) => (
              <tr key={s.sectionId}>
                <td>
                  {s.code} · {s.title}
                </td>
                <td>{s.percentage}%</td>
                <td>{s.applicableScored}</td>
                <td>{s.excluded}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Brechas</h2>
      {result.gaps.length === 0 ? (
        <p className="empty-state">Sin brechas registradas por las reglas preliminares.</p>
      ) : (
        <ul className="gaps">
          {result.gaps.map((g) => (
            <li key={`${g.sectionCode}-${g.questionCode}`}>
              <span className="muted">
                {g.sectionCode} · {g.requirementCode} · {g.questionCode}
              </span>{' '}
              {g.isCritical && <span className="badge badge--critical">Crítica</span>} — puntuación{' '}
              {g.scoreFraction}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
