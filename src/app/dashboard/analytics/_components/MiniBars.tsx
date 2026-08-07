/**
 * Gráfico de barras minimalista renderizado en servidor (SVG, sin JS). Muestra la
 * serie temporal de un KPI o tendencia. Determinista y accesible por etiquetas.
 */
export function MiniBars({
  points,
  height = 120,
  color = 'var(--accent, #2563eb)',
}: {
  points: { label: string; value: number }[];
  height?: number;
  color?: string;
}) {
  if (points.length === 0) return <p className="muted">Sin datos para graficar.</p>;
  const max = Math.max(...points.map((p) => p.value), 1);
  const barW = 100 / points.length;
  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Serie temporal"
      style={{ width: '100%', height }}
    >
      {points.map((p, i) => {
        const h = (p.value / max) * (height - 20);
        return (
          <g key={p.label}>
            <rect
              x={i * barW + barW * 0.15}
              y={height - 16 - h}
              width={barW * 0.7}
              height={Math.max(h, 0.5)}
              fill={color}
              rx={0.6}
            >
              <title>
                {p.label}: {p.value}
              </title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}
