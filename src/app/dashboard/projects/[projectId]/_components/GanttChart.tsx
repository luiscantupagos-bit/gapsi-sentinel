/**
 * Gantt propio (sin librería): HTML/CSS con columna fija de nombres y línea de
 * tiempo con scroll horizontal interno. Barras clickeables, hitos en rombo,
 * marcador de "hoy", tareas vencidas y avance. Server-safe.
 */
import Link from 'next/link';

export interface GanttRow {
  id: string;
  kind: 'task' | 'milestone';
  name: string;
  href: string | null;
  start: string | null; // YYYY-MM-DD
  end: string | null;
  progress: number;
  status: string;
  overdue: boolean;
}

const DAY = 86400000;
const pct = (n: number) => `${Math.max(0, Math.min(100, n)) * 100}%`;

export function GanttChart({
  rows,
  rangeStart,
  rangeEnd,
  today,
}: {
  rows: GanttRow[];
  rangeStart: string;
  rangeEnd: string;
  today: string;
}) {
  if (rows.length === 0) {
    return <p className="empty-state">Sin tareas ni hitos con fechas para el Gantt.</p>;
  }
  const start = new Date(`${rangeStart}T00:00:00Z`).getTime();
  const end = new Date(`${rangeEnd}T00:00:00Z`).getTime();
  const total = Math.max(DAY, end - start);
  const frac = (d: string) => (new Date(`${d}T00:00:00Z`).getTime() - start) / total;

  // Meses en el rango (para la cabecera).
  const months: { label: string; left: number; width: number }[] = [];
  const cur = new Date(`${rangeStart}T00:00:00Z`);
  cur.setUTCDate(1);
  while (cur.getTime() <= end) {
    const mStart = Math.max(start, cur.getTime());
    const next = new Date(cur);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const mEnd = Math.min(end, next.getTime());
    months.push({
      label: cur.toLocaleDateString('es-MX', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      left: (mStart - start) / total,
      width: (mEnd - mStart) / total,
    });
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  const todayFrac = frac(today);
  const showToday = todayFrac >= 0 && todayFrac <= 1;

  return (
    <div className="gantt">
      <div className="gantt__inner">
        <div className="gantt__head">
          <div className="gantt__name gantt__name--head">Elemento</div>
          <div className="gantt__timeline gantt__timeline--head">
            {months.map((m, i) => (
              <span
                key={i}
                className="gantt__month"
                style={{ left: pct(m.left), width: pct(m.width) }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>

        {rows.map((r) => {
          const s = r.start ?? r.end;
          const e = r.end ?? r.start;
          const hasDates = Boolean(s && e);
          const left = hasDates ? frac(s!) : 0;
          const width = hasDates ? Math.max(0.01, frac(e!) - frac(s!)) : 0;
          return (
            <div className="gantt__row" key={r.id}>
              <div className="gantt__name">
                {r.href ? <Link href={r.href}>{r.name}</Link> : <span>{r.name}</span>}
              </div>
              <div className="gantt__timeline">
                {months.map((m, i) => (
                  <span
                    key={i}
                    className="gantt__grid"
                    style={{ left: pct(m.left), width: pct(m.width) }}
                  />
                ))}
                {showToday && <span className="gantt__today" style={{ left: pct(todayFrac) }} />}
                {hasDates &&
                  (r.kind === 'milestone' ? (
                    <span
                      className={`gantt__milestone${r.overdue ? ' is-overdue' : ''}`}
                      style={{ left: pct(left) }}
                      title={`${r.name} · ${r.end ?? ''}`}
                    />
                  ) : (
                    <span
                      className={`gantt__bar${r.overdue ? ' is-overdue' : ''}`}
                      style={{ left: pct(left), width: pct(width) }}
                      title={`${r.name} · ${r.start ?? '?'} → ${r.end ?? '?'} · ${r.progress}%`}
                    >
                      <span className="gantt__progress" style={{ width: `${r.progress}%` }} />
                    </span>
                  ))}
                {!hasDates && <span className="gantt__nodate">sin fechas</span>}
              </div>
            </div>
          );
        })}
      </div>
      <ul className="gantt__legend">
        <li>
          <span className="gantt__swatch gantt__swatch--bar" /> Tarea
        </li>
        <li>
          <span className="gantt__swatch gantt__swatch--ms" /> Hito
        </li>
        <li>
          <span className="gantt__swatch gantt__swatch--today" /> Hoy
        </li>
        <li>
          <span className="gantt__swatch gantt__swatch--overdue" /> Vencido
        </li>
      </ul>
    </div>
  );
}
