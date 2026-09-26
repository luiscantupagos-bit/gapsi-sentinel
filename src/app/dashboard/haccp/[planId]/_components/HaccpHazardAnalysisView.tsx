/**
 * HACCP-003 — vista read-only reutilizable del análisis de peligros (para workspace y futuro
 * PDF HACCP-007). Agrupa por MATERIA PRIMA o por ETAPA, colapsable, con contador de peligros y
 * significativos. No decide PCC/PPRO (eso es HACCP-004).
 */
import Link from 'next/link';
import { hazardTypeLabel } from '@/features/haccp/haccp-hazards';

export interface HazardRow {
  id: string;
  hazardType: string;
  name: string;
  description?: string | null;
  originOrCause?: string | null;
  probability: number;
  severity: number;
  riskScore: number;
  isSignificant: boolean;
  significanceSource: string;
  existingControlMeasure?: string | null;
}

export interface HazardGroup {
  key: string;
  title: string;
  subtitle?: string | null;
  href?: string | null;
  hazards: HazardRow[];
  significantCount: number;
}

function HazardTable({ hazards }: { hazards: HazardRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Peligro</th>
            <th>P</th>
            <th>S</th>
            <th>Riesgo</th>
            <th>Significativo</th>
            <th>Medida existente</th>
          </tr>
        </thead>
        <tbody>
          {hazards.map((h) => (
            <tr key={h.id} className={h.isSignificant ? 'row--significant' : undefined}>
              <td>{hazardTypeLabel(h.hazardType)}</td>
              <td>{h.name}</td>
              <td>{h.probability}</td>
              <td>{h.severity}</td>
              <td>
                <strong>{h.riskScore}</strong>
              </td>
              <td>
                {h.isSignificant ? 'Sí' : 'No'}
                {h.significanceSource === 'override' ? ' (manual)' : ''}
              </td>
              <td>{h.existingControlMeasure ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HaccpHazardAnalysisView({
  groups,
  emptyLabel,
}: {
  groups: HazardGroup[];
  emptyLabel: string;
}) {
  if (groups.length === 0) {
    return <p className="empty-state empty-state--compact">{emptyLabel}</p>;
  }
  return (
    <div className="haccp-hazards">
      {groups.map((g) => (
        <details key={g.key} className="haccp-hazard-group" open={g.hazards.length > 0}>
          <summary>
            <strong>{g.title}</strong>
            {g.subtitle ? <span className="muted"> · {g.subtitle}</span> : null}{' '}
            <span className="badge">{g.hazards.length} peligro(s)</span>
            {g.significantCount > 0 && (
              <span className="badge badge--warn">{g.significantCount} significativo(s)</span>
            )}
          </summary>
          {g.href && (
            <p className="muted">
              <Link href={g.href}>Ver fuente</Link>
            </p>
          )}
          {g.hazards.length === 0 ? (
            <p className="empty-state empty-state--compact">Sin análisis de peligros.</p>
          ) : (
            <HazardTable hazards={g.hazards} />
          )}
        </details>
      ))}
    </div>
  );
}
