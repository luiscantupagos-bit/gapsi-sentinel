import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getAuditPerms, getAuditSummary, listAudits, type AuditFilters } from '@/server/audits';
import { PageHeader, StatCard } from '../_components/ui';
import { AuditStatusBadge, Progress, auditTypeLabel } from './_components/AuditBits';

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'planned', label: 'Planeadas' },
  { key: 'in_progress', label: 'En ejecución' },
  { key: 'follow_up', label: 'En seguimiento' },
  { key: 'completed', label: 'Completadas' },
  { key: 'closed', label: 'Cerradas' },
];

export default async function AuditsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; type?: string }>;
}) {
  const session = await requireServerSession();
  const sp = await searchParams;
  const filters: AuditFilters = {
    status: sp.status && sp.status !== 'all' ? sp.status : undefined,
    search: sp.q?.trim() || undefined,
    auditType: sp.type || undefined,
  };
  const [summary, audits, ctx] = await Promise.all([
    getAuditSummary(session.organizationId),
    listAudits(session.organizationId, filters),
    getAuditPerms(session.organizationId, session.userId),
  ]);
  const tabKey = sp.status && STATUS_TABS.some((t) => t.key === sp.status) ? sp.status : 'all';

  return (
    <main className="container">
      <PageHeader
        title="Auditorías"
        subtitle="Programas, auditorías internas y preparación para cumplimiento. Sentinel prepara y documenta; la decisión es del auditor."
        actions={
          <div className="page-head__actions">
            <Link className="button button--ghost" href="/dashboard/audits/programs">
              Programas
            </Link>
            <Link className="button button--ghost" href="/dashboard/audits/preparation">
              Preparación
            </Link>
            <Link className="button button--ghost" href="/dashboard/audits/certifications">
              Certificaciones
            </Link>
            {ctx.canCreate && (
              <Link className="button button--primary" href="/dashboard/audits/new">
                Nueva auditoría
              </Link>
            )}
          </div>
        }
      />

      <div className="statcard-row">
        <StatCard
          label="Programadas"
          value={summary.planned}
          href="/dashboard/audits?status=planned"
        />
        <StatCard
          label="En ejecución"
          value={summary.inProgress}
          href="/dashboard/audits?status=in_progress"
        />
        <StatCard
          label="En seguimiento"
          value={summary.followUp}
          href="/dashboard/audits?status=follow_up"
        />
        <StatCard
          label="Vencidas"
          value={summary.overdue}
          tone={summary.overdue > 0 ? 'danger' : 'default'}
        />
        <StatCard
          label="Hallazgos abiertos"
          value={summary.openFindings}
          tone={summary.majorOpen > 0 ? 'warning' : 'default'}
        />
        <StatCard label="Próxima auditoría" value={summary.nextAuditDate ?? '—'} />
      </div>

      <nav className="tabs" aria-label="Estado de auditorías">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/audits${t.key === 'all' ? '' : `?status=${t.key}`}`}
            className={`tab${t.key === tabKey ? ' is-active' : ''}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="list-toolbar">
        <form method="get" className="searchbar">
          {tabKey !== 'all' && <input type="hidden" name="status" value={tabKey} />}
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="Buscar por folio o título…"
            aria-label="Buscar auditorías"
          />
          <button type="submit" className="button button--ghost">
            Buscar
          </button>
        </form>
      </div>

      {audits.length === 0 ? (
        <p className="empty-state">No hay auditorías para este filtro.</p>
      ) : (
        <div className="table-wrap">
          <table className="tbl-linkable">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Auditoría</th>
                <th>Tipo</th>
                <th>Norma</th>
                <th>Sitio</th>
                <th>Fecha</th>
                <th>Auditor líder</th>
                <th>Estado</th>
                <th>Preparación</th>
                <th>Hallazgos</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => (
                <tr key={a.id} className={a.overdue ? 'is-overdue' : undefined}>
                  <td className="mono">
                    <Link href={`/dashboard/audits/${a.id}`}>{a.folio}</Link>
                  </td>
                  <td>
                    <Link href={`/dashboard/audits/${a.id}`} className="tbl-title">
                      {a.title}
                    </Link>
                  </td>
                  <td>
                    <span className="badge badge--soft">{auditTypeLabel(a.auditType)}</span>
                  </td>
                  <td>{a.normVersionLabel ?? <span className="muted">—</span>}</td>
                  <td>{a.siteName ?? <span className="muted">—</span>}</td>
                  <td className={a.overdue ? 'due due--overdue' : 'due'}>
                    {a.plannedDate ?? <span className="muted">—</span>}
                  </td>
                  <td>{a.leadAuditorName ?? <span className="muted">—</span>}</td>
                  <td>
                    <AuditStatusBadge status={a.status} />
                  </td>
                  <td>
                    <Progress value={a.progressPct} />
                  </td>
                  <td>
                    {a.openFindings > 0 ? (
                      <span className="badge badge--warning">{a.openFindings}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
