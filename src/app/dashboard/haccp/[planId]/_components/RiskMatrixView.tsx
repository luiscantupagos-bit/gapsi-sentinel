/**
 * HACCP-003 — matriz de riesgo N×N reutilizable (read-only). Severidad (filas) × Probabilidad
 * (columnas); cada celda muestra el SCORE y su banda (no depende solo del color, §24). Semántica
 * de riesgo HACCP, independiente del semáforo de cumplimiento (§25).
 */
import {
  computeRiskScore,
  riskBand,
  RISK_BAND_LABEL,
  type RiskMatrixConfig,
} from '@/features/haccp/haccp-hazards';

export function RiskMatrixView({ matrix }: { matrix: RiskMatrixConfig }) {
  const probs = matrix.probabilityScale;
  const sevs = [...matrix.severityScale].sort((a, b) => b.value - a.value); // severidad alta arriba
  return (
    <div className="table-wrap">
      <table className="risk-matrix" aria-label="Matriz de riesgo (severidad × probabilidad)">
        <thead>
          <tr>
            <th>Severidad ＼ Probabilidad</th>
            {probs.map((p) => (
              <th key={p.value}>
                {p.value} · {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sevs.map((s) => (
            <tr key={s.value}>
              <th scope="row">
                {s.value} · {s.label}
              </th>
              {probs.map((p) => {
                const score = computeRiskScore(p.value, s.value, matrix.scoreFormula);
                const band = riskBand(score, matrix.significanceThreshold);
                return (
                  <td key={p.value} className={`risk-cell risk-cell--${band}`}>
                    <span className="risk-cell__score">{score}</span>
                    <span className="risk-cell__band">{RISK_BAND_LABEL[band]}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">
        Umbral de significancia: score ≥ {matrix.significanceThreshold} · Fórmula:{' '}
        {matrix.scoreFormula === 'sum' ? 'Probabilidad + Severidad' : 'Probabilidad × Severidad'}
      </p>
    </div>
  );
}
