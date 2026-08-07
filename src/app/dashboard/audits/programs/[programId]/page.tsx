import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { ProgramNotFoundError, getProgramDetail } from '@/server/audit-programs';
import { getAuditPerms } from '@/server/audits';
import { PROGRAM_FREQUENCY_LABEL, type ProgramFrequency } from '@/features/audits/program-state';
import { PageHeader, SectionCard } from '../../../_components/ui';
import { AuditStatusBadge, ProgramStatusBadge, auditTypeLabel } from '../../_components/AuditBits';
import { AuditActionForm } from '../../_components/AuditActionForm';
import { addProgramItemAction, transitionProgramAction } from '../../actions';

const NEXT: Record<string, { to: string; label: string; reason?: boolean }[]> = {
  draft: [
    { to: 'approved', label: 'Aprobar' },
    { to: 'cancelled', label: 'Cancelar', reason: true },
  ],
  approved: [
    { to: 'active', label: 'Activar' },
    { to: 'cancelled', label: 'Cancelar', reason: true },
  ],
  active: [
    { to: 'completed', label: 'Completar' },
    { to: 'cancelled', label: 'Cancelar', reason: true },
  ],
  completed: [],
  cancelled: [],
};

const dt = (d: Date) => new Date(d).toLocaleString('es-MX');

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const session = await requireServerSession();
  const { programId } = await params;
  let detail;
  try {
    detail = await getProgramDetail(session.organizationId, programId);
  } catch (error) {
    if (error instanceof ProgramNotFoundError) notFound();
    throw error;
  }
  const ctx = await getAuditPerms(session.organizationId, session.userId);
  const p = detail.program;

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/audits/programs">← Volver a programas</Link>
      </p>
      <PageHeader
        title={p.name}
        subtitle={`${p.folio} · ${p.year}`}
        actions={
          ctx.canCreate ? (
            <Link
              className="button button--primary"
              href={`/dashboard/audits/new?programId=${p.id}`}
            >
              Nueva auditoría
            </Link>
          ) : undefined
        }
      />

      <dl className="meta-grid">
        <div>
          <dt>Estado</dt>
          <dd>
            <ProgramStatusBadge status={p.status} />
          </dd>
        </div>
        <div>
          <dt>Frecuencia</dt>
          <dd>{PROGRAM_FREQUENCY_LABEL[p.frequency as ProgramFrequency] ?? p.frequency}</dd>
        </div>
        <div>
          <dt>Responsable</dt>
          <dd>{p.responsibleName ?? '—'}</dd>
        </div>
        <div>
          <dt>Sitio</dt>
          <dd>{p.siteName ?? 'Todos'}</dd>
        </div>
      </dl>
      {p.objective && (
        <p>
          <strong>Objetivo:</strong> {p.objective}
        </p>
      )}
      {p.scope && (
        <p className="muted">
          <strong>Alcance:</strong> {p.scope}
        </p>
      )}

      <div className="two-col">
        <div>
          {ctx.isAdmin && !p.readOnly && (
            <SectionCard title="Estado del programa">
              <div className="wf-panel">
                {(NEXT[p.status] ?? []).map((tr) => (
                  <AuditActionForm
                    key={tr.to}
                    action={transitionProgramAction}
                    hidden={{ programId: p.id, to: tr.to }}
                    button={tr.label}
                    variant={tr.to === 'active' || tr.to === 'approved' ? 'primary' : 'ghost'}
                  >
                    {tr.reason && (
                      <label className="field">
                        <span className="field__label">Motivo</span>
                        <input name="reason" required placeholder="Obligatorio" />
                      </label>
                    )}
                  </AuditActionForm>
                ))}
              </div>
            </SectionCard>
          )}

          <SectionCard title="Auditorías del programa">
            {detail.audits.length === 0 ? (
              <p className="empty-state">Sin auditorías.</p>
            ) : (
              <ul className="dep-list">
                {detail.audits.map((a) => (
                  <li key={a.id}>
                    <AuditStatusBadge status={a.status} />{' '}
                    <Link href={`/dashboard/audits/${a.id}`}>
                      {a.folio} · {a.title}
                    </Link>{' '}
                    <span className="muted small">
                      {auditTypeLabel(a.auditType)}
                      {a.plannedDate ? ` · ${a.plannedDate}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div>
          <SectionCard title="Auditorías planeadas (calendario del programa)">
            {detail.items.length === 0 ? (
              <p className="empty-state">Sin auditorías planeadas.</p>
            ) : (
              <ul className="dep-list">
                {detail.items.map((i) => (
                  <li key={i.id}>
                    <span className="badge badge--soft">{auditTypeLabel(i.auditType)}</span>{' '}
                    {i.title} <span className="muted small">{i.plannedDate ?? 'sin fecha'}</span>
                    {i.auditId && (
                      <>
                        {' · '}
                        <Link href={`/dashboard/audits/${i.auditId}`}>abrir</Link>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {ctx.isAdmin && !p.readOnly && (
              <AuditActionForm
                action={addProgramItemAction}
                hidden={{ programId: p.id }}
                button="Agregar auditoría planeada"
              >
                <label className="field">
                  <span className="field__label">Título</span>
                  <input name="title" required placeholder="Auditoría de proceso — Producción" />
                </label>
                <label className="field">
                  <span className="field__label">Fecha planeada</span>
                  <input type="date" name="plannedDate" />
                </label>
              </AuditActionForm>
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Historial">
        {detail.history.length === 0 ? (
          <p className="empty-state">Sin eventos.</p>
        ) : (
          <ul className="history history--compact">
            {detail.history.map((h) => (
              <li key={h.id}>
                <span className="muted">{dt(h.createdAt)}</span> · {h.event}
                {h.toStatus ? ` → ${h.toStatus}` : ''} · {h.actorName ?? 'sistema'}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </main>
  );
}
