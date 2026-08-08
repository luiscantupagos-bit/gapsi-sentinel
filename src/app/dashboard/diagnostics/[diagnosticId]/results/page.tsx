import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { DiagnosticNotFoundError, getPreviewResult } from '@/server/diagnostics';
import { DIAGNOSTIC_RISK_LABEL } from '@/features/diagnostics/state';
import { PageHeader, StatCard } from '../../../_components/ui';

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

  const riskTone =
    result.riskLevel === 'low'
      ? 'success'
      : result.riskLevel === 'critical' || result.riskLevel === 'high'
        ? 'danger'
        : 'warning';

  return (
    <main className="container">
      <p>
        <Link href={`/dashboard/diagnostics/${diagnosticId}`}>← Volver al diagnóstico</Link>
      </p>

      <PageHeader title="Resultado de evaluación" subtitle={result.diagnosticName} />

      <div className="statcard-row">
        <StatCard label="Cumplimiento" value={`${result.percentage}%`} />
        <StatCard
          label="Nivel de riesgo"
          value={DIAGNOSTIC_RISK_LABEL[result.riskLevel] ?? result.riskLevel}
          tone={riskTone}
        />
        <StatCard
          label="Críticos incumplidos"
          value={result.criticalUnmet}
          tone={result.criticalUnmet > 0 ? 'danger' : 'success'}
        />
      </div>

      <div className="statcard-row">
        <StatCard label="Conformes" value={result.conforming} tone="success" />
        <StatCard
          label="No conformes"
          value={result.nonConforming}
          tone={result.nonConforming > 0 ? 'danger' : 'default'}
        />
        <StatCard label="No aplica" value={result.notApplicable} />
      </div>

      <p className="muted">
        Escala de riesgo: Bajo 90–100% · Moderado 75–89.99% · Alto 50–74.99% · Crítico &lt;50%. Un
        crítico incumplido sitúa el riesgo en Alto como mínimo. Este resultado orienta la mejora; no
        constituye una certificación.
      </p>

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

      <h2>Brechas priorizadas</h2>
      {result.gaps.length === 0 ? (
        <p className="empty-state">Sin brechas registradas.</p>
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
