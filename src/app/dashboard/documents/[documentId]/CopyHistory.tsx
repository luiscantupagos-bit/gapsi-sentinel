/**
 * Historial de copias controladas de SALIDA (impresión / PDF) — DOC-UX-002 §79.
 * Datos reales desde `getControlledCopyHistory`. Server component (sin estado).
 */
import type { ControlledCopyHistoryRow } from '@/server/documents';

const TYPE_LABEL: Record<string, string> = { print: 'Impresa', pdf: 'PDF' };

export function CopyHistory({ rows }: { rows: ControlledCopyHistoryRow[] }) {
  return (
    <>
      <h3>Copias controladas (salidas)</h3>
      {rows.length === 0 ? (
        <p className="empty-state">Sin copias de impresión ni PDF generadas.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Tipo</th>
                <th>Versión</th>
                <th>Destino / Motivo</th>
                <th>Generada por</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.folio}</td>
                  <td>{TYPE_LABEL[r.copyType] ?? r.copyType}</td>
                  <td>{r.versionLabel}</td>
                  <td>{r.destinationLabel ?? r.reason ?? '—'}</td>
                  <td>{r.issuedByName ?? '—'}</td>
                  <td>{r.issuedAt ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
