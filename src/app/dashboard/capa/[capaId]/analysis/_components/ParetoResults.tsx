'use client';

import { useState } from 'react';
import { InteractiveParetoChart, type ParetoChartRow } from './InteractiveParetoChart';

/**
 * Sección de resultado del Pareto: gráfico interactivo (≈60%) + tabla accesible
 * (≈40%) con estado de hover compartido, para que al resaltar una barra se
 * resalte la fila y viceversa. La tabla es la representación alternativa
 * accesible (no depende del color).
 */
export function ParetoResults({ rows, cutoff }: { rows: ParetoChartRow[]; cutoff: number }) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="pareto-results">
      <div className="report-card pareto-results__chart">
        <h2>Diagrama de Pareto</h2>
        {rows.length === 0 ? (
          <p className="empty-state">Captura datos para ver el Pareto.</p>
        ) : (
          <InteractiveParetoChart
            rows={rows}
            cutoff={cutoff}
            hovered={hovered}
            onHover={setHovered}
          />
        )}
      </div>
      <div className="report-card pareto-results__table">
        <h2>Datos</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Categoría</th>
                <th>Cant.</th>
                <th>%</th>
                <th>% Acum</th>
                <th>Vital</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    Sin datos.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr
                    key={r.id ?? r.category}
                    className={hovered === i ? 'is-hover' : undefined}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(i)}
                    onBlur={() => setHovered(null)}
                    tabIndex={0}
                  >
                    <td>{i + 1}</td>
                    <td>{r.category}</td>
                    <td>{r.value}</td>
                    <td>{r.percentage}%</td>
                    <td>{r.cumulativePercentage}%</td>
                    <td>
                      {r.vitalFew ? (
                        <span className="badge badge--sev-low">Sí</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
