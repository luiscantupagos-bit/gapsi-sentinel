import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getPreparationMatrix, listPreparableAudits } from '@/server/audit-preparation';
import { PageHeader, SectionCard, StatCard } from '../../_components/ui';
import { PrepStateBadge, ResultBadge } from '../_components/AuditBits';

export default async function PreparationPage({
  searchParams,
}: {
  searchParams: Promise<{ auditId?: string }>;
}) {
  const session = await requireServerSession();
  const sp = await searchParams;
  const audits = await listPreparableAudits(session.organizationId);
  const selected = sp.auditId || audits[0]?.id;
  const matrix = selected
    ? await getPreparationMatrix(session.organizationId, selected).catch(() => null)
    : null;

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/audits">← Volver a auditorías</Link>
      </p>
      <PageHeader
        title="Preparación para auditoría"
        subtitle="Índice OPERATIVO de preparación (no es cumplimiento certificado). Muestra solo datos reales."
      />

      {audits.length === 0 ? (
        <p className="empty-state">
          Genera el checklist de una auditoría para evaluar su preparación.
        </p>
      ) : (
        <>
          <nav className="tabs" aria-label="Auditoría a evaluar">
            {audits.map((a) => (
              <Link
                key={a.id}
                href={`/dashboard/audits/preparation?auditId=${a.id}`}
                className={`tab${a.id === selected ? ' is-active' : ''}`}
              >
                {a.folio}
              </Link>
            ))}
          </nav>

          {matrix && (
            <>
              <div className="statcard-row">
                <StatCard label="Índice de preparación" value={`${matrix.index.indexPct}%`} />
                <StatCard
                  label="Sin evidencia"
                  value={matrix.gaps.withoutEvidence}
                  tone={matrix.gaps.withoutEvidence > 0 ? 'danger' : 'default'}
                />
                <StatCard
                  label="Requiere revisión"
                  value={matrix.gaps.needsReview}
                  tone={matrix.gaps.needsReview > 0 ? 'warning' : 'default'}
                />
                <StatCard
                  label="Hallazgos abiertos"
                  value={matrix.gaps.openFindings}
                  tone={matrix.gaps.openFindings > 0 ? 'warning' : 'default'}
                />
                <StatCard
                  label="Críticos no preparados"
                  value={matrix.gaps.critical}
                  tone={matrix.gaps.critical > 0 ? 'danger' : 'default'}
                />
              </div>

              <SectionCard
                title={`Matriz requisito–evidencia · ${matrix.audit.normVersionLabel ?? matrix.audit.folio}`}
              >
                <p className="muted small">
                  Fórmula documentada: índice = Σ peso(estado) / requisitos aplicables (excluye “No
                  aplica”). preparado=1 · parcial/requiere_revisión=0.5 · evidencia_vencida=0.25 ·
                  sin_evidencia=0.
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Sección</th>
                        <th>Requisito</th>
                        <th>Evidencia</th>
                        <th>Resultado</th>
                        <th>Hallazgos</th>
                        <th>Preparación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.rows.map((r) => (
                        <tr key={r.snapshotId}>
                          <td>{r.sectionCode ?? '—'}</td>
                          <td>
                            <span className="mono">{r.requirementCode}</span> {r.requirementTitle}
                            {r.isCritical && (
                              <span className="badge badge--warning small"> crítico</span>
                            )}
                          </td>
                          <td>{r.evidenceCount}</td>
                          <td>
                            <ResultBadge result={r.result} />
                          </td>
                          <td>{r.openFindings > 0 ? r.openFindings : '—'}</td>
                          <td>
                            <PrepStateBadge state={r.state} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </>
          )}
        </>
      )}
    </main>
  );
}
