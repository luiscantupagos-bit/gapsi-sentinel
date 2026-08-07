import type { BivariateResult, VariableRef } from '@/features/analytics/bivariate';

/** Presenta el resultado del análisis bivariado con su interpretación prudente. */
export function BivariateView({
  x,
  y,
  result,
}: {
  x: VariableRef;
  y: VariableRef;
  result: BivariateResult;
}) {
  if (result.kind === 'unsupported') return <p className="msg msg--error">{result.message}</p>;

  if (result.kind === 'numeric-numeric') {
    const { pearson: p, spearman: sp, regression: reg } = result;
    return (
      <div className="stat-result">
        <h3>
          {x.label} vs {y.label} — correlación y regresión
        </h3>
        <ul className="def-list">
          <li>
            <span>Pearson (r)</span>
            <strong>{p.ok ? p.r : '—'}</strong>
          </li>
          <li>
            <span>Spearman (ρ)</span>
            <strong>{sp.ok ? sp.r : '—'}</strong>
          </li>
          <li>
            <span>Regresión</span>
            <strong>
              {reg.ok ? `y = ${reg.intercept} + ${reg.slope}·x (R²=${reg.r2}, n=${reg.n})` : '—'}
            </strong>
          </li>
        </ul>
        {reg.ok && reg.line && <Scatter points={reg.points} line={reg.line} />}
        <p className="msg msg--info">{p.interpretation}</p>
        <p className="muted">{reg.interpretation}</p>
      </div>
    );
  }

  if (result.kind === 'categorical-categorical') {
    const c = result.contingency;
    return (
      <div className="stat-result">
        <h3>
          {x.label} vs {y.label} — tabla de contingencia y chi²
        </h3>
        {c.ok ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    {x.label} \ {y.label}
                  </th>
                  {c.colLabels.map((cl) => (
                    <th key={cl}>{cl}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.rowLabels.map((rl, i) => (
                  <tr key={rl}>
                    <td>
                      <strong>{rl}</strong>
                    </td>
                    {c.colLabels.map((_, j) => (
                      <td key={j}>{c.observed[i]?.[j] ?? 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className={c.lowExpectedWarning ? 'msg msg--error' : 'msg msg--info'}>
          {c.interpretation}
        </p>
      </div>
    );
  }

  // categorical-numeric → ANOVA
  const a = result.anova;
  return (
    <div className="stat-result">
      <h3>
        {x.label} vs {y.label} — ANOVA de una vía
      </h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Grupo</th>
              <th>n</th>
              <th>Media</th>
              <th>Desv. est.</th>
            </tr>
          </thead>
          <tbody>
            {a.groups.map((g) => (
              <tr key={g.label}>
                <td>{g.label}</td>
                <td>{g.n}</td>
                <td>{g.mean ?? '—'}</td>
                <td>{g.stdDev ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {a.ok && (
        <p className="muted">
          F = {a.fStatistic} (gl {a.dfBetween}, {a.dfWithin})
        </p>
      )}
      <p className={a.conditionsValid ? 'msg msg--info' : 'msg msg--error'}>{a.interpretation}</p>
    </div>
  );
}

function Scatter({
  points,
  line,
}: {
  points: { x: number; y: number }[];
  line: { x: number; y: number }[];
}) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys, ...line.map((l) => l.y));
  const maxY = Math.max(...ys, ...line.map((l) => l.y));
  const W = 320;
  const H = 200;
  const pad = 24;
  const sx = (v: number) =>
    maxX === minX ? W / 2 : pad + ((v - minX) / (maxX - minX)) * (W - 2 * pad);
  const sy = (v: number) =>
    maxY === minY ? H / 2 : H - pad - ((v - minY) / (maxY - minY)) * (H - 2 * pad);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Diagrama de dispersión con recta de regresión"
      style={{ maxWidth: W }}
    >
      <line
        x1={sx(line[0]!.x)}
        y1={sy(line[0]!.y)}
        x2={sx(line[1]!.x)}
        y2={sy(line[1]!.y)}
        stroke="var(--accent, #2563eb)"
        strokeWidth={1.5}
      />
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2.5} fill="#64748b" />
      ))}
    </svg>
  );
}
