import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { ProjectNotFoundError, getProjectDetail } from '@/server/projects';
import { PageHeader } from '../../../_components/ui';
import { GanttChart, type GanttRow } from '../_components/GanttChart';

const todayISO = () => new Date().toISOString().slice(0, 10);
const addMonthsISO = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

export default async function ProjectGanttPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await requireServerSession();
  const { projectId } = await params;
  let detail;
  try {
    detail = await getProjectDetail(session.organizationId, projectId);
  } catch (error) {
    if (error instanceof ProjectNotFoundError) notFound();
    throw error;
  }
  const p = detail.project;
  const t = todayISO();

  const rows: GanttRow[] = [
    ...detail.tasks.map((task): GanttRow => {
      const end = task.targetDate ?? task.startDate;
      return {
        id: `t-${task.id}`,
        kind: 'task',
        name: `${task.folio} · ${task.title}`,
        href: `/dashboard/tasks/${task.id}`,
        start: task.startDate ?? task.targetDate,
        end,
        progress: task.progress,
        status: task.status,
        overdue: task.status !== 'completed' && task.status !== 'cancelled' && !!end && end < t,
      };
    }),
    ...detail.milestones.map(
      (m): GanttRow => ({
        id: `m-${m.id}`,
        kind: 'milestone',
        name: `◆ ${m.name}`,
        href: null,
        start: m.targetDate,
        end: m.targetDate,
        progress: m.status === 'reached' ? 100 : 0,
        status: m.status,
        overdue:
          m.status !== 'reached' && m.status !== 'cancelled' && !!m.targetDate && m.targetDate < t,
      }),
    ),
  ];

  // Rango: del inicio del proyecto/primera fecha al objetivo/última fecha (con margen).
  const dates = [
    p.startDate,
    p.targetDate,
    ...rows.map((r) => r.start),
    ...rows.map((r) => r.end),
    t,
  ].filter((x): x is string => Boolean(x));
  const rangeStart = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : addMonthsISO(t, -1);
  const rangeEndRaw = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : addMonthsISO(t, 2);
  const rangeEnd = addMonthsISO(rangeEndRaw, 1); // margen final

  return (
    <main className="container">
      <p>
        <Link href={`/dashboard/projects/${p.id}`}>← Volver al proyecto</Link>
      </p>
      <PageHeader
        title={`Gantt · ${p.name}`}
        subtitle={`${p.folio} · tareas e hitos en el tiempo`}
      />
      <GanttChart rows={rows} rangeStart={rangeStart} rangeEnd={rangeEnd} today={t} />
    </main>
  );
}
