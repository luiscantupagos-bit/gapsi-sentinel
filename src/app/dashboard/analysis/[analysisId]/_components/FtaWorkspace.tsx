'use client';

import {
  buildFtaTree,
  layoutFtaTree,
  validateFtaTree,
  FTA_NODE_LABEL,
  GATE_LABEL,
  type FtaNodeInput,
  type FtaNodeType,
} from '@/features/analysis/fta';
import { ActionForm } from './ActionForm';
import { addFtaNodeAction, updateFtaNodeAction, deleteFtaNodeAction } from '../actions';

const BOX_W = 150;
const BOX_H = 54;
const PAD = 40;

const NODE_FILL: Record<FtaNodeType, string> = {
  top: 'var(--fta-top, #fee2e2)',
  intermediate: 'var(--fta-mid, #e0e7ff)',
  basic: 'var(--fta-basic, #dcfce7)',
};

/** Workspace visual del Árbol de Fallas: SVG derivado de la estructura + edición. */
export function FtaWorkspace({
  analysisId,
  nodes,
  editable,
}: {
  analysisId: string;
  nodes: FtaNodeInput[];
  editable: boolean;
}) {
  const tree = buildFtaTree(nodes);
  const layout = layoutFtaTree(tree);
  const errors = validateFtaTree(nodes);
  const posById = new Map(layout.nodes.map((n) => [n.id, n]));
  const svgW = layout.width + BOX_W + PAD * 2;
  const svgH = layout.height + BOX_H + PAD * 2;
  const cx = (x: number) => x + PAD + BOX_W / 2;
  const cy = (y: number) => y + PAD + BOX_H / 2;

  return (
    <div className="fta">
      {nodes.length === 0 ? (
        <p className="empty-state">Aún no hay eventos. Comienza por el evento superior.</p>
      ) : (
        <div className="fta__diagram" role="group" aria-label="Árbol de fallas">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="fta__svg"
            role="img"
            aria-label={`Árbol de fallas con ${nodes.length} eventos`}
          >
            {layout.edges.map((e) => {
              const from = posById.get(e.from);
              const to = posById.get(e.to);
              if (!from || !to) return null;
              return (
                <g key={`${e.from}-${e.to}`}>
                  <line
                    x1={cx(from.x)}
                    y1={cy(from.y) + BOX_H / 2}
                    x2={cx(to.x)}
                    y2={cy(to.y) - BOX_H / 2}
                    className="fta__edge"
                  />
                  {e.gate && (
                    <text
                      x={(cx(from.x) + cx(to.x)) / 2}
                      y={(cy(from.y) + cy(to.y)) / 2}
                      className="fta__gate"
                    >
                      {e.gate === 'and' ? 'Y' : 'O'}
                    </text>
                  )}
                </g>
              );
            })}
            {layout.nodes.map(({ id, x, y, node }) => (
              <g key={id}>
                <title>
                  {FTA_NODE_LABEL[node.nodeType]}: {node.label}
                  {node.gateType ? ` (compuerta ${GATE_LABEL[node.gateType]})` : ''}
                </title>
                <rect
                  x={x + PAD}
                  y={y + PAD}
                  width={BOX_W}
                  height={BOX_H}
                  rx={8}
                  className="fta__box"
                  style={{ fill: NODE_FILL[node.nodeType] }}
                />
                <text x={cx(x)} y={cy(y) - 6} className="fta__box-label">
                  {node.label.length > 22 ? `${node.label.slice(0, 21)}…` : node.label}
                </text>
                <text x={cx(x)} y={cy(y) + 12} className="fta__box-type">
                  {FTA_NODE_LABEL[node.nodeType]}
                  {node.gateType ? ` · ${node.gateType === 'and' ? 'Y' : 'O'}` : ''}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}

      {/* Esquema textual (accesible e imprimible) */}
      <ol className="fta__outline">
        {layout.nodes.map(({ id, node }) => (
          <li key={id} style={{ marginLeft: `${node.depth * 1.25}rem` }}>
            <strong>{node.label}</strong> — {FTA_NODE_LABEL[node.nodeType]}
            {node.gateType ? ` · compuerta ${GATE_LABEL[node.gateType]}` : ''}
            {node.notes ? ` · nota: ${node.notes}` : ''}
          </li>
        ))}
      </ol>

      {errors.length > 0 && (
        <ul className="fta__errors no-print">
          {errors.map((e) => (
            <li key={e} className="msg msg--error">
              {e}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <details className="more-actions no-print">
          <summary>Editar árbol (agregar, cambiar compuerta, eliminar)</summary>

          <div className="fta__editor">
            <h4>Agregar evento</h4>
            <ActionForm
              action={addFtaNodeAction}
              hidden={{ analysisId }}
              button="Agregar"
              variant="primary"
              className="filter-bar"
            >
              <label className="field">
                <span className="field__label">Tipo</span>
                <select name="nodeType" defaultValue="basic">
                  <option value="top">Evento superior</option>
                  <option value="intermediate">Evento intermedio</option>
                  <option value="basic">Evento básico</option>
                </select>
              </label>
              <label className="field">
                <span className="field__label">Padre</span>
                <select name="parentId" defaultValue="">
                  <option value="">(evento superior / sin padre)</option>
                  {nodes
                    .filter((n) => n.nodeType !== 'basic')
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Compuerta (si tendrá hijos)</span>
                <select name="gateType" defaultValue="">
                  <option value="">—</option>
                  <option value="and">Y (AND)</option>
                  <option value="or">O (OR)</option>
                </select>
              </label>
              <label className="field field--full">
                <span className="field__label">Etiqueta</span>
                <input name="label" required placeholder="Descripción breve del evento" />
              </label>
              <label className="field field--full">
                <span className="field__label">Notas / evidencia</span>
                <input name="notes" placeholder="Opcional" />
              </label>
            </ActionForm>

            <h4>Eventos</h4>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Evento</th>
                    <th>Tipo</th>
                    <th>Compuerta</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((n) => (
                    <tr key={n.id}>
                      <td>
                        <ActionForm
                          action={updateFtaNodeAction}
                          hidden={{ analysisId, nodeId: n.id }}
                          button="Guardar"
                        >
                          <input name="label" defaultValue={n.label} aria-label="Etiqueta" />
                        </ActionForm>
                      </td>
                      <td>{FTA_NODE_LABEL[n.nodeType]}</td>
                      <td>
                        {n.nodeType === 'basic' ? (
                          '—'
                        ) : (
                          <ActionForm
                            action={updateFtaNodeAction}
                            hidden={{ analysisId, nodeId: n.id }}
                            button="Fijar"
                          >
                            <select name="gateType" defaultValue={n.gateType ?? ''}>
                              <option value="">—</option>
                              <option value="and">Y (AND)</option>
                              <option value="or">O (OR)</option>
                            </select>
                          </ActionForm>
                        )}
                      </td>
                      <td>
                        {n.nodeType !== 'top' && (
                          <ActionForm
                            action={deleteFtaNodeAction}
                            hidden={{ analysisId, nodeId: n.id }}
                            button="Eliminar"
                            confirm="¿Eliminar este evento? (debe no tener hijos)"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
