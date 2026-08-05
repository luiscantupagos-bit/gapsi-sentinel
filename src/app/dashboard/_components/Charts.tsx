/**
 * Gráficos SVG de servidor para el panel (donut y barras). Accesibles: cada
 * gráfico incluye una leyenda/etiqueta con el valor (no dependen solo del color).
 */
export interface Segment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({ segments, title }: { segments: Segment[]; title: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 54;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="chart" role="img" aria-label={`${title}: total ${total}`}>
      <svg viewBox="0 0 140 140" width="140" height="140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#eef2f6" strokeWidth="18" />
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => {
              const len = (s.value / total) * c;
              const el = (
                <circle
                  key={s.label}
                  cx="70"
                  cy="70"
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="18"
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-acc}
                  transform="rotate(-90 70 70)"
                >
                  <title>
                    {s.label}: {s.value}
                  </title>
                </circle>
              );
              acc += len;
              return el;
            })}
        <text x="70" y="66" textAnchor="middle" fontSize="20" fontWeight="700" fill="#16202b">
          {total}
        </text>
        <text x="70" y="84" textAnchor="middle" fontSize="9" fill="#64748b">
          total
        </text>
      </svg>
      <ul className="chart__legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="chart__dot" style={{ background: s.color }} aria-hidden />
            <span>{s.label}</span>
            <span className="chart__val">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BarChart({ bars, title }: { bars: Segment[]; title: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="barchart" role="img" aria-label={title}>
      {bars.map((b) => (
        <div key={b.label} className="barchart__row">
          <span className="barchart__label">{b.label}</span>
          <span className="barchart__track">
            <span
              className="barchart__fill"
              style={{ width: `${(b.value / max) * 100}%`, background: b.color }}
            />
          </span>
          <span className="barchart__val">{b.value}</span>
        </div>
      ))}
    </div>
  );
}
