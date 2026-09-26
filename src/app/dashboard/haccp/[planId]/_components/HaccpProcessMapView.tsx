/**
 * HACCP-PROCESS-EXPANSION — Mapa de proceso reutilizable (workspace + futuro PDF HACCP-007).
 * Read-only, print-safe, sin estado. Composición tipo SIPOC por etapa:
 * ENTRADAS → ETAPA → SALIDAS → DESTINOS. Vista general compacta (conteos); el detalle se
 * consulta en la descripción de etapas. Responsive (§X): columnas en desktop, tarjetas apiladas
 * en móvil.
 */
import {
  inputTypeLabel,
  inputSourceLabel,
  outputTypeLabel,
  destinationTypeLabel,
  destinationIsExternal,
  isSecondaryOutput,
} from '@/features/haccp/haccp-process';
import type { ProcessStepView } from '@/server/haccp-process';

function destinationText(d: ProcessStepView['outputs'][number]['destinations'][number]): string {
  if (d.destinationStepName) return d.destinationStepName;
  if (d.destinationExternalText) return d.destinationExternalText;
  return destinationTypeLabel(d.destinationType);
}

export function HaccpProcessMapView({
  steps,
  compact = false,
}: {
  steps: ProcessStepView[];
  compact?: boolean;
}) {
  if (steps.length === 0) {
    return <p className="empty-state empty-state--compact">El proceso aún no tiene etapas.</p>;
  }
  return (
    <div className="haccp-map">
      {steps.map((step, i) => {
        const altRoutes = step.outputs.reduce(
          (n, o) => n + Math.max(0, o.destinations.length - 1),
          0,
        );
        return (
          <section key={step.id} className="haccp-map__step">
            <header className="haccp-map__stephead">
              <span className="haccp-map__num">{String(i + 1).padStart(2, '0')}</span>
              <strong>{step.name}</strong>
              {step.area && <span className="muted"> · {step.area}</span>}
            </header>

            {compact ? (
              <div className="haccp-map__counts">
                <span>Entradas: {step.inputs.length}</span>
                <span>Salidas: {step.outputs.length}</span>
                <span>Rutas alternas: {altRoutes}</span>
              </div>
            ) : (
              <div className="haccp-map__sipoc">
                <div className="haccp-map__col">
                  <h4>Entradas</h4>
                  {step.inputs.length === 0 ? (
                    <p className="muted">—</p>
                  ) : (
                    <ul>
                      {step.inputs.map((inp) => (
                        <li key={inp.id}>
                          <strong>{inp.name}</strong>
                          <span className="muted"> · {inputTypeLabel(inp.inputType)}</span>
                          <span className="haccp-map__origin">
                            {inp.sourceStepName ??
                              inp.supplierName ??
                              inputSourceLabel(inp.sourceType)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="haccp-map__arrow" aria-hidden="true">
                  →
                </div>

                <div className="haccp-map__col haccp-map__col--out">
                  <h4>Salidas → destinos</h4>
                  {step.outputs.length === 0 ? (
                    <p className="muted">—</p>
                  ) : (
                    <ul>
                      {step.outputs.map((o) => (
                        <li
                          key={o.id}
                          className={isSecondaryOutput(o.outputType) ? 'haccp-map__secondary' : ''}
                        >
                          <strong>{o.name}</strong>
                          <span className="muted"> · {outputTypeLabel(o.outputType)}</span>
                          {o.destinations.length > 0 && (
                            <ul className="haccp-map__dests">
                              {o.destinations.map((d) => (
                                <li key={d.id}>
                                  → {destinationText(d)}
                                  {destinationIsExternal(d.destinationType) && (
                                    <span className="badge badge--warn haccp-map__ext">
                                      externo
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
