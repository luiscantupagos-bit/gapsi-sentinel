'use client';

import { AnalysisActionForm } from '../_components/AnalysisActionForm';
import { HelpTip, Step } from '../_components/HelpTip';
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
  /** capaId es OPCIONAL: los análisis transversales no dependen de una CAPA. */
  capaId: string | null;
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

/** Etiqueta de campo (título encima del control) para un llenado claro. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}

export function AnalysisEditPanel(p: Props) {
  // capaId opcional: en modo transversal se omite el campo oculto.
  const base: Record<string, string> = p.capaId
    ? { capaId: p.capaId, analysisId: p.analysisId }
    : { analysisId: p.analysisId };
  const hasCapa = Boolean(p.capaId);
  const { canEdit, canReview, isAdmin } = p.ctx;
  const c = (k: string) => p.conclusion?.[k] ?? '';

  return (
    <div className="analysis-steps">
      {/* Etapa: estado / flujo */}
      <Step
        title="Estado del análisis"
        help="Avanza el análisis por sus etapas. Debes registrar la conclusión antes de enviarlo a revisión; solo el revisor o un administrador aprueba."
      >
        <div className="step-actions">
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
                <Field label="¿Qué se debe cambiar?">
                  <input name="comment" placeholder="Indica los cambios" required />
                </Field>
              </AnalysisActionForm>
            </>
          )}
          {p.status !== 'approved' && p.status !== 'cancelled' && isAdmin && (
            <AnalysisActionForm
              action={transitionAnalysisAction}
              hidden={{ ...base, to: 'cancelled' }}
              button="Cancelar análisis"
            >
              <Field label="Motivo">
                <input name="comment" placeholder="Motivo de la cancelación" />
              </Field>
            </AnalysisActionForm>
          )}
          {p.status === 'approved' && hasCapa && (
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
          {!canEdit && p.status !== 'approved' && (
            <p className="muted">
              Este análisis no es editable en su estado actual o no tienes permiso.
            </p>
          )}
        </div>
      </Step>

      {/* Etapa: equipo */}
      {canEdit && (
        <Step
          title="Equipo"
          desc="Quién participa en el análisis."
          help="Agrega colaboradores que podrán capturar información en este análisis."
        >
          <AnalysisActionForm action={addParticipantAction} hidden={base} button="Agregar">
            <Field label="Participante">
              <select name="userId" required defaultValue="">
                <option value="" disabled>
                  Selecciona…
                </option>
                {p.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
          </AnalysisActionForm>
        </Step>
      )}

      {/* --- Ishikawa --- */}
      {canEdit && p.type === 'ishikawa' && (
        <>
          <Step
            n={1}
            title="Categorías (6M)"
            desc="Las seis categorías estándar ya están creadas."
            help="Las 6M (Mano de obra, Método, Maquinaria, Materiales, Medición, Medio ambiente) ya existen. Agrega una categoría solo si tu proceso lo requiere."
          >
            <AnalysisActionForm action={addCategoryAction} hidden={base} button="Agregar categoría">
              <Field label="Nueva categoría">
                <input name="name" placeholder="Ej. Proveedor" required />
              </Field>
            </AnalysisActionForm>
          </Step>
          <Step
            n={2}
            title="Causas posibles"
            desc="Registra cada causa dentro de su categoría."
            help="Elige la categoría, describe la causa posible y estima su probabilidad. Podrás evaluar cada causa más abajo."
          >
            <AnalysisActionForm action={addHypothesisAction} hidden={base} button="Agregar causa">
              <Field label="Categoría">
                <select name="ishikawaCategoryId" required defaultValue="">
                  <option value="" disabled>
                    Selecciona…
                  </option>
                  {p.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Causa posible">
                <input name="description" placeholder="Ej. Sensor descalibrado" required />
              </Field>
              <Field label="Probabilidad">
                <select name="probability" defaultValue="undetermined">
                  <option value="undetermined">No determinada</option>
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </Field>
            </AnalysisActionForm>
          </Step>
        </>
      )}

      {/* Evaluar causas (Ishikawa y libre) */}
      {canEdit && ['ishikawa', 'freeform'].includes(p.type) && p.hypotheses.length > 0 && (
        <Step
          n={p.type === 'ishikawa' ? 3 : 2}
          title="Evaluar causas"
          desc="Clasifica cada causa según la evidencia."
          help="Cambia el estado de cada causa (descartada, contribuyente, probable o confirmada). Confirmar una causa raíz exige justificación."
        >
          <div className="rows">
            {p.hypotheses.map((h) => (
              <AnalysisActionForm
                key={h.id}
                action={updateHypothesisAction}
                hidden={{ ...base, hypothesisId: h.id }}
                button="Guardar"
              >
                <span className="rows__label">{h.description}</span>
                <Field label="Estado">
                  <select name="status" defaultValue={h.status}>
                    {HYPOTHESIS_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {HYPOTHESIS_STATUS_LABEL[st]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Justificación (si confirma)">
                  <input name="justification" placeholder="Evidencia que la respalda" />
                </Field>
              </AnalysisActionForm>
            ))}
          </div>
        </Step>
      )}

      {/* Análisis libre: agregar hipótesis */}
      {canEdit && p.type === 'freeform' && (
        <Step
          n={1}
          title="Hipótesis"
          desc="Plantea hipótesis de causa con su evidencia."
          help="Describe la hipótesis y, si la tienes, la evidencia a favor y en contra. Podrás clasificarla más abajo."
        >
          <AnalysisActionForm action={addHypothesisAction} hidden={base} button="Agregar hipótesis">
            <Field label="Hipótesis">
              <input name="description" placeholder="Ej. Falla en el proceso X" required />
            </Field>
            <Field label="Evidencia a favor">
              <input name="evidenceFor" placeholder="Opcional" />
            </Field>
            <Field label="Evidencia en contra">
              <input name="evidenceAgainst" placeholder="Opcional" />
            </Field>
          </AnalysisActionForm>
        </Step>
      )}

      {/* --- Árbol de causas --- */}
      {canEdit && p.type === 'cause_tree' && (
        <>
          <Step
            n={1}
            title="Nodos"
            desc="Agrega el evento principal y sus causas como nodos."
            help="Empieza por el evento (lo que ocurrió). Luego agrega causas inmediatas, contribuyentes, sistémicas, controles fallidos, etc."
          >
            <AnalysisActionForm action={addNodeAction} hidden={base} button="Agregar nodo">
              <Field label="Tipo de nodo">
                <select name="type" defaultValue="immediate_cause">
                  {CAUSE_NODE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {CAUSE_NODE_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Descripción">
                <input name="description" placeholder="Describe el nodo" required />
              </Field>
            </AnalysisActionForm>
          </Step>
          {p.nodes.length >= 2 && (
            <Step
              n={2}
              title="Relaciones"
              desc="Conecta los nodos indicando cómo se relacionan."
              help="Elige el nodo origen, la relación (causó, contribuyó, permitió…) y el nodo destino. El sistema impide crear ciclos."
            >
              <AnalysisActionForm action={addEdgeAction} hidden={base} button="Relacionar">
                <Field label="Origen">
                  <select name="fromNodeId" required defaultValue="">
                    <option value="" disabled>
                      Selecciona…
                    </option>
                    {p.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.description.slice(0, 32)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Relación">
                  <select name="relation" defaultValue="caused">
                    {CAUSE_EDGE_RELATIONS.map((r) => (
                      <option key={r} value={r}>
                        {CAUSE_EDGE_RELATION_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Destino">
                  <select name="toNodeId" required defaultValue="">
                    <option value="" disabled>
                      Selecciona…
                    </option>
                    {p.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.description.slice(0, 32)}
                      </option>
                    ))}
                  </select>
                </Field>
              </AnalysisActionForm>
            </Step>
          )}
          {p.nodes.length > 0 && (
            <Step
              n={3}
              title="Causa raíz"
              desc="Marca el nodo que consideras la causa raíz."
              help="Selecciona el nodo de causa raíz y justifica por qué lo es. No se confirma automáticamente."
            >
              <AnalysisActionForm
                action={markRootCauseAction}
                hidden={base}
                button="Marcar causa raíz"
              >
                <Field label="Nodo">
                  <select name="nodeId" required defaultValue="">
                    <option value="" disabled>
                      Selecciona…
                    </option>
                    {p.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.description.slice(0, 32)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Justificación">
                  <input name="justification" placeholder="Por qué es la causa raíz" required />
                </Field>
              </AnalysisActionForm>
            </Step>
          )}
        </>
      )}

      {/* --- Pareto --- */}
      {canEdit && p.type === 'pareto' && (
        <Step
          n={1}
          title="Datos del Pareto"
          desc="Captura cada categoría y su cantidad (frecuencia)."
          help="Escribe una categoría y su cantidad en cada fila, o genera los datos automáticamente desde las CAPA. El sistema calcula %, % acumulado y el grupo vital (corte 80%)."
        >
          {hasCapa && (
            <AnalysisActionForm
              action={generateParetoAction}
              hidden={base}
              button="Generar desde CAPA"
            >
              <Field label="Agrupar CAPA por">
                <select name="dimension" defaultValue="sourceType">
                  <option value="sourceType">Tipo</option>
                  <option value="severity">Severidad</option>
                  <option value="priority">Prioridad</option>
                  <option value="area">Área</option>
                  <option value="process">Proceso</option>
                </select>
              </Field>
            </AnalysisActionForm>
          )}
          <AnalysisActionForm
            action={setParetoAction}
            hidden={base}
            button="Guardar datos"
            className="wf-form pareto-grid"
          >
            <div className="pareto-grid__rows">
              {Array.from({ length: 8 }).map((_, i) => {
                const item = p.paretoItems[i];
                return (
                  <span key={i} className="pareto-grid__row">
                    <input
                      name="category"
                      aria-label={`Categoría ${i + 1}`}
                      placeholder={`Categoría ${i + 1}`}
                      defaultValue={item?.category ?? ''}
                    />
                    <input
                      name="count"
                      type="number"
                      min={0}
                      aria-label={`Cantidad ${i + 1}`}
                      placeholder="Cantidad"
                      defaultValue={item ? String(item.count) : ''}
                    />
                  </span>
                );
              })}
            </div>
          </AnalysisActionForm>
        </Step>
      )}

      {/* --- AMEF --- */}
      {canEdit && p.type === 'fmea' && (
        <>
          <Step
            n={1}
            title="Modo de falla"
            desc="Describe la falla y califícala del 1 al 10."
            help="Severidad = gravedad del efecto; Ocurrencia = qué tan frecuente; Detección = qué tan difícil de detectar (10 = no se detecta). El NPR = S×O×D se calcula automáticamente."
          >
            <AnalysisActionForm
              action={addFmeaRowAction}
              hidden={base}
              button="Agregar modo de falla"
            >
              <Field label="Proceso / etapa">
                <input name="processStep" placeholder="Ej. Pasteurización" />
              </Field>
              <Field label="Modo de falla">
                <input name="failureMode" placeholder="Qué puede fallar" required />
              </Field>
              <Field label="Efecto">
                <input name="effect" placeholder="Consecuencia" />
              </Field>
              <Field label="Causa potencial">
                <input name="causePotential" placeholder="Posible causa" />
              </Field>
              <Field label="Severidad (1-10)">
                <input name="severity" type="number" min={1} max={10} required />
              </Field>
              <Field label="Ocurrencia (1-10)">
                <input name="occurrence" type="number" min={1} max={10} required />
              </Field>
              <Field label="Detección (1-10)">
                <input name="detection" type="number" min={1} max={10} required />
              </Field>
              <Field label="Acción recomendada">
                <input name="recommendedAction" placeholder="Qué hacer" />
              </Field>
            </AnalysisActionForm>
          </Step>
          {p.fmeaRows.length > 0 && (
            <Step
              n={2}
              title="Acción posterior"
              desc="Tras ejecutar la acción, recalifica para ver el NPR posterior."
              help="Registra la acción ejecutada y las nuevas calificaciones S/O/D. El sistema recalcula el NPR posterior para comparar la mejora."
            >
              <div className="rows">
                {p.fmeaRows.map((r) => (
                  <AnalysisActionForm
                    key={r.id}
                    action={updateFmeaRowAction}
                    hidden={{ ...base, rowId: r.id }}
                    button="Guardar"
                  >
                    <span className="rows__label">{r.failureMode}</span>
                    <Field label="Acción ejecutada">
                      <input name="executedAction" placeholder="Qué se hizo" />
                    </Field>
                    <Field label="Sev. post">
                      <input name="severityPost" type="number" min={1} max={10} />
                    </Field>
                    <Field label="Ocur. post">
                      <input name="occurrencePost" type="number" min={1} max={10} />
                    </Field>
                    <Field label="Detec. post">
                      <input name="detectionPost" type="number" min={1} max={10} />
                    </Field>
                  </AnalysisActionForm>
                ))}
              </div>
            </Step>
          )}
        </>
      )}

      {/* --- Recurrencia --- */}
      {canEdit && p.type === 'recurrence' && (
        <Step
          n={1}
          title="Casos similares"
          desc="Revisa si el problema ya había ocurrido."
          help="El sistema propone CAPA parecidas por tipo, sitio, área o proceso. Confirma si es recurrente y justifica tu decisión."
        >
          {!hasCapa ? (
            <p className="muted">
              La recurrencia compara CAPA: vincula este análisis a una CAPA para usarla.
            </p>
          ) : p.recurrenceCandidates.length === 0 ? (
            <p className="muted">No se encontraron CAPA candidatas.</p>
          ) : (
            <div className="rows">
              {p.recurrenceCandidates.map((cand) => (
                <AnalysisActionForm
                  key={cand.capaId}
                  action={confirmRecurrenceAction}
                  hidden={{ ...base, matchedCapaId: cand.capaId, matchReason: cand.matchReason }}
                  button="Registrar"
                >
                  <span className="rows__label">
                    {cand.folio} · {cand.title} <em>({cand.matchReason})</em>
                  </span>
                  <Field label="Conclusión">
                    <select name="confirmation" defaultValue="possibly_recurrent">
                      {RECURRENCE_CONFIRMATIONS.map((r) => (
                        <option key={r} value={r}>
                          {RECURRENCE_CONFIRMATION_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Justificación">
                    <input name="justification" placeholder="Por qué (no) es recurrente" required />
                  </Field>
                </AnalysisActionForm>
              ))}
            </div>
          )}
        </Step>
      )}

      {/* --- Comparación --- */}
      {canEdit && p.type === 'comparative' && (
        <Step
          n={1}
          title="Casos a comparar"
          desc="Selecciona entre 2 y 5 CAPA."
          help="Marca las CAPA que quieres comparar (mínimo 2, máximo 5). La tabla comparativa aparece más abajo."
        >
          {!hasCapa ? (
            <p className="muted">
              La comparación de casos usa CAPA: vincula este análisis a una CAPA para usarla.
            </p>
          ) : (
            <AnalysisActionForm
              action={setComparativeAction}
              hidden={base}
              button="Guardar comparación"
            >
              <div className="capa-checklist">
                {p.allCapas.map((cap) => (
                  <label key={cap.id} className="props-check">
                    <input type="checkbox" name="capaIds" value={cap.id} /> {cap.folio} ·{' '}
                    {cap.title.slice(0, 32)}
                  </label>
                ))}
              </div>
            </AnalysisActionForm>
          )}
        </Step>
      )}

      {/* Conclusión */}
      {canEdit && (
        <Step
          title="Conclusión"
          desc="Resume los hallazgos y la causa raíz."
          help="Requerida antes de enviar a revisión: escribe al menos el resumen y la causa raíz propuesta. La causa raíz confirmada puede enviarse luego a la CAPA."
        >
          <AnalysisActionForm
            action={saveConclusionAction}
            hidden={base}
            button="Guardar conclusión"
            className="doc-form"
          >
            <Field label="Resumen">
              <textarea name="summary" defaultValue={c('summary')} rows={2} />
            </Field>
            <div className="form-grid">
              <Field label="Causa inmediata">
                <input name="immediateCause" defaultValue={c('immediateCause')} />
              </Field>
              <Field label="Causas contribuyentes">
                <input name="contributingCauses" defaultValue={c('contributingCauses')} />
              </Field>
              <Field label="Causa raíz propuesta">
                <input name="proposedRootCause" defaultValue={c('proposedRootCause')} />
              </Field>
              <Field label="Causa raíz confirmada">
                <input name="confirmedRootCause" defaultValue={c('confirmedRootCause')} />
              </Field>
              <Field label="Evidencia principal">
                <input name="mainEvidence" defaultValue={c('mainEvidence')} />
              </Field>
              <Field label="Evidencia contradictoria">
                <input name="contradictoryEvidence" defaultValue={c('contradictoryEvidence')} />
              </Field>
              <Field label="Limitaciones">
                <input name="limitations" defaultValue={c('limitations')} />
              </Field>
              <Field label="Riesgo de recurrencia">
                <input name="recurrenceRisk" defaultValue={c('recurrenceRisk')} />
              </Field>
              <Field label="Recomendaciones">
                <input name="recommendations" defaultValue={c('recommendations')} />
              </Field>
            </div>
          </AnalysisActionForm>
        </Step>
      )}

      {/* Convertir en acción CAPA */}
      {p.capaOpen && (
        <Step
          title="Convertir en acción CAPA"
          desc="Transforma un hallazgo en una acción correctiva."
          help="Crea una acción dentro de la CAPA a partir de este análisis. La acción queda vinculada al análisis."
        >
          <AnalysisActionForm
            action={createActionFromAnalysisAction}
            hidden={{ ...base, sourceEntity: 'conclusion' }}
            button="Crear acción CAPA"
          >
            <Field label="Descripción de la acción">
              <input name="description" placeholder="Qué se hará" required />
            </Field>
            <Field label="Prioridad">
              <select name="priority" defaultValue="normal">
                <option value="low">Baja</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </Field>
          </AnalysisActionForm>
        </Step>
      )}

      {/* Evidencia y comentario */}
      <Step
        title="Evidencia y comentarios"
        help="Adjunta soporte (PDF, Word, Excel, imagen) o deja un comentario para el equipo. Los comentarios quedan en el historial."
      >
        <div className="step-actions">
          {canEdit && (
            <AnalysisActionForm
              action={uploadAnalysisEvidenceAction}
              hidden={{ ...base, entityType: 'analysis' }}
              button="Adjuntar evidencia"
              encType="multipart/form-data"
            >
              <Field label="Archivo">
                <input type="file" name="file" required />
              </Field>
            </AnalysisActionForm>
          )}
          <AnalysisActionForm action={addAnalysisCommentAction} hidden={base} button="Comentar">
            <Field label="Comentario">
              <input name="body" placeholder="Escribe un comentario" required />
            </Field>
          </AnalysisActionForm>
        </div>
      </Step>

      <p className="analysis-steps__hint">
        <HelpTip text="El icono ? junto a cada etapa explica brevemente qué capturar." /> Pasa el
        cursor sobre los iconos <strong>?</strong> para ver instrucciones de llenado.
      </p>
    </div>
  );
}
