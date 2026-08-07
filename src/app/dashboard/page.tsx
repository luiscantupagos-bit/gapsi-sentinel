import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getPrisma } from '@/server/db';
import { getDashboardData } from '@/server/diagnostics';
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
import { KpiCard, Placeholder, SemiGauge } from './_components/exec';

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
    data,
    docSummary,
    alerts,
    capa,
    capaBoard,
    frameworks,
    findings,
    taskSummary,
    projectSummary,
    overdueTasks,
    upcomingMilestones,
  ] = await Promise.all([
    getDashboardData(org),
    getDocSummary(org),
    getWorkflowAlerts(org, session.userId),
    getCapaAlerts(org),
    getCapaDashboard(org),
    getPrisma().assessmentFramework.findMany({
      where: { organizationId: org, deletedAt: null },
      select: { code: true, name: true },
    }),
    getPrisma().diagnosticFinding.count({ where: { organizationId: org } }),
    getTaskSummary(org, session.userId),
    getProjectSummary(org),
    listGlobalTasks(org, session.userId, { quick: 'overdue' }),
    listMilestones(org, { from: todayStr, to: soon30 }),
  ]);
  const [auditSummary, openFindings] = await Promise.all([
    getAuditSummary(org),
    listFindings(org, {}),
  ]);
  const openFindingsList = openFindings.filter(
    (f) => f.status !== 'closed' && f.status !== 'effective',
  );

  const orgName = data?.organization.name ?? 'Organización';
  const totalActions = capaBoard.actionsCompleted + capa.pendingActions;
  const completionRing =
    totalActions > 0 ? Math.round((capaBoard.actionsCompleted / totalActions) * 100) : 0;

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
    <main className="container exec">
      <PageHeader
        title="Dashboard Ejecutivo"
        subtitle={`Resumen general del Sistema de Gestión · ${orgName}`}
      />

      {/* Tira de contexto */}
      <div className="exec-strip">
        <div className="exec-strip__item">
          <span className="exec-strip__label">Normas activas</span>
          <span className="exec-strip__value">
            {frameworks.length > 0
              ? frameworks.map((f) => f.name.replace(/\s*\(.*\)$/, '')).join(' · ')
              : 'En configuración'}
          </span>
        </div>
        <div className="exec-strip__item">
          <span className="exec-strip__label">Última actualización</span>
          <span className="exec-strip__value">Hace un momento</span>
        </div>
        <div className="exec-strip__item">
          <span className="exec-strip__label">Próxima auditoría</span>
          <span className="exec-strip__value muted">Próximamente</span>
        </div>
      </div>

      {/* Fila 1 — KPIs */}
      <div className="kpi-row">
        <KpiCard label="Cumplimiento general" tone="green" placeholder="En configuración" />
        <KpiCard
          label="Actividades completadas"
          value={capaBoard.actionsCompleted}
          tone="green"
          ring={completionRing}
        />
        <KpiCard
          label="Actividades vencidas"
          value={capaBoard.actionsOverdue}
          tone="red"
          ring={100}
        />
        <KpiCard label="CAPA abiertas" value={capa.open} tone="amber" ring={100} />
        <KpiCard label="Hallazgos pendientes" value={findings} tone="blue" ring={100} />
        <KpiCard label="Riesgos críticos" tone="red" placeholder="Próximamente" />
      </div>

      {/* Tareas y proyectos (datos reales) */}
      <SectionCard
        title="Tareas y proyectos"
        action={
          <Link className="button button--ghost" href="/dashboard/tasks">
            Ver tareas
          </Link>
        }
      >
        <div className="statcard-row">
          <StatCard
            label="Tareas abiertas"
            value={taskSummary.open}
            href="/dashboard/tasks?tab=all"
          />
          <StatCard
            label="Tareas vencidas"
            value={taskSummary.overdue}
            tone={taskSummary.overdue > 0 ? 'danger' : 'default'}
            href="/dashboard/tasks?tab=overdue"
          />
          <StatCard
            label="Próximas (7d)"
            value={taskSummary.dueSoon}
            tone="warning"
            href="/dashboard/tasks?tab=due_soon"
          />
          <StatCard
            label="Proyectos activos"
            value={projectSummary.active}
            tone="success"
            href="/dashboard/projects?status=active"
          />
          <StatCard
            label="Proyectos en riesgo"
            value={projectSummary.atRisk}
            tone={projectSummary.atRisk > 0 ? 'danger' : 'default'}
            href="/dashboard/projects?status=active"
          />
        </div>

        <div className="dash-grid dash-grid--2">
          <div>
            <p className="alerts__head alerts__head--crit">Tareas vencidas</p>
            {overdueTasks.length === 0 ? (
              <p className="empty-state">Sin tareas vencidas.</p>
            ) : (
              <ul className="alerts">
                {overdueTasks.slice(0, 6).map((t) => (
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
          </div>
          <div>
            <p className="alerts__head alerts__head--prev">Hitos próximos (30 días)</p>
            {upcomingMilestones.length === 0 ? (
              <p className="empty-state">Sin hitos próximos.</p>
            ) : (
              <ul className="alerts">
                {upcomingMilestones.slice(0, 6).map((m) => (
                  <li key={m.id}>
                    <span
                      className={`alerts__dot ${m.overdue ? 'alerts__dot--crit' : 'alerts__dot--prev'}`}
                      aria-hidden
                    />
                    <Link href={`/dashboard/projects/${m.projectId}`}>
                      ◆ {m.name}
                      {m.projectFolio ? ` · ${m.projectFolio}` : ''}
                    </Link>
                    <span className="alerts__meta">objetivo {m.targetDate}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SectionCard>

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
          <StatCard
            label="Programadas"
            value={auditSummary.planned}
            href="/dashboard/audits?status=planned"
          />
          <StatCard
            label="En seguimiento"
            value={auditSummary.followUp}
            href="/dashboard/audits?status=follow_up"
          />
          <StatCard
            label="Vencidas"
            value={auditSummary.overdue}
            tone={auditSummary.overdue > 0 ? 'danger' : 'default'}
            href="/dashboard/audits"
          />
          <StatCard
            label="Hallazgos abiertos"
            value={auditSummary.openFindings}
            tone={auditSummary.openFindings > 0 ? 'warning' : 'default'}
          />
          <StatCard
            label="Hallazgos mayores"
            value={auditSummary.majorOpen}
            tone={auditSummary.majorOpen > 0 ? 'danger' : 'default'}
          />
          <StatCard label="Próxima auditoría" value={auditSummary.nextAuditDate ?? '—'} />
        </div>
        <div>
          <p className="alerts__head alerts__head--crit">Hallazgos abiertos</p>
          {openFindingsList.length === 0 ? (
            <p className="empty-state">Sin hallazgos abiertos.</p>
          ) : (
            <ul className="alerts">
              {openFindingsList.slice(0, 6).map((f) => (
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
        </div>
      </SectionCard>

      {/* Fila 2 — Sentinel Score · Cumplimiento por norma · Alertas */}
      <div className="dash-grid dash-grid--3">
        <SectionCard title="Sentinel Score™">
          <SemiGauge value={null} placeholder="En configuración" caption="Salud general" />
          <p className="muted center">
            El cálculo del puntaje de salud del sistema llegará en una tarea futura.
          </p>
        </SectionCard>

        <SectionCard title="Cumplimiento por norma / esquema">
          {frameworks.length === 0 ? (
            <Placeholder
              title="En configuración"
              message="No hay normas configuradas para calcular cumplimiento."
            />
          ) : (
            <ul className="norm-list">
              {frameworks.map((f) => (
                <li key={f.code}>
                  <span className="norm-list__name">{f.name.replace(/\s*\(.*\)$/, '')}</span>
                  <span className="badge">En configuración</span>
                </li>
              ))}
            </ul>
          )}
          <p className="muted">El % de cumplimiento por norma requiere configurar el marco.</p>
        </SectionCard>

        <SectionCard
          title="Centro de alertas"
          action={
            <Link className="button button--ghost" href="/dashboard/capa/tasks">
              Ver todas
            </Link>
          }
        >
          {!hasCriticas && !hasPreventivas ? (
            <p className="empty-state">Sin alertas.</p>
          ) : (
            <>
              {hasCriticas && (
                <>
                  <p className="alerts__head alerts__head--crit">Críticas</p>
                  <ul className="alerts">
                    {capaBoard.overdueActions.map((a) => (
                      <li key={a.id}>
                        <span className="alerts__dot alerts__dot--crit" aria-hidden />
                        <span>
                          <strong>{a.folio}</strong> · {a.description}
                        </span>
                        <span className="alerts__meta alerts__meta--crit">
                          Venció hace {a.daysOverdue ?? 0}d
                        </span>
                      </li>
                    ))}
                    {alerts.reviewOverdue > 0 && (
                      <li>
                        <span className="alerts__dot alerts__dot--crit" aria-hidden />
                        <span>Revisión documental vencida</span>
                        <span className="alerts__meta alerts__meta--crit">
                          {alerts.reviewOverdue}
                        </span>
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
                        <span>
                          <strong>{a.folio}</strong> · {a.description}
                        </span>
                        <span className="alerts__meta alerts__meta--prev">{a.dueDate ?? '—'}</span>
                      </li>
                    ))}
                    {alerts.reviewDueSoon > 0 && (
                      <li>
                        <span className="alerts__dot alerts__dot--prev" aria-hidden />
                        <span>Documentos próximos a revisión</span>
                        <span className="alerts__meta alerts__meta--prev">
                          {alerts.reviewDueSoon}
                        </span>
                      </li>
                    )}
                  </ul>
                </>
              )}
            </>
          )}
        </SectionCard>
      </div>

      {/* Fila 3 — Auditoría · Actividades principales · Tendencia */}
      <div className="dash-grid dash-grid--3">
        <SectionCard title="Estado de auditoría">
          <Placeholder
            title="Próximamente"
            message="El módulo de auditorías se conectará en una tarea futura."
          />
        </SectionCard>

        <SectionCard title="Actividades principales">
          {capaBoard.upcoming.length === 0 ? (
            <Placeholder
              title="Próximamente"
              message="La vista Gantt de actividades llegará con TASK-009."
            />
          ) : (
            <>
              <ul className="activity">
                {capaBoard.upcoming.map((u) => (
                  <li key={u.id}>
                    <span className="activity__dot activity__dot--warn" aria-hidden />
                    <span>
                      <Link href={`/dashboard/capa/${u.capaId}`}>
                        <strong>{u.folio}</strong>
                      </Link>{' '}
                      · {u.description}
                    </span>
                    <span className="activity__at">{u.dueDate ?? '—'}</span>
                  </li>
                ))}
              </ul>
              <p className="muted">Vista Gantt próximamente (TASK-009).</p>
            </>
          )}
        </SectionCard>

        <SectionCard title="Tendencia del sistema (12 meses)">
          <Placeholder
            title="En configuración"
            message="La tendencia requiere históricos que aún no se almacenan."
          />
        </SectionCard>
      </div>

      {/* Fila 4 — IA Insights · Certificación */}
      <div className="dash-grid dash-grid--2">
        <SectionCard title="IA Insights">
          <Placeholder title="Próximamente" message="Sin análisis disponibles." />
        </SectionCard>
        <SectionCard title="Estado de certificación">
          <Placeholder
            title="Próximamente"
            message="El seguimiento de certificación se habilitará más adelante."
          />
        </SectionCard>
      </div>

      {/* Resumen operativo (datos reales) */}
      <div className="dash-grid dash-grid--3">
        <SectionCard title="CAPA por estado">
          {statusSegments.length === 0 ? (
            <p className="empty-state">Sin CAPA registradas.</p>
          ) : (
            <DonutChart segments={statusSegments} title="CAPA por estado" />
          )}
        </SectionCard>
        <SectionCard title="Abiertas por prioridad">
          {prioritySegments.length === 0 ? (
            <p className="empty-state">Sin CAPA abiertas.</p>
          ) : (
            <BarChart bars={prioritySegments} title="Abiertas por prioridad" />
          )}
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
            <StatCard
              label="Vigentes"
              value={docSummary.effective}
              tone="success"
              href="/dashboard/documents?status=effective"
            />
            <StatCard
              label="Próx. revisión"
              value={docSummary.dueSoon}
              tone="warning"
              href="/dashboard/documents"
            />
            <StatCard
              label="Lecturas pend."
              value={alerts.pendingReads}
              href="/dashboard/documents/tasks"
            />
          </div>
        </SectionCard>
      </div>

      <p className="muted exec__foot">
        Diagnósticos registrados: {data?.diagnosticsCount ?? 0}.{' '}
        <Link href="/dashboard/capa">Ir a acciones correctivas</Link>
      </p>
    </main>
  );
}
