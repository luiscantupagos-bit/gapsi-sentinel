/**
 * HACCP-PROCESS-EXPANSION — Descripción de etapas reutilizable (workspace + futuro PDF HACCP-007,
 * §L/§L1). Read-only, print-safe. Por cada etapa: actividad, origen/proveedores, entradas,
 * salidas, destino de cada salida, área, responsable, equipo, parámetros y observaciones.
 * También expone una vista SIPOC en tabla (§J).
 */
import {
  inputTypeLabel,
  inputSourceLabel,
  outputTypeLabel,
  destinationTypeLabel,
} from '@/features/haccp/haccp-process';
import type { ProcessStepView } from '@/server/haccp-process';

const field = (label: string, value: string | null | undefined) =>
  value && value.trim() ? (
    <div className="doc-report__field">
      <span className="doc-report__field-label">{label}</span>
      <p>{value}</p>
    </div>
  ) : null;

function destText(d: ProcessStepView['outputs'][number]['destinations'][number]): string {
  const target =
    d.destinationStepName ?? d.destinationExternalText ?? destinationTypeLabel(d.destinationType);
  return d.destinationStepName ? target : `${destinationTypeLabel(d.destinationType)}: ${target}`;
}

export function HaccpProcessStageDescriptionView({ steps }: { steps: ProcessStepView[] }) {
  if (steps.length === 0) {
    return <p className="empty-state empty-state--compact">Sin etapas descritas.</p>;
  }
  return (
    <div className="haccp-stagedesc">
      {steps.map((step, i) => (
        <section key={step.id} className="haccp-control-card">
          <header className="haccp-control-card__head">
            <strong>
              {String(i + 1).padStart(2, '0')} · {step.name}
            </strong>
            {step.area && <span className="muted"> · {step.area}</span>}
          </header>
          <div className="haccp-plan-fields">
            {field('Descripción de la actividad', step.description)}
            {field('Área', step.area)}
            {field('Responsable', step.responsibleName ?? step.responsibleRole)}
            {field('Equipo / utensilios', step.equipment)}
            {field('Parámetros', step.parameters)}
            {field('Observaciones', step.notes)}
          </div>

          <h4>Entradas y origen</h4>
          {step.inputs.length === 0 ? (
            <p className="muted">—</p>
          ) : (
            <ul className="haccp-stagedesc__list">
              {step.inputs.map((inp) => (
                <li key={inp.id}>
                  <strong>{inp.name}</strong> · {inputTypeLabel(inp.inputType)} ·{' '}
                  {inp.sourceStepName ?? inp.supplierName ?? inputSourceLabel(inp.sourceType)}
                </li>
              ))}
            </ul>
          )}

          <h4>Salidas y destino</h4>
          {step.outputs.length === 0 ? (
            <p className="muted">—</p>
          ) : (
            <ul className="haccp-stagedesc__list">
              {step.outputs.map((o) => (
                <li key={o.id}>
                  <strong>{o.name}</strong> · {outputTypeLabel(o.outputType)}
                  {o.destinations.length > 0 && (
                    <span> → {o.destinations.map(destText).join(' / ')}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/** Vista SIPOC en tabla (§J): Proveedor/Origen · Entradas · Proceso · Salidas · Cliente/Destino. */
export function HaccpSipocTableView({ steps }: { steps: ProcessStepView[] }) {
  if (steps.length === 0) {
    return <p className="empty-state empty-state--compact">Sin etapas.</p>;
  }
  return (
    <div className="haccp-sipoc">
      {steps.map((step, i) => {
        const origins = [
          ...new Set(
            step.inputs.map(
              (inp) => inp.sourceStepName ?? inp.supplierName ?? inputSourceLabel(inp.sourceType),
            ),
          ),
        ];
        const clients = [
          ...new Set(
            step.outputs.flatMap((o) =>
              o.destinations.map(
                (d) =>
                  d.destinationStepName ??
                  d.destinationExternalText ??
                  destinationTypeLabel(d.destinationType),
              ),
            ),
          ),
        ];
        return (
          <div key={step.id} className="haccp-sipoc__row">
            <div className="haccp-sipoc__cell" data-col="Proveedor / Origen">
              {origins.length ? origins.join(', ') : '—'}
            </div>
            <div className="haccp-sipoc__cell" data-col="Entradas">
              {step.inputs.length ? step.inputs.map((inp) => inp.name).join(', ') : '—'}
            </div>
            <div className="haccp-sipoc__cell haccp-sipoc__cell--proc" data-col="Proceso">
              <strong>
                {String(i + 1).padStart(2, '0')} · {step.name}
              </strong>
            </div>
            <div className="haccp-sipoc__cell" data-col="Salidas">
              {step.outputs.length ? step.outputs.map((o) => o.name).join(', ') : '—'}
            </div>
            <div className="haccp-sipoc__cell" data-col="Cliente / Destino">
              {clients.length ? clients.join(', ') : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
