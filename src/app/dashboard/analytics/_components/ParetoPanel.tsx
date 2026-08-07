'use client';

import { useState } from 'react';
import {
  InteractiveParetoChart,
  type ParetoChartRow,
} from '../../capa/[capaId]/analysis/_components/InteractiveParetoChart';

/** Envoltorio cliente: mantiene el estado de hover y reutiliza el Pareto interactivo. */
export function ParetoPanel({ rows, cutoff }: { rows: ParetoChartRow[]; cutoff: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (rows.length === 0) return <p className="muted">Sin datos suficientes para el Pareto.</p>;
  return (
    <div>
      <InteractiveParetoChart rows={rows} cutoff={cutoff} hovered={hovered} onHover={setHovered} />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Categoría</th>
              <th>Valor</th>
              <th>%</th>
              <th>% acumulado</th>
              <th>Grupo vital</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.category}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                className={hovered === i ? 'is-hovered' : undefined}
              >
                <td>{i + 1}</td>
                <td>{r.category}</td>
                <td>{r.value}</td>
                <td>{r.percentage}%</td>
                <td>{r.cumulativePercentage}%</td>
                <td>{r.vitalFew ? 'Sí' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
