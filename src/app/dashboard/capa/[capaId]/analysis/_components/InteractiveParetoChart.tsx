'use client';

export interface ParetoChartRow {
  id?: string;
  category: string;
  value: number;
  percentage: number;
  cumulativePercentage: number;
  vitalFew: boolean;
}

const W = 920;
const H = 360;
const PAD_L = 44;
const PAD_R = 44;
const PAD_T = 26;

const truncate = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/**
 * Gráfico de Pareto interactivo (barras + línea acumulada + corte). El hover /
 * foco resalta la barra, el punto acumulado y (vía estado compartido) la fila de
 * la tabla, y muestra un tooltip. No recalcula nada: recibe filas ya calculadas.
 * Respeta `prefers-reduced-motion` (transiciones vía CSS).
 */
export function InteractiveParetoChart({
  rows,
  cutoff,
  hovered,
  onHover,
}: {
  rows: ParetoChartRow[];
  cutoff: number;
  hovered: number | null;
  onHover: (i: number | null) => void;
}) {
  const data = rows.slice(0, 14);
  const n = data.length;
  const padB = n > 7 ? 68 : 44;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - padB;
  const maxVal = Math.max(1, ...data.map((r) => r.value));
  const bw = n > 0 ? plotW / n : plotW;
  const x = (i: number) => PAD_L + i * bw;
  const cx = (i: number) => x(i) + bw / 2;
  const yVal = (v: number) => PAD_T + plotH - (v / maxVal) * plotH;
  const yPct = (p: number) => PAD_T + plotH - (p / 100) * plotH;
  const cutoffY = yPct(cutoff);
  const rotate = n > 7;
  const labelSize = n > 10 ? 9 : 11;
  const showValues = n <= 12;

  const linePts = data.map((r, i) => `${cx(i)},${yPct(r.cumulativePercentage)}`).join(' ');

  const tip = hovered != null ? data[hovered] : null;
  const tipLeft = hovered != null ? Math.min(90, Math.max(10, (cx(hovered) / W) * 100)) : 0;
  const tipTop = tip ? (Math.min(yVal(tip.value), yPct(tip.cumulativePercentage)) / H) * 100 : 0;

  return (
    <div className="pareto-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Gráfico de Pareto interactivo. Los detalles están en la tabla adjunta."
      >
        {/* Ejes */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + plotH} stroke="#cbd5e1" />
        <line x1={PAD_L} y1={PAD_T + plotH} x2={W - PAD_R} y2={PAD_T + plotH} stroke="#cbd5e1" />
        {/* Línea del 80% (corte) */}
        <line
          x1={PAD_L}
          y1={cutoffY}
          x2={W - PAD_R}
          y2={cutoffY}
          stroke="#0f2440"
          strokeWidth={1.5}
          strokeDasharray="6 5"
        />
        <text x={W - PAD_R + 2} y={cutoffY + 4} fontSize={11} fontWeight={700} fill="#0f2440">
          {cutoff}%
        </text>

        {/* Barras */}
        {data.map((r, i) => {
          const active = hovered === i;
          const bx = x(i) + 7;
          const bwEff = Math.max(6, bw - 14);
          const by = yVal(r.value);
          const bh = PAD_T + plotH - by;
          const fill = r.vitalFew ? '#16a34a' : '#93b4d8';
          return (
            <g
              key={r.id ?? r.category}
              className={`pareto-bar${active ? ' is-active' : ''}`}
              tabIndex={0}
              role="button"
              aria-label={`${r.category}: ${r.value}, ${r.percentage}%, acumulado ${r.cumulativePercentage}%, ${r.vitalFew ? 'grupo vital' : 'no vital'}, posición ${i + 1} de ${n}`}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(i)}
              onBlur={() => onHover(null)}
            >
              <rect
                className="pareto-bar__rect"
                x={bx}
                y={by}
                width={bwEff}
                height={bh}
                rx={3}
                fill={fill}
                stroke={active ? '#0f2440' : 'transparent'}
                strokeWidth={active ? 2 : 0}
                opacity={hovered == null || active ? 1 : 0.55}
              />
              {showValues && (
                <text
                  x={cx(i)}
                  y={by - 6}
                  fontSize={labelSize}
                  fontWeight={active ? 700 : 500}
                  textAnchor="middle"
                  fill="#16202b"
                >
                  {r.value}
                </text>
              )}
              <text
                className="pareto-bar__label"
                x={rotate ? cx(i) : cx(i)}
                y={PAD_T + plotH + (rotate ? 12 : 16)}
                fontSize={labelSize}
                fontWeight={active ? 700 : 500}
                textAnchor={rotate ? 'end' : 'middle'}
                fill="#334155"
                transform={rotate ? `rotate(-32 ${cx(i)} ${PAD_T + plotH + 12})` : undefined}
              >
                {truncate(r.category, rotate ? 16 : 12)}
              </text>
            </g>
          );
        })}

        {/* Línea acumulada */}
        {n > 0 && (
          <polyline
            className="pareto-line"
            points={linePts}
            fill="none"
            stroke="#d97706"
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        )}
        {data.map((r, i) => (
          <circle
            key={`pt-${r.id ?? r.category}`}
            cx={cx(i)}
            cy={yPct(r.cumulativePercentage)}
            r={hovered === i ? 6 : 3.5}
            fill="#b45309"
            stroke="#fff"
            strokeWidth={hovered === i ? 2 : 1}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {tip && (
        <div
          className="pareto-tip"
          role="status"
          style={{ left: `${tipLeft}%`, top: `${tipTop}%` }}
        >
          <strong>{tip.category}</strong>
          <span>Cantidad: {tip.value}</span>
          <span>Porcentaje: {tip.percentage}%</span>
          <span>Acumulado: {tip.cumulativePercentage}%</span>
          <span className={tip.vitalFew ? 'pareto-tip__vital' : 'pareto-tip__nonvital'}>
            {tip.vitalFew ? 'Grupo vital (80/20)' : 'No vital'}
          </span>
          <span className="muted">
            Ranking: {(hovered ?? 0) + 1} de {n}
          </span>
        </div>
      )}

      {/* Leyenda accesible (no depende solo del color) */}
      <ul className="pareto-legend" aria-hidden="false">
        <li>
          <span className="pareto-legend__sw pareto-legend__sw--vital" /> Grupo vital
        </li>
        <li>
          <span className="pareto-legend__sw pareto-legend__sw--nonvital" /> No vital
        </li>
        <li>
          <span className="pareto-legend__sw pareto-legend__sw--line" /> % acumulado
        </li>
      </ul>
    </div>
  );
}
