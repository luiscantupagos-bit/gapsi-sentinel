/**
 * HACCP-002 — render REUTILIZABLE del diagrama de flujo (read-only, print-safe). Vertical
 * top-down (los procesos HACCP se leen secuencialmente). No depende del editor; se usará
 * también en la salida documental (HACCP-007). Cada nodo muestra número + nombre + tipo; las
 * conexiones se anotan bajo su nodo origen (con etiqueta para ramas condicionales/rechazo).
 */
import {
  orderSteps,
  stepNumber,
  stepTypeLabel,
  connectionTypeLabel,
  type FlowStep,
  type FlowConnection,
} from '@/features/haccp/haccp-flow';

export function HaccpProcessFlowView({
  steps,
  connections,
}: {
  steps: FlowStep[];
  connections: FlowConnection[];
}) {
  if (steps.length === 0) {
    return <p className="empty-state empty-state--compact">Sin etapas registradas.</p>;
  }
  const ordered = orderSteps(steps);
  const numberOf = new Map(ordered.map((s, i) => [s.processStepId, stepNumber(i)]));
  const nameOf = new Map(ordered.map((s) => [s.processStepId, s.name]));

  return (
    <div className="haccp-flow" role="list" aria-label="Diagrama de flujo del proceso">
      {ordered.map((s, i) => {
        const out = connections.filter((c) => c.fromStepId === s.processStepId);
        return (
          <div key={s.id} className="haccp-flow__item" role="listitem">
            <div className={`haccp-flow__node haccp-flow__node--${s.stepType}`}>
              <div className="haccp-flow__node-head">
                <span className="haccp-flow__num">{stepNumber(i)}</span>
                <span className="haccp-flow__name">{s.name}</span>
                <span className="badge">{stepTypeLabel(s.stepType)}</span>
              </div>
              {(s.area || s.responsibleName || s.responsibleRole) && (
                <p className="haccp-flow__meta">
                  {[s.area, s.responsibleName ?? s.responsibleRole].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            {/* Conexiones salientes: flecha vertical simple + ramas etiquetadas. */}
            {out.length > 0 && (
              <ul className="haccp-flow__edges">
                {out.map((c) => (
                  <li
                    key={c.id}
                    className={`haccp-flow__edge haccp-flow__edge--${c.connectionType}`}
                  >
                    <span aria-hidden="true">↓</span>{' '}
                    {c.label ? <strong>{c.label}: </strong> : null}
                    {nameOf.get(c.toStepId) ? (
                      <>
                        Etapa {numberOf.get(c.toStepId)} · {nameOf.get(c.toStepId)}
                      </>
                    ) : (
                      '—'
                    )}
                    {c.connectionType !== 'sequence' && (
                      <span className="muted"> ({connectionTypeLabel(c.connectionType)})</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {out.length === 0 && i < ordered.length - 1 && (
              <div className="haccp-flow__arrow" aria-hidden="true">
                ↓
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
