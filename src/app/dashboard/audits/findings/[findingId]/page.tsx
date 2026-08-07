import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { FindingNotFoundError, getFindingDetail } from '@/server/audit-findings';
import { getAuditPerms } from '@/server/audits';
import { PageHeader, SectionCard } from '../../../_components/ui';
import { FindingClassBadge, FindingStatusBadge, severityLabel } from '../../_components/AuditBits';
import { AuditActionForm } from '../../_components/AuditActionForm';
import {
  addFollowUpAction,
  convertFindingToCapaAction,
  createFindingTaskAction,
  transitionFindingAction,
} from '../../actions';

const dt = (d: Date) => new Date(d).toLocaleString('es-MX');

export default async function FindingDetailPage({
  params,
}: {
  params: Promise<{ findingId: string }>;
}) {
  const session = await requireServerSession();
  const { findingId } = await params;
  let detail;
  try {
    detail = await getFindingDetail(session.organizationId, findingId);
  } catch (error) {
    if (error instanceof FindingNotFoundError) notFound();
    throw error;
  }
  const ctx = await getAuditPerms(session.organizationId, session.userId);
  const f = detail.finding;

  return (
    <main className="container">
      <p>
        {detail.audit ? (
          <Link href={`/dashboard/audits/${detail.audit.id}?tab=hallazgos`}>
            ← Volver a la auditoría
          </Link>
        ) : (
          <Link href="/dashboard/audits">← Volver a auditorías</Link>
        )}
      </p>
      <PageHeader
        title={f.title}
        subtitle={`${f.folio}${detail.audit ? ` · ${detail.audit.folio}` : ''}`}
      />

      <dl className="meta-grid">
        <div>
          <dt>Estado</dt>
          <dd>
            <FindingStatusBadge status={f.status} />
          </dd>
        </div>
        <div>
          <dt>Clasificación</dt>
          <dd>
            <FindingClassBadge classification={f.classification} />
          </dd>
        </div>
        <div>
          <dt>Severidad</dt>
          <dd>{severityLabel(f.severity)}</dd>
        </div>
        <div>
          <dt>Responsable</dt>
          <dd>{f.responsibleName ?? '—'}</dd>
        </div>
        <div>
          <dt>Compromiso</dt>
          <dd>{f.committedDate ?? '—'}</dd>
        </div>
      </dl>

      <SectionCard title="Requisito → Evidencia objetiva → Brecha">
        <ul className="dep-list">
          <li>
            <strong>Requisito incumplido:</strong> {f.requirementBreached ?? '—'}
          </li>
          <li>
            <strong>Evidencia objetiva:</strong> {f.objectiveEvidence ?? '—'}
          </li>
          <li>
            <strong>Brecha:</strong> {f.description ?? '—'}
          </li>
          {f.immediateCorrection && (
            <li>
              <strong>Corrección inmediata:</strong> {f.immediateCorrection}
            </li>
          )}
        </ul>
      </SectionCard>

      <div className="two-col">
        <div>
          <SectionCard title="Acciones">
            <div className="wf-panel">
              {!f.capaId && ctx.canCreate && !f.readOnly && (
                <AuditActionForm
                  action={convertFindingToCapaAction}
                  hidden={{ findingId: f.id }}
                  button="Crear CAPA"
                  variant="primary"
                />
              )}
              {f.capaId && (
                <Link className="button button--ghost" href={`/dashboard/capa/${f.capaId}`}>
                  Abrir CAPA vinculada ↗
                </Link>
              )}
              {ctx.canCreate && !f.readOnly && (
                <AuditActionForm
                  action={createFindingTaskAction}
                  hidden={{ findingId: f.id }}
                  button="Crear tarea de seguimiento"
                />
              )}
              {ctx.canCreate && !f.readOnly && f.status !== 'closed' && (
                <AuditActionForm
                  action={transitionFindingAction}
                  hidden={{ findingId: f.id, to: 'closed' }}
                  button="Cerrar hallazgo"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard title="Trazabilidad">
            {detail.relations.length === 0 ? (
              <p className="empty-state">Sin relaciones.</p>
            ) : (
              <ul className="rel-list">
                {detail.relations.map((r) => (
                  <li key={r.id}>
                    <span className="badge badge--soft">{r.relationType}</span>{' '}
                    {r.href ? (
                      <Link href={r.href}>abrir ↗</Link>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div>
          <SectionCard title="Seguimiento">
            {detail.followUps.length === 0 ? (
              <p className="empty-state">Sin seguimiento registrado.</p>
            ) : (
              <ul className="history">
                {detail.followUps.map((x) => (
                  <li key={x.id}>
                    <span className="muted">{dt(x.createdAt)}</span> ·{' '}
                    <FindingStatusBadge status={x.status} /> {x.correction ?? ''}{' '}
                    {x.result ? `· ${x.result}` : ''}
                    {x.verifierName ? ` · verificó ${x.verifierName}` : ''}
                  </li>
                ))}
              </ul>
            )}
            {ctx.canCreate && !f.readOnly && (
              <AuditActionForm
                action={addFollowUpAction}
                hidden={{ findingId: f.id }}
                button="Registrar seguimiento"
              >
                <label className="field">
                  <span className="field__label">Corrección</span>
                  <input name="correction" />
                </label>
                <label className="field">
                  <span className="field__label">Estado</span>
                  <select name="status" defaultValue="correction_in_progress">
                    <option value="correction_in_progress">Corrección en proceso</option>
                    <option value="pending_verification">Pendiente de verificación</option>
                    <option value="effective">Eficaz</option>
                    <option value="not_effective">No eficaz</option>
                  </select>
                </label>
              </AuditActionForm>
            )}
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
