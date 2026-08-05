'use client';

import { AnalysisActionForm } from '../_components/AnalysisActionForm';
import {
  CAUSE_EDGE_RELATIONS,
  CAUSE_EDGE_RELATION_LABEL,
  CAUSE_NODE_TYPES,
  CAUSE_NODE_TYPE_LABEL,
  HYPOTHESIS_STATUSES,
  HYPOTHESIS_STATUS_LABEL,
  RECURRENCE_CONFIRMATIONS,
  RECURRENCE_CONFIRMATION_LABEL,
  type AnalysisStatus,
  type AnalysisType,
} from '@/features/capa/analysis-state';
import {
  addCategoryAction,
  addEdgeAction,
  addFmeaRowAction,
  addHypothesisAction,
  addNodeAction,
  addParticipantAction,
  addAnalysisCommentAction,
  confirmRecurrenceAction,
  createActionFromAnalysisAction,
  generateParetoAction,
  markRootCauseAction,
  newVersionAction,
  saveConclusionAction,
  sendRootCauseAction,
  setComparativeAction,
  setParetoAction,
  transitionAnalysisAction,
  updateFmeaRowAction,
  updateHypothesisAction,
  uploadAnalysisEvidenceAction,
} from '../analysis-actions';

type Member = { id: string; name: string };

interface Props {
  capaId: string;
  analysisId: string;
  type: AnalysisType;
  status: AnalysisStatus;
  ctx: { isAdmin: boolean; canEdit: boolean; canReview: boolean };
  capaOpen: boolean;
  members: Member[];
  categories: { id: string; name: string }[];
  hypotheses: { id: string; description: string; status: string }[];
  nodes: { id: string; description: string; type: string }[];
  fmeaRows: { id: string; failureMode: string }[];
  recurrenceCandidates: { capaId: string; folio: string; title: string; matchReason: string }[];
  allCapas: { id: string; folio: string; title: string }[];
  paretoItems: { category: string; count: number }[];
  conclusion: Record<string, string | null> | null;
}

export function AnalysisEditPanel(p: Props) {
  const base = { capaId: p.capaId, analysisId: p.analysisId };
  const { canEdit, canReview, isAdmin } = p.ctx;
  const c = (k: string) => p.conclusion?.[k] ?? '';

  return (
    <div className="analysis-panel">
      {/* Flujo del análisis */}
      <section className="wf-panel">
        {canEdit && p.status === 'draft' && (
          <AnalysisActionForm
            action={transitionAnalysisAction}
            hidden={{ ...base, to: 'in_progress' }}
            button="Iniciar desarrollo"
            variant="primary"
          />
        )}
        {canEdit && p.status === 'in_progress' && (
          <AnalysisActionForm
            action={transitionAnalysisAction}
            hidden={{ ...base, to: 'under_review' }}
            button="Enviar a revisión"
            variant="primary"
          />
        )}
        {canEdit && p.status === 'changes_requested' && (
          <AnalysisActionForm
            action={transitionAnalysisAction}
            hidden={{ ...base, to: 'in_progress' }}
            button="Reanudar edición"
          />
        )}
        {p.status === 'under_review' && canReview && (
          <>
            <AnalysisActionForm
              action={transitionAnalysisAction}
              hidden={{ ...base, to: 'approved' }}
              button="Aprobar"
              variant="primary"
            />
            <AnalysisActionForm
              action={transitionAnalysisAction}
              hidden={{ ...base, to: 'changes_requested' }}
              button="Solicitar cambios"
            >
              <input name="comment" placeholder="Qué cambiar (obligatorio)" required />
            </AnalysisActionForm>
          </>
        )}
        {p.status !== 'approved' && p.status !== 'cancelled' && isAdmin && (
          <AnalysisActionForm
            action={transitionAnalysisAction}
            hidden={{ ...base, to: 'cancelled' }}
            button="Cancelar análisis"
          >
            <input name="comment" placeholder="Motivo" />
          </AnalysisActionForm>
        )}
        {p.status === 'approved' && (
          <>
            <AnalysisActionForm
              action={newVersionAction}
              hidden={base}
              button="Crear nueva versión"
            />
            <AnalysisActionForm
              action={sendRootCauseAction}
              hidden={base}
              button="Enviar causa raíz a la CAPA"
              variant="primary"
            />
          </>
        )}
      </section>

      {/* Participantes */}
      {canEdit && (
        <AnalysisActionForm
          action={addParticipantAction}
          hidden={base}
          button="Agregar participante"
        >
          <select name="userId" required defaultValue="">
            <option value="" disabled>
              Participante
            </option>
            {p.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </AnalysisActionForm>
      )}

      {/* --- Ishikawa --- */}
      {canEdit && p.type === 'ishikawa' && (
        <>
          <AnalysisActionForm action={addCategoryAction} hidden={base} button="Agregar categoría">
            <input name="name" placeholder="Nueva categoría" required />
          </AnalysisActionForm>
          <AnalysisActionForm action={addHypothesisAction} hidden={base} button="Agregar causa">
            <select name="ishikawaCategoryId" required defaultValue="">
              <option value="" disabled>
                Categoría
              </option>
              {p.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <input name="description" placeholder="Causa posible" required />
            <select name="probability" defaultValue="undetermined">
              <option value="undetermined">Prob. no determinada</option>
              <option value="low">Prob. baja</option>
              <option value="medium">Prob. media</option>
              <option value="high">Prob. alta</option>
            </select>
          </AnalysisActionForm>
        </>
      )}

      {/* Actualizar estado de hipótesis/causa (Ishikawa y libre) */}
      {canEdit &&
        ['ishikawa', 'freeform'].includes(p.type) &&
        p.hypotheses.map((h) => (
          <AnalysisActionForm
            key={h.id}
            action={updateHypothesisAction}
            hidden={{ ...base, hypothesisId: h.id }}
            button="Actualizar causa"
          >
            <span className="muted">{h.description.slice(0, 40)}</span>
            <select name="status" defaultValue={h.status}>
              {HYPOTHESIS_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {HYPOTHESIS_STATUS_LABEL[st]}
                </option>
              ))}
            </select>
            <input name="justification" placeholder="Justificación (si confirma)" />
          </AnalysisActionForm>
        ))}

      {/* Análisis libre: agregar hipótesis sin categoría */}
      {canEdit && p.type === 'freeform' && (
        <AnalysisActionForm action={addHypothesisAction} hidden={base} button="Agregar hipótesis">
          <input name="description" placeholder="Hipótesis" required />
          <input name="evidenceFor" placeholder="Evidencia a favor" />
          <input name="evidenceAgainst" placeholder="Evidencia en contra" />
        </AnalysisActionForm>
      )}

      {/* --- Árbol de causas --- */}
      {canEdit && p.type === 'cause_tree' && (
        <>
          <AnalysisActionForm action={addNodeAction} hidden={base} button="Agregar nodo">
            <select name="type" defaultValue="immediate_cause">
              {CAUSE_NODE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CAUSE_NODE_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <input name="description" placeholder="Descripción del nodo" required />
          </AnalysisActionForm>
          {p.nodes.length >= 2 && (
            <AnalysisActionForm action={addEdgeAction} hidden={base} button="Relacionar nodos">
              <select name="fromNodeId" required defaultValue="">
                <option value="" disabled>
                  Origen
                </option>
                {p.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.description.slice(0, 24)}
                  </option>
                ))}
              </select>
              <select name="relation" defaultValue="caused">
                {CAUSE_EDGE_RELATIONS.map((r) => (
                  <option key={r} value={r}>
                    {CAUSE_EDGE_RELATION_LABEL[r]}
                  </option>
                ))}
              </select>
              <select name="toNodeId" required defaultValue="">
                <option value="" disabled>
                  Destino
                </option>
                {p.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.description.slice(0, 24)}
                  </option>
                ))}
              </select>
            </AnalysisActionForm>
          )}
          {p.nodes.length > 0 && (
            <AnalysisActionForm
              action={markRootCauseAction}
              hidden={base}
              button="Marcar causa raíz"
            >
              <select name="nodeId" required defaultValue="">
                <option value="" disabled>
                  Nodo
                </option>
                {p.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.description.slice(0, 24)}
                  </option>
                ))}
              </select>
              <input name="justification" placeholder="Justificación (obligatoria)" required />
            </AnalysisActionForm>
          )}
        </>
      )}

      {/* --- Pareto --- */}
      {canEdit && p.type === 'pareto' && (
        <>
          <AnalysisActionForm
            action={generateParetoAction}
            hidden={base}
            button="Generar desde CAPA"
          >
            <select name="dimension" defaultValue="sourceType">
              <option value="sourceType">Por tipo</option>
              <option value="severity">Por severidad</option>
              <option value="priority">Por prioridad</option>
              <option value="area">Por área</option>
              <option value="process">Por proceso</option>
            </select>
          </AnalysisActionForm>
          <AnalysisActionForm
            action={setParetoAction}
            hidden={base}
            button="Guardar datos"
            className="wf-form pareto-editor"
          >
            {Array.from({ length: 8 }).map((_, i) => {
              const item = p.paretoItems[i];
              return (
                <span key={i} className="pareto-row">
                  <input
                    name="category"
                    placeholder={`Categoría ${i + 1}`}
                    defaultValue={item?.category ?? ''}
                  />
                  <input
                    name="count"
                    type="number"
                    min={0}
                    placeholder="0"
                    defaultValue={item ? String(item.count) : ''}
                  />
                </span>
              );
            })}
          </AnalysisActionForm>
        </>
      )}

      {/* --- AMEF --- */}
      {canEdit && p.type === 'fmea' && (
        <>
          <AnalysisActionForm
            action={addFmeaRowAction}
            hidden={base}
            button="Agregar modo de falla"
          >
            <input name="processStep" placeholder="Proceso / etapa" />
            <input name="failureMode" placeholder="Modo de falla" required />
            <input name="effect" placeholder="Efecto" />
            <input name="causePotential" placeholder="Causa potencial" />
            <input name="severity" type="number" min={1} max={10} placeholder="S (1-10)" required />
            <input
              name="occurrence"
              type="number"
              min={1}
              max={10}
              placeholder="O (1-10)"
              required
            />
            <input
              name="detection"
              type="number"
              min={1}
              max={10}
              placeholder="D (1-10)"
              required
            />
            <input name="recommendedAction" placeholder="Acción recomendada" />
          </AnalysisActionForm>
          {p.fmeaRows.map((r) => (
            <AnalysisActionForm
              key={r.id}
              action={updateFmeaRowAction}
              hidden={{ ...base, rowId: r.id }}
              button="Registrar acción posterior"
            >
              <span className="muted">{r.failureMode.slice(0, 30)}</span>
              <input name="executedAction" placeholder="Acción ejecutada" />
              <input name="severityPost" type="number" min={1} max={10} placeholder="S'" />
              <input name="occurrencePost" type="number" min={1} max={10} placeholder="O'" />
              <input name="detectionPost" type="number" min={1} max={10} placeholder="D'" />
            </AnalysisActionForm>
          ))}
        </>
      )}

      {/* --- Recurrencia --- */}
      {canEdit &&
        p.type === 'recurrence' &&
        p.recurrenceCandidates.map((cand) => (
          <AnalysisActionForm
            key={cand.capaId}
            action={confirmRecurrenceAction}
            hidden={{ ...base, matchedCapaId: cand.capaId, matchReason: cand.matchReason }}
            button="Registrar"
          >
            <span className="muted">
              {cand.folio} · {cand.title.slice(0, 28)} ({cand.matchReason})
            </span>
            <select name="confirmation" defaultValue="possibly_recurrent">
              {RECURRENCE_CONFIRMATIONS.map((r) => (
                <option key={r} value={r}>
                  {RECURRENCE_CONFIRMATION_LABEL[r]}
                </option>
              ))}
            </select>
            <input name="justification" placeholder="Justificación (obligatoria)" required />
          </AnalysisActionForm>
        ))}

      {/* --- Comparación --- */}
      {canEdit && p.type === 'comparative' && (
        <AnalysisActionForm
          action={setComparativeAction}
          hidden={base}
          button="Guardar comparación (2-5)"
        >
          <span className="muted">Selecciona entre 2 y 5 CAPA:</span>
          <div className="capa-checklist">
            {p.allCapas.map((cap) => (
              <label key={cap.id} className="props-check">
                <input type="checkbox" name="capaIds" value={cap.id} /> {cap.folio} ·{' '}
                {cap.title.slice(0, 24)}
              </label>
            ))}
          </div>
        </AnalysisActionForm>
      )}

      {/* Conclusión */}
      {canEdit && (
        <details className="props-panel">
          <summary>Conclusión</summary>
          <AnalysisActionForm
            action={saveConclusionAction}
            hidden={base}
            button="Guardar conclusión"
            className="doc-form"
          >
            <label className="doc-form__full">
              Resumen
              <textarea name="summary" defaultValue={c('summary')} rows={2} />
            </label>
            <div className="form-grid">
              <label>
                Causa inmediata
                <input name="immediateCause" defaultValue={c('immediateCause')} />
              </label>
              <label>
                Causas contribuyentes
                <input name="contributingCauses" defaultValue={c('contributingCauses')} />
              </label>
              <label>
                Causa raíz propuesta
                <input name="proposedRootCause" defaultValue={c('proposedRootCause')} />
              </label>
              <label>
                Causa raíz confirmada
                <input name="confirmedRootCause" defaultValue={c('confirmedRootCause')} />
              </label>
              <label>
                Evidencia principal
                <input name="mainEvidence" defaultValue={c('mainEvidence')} />
              </label>
              <label>
                Evidencia contradictoria
                <input name="contradictoryEvidence" defaultValue={c('contradictoryEvidence')} />
              </label>
              <label>
                Limitaciones
                <input name="limitations" defaultValue={c('limitations')} />
              </label>
              <label>
                Riesgo de recurrencia
                <input name="recurrenceRisk" defaultValue={c('recurrenceRisk')} />
              </label>
              <label>
                Recomendaciones
                <input name="recommendations" defaultValue={c('recommendations')} />
              </label>
            </div>
          </AnalysisActionForm>
        </details>
      )}

      {/* Convertir en acción CAPA */}
      {p.capaOpen && (
        <AnalysisActionForm
          action={createActionFromAnalysisAction}
          hidden={{ ...base, sourceEntity: 'conclusion' }}
          button="Crear acción CAPA"
        >
          <input name="description" placeholder="Descripción de la acción" required />
          <select name="priority" defaultValue="normal">
            <option value="low">Baja</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </AnalysisActionForm>
      )}

      {/* Evidencia y comentario */}
      {canEdit && (
        <AnalysisActionForm
          action={uploadAnalysisEvidenceAction}
          hidden={{ ...base, entityType: 'analysis' }}
          button="Adjuntar evidencia"
          encType="multipart/form-data"
        >
          <input type="file" name="file" required />
        </AnalysisActionForm>
      )}
      <AnalysisActionForm action={addAnalysisCommentAction} hidden={base} button="Comentar">
        <input name="body" placeholder="Comentario" required />
      </AnalysisActionForm>
    </div>
  );
}
