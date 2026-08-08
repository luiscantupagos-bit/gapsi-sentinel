import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getDiagnosticSummary } from '@/server/diagnostics';
import { getDocSummary } from '@/server/documents';
import { getWorkflowAlerts } from '@/server/document-workflow';
import { getCapaAlerts, getCapaDashboard } from '@/server/capa';
import { getTaskSummary, listGlobalTasks } from '@/server/tasks';
import { getProjectSummary, listMilestones } from '@/server/projects';
import { getAuditSummary } from '@/server/audits';
import {
  getActiveSchemes,
  getGanttRows,
  getLastActivity,
  getNextAudit,
  getQualityTrend,
  getSchemeCompliance,
  getSystemStatus,
} from '@/server/dashboard';
import { PageHeader, SectionCard } from './_components/ui';
import {
  ContextItem,
  ContextStrip,
  KpiTile,
  MiniGantt,
  SchemeBars,
  SystemStatusCard,
  TrendChart,
} from './_components/exec';
import {
  IconAudit,
  IconCalendar,
  IconCapa,
  IconClock,
  IconDiagnostic,
  IconDoc,
  IconReport,
  IconTasks,
} from './_components/icons';

function relTime(d: Date | null, now: number): string {
  if (!d) return 'Sin datos';
  const h = Math.floor((now - d.getTime()) / 3600000);
  if (h < 1) return 'Hace menos de 1 h';
  if (h < 24) return `Hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `Hace ${days} d`;
  return d.toISOString().slice(0, 10);
}

function daysUntil(iso: string, todayIso: string): number {
  const a = Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / 86400000);
  const b = Math.floor(new Date(`${todayIso}T00:00:00Z`).getTime() / 86400000);
  return a - b;
}

export default async function DashboardPage() {
  const session = await requireServerSession();
  const org = session.organizationId;
  const now = Date.now();
  const todayStr = new Date(now).toISOString().slice(0, 10);
  const soon30 = new Date(now + 30 * 86400000).toISOString().slice(0, 10);

  const [
    diag,
    docSummary,
    alerts,
    capa,
    capaBoard,
    taskSummary,
    projectSummary,
    overdueTasks,
    dueSoonTasks,
    upcomingMilestones,
    auditSummary,
    schemes,
    lastActivity,
    nextAudit,
    systemStatus,
    schemeCompliance,
    ganttRows,
    trend,
  ] = await Promise.all([
    getDiagnosticSummary(org),
    getDocSummary(org),
    getWorkflowAlerts(org, session.userId),
    getCapaAlerts(org),
    getCapaDashboard(org),
    getTaskSummary(org, session.userId),
    getProjectSummary(org),
    listGlobalTasks(org, session.userId, { quick: 'overdue' }),
    listGlobalTasks(org, session.userId, { quick: 'due_soon' }),
    listMilestones(org, { from: todayStr, to: soon30 }),
    getAuditSummary(org),
    getActiveSchemes(org),
    getLastActivity(org),
    getNextAudit(org),
    getSystemStatus(org),
    getSchemeCompliance(org),
    getGanttRows(org),
    getQualityTrend(org),
  ]);

  const daysToAudit = nextAudit ? daysUntil(nextAudit.date, todayStr) : null;

  // Centro de alertas (CAPA + documental + auditoría), sin duplicar tareas.
  const critical = [
    ...capaBoard.overdueActions.map((a) => ({
      key: `capa-${a.id}`,
      text: `${a.folio} · ${a.description}`,
      meta: `Venció hace ${a.daysOverdue ?? 0} d`,
      href: `/dashboard/capa/${a.capaId}`,
    })),
    ...(alerts.reviewOverdue > 0
      ? [
          {
            key: 'doc-rev',
            text: 'Revisión documental vencida',
            meta: `${alerts.reviewOverdue}`,
            href: '/dashboard/documents',
          },
        ]
      : []),
    ...(auditSummary.overdue > 0
      ? [
          {
            key: 'aud-over',
            text: 'Auditorías vencidas',
            meta: `${auditSummary.overdue}`,
            href: '/dashboard/audits',
          },
        ]
      : []),
    ...(auditSummary.majorOpen > 0
      ? [
          {
            key: 'find-major',
            text: 'Hallazgos mayores abiertos',
            meta: `${auditSummary.majorOpen}`,
            href: '/dashboard/audits',
          },
        ]
      : []),
  ].slice(0, 5);

  const preventive = [
    ...capaBoard.upcoming.map((a) => ({
      key: `capaup-${a.id}`,
      text: `${a.folio} · ${a.description}`,
      meta: a.dueDate ?? '—',
      href: `/dashboard/capa/${a.capaId}`,
    })),
    ...(alerts.reviewDueSoon > 0
      ? [
          {
            key: 'doc-soon',
            text: 'Documentos próximos a revisión',
            meta: `${alerts.reviewDueSoon}`,
            href: '/dashboard/documents',
          },
        ]
      : []),
  ].slice(0, 4);

  // Próximas acciones (tareas + hitos), sin repetir en el centro de alertas.
  const actions = [
    ...overdueTasks.map((t) => ({ ...t, bucket: 'crit' as const })),
    ...dueSoonTasks.map((t) => ({ ...t, bucket: 'soon' as const })),
  ].slice(0, 6);

  return (
    <main className="container exec2">
      <PageHeader title="Dashboard Ejecutivo" subtitle="Resumen general del Sistema de Gestión" />

      <ContextStrip>
        <ContextItem
          icon={<IconReport />}
          label="Esquemas activos"
          value={schemes.length > 0 ? schemes.slice(0, 3).join(' · ') : 'Sin datos'}
        />
        <ContextItem
          icon={<IconClock />}
          label="Último movimiento"
          value={relTime(lastActivity, now)}
        />
        <ContextItem
          icon={<IconAudit />}
          label="Próxima auditoría"
          value={nextAudit ? nextAudit.date : 'Sin programar'}
          sub={nextAudit ? `${nextAudit.folio} · ${nextAudit.title}` : undefined}
        />
        <ContextItem
          icon={<IconCalendar />}
          label="Tiempo restante"
          value={
            daysToAudit === null
              ? 'Sin datos'
              : daysToAudit <= 0
                ? 'Vencida'
                : `En ${daysToAudit} días`
          }
        />
      </ContextStrip>

      {/* KPIs */}
      <div className="kpitiles">
        <KpiTile
          icon={<IconDiagnostic />}
          label="Diagnósticos en progreso"
          value={diag.inProgress}
          tone="blue"
          context={`${diag.total} en total`}
          href="/dashboard/diagnostics?status=in_progress"
        />
        <KpiTile
          icon={<IconTasks />}
          label="Tareas vencidas"
          value={taskSummary.overdue}
          tone={taskSummary.overdue > 0 ? 'red' : 'green'}
          context={`${taskSummary.open} abiertas`}
          href="/dashboard/tasks?tab=overdue"
        />
        <KpiTile
          icon={<IconCapa />}
          label="CAPA abiertas"
          value={capa.open}
          tone={capa.open > 0 ? 'amber' : 'green'}
          context={`${capa.pendingActions} acciones pend.`}
          href="/dashboard/capa"
        />
        <KpiTile
          icon={<IconAudit />}
          label="Hallazgos abiertos"
          value={auditSummary.openFindings}
          tone={
            auditSummary.majorOpen > 0 ? 'red' : auditSummary.openFindings > 0 ? 'amber' : 'green'
          }
          context={`${auditSummary.majorOpen} mayores`}
          href="/dashboard/audits"
        />
        <KpiTile
          icon={<IconDoc />}
          label="Documentos por revisar"
          value={docSummary.dueSoon}
          tone={docSummary.dueSoon > 0 ? 'amber' : 'green'}
          context={`${docSummary.effective} vigentes`}
          href="/dashboard/documents"
        />
        <KpiTile
          icon={<IconAudit />}
          label="Auditorías en seguimiento"
          value={auditSummary.followUp}
          tone="blue"
          context={`${auditSummary.planned} programadas`}
          href="/dashboard/audits?status=follow_up"
        />
      </div>

      {/* Fila A */}
      <div className="exec-grid exec-grid--3">
        <SectionCard title="Estado del sistema">
          <SystemStatusCard status={systemStatus} />
        </SectionCard>

        <SectionCard title="Cumplimiento por esquema">
          <SchemeBars items={schemeCompliance} />
        </SectionCard>

        <SectionCard
          title="Centro de alertas"
          action={
            <Link className="button button--ghost" href="/dashboard/capa/tasks">
              Ver todas
            </Link>
          }
        >
          {critical.length === 0 && preventive.length === 0 ? (
            <p className="empty-state">Sin alertas. Todo al día.</p>
          ) : (
            <>
              {critical.length > 0 && (
                <>
                  <p className="alerts__head alerts__head--crit">Críticas</p>
                  <ul className="alerts">
                    {critical.map((a) => (
                      <li key={a.key}>
                        <span className="alerts__dot alerts__dot--crit" aria-hidden />
                        <Link href={a.href}>{a.text}</Link>
                        <span className="alerts__meta alerts__meta--crit">{a.meta}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {preventive.length > 0 && (
                <>
                  <p className="alerts__head alerts__head--prev">Preventivas</p>
                  <ul className="alerts">
                    {preventive.map((a) => (
                      <li key={a.key}>
                        <span className="alerts__dot alerts__dot--prev" aria-hidden />
                        <Link href={a.href}>{a.text}</Link>
                        <span className="alerts__meta alerts__meta--prev">{a.meta}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </SectionCard>
      </div>

      {/* Fila B */}
      <div className="exec-grid exec-grid--3">
        <SectionCard
          title="Estado de auditorías"
          action={
            <Link className="button button--ghost" href="/dashboard/audits">
              Ver
            </Link>
          }
        >
          <div className="auditmini">
            <div className="auditmini__num">
              <strong>{auditSummary.planned}</strong>
              <span>Programadas</span>
            </div>
            <div className="auditmini__num">
              <strong>{auditSummary.followUp}</strong>
              <span>En seguimiento</span>
            </div>
            <div className="auditmini__num">
              <strong className={auditSummary.openFindings > 0 ? 'is-warn' : undefined}>
                {auditSummary.openFindings}
              </strong>
              <span>Hallazgos abiertos</span>
            </div>
          </div>
          {nextAudit ? (
            <p className="auditmini__next">
              Próxima: <strong>{nextAudit.date}</strong> · {nextAudit.folio} · {nextAudit.title}
            </p>
          ) : (
            <p className="muted">Sin auditorías programadas.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Actividades principales"
          action={
            <Link className="button button--ghost" href="/dashboard/projects">
              Ver proyectos
            </Link>
          }
        >
          <MiniGantt rows={ganttRows} today={todayStr} />
        </SectionCard>

        <SectionCard title="Tendencia del sistema — 12 meses">
          {trend.hasData ? (
            <TrendChart months={trend.months} series={trend.series} />
          ) : (
            <p className="empty-state">Aún no hay suficientes datos para la tendencia.</p>
          )}
        </SectionCard>
      </div>

      {/* Fila C */}
      <div className="exec-grid exec-grid--3-2">
        <SectionCard
          title="Próximas acciones"
          action={
            <Link className="button button--ghost" href="/dashboard/tasks">
              Ver tareas
            </Link>
          }
        >
          {actions.length === 0 && upcomingMilestones.length === 0 ? (
            <p className="empty-state">Sin acciones próximas.</p>
          ) : (
            <ul className="alerts">
              {actions.map((t) => (
                <li key={t.id}>
                  <span
                    className={`alerts__dot ${t.bucket === 'crit' ? 'alerts__dot--crit' : 'alerts__dot--prev'}`}
                    aria-hidden
                  />
                  <Link href={t.detailHref ?? t.originHref}>
                    {t.folio ?? t.sourceFolio ?? 'tarea'} · {t.title}
                  </Link>
                  <span className="alerts__meta">
                    {t.responsibleName ?? 'sin asignar'} · vence {t.targetDate}
                  </span>
                </li>
              ))}
              {upcomingMilestones.slice(0, 2).map((m) => (
                <li key={m.id}>
                  <span className="alerts__dot alerts__dot--prev" aria-hidden />
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

        <SectionCard title="Documentos y proyectos">
          <div className="minisummary">
            <div>
              <p className="minisummary__title">Documentos</p>
              <ul className="minisummary__list">
                <li>
                  <Link href="/dashboard/documents?status=effective">Vigentes</Link>
                  <span>{docSummary.effective}</span>
                </li>
                <li>
                  <Link href="/dashboard/documents">Próximos a revisión</Link>
                  <span>{docSummary.dueSoon}</span>
                </li>
                <li>
                  <Link href="/dashboard/documents/tasks">Lecturas pendientes</Link>
                  <span>{alerts.pendingReads}</span>
                </li>
              </ul>
            </div>
            <div>
              <p className="minisummary__title">Proyectos</p>
              <ul className="minisummary__list">
                <li>
                  <Link href="/dashboard/projects?status=active">Activos</Link>
                  <span>{projectSummary.active}</span>
                </li>
                <li>
                  <Link href="/dashboard/projects?status=active">En riesgo</Link>
                  <span className={projectSummary.atRisk > 0 ? 'is-warn' : undefined}>
                    {projectSummary.atRisk}
                  </span>
                </li>
                <li>
                  <Link href="/dashboard/tasks">Hitos próximos</Link>
                  <span>{upcomingMilestones.length}</span>
                </li>
              </ul>
            </div>
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
