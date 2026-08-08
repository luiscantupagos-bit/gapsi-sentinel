import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getDiagnosticSummary } from '@/server/diagnostics';
import { getDocSummary } from '@/server/documents';
import { getWorkflowAlerts } from '@/server/document-workflow';
import { getCapaAlerts, getCapaDashboard } from '@/server/capa';
import { getTaskSummary, listGlobalTasks } from '@/server/tasks';
import { getProjectSummary, listMilestones } from '@/server/projects';
import { getAuditSummary } from '@/server/audits';
import { listFindings } from '@/server/audit-findings';
import {
  CAPA_PRIORITY_LABEL,
  CAPA_STATUS_LABEL,
  type CapaPriority,
  type CapaStatus,
} from '@/features/capa/capa-state';
import { BarChart, DonutChart, type Segment } from './_components/Charts';
import { PageHeader, SectionCard, StatCard } from './_components/ui';

const STATUS_COLOR: Record<string, string> = {
  draft: '#94a3b8',
  reported: '#3b82f6',
  containment: '#0ea5e9',
  under_investigation: '#d97706',
  action_plan: '#f59e0b',
  in_implementation: '#8b5cf6',
  effectiveness_review: '#7c3aed',
  closed: '#16a34a',
  cancelled: '#64748b',
};
const PRIORITY_COLOR: Record<string, string> = {
  low: '#94a3b8',
  normal: '#3b82f6',
  high: '#d97706',
  urgent: '#dc2626',
};

export default async function DashboardPage() {
  const session = await requireServerSession();
  const org = session.organizationId;
  const soon30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  const [
    diagSummary,
    docSummary,
    alerts,
    capa,
    capaBoard,
    taskSummary,
    projectSummary,
    overdueTasks,
    upcomingMilestones,
    auditSummary,
    findings,
  ] = await Promise.all([
    getDiagnosticSummary(org),
    getDocSummary(org),
    getWorkflowAlerts(org, session.userId),
    getCapaAlerts(org),
    getCapaDashboard(org),
    getTaskSummary(org, session.userId),
    getProjectSummary(org),
    listGlobalTasks(org, session.userId, { quick: 'overdue' }),
    listMilestones(org, { from: todayStr, to: soon30 }),
    getAuditSummary(org),
    listFindings(org, {}),
  ]);

  const openFindings = findings.filter((f) => f.status !== 'closed' && f.status !== 'effective');

  const statusSegments: Segment[] = capaBoard.byStatus.map((s) => ({
    label: CAPA_STATUS_LABEL[s.key as CapaStatus] ?? s.key,
    value: s.count,
    color: STATUS_COLOR[s.key] ?? '#94a3b8',
  }));
  const prioritySegments: Segment[] = capaBoard.byPriority.map((p) => ({
    label: CAPA_PRIORITY_LABEL[p.key as CapaPriority] ?? p.key,
    value: p.count,
    color: PRIORITY_COLOR[p.key] ?? '#94a3b8',
  }));

  const hasCriticas = capaBoard.overdueActions.length > 0 || alerts.reviewOverdue > 0;
  const hasPreventivas = capaBoard.upcoming.length > 0 || alerts.reviewDueSoon > 0;

  return (
    <main className="container">
      <PageHeader title="Panel" subtitle="Estado del sistema de gestión y próximas acciones." />

      {/* Fila 1 — indicadores reales, clickeables */}
      <div className="statcard-row">
        <StatCard
          label="Diagnósticos en progreso"
          value={diagSummary.inProgress}
          href="/dashboard/diagnostics?status=in_progress"
        />
        <StatCard
          label="Tareas vencidas"
          value={taskSummary.overdue}
          tone={taskSummary.overdue > 0 ? 'danger' : 'success'}
          href="/dashboard/tasks?tab=overdue"
        />
        <StatCard
          label="CAPA abiertas"
          value={capa.open}
          tone={capa.open > 0 ? 'warning' : 'default'}
          href="/dashboard/capa"
        />
        <StatCard
          label="Hallazgos abiertos"
          value={auditSummary.openFindings}
          tone={auditSummary.openFindings > 0 ? 'warning' : 'default'}
          href="/dashboard/audits"
        />
        <StatCard
          label="Documentos por revisar"
          value={docSummary.dueSoon}
          tone={docSummary.dueSoon > 0 ? 'warning' : 'default'}
          href="/dashboard/documents"
        />
        <StatCard
          label="Auditorías en seguimiento"
          value={auditSummary.followUp}
          href="/dashboard/audits?status=follow_up"
        />
      </div>

      {/* Fila 2 — alertas prioritarias · próximas acciones */}
      <div className="dash-grid dash-grid--2">
        <SectionCard
          title="Alertas prioritarias"
          action={
            <Link className="button button--ghost" href="/dashboard/capa/tasks">
              Ver todas
            </Link>
          }
        >
          {!hasCriticas && !hasPreventivas ? (
            <p className="empty-state">Sin alertas. Todo al día.</p>
          ) : (
            <>
              {hasCriticas && (
                <>
                  <p className="alerts__head alerts__head--crit">Críticas</p>
                  <ul className="alerts">
                    {capaBoard.overdueActions.map((a) => (
                      <li key={a.id}>
                        <span className="alerts__dot alerts__dot--crit" aria-hidden />
                        <Link href={`/dashboard/capa/${a.capaId}`}>
                          <strong>{a.folio}</strong> · {a.description}
                        </Link>
                        <span className="alerts__meta alerts__meta--crit">
                          Venció hace {a.daysOverdue ?? 0}d
                        </span>
                      </li>
                    ))}
                    {alerts.reviewOverdue > 0 && (
                      <li>
                        <span className="alerts__dot alerts__dot--crit" aria-hidden />
                        <Link href="/dashboard/documents">Revisión documental vencida</Link>
                        <span className="alerts__meta alerts__meta--crit">{alerts.reviewOverdue}</span>
                      </li>
                    )}
                  </ul>
                </>
              )}
              {hasPreventivas && (
                <>
                  <p className="alerts__head alerts__head--prev">Preventivas</p>
                  <ul className="alerts">
                    {capaBoard.upcoming.map((a) => (
                      <li key={a.id}>
                        <span className="alerts__dot alerts__dot--prev" aria-hidden />
                        <Link href={`/dashboard/capa/${a.capaId}`}>
                          <strong>{a.folio}</strong> · {a.description}
                        </Link>
                        <span className="alerts__meta alerts__meta--prev">{a.dueDate ?? '—'}</span>
                      </li>
                    ))}
                    {alerts.reviewDueSoon > 0 && (
                      <li>
                        <span className="alerts__dot alerts__dot--prev" aria-hidden />
                        <Link href="/dashboard/documents">Documentos próximos a revisión</Link>
                        <span className="alerts__meta alerts__meta--prev">{alerts.reviewDueSoon}</span>
                      </li>
                    )}
                  </ul>
                </>
              )}
            </>
          )}
        </SectionCard>

        <SectionCard
          title="Próximas acciones"
          action={
            <Link className="button button--ghost" href="/dashboard/tasks?tab=overdue">
              Ver tareas
            </Link>
          }
        >
          <p className="alerts__head alerts__head--crit">Tareas vencidas</p>
          {overdueTasks.length === 0 ? (
            <p className="empty-state">Sin tareas vencidas.</p>
          ) : (
            <ul className="alerts">
              {overdueTasks.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <span className="alerts__dot alerts__dot--crit" aria-hidden />
                  <Link href={t.detailHref ?? t.originHref}>
                    {t.folio ?? t.sourceFolio ?? 'tarea'} · {t.title}
                  </Link>
                  <span className="alerts__meta alerts__meta--crit">
                    {t.responsibleName ?? 'sin asignar'} · vence {t.targetDate}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="alerts__head alerts__head--prev">Hitos próximos (30 días)</p>
          {upcomingMilestones.length === 0 ? (
            <p className="empty-state">Sin hitos próximos.</p>
          ) : (
            <ul className="alerts">
              {upcomingMilestones.slice(0, 5).map((m) => (
                <li key={m.id}>
                  <span
                    className={`alerts__dot ${m.overdue ? 'alerts__dot--crit' : 'alerts__dot--prev'}`}
                    aria-hidden
                  />
                  <Link href={`/dashboard/projects/${m.projectId}`}>
                    {m.name}
                    {m.projectFolio ? ` · ${m.projectFolio}` : ''}
                  </Link>
                  <span className="alerts__meta">objetivo {m.targetDate}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Auditorías (datos reales) */}
      <SectionCard
        title="Auditorías"
        action={
          <Link className="button button--ghost" href="/dashboard/audits">
            Ver auditorías
          </Link>
        }
      >
        <div className="statcard-row">
          <StatCard label="Programadas" value={auditSummary.planned} href="/dashboard/audits?status=planned" />
          <StatCard label="En seguimiento" value={auditSummary.followUp} href="/dashboard/audits?status=follow_up" />
          <StatCard
            label="Vencidas"
            value={auditSummary.overdue}
            tone={auditSummary.overdue > 0 ? 'danger' : 'default'}
            href="/dashboard/audits"
          />
          <StatCard
            label="Hallazgos mayores"
            value={auditSummary.majorOpen}
            tone={auditSummary.majorOpen > 0 ? 'danger' : 'default'}
          />
          <StatCard label="Próxima auditoría" value={auditSummary.nextAuditDate ?? '—'} />
        </div>
        <p className="alerts__head alerts__head--crit">Hallazgos abiertos</p>
        {openFindings.length === 0 ? (
          <p className="empty-state">Sin hallazgos abiertos.</p>
        ) : (
          <ul className="alerts">
            {openFindings.slice(0, 5).map((f) => (
              <li key={f.id}>
                <span
                  className={`alerts__dot ${f.overdue ? 'alerts__dot--crit' : 'alerts__dot--prev'}`}
                  aria-hidden
                />
                <Link href={`/dashboard/audits/findings/${f.id}`}>
                  {f.folio} · {f.title}
                </Link>
                <span className="alerts__meta">
                  {f.auditFolio ? `${f.auditFolio} · ` : ''}
                  {f.responsibleName ?? 'sin asignar'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Trabajo y documentos (datos reales) */}
      <div className="dash-grid dash-grid--2">
        <SectionCard
          title="Tareas y proyectos"
          action={
            <Link className="button button--ghost" href="/dashboard/tasks">
              Ver tareas
            </Link>
          }
        >
          <div className="statcard-row">
            <StatCard label="Tareas abiertas" value={taskSummary.open} href="/dashboard/tasks?tab=all" />
            <StatCard label="Próximas (7d)" value={taskSummary.dueSoon} tone="warning" href="/dashboard/tasks?tab=due_soon" />
            <StatCard label="Proyectos activos" value={projectSummary.active} tone="success" href="/dashboard/projects?status=active" />
            <StatCard
              label="Proyectos en riesgo"
              value={projectSummary.atRisk}
              tone={projectSummary.atRisk > 0 ? 'danger' : 'default'}
              href="/dashboard/projects?status=active"
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Documentos"
          action={
            <Link className="button button--ghost" href="/dashboard/documents">
              Ir al listado
            </Link>
          }
        >
          <div className="statcard-row">
            <StatCard label="Total" value={docSummary.total} href="/dashboard/documents" />
            <StatCard label="Vigentes" value={docSummary.effective} tone="success" href="/dashboard/documents?status=effective" />
            <StatCard label="Próx. revisión" value={docSummary.dueSoon} tone="warning" href="/dashboard/documents" />
            <StatCard label="Lecturas pend." value={alerts.pendingReads} href="/dashboard/documents/tasks" />
          </div>
        </SectionCard>
      </div>

      {/* CAPA (datos reales) */}
      <div className="dash-grid dash-grid--2">
        <SectionCard title="CAPA por estado">
          {statusSegments.length === 0 ? (
            <p className="empty-state">Sin CAPA registradas.</p>
          ) : (
            <DonutChart segments={statusSegments} title="CAPA por estado" />
          )}
        </SectionCard>
        <SectionCard title="CAPA abiertas por prioridad">
          {prioritySegments.length === 0 ? (
            <p className="empty-state">Sin CAPA abiertas.</p>
          ) : (
            <BarChart bars={prioritySegments} title="Abiertas por prioridad" />
          )}
        </SectionCard>
      </div>
    </main>
  );
}
