import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { AuditNotFoundError, getAuditDetail, getExecutionData } from '@/server/audits';
import { PrintButton } from '../../../capa/[capaId]/analysis/_components/PrintButton';
import {
  AuditStatusBadge,
  FindingClassBadge,
  auditTypeLabel,
  severityLabel,
} from '../../_components/AuditBits';
import { CHECKLIST_RESULT_LABEL, type ChecklistResult } from '@/features/audits/checklist';

export default async function AuditReportPage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}) {
  const session = await requireServerSession();
  const { auditId } = await params;
  let detail;
  try {
    detail = await getAuditDetail(session.organizationId, auditId);
  } catch (error) {
    if (error instanceof AuditNotFoundError) notFound();
    throw error;
  }
  const exec = await getExecutionData(session.organizationId, auditId);
  const a = detail.audit;
  const s = detail.summary;

  return (
    <main className="container analysis-detail">
      <p className="no-print">
        <Link href={`/dashboard/audits/${a.id}`}>← Volver a la auditoría</Link>
      </p>

      <header className="report-head">
        <div className="report-head__main">
          <h1>Informe de auditoría</h1>
          <span className="report-head__meta">
            {a.folio} · {auditTypeLabel(a.auditType)} · {a.normVersionLabel ?? 'sin norma'}
          </span>
        </div>
        <div className="report-head__actions no-print">
          <PrintButton />
        </div>
      </header>

      <dl className="report-meta">
        <div>
          <dt>Auditoría</dt>
          <dd>{a.title}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            <AuditStatusBadge status={a.status} />
          </dd>
        </div>
        <div>
          <dt>Sitio</dt>
          <dd>{a.siteName ?? '—'}</dd>
        </div>
        <div>
          <dt>Auditor líder</dt>
          <dd>{a.leadAuditorName ?? '—'}</dd>
        </div>
        <div>
          <dt>Fechas</dt>
          <dd>
            {a.startedAt ?? a.plannedDate ?? '—'} → {a.endedAt ?? '—'}
          </dd>
        </div>
      </dl>

      <section className="report-card">
        <h2>Objetivo, alcance y criterios</h2>
        <p>
          <strong>Objetivo:</strong> {a.objective ?? '—'}
        </p>
        <p>
          <strong>Alcance:</strong> {a.scope ?? '—'}
        </p>
        <p>
          <strong>Criterios:</strong> {a.criteria ?? '—'}
        </p>
      </section>

      <section className="report-card">
        <h2>Resumen de resultados</h2>
        <ul className="gaps">
          <li>Requisitos totales: {s.total}</li>
          <li>Conformes: {s.byResult.conforme}</li>
          <li>Parciales: {s.byResult.parcial}</li>
          <li>No conformes: {s.byResult.no_conforme}</li>
          <li>No aplica: {s.byResult.no_aplica}</li>
          <li>Evidencia insuficiente: {s.byResult.evidencia_insuficiente}</li>
        </ul>
      </section>

      <section className="report-card">
        <h2>Requisitos evaluados</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Sección</th>
                <th>Requisito</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {exec.rows.map((r) => (
                <tr key={r.snapshotId}>
                  <td>{r.sequence}</td>
                  <td>{r.sectionCode ?? '—'}</td>
                  <td>
                    {r.requirementCode} · {r.requirementTitle}
                  </td>
                  <td>{CHECKLIST_RESULT_LABEL[r.result as ChecklistResult] ?? r.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="report-card">
        <h2>Hallazgos</h2>
        {detail.findings.length === 0 ? (
          <p className="empty-state">Sin hallazgos.</p>
        ) : (
          <ul className="gaps">
            {detail.findings.map((f) => (
              <li key={f.id}>
                {f.folio} · <FindingClassBadge classification={f.classification} /> {f.title} (
                {severityLabel(f.severity)})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="report-card">
        <h2>Conclusión del auditor</h2>
        <p>{a.conclusion ?? a.executiveSummary ?? 'Pendiente de redacción.'}</p>
        <p className="muted small">
          Sentinel documenta y organiza la auditoría. La decisión final y cualquier dictamen de
          certificación corresponden al auditor o responsable autorizado.
        </p>
      </section>
    </main>
  );
}
