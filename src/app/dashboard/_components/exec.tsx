/**
 * Componentes del Dashboard Ejecutivo (CORE-ALIGN-002). Tema claro, densidad
 * ejecutiva. Solo presentación; los datos siempre son reales y se pasan por
 * props. Sin métricas inventadas: los estados vacíos se muestran explícitamente.
 */
import Link from 'next/link';

export type Tone = 'blue' | 'amber' | 'red' | 'green' | 'slate';

const TONE_FG: Record<Tone, string> = {
  blue: '#2563eb',
  amber: '#d97706',
  red: '#dc2626',
  green: '#16a34a',
  slate: '#64748b',
};

// ---------------------------------------------------------------------------
// Franja de contexto
// ---------------------------------------------------------------------------

export function ContextStrip({ children }: { children: React.ReactNode }) {
  return <div className="ctxstrip">{children}</div>;
}

export function ContextItem({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="ctxstrip__item">
      <span className="ctxstrip__icon" aria-hidden>
        {icon}
      </span>
      <span className="ctxstrip__body">
        <span className="ctxstrip__label">{label}</span>
        <span className="ctxstrip__value">{value}</span>
        {sub && <span className="ctxstrip__sub">{sub}</span>}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI tile
// ---------------------------------------------------------------------------

export function KpiTile({
  icon,
  label,
  value,
  tone = 'blue',
  context,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  context?: React.ReactNode;
  href?: string;
}) {
  const color = TONE_FG[tone];
  const inner = (
    <>
      <span className="kpitile__icon" style={{ color, background: `${color}14` }} aria-hidden>
        {icon}
      </span>
      <span className="kpitile__body">
        <span className="kpitile__label">{label}</span>
        <span className="kpitile__value">{value}</span>
        {context && <span className="kpitile__context">{context}</span>}
      </span>
    </>
  );
  const className = `kpitile kpitile--${tone}${href ? ' kpitile--link' : ''}`;
  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

// ---------------------------------------------------------------------------
// Gauge (estado del sistema)
// ---------------------------------------------------------------------------

function riskColor(risk: string): string {
  switch (risk) {
    case 'low':
      return '#16a34a';
    case 'moderate':
      return '#d97706';
    case 'high':
      return '#ea580c';
    case 'critical':
      return '#dc2626';
    default:
      return '#64748b';
  }
}

export function Gauge({ value, color }: { value: number; color: string }) {
  const cx = 90;
  const cy = 90;
  const r = 72;
  const polar = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const [sx, sy] = polar(180);
  const [ex, ey] = polar(0);
  const v = Math.max(0, Math.min(100, value));
  const [vx, vy] = polar(180 - (v / 100) * 180);
  const large = v > 50 ? 1 : 0;
  return (
    <svg
      viewBox="0 0 180 108"
      width="100%"
      style={{ maxWidth: 220 }}
      role="img"
      aria-label={`${value}%`}
    >
      <title>Cumplimiento: {value}%</title>
      <path
        d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`}
        fill="none"
        stroke="#eef2f6"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d={`M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${vx} ${vy}`}
        fill="none"
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
      />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="30" fontWeight="700" fill="#16202b">
        {value}%
      </text>
    </svg>
  );
}

export function SystemStatusCard({
  status,
}: {
  status: {
    diagnosticId: string;
    name: string;
    scheme: string;
    status: string;
    percentage: number;
    riskLevel: string;
  } | null;
}) {
  if (!status) {
    return (
      <div className="sysstatus sysstatus--empty">
        <p className="sysstatus__empty">Sin evaluación vigente.</p>
        <Link className="button button--primary" href="/dashboard/diagnostics">
          Ver diagnósticos
        </Link>
      </div>
    );
  }
  const riskLabel: Record<string, string> = {
    low: 'Bajo',
    moderate: 'Moderado',
    high: 'Alto',
    critical: 'Crítico',
  };
  const vigente = status.status === 'submitted' || status.status === 'reviewed';
  return (
    <div className="sysstatus">
      <Gauge value={status.percentage} color={vigente ? riskColor(status.riskLevel) : '#94a3b8'} />
      {vigente ? (
        <p className="sysstatus__risk" style={{ color: riskColor(status.riskLevel) }}>
          Riesgo {riskLabel[status.riskLevel] ?? status.riskLevel}
        </p>
      ) : (
        <p className="sysstatus__risk sysstatus__risk--muted">Evaluación en progreso</p>
      )}
      <p className="sysstatus__meta">
        {status.scheme}
        {vigente ? '' : ' · avance de cumplimiento'}
      </p>
      <Link className="button button--ghost" href={`/dashboard/diagnostics/${status.diagnosticId}`}>
        {vigente ? 'Ver diagnóstico' : 'Continuar diagnóstico'}
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barras de cumplimiento por esquema
// ---------------------------------------------------------------------------

export function SchemeBars({
  items,
}: {
  items: {
    scheme: string;
    percentage: number;
    riskLevel: string;
    diagnosticId: string;
    status: string;
  }[];
}) {
  if (items.length === 0) {
    return <p className="empty-state">Sin evaluaciones disponibles.</p>;
  }
  return (
    <ul className="schemebars">
      {items.map((it) => {
        const vigente = it.status === 'submitted' || it.status === 'reviewed';
        return (
          <li
            key={it.diagnosticId}
            className="schemebars__row"
            title={`${it.scheme}: ${it.percentage}%${vigente ? '' : ' (en progreso)'}`}
          >
            <Link href={`/dashboard/diagnostics/${it.diagnosticId}`} className="schemebars__name">
              {it.scheme}
              {!vigente && <span className="schemebars__tag"> · en progreso</span>}
            </Link>
            <span className="schemebars__track" aria-hidden>
              <span
                className="schemebars__fill"
                style={{
                  width: `${it.percentage}%`,
                  background: vigente ? riskColor(it.riskLevel) : '#cbd5e1',
                }}
              />
            </span>
            <span className="schemebars__pct">{it.percentage}%</span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Mini Gantt
// ---------------------------------------------------------------------------

function dayNum(iso: string): number {
  return Math.floor(new Date(`${iso}T00:00:00.000Z`).getTime() / 86400000);
}

export function MiniGantt({
  rows,
  today,
}: {
  rows: {
    id: string;
    label: string;
    folio: string | null;
    start: string;
    end: string;
    progress: number | null;
    overdue: boolean;
    href: string;
    milestones: { label: string; date: string; overdue: boolean }[];
  }[];
  today: string;
}) {
  if (rows.length === 0) {
    return <p className="empty-state">Sin proyectos con fechas para mostrar.</p>;
  }
  const t = dayNum(today);
  const starts = rows.map((r) => dayNum(r.start));
  const ends = rows.map((r) => dayNum(r.end));
  const min = Math.min(...starts, t);
  const max = Math.max(...ends, t + 30);
  const span = Math.max(1, max - min);
  const pct = (iso: string) => ((dayNum(iso) - min) / span) * 100;
  const todayPct = ((t - min) / span) * 100;

  return (
    <div className="minigantt">
      <div className="minigantt__today" style={{ left: `${todayPct}%` }} aria-hidden />
      {rows.map((r) => {
        const left = pct(r.start);
        const width = Math.max(2, pct(r.end) - left);
        return (
          <Link key={r.id} href={r.href} className="minigantt__row">
            <span className="minigantt__label" title={r.label}>
              {r.folio ? `${r.folio} · ` : ''}
              {r.label}
            </span>
            <span className="minigantt__track">
              <span
                className={`minigantt__bar${r.overdue ? ' is-overdue' : ''}`}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${r.folio ? `${r.folio} · ` : ''}${r.label}\n${r.start} → ${r.end}${r.progress != null ? ` · ${r.progress}%` : ''}${r.overdue ? ' · vencido' : ''}`}
              >
                {r.progress != null && (
                  <span className="minigantt__progress" style={{ width: `${r.progress}%` }} />
                )}
              </span>
              {r.milestones.map((m, i) => (
                <span
                  key={i}
                  className={`minigantt__ms${m.overdue ? ' is-overdue' : ''}`}
                  style={{ left: `${pct(m.date)}%` }}
                  title={`${m.label} · ${m.date}`}
                  aria-hidden
                />
              ))}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tendencia (líneas)
// ---------------------------------------------------------------------------

export function TrendChart({
  months,
  series,
}: {
  months: string[];
  series: { key: string; label: string; color: string; values: number[] }[];
}) {
  const W = 640;
  const H = 180;
  const padL = 28;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxVal = Math.max(1, ...series.flatMap((s) => s.values));
  const n = months.length;
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / maxVal) * plotH;

  return (
    <div className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Tendencia 12 meses">
        <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="#e3e8ef" />
        {series.map((s) => (
          <polyline
            key={s.key}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          />
        ))}
        {/* Puntos interactivos: hover/foco muestran mes · serie · valor. */}
        {series.map((s) =>
          s.values.map((v, i) => (
            <circle
              key={`${s.key}-${i}`}
              className="trend__pt"
              cx={x(i)}
              cy={y(v)}
              r={2.6}
              fill={s.color}
              tabIndex={0}
              role="img"
              aria-label={`${s.label}, ${months[i]}: ${v}`}
            >
              <title>
                {months[i]} · {s.label}: {v}
              </title>
            </circle>
          )),
        )}
        {months.map((m, i) =>
          i % 3 === 0 ? (
            <text key={m} x={x(i)} y={H - 8} fontSize="10" textAnchor="middle" fill="#94a3b8">
              {m.slice(2)}
            </text>
          ) : null,
        )}
      </svg>
      <ul className="trend__legend">
        {series.map((s) => (
          <li key={s.key}>
            <span className="trend__dot" style={{ background: s.color }} aria-hidden />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
