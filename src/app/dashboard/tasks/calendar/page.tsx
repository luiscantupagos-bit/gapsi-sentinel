import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { listGlobalTasks } from '@/server/tasks';
import { listMilestones } from '@/server/projects';
import { PageHeader } from '../../_components/ui';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

type CalItem = {
  date: string;
  label: string;
  href: string;
  kind: 'task' | 'milestone';
  status: string;
  overdue: boolean;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default async function TaskCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireServerSession();
  const sp = await searchParams;
  const now = new Date();
  const [yy, mm] = (sp.month ?? `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`)
    .split('-')
    .map(Number);
  const year = yy || now.getUTCFullYear();
  const month = (mm || now.getUTCMonth() + 1) - 1; // 0-based

  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));
  const fromISO = `${year}-${pad(month + 1)}-01`;
  const toISO = `${year}-${pad(month + 1)}-${pad(last.getUTCDate())}`;
  const todayISO = now.toISOString().slice(0, 10);

  const [tasks, milestones] = await Promise.all([
    listGlobalTasks(session.organizationId, session.userId, {}),
    listMilestones(session.organizationId, { from: fromISO, to: toISO }),
  ]);

  const items: CalItem[] = [];
  for (const t of tasks) {
    if (t.targetDate && t.targetDate >= fromISO && t.targetDate <= toISO) {
      items.push({
        date: t.targetDate,
        label: t.title,
        href: t.detailHref ?? t.originHref,
        kind: 'task',
        status: t.status,
        overdue: t.overdue,
      });
    }
  }
  for (const m of milestones) {
    if (m.targetDate) {
      items.push({
        date: m.targetDate,
        label: `◆ ${m.name}`,
        href: `/dashboard/projects/${m.projectId}`,
        kind: 'milestone',
        status: m.status,
        overdue: m.overdue,
      });
    }
  }
  const byDate = new Map<string, CalItem[]>();
  for (const it of items) {
    const list = byDate.get(it.date) ?? [];
    list.push(it);
    byDate.set(it.date, list);
  }

  // Rejilla desde el lunes de la primera semana (42 celdas).
  const startWeekday = (first.getUTCDay() + 6) % 7; // lunes=0
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - startWeekday);
  const cells: { iso: string; day: number; inMonth: boolean; isToday: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    cells.push({
      iso,
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month,
      isToday: iso === todayISO,
    });
  }

  const prev = month === 0 ? `${year - 1}-12` : `${year}-${pad(month)}`;
  const next = month === 11 ? `${year + 1}-01` : `${year}-${pad(month + 2)}`;

  return (
    <main className="container">
      <PageHeader
        title="Calendario"
        subtitle="Vencimientos de tareas e hitos de proyecto."
        actions={
          <Link className="button button--ghost" href="/dashboard/tasks">
            Ver lista
          </Link>
        }
      />

      <div className="cal-nav">
        <Link className="button button--ghost" href={`/dashboard/tasks/calendar?month=${prev}`}>
          ← Mes anterior
        </Link>
        <strong className="cal-title">
          {MONTHS[month]} {year}
        </strong>
        <Link className="button button--ghost" href={`/dashboard/tasks/calendar?month=${next}`}>
          Mes siguiente →
        </Link>
      </div>

      <div className="cal-grid" role="grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-weekday" role="columnheader">
            {w}
          </div>
        ))}
        {cells.map((c) => {
          const dayItems = byDate.get(c.iso) ?? [];
          return (
            <div
              key={c.iso}
              className={`cal-cell${c.inMonth ? '' : ' is-out'}${c.isToday ? ' is-today' : ''}`}
              role="gridcell"
            >
              <div className="cal-daynum">{c.day}</div>
              <ul className="cal-items">
                {dayItems.map((it, idx) => (
                  <li key={idx}>
                    <Link
                      href={it.href}
                      className={`cal-item cal-item--${it.kind}${it.overdue ? ' is-overdue' : ''}`}
                      title={it.label}
                    >
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </main>
  );
}
