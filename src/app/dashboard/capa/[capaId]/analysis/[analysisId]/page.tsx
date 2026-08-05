import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { getCapaDetail, listCapas } from '@/server/capa';
import {
  AnalysisNotFoundError,
  findRecurrenceCandidates,
  getAnalysisDetail,
  getAnalysisUserContext,
  getComparison,
  listAnalysisMembers,
} from '@/server/quality-analysis';
import {
  ANALYSIS_STATUS_LABEL,
  ANALYSIS_TYPE_HELP,
  ANALYSIS_TYPE_LABEL,
  CAUSE_NODE_TYPE_LABEL,
  HYPOTHESIS_STATUS_LABEL,
  RECURRENCE_CONFIRMATION_LABEL,
  type AnalysisStatus,
  type AnalysisType,
  type CauseNodeType,
  type HypothesisStatus,
  type RecurrenceConfirmation,
} from '@/features/capa/analysis-state';
import { CauseTreeChart, IshikawaChart, ParetoChart } from '../_components/AnalysisVisuals';
import { AnalysisEditPanel } from './AnalysisEditPanel';

const dt = (d: Date | null | undefined) => (d ? new Date(d).toLocaleString('es-MX') : '—');

export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ capaId: string; analysisId: string }>;
}) {
  const session = await requireServerSession();
  const { capaId, analysisId } = await params;
  const org = session.organizationId;

  try {
    const [detail, ctx, members, capaDetail] = await Promise.all([
      getAnalysisDetail(org, analysisId),
      getAnalysisUserContext(org, session.userId, analysisId),
      listAnalysisMembers(org),
      getCapaDetail(org, capaId),
    ]);
    const { analysis, nameOf } = detail;
    const type = analysis.type as AnalysisType;
    const status = analysis.status as AnalysisStatus;
    const capaOpen = capaDetail.capa.status !== 'closed' && capaDetail.capa.status !== 'cancelled';

    const [recurrenceCandidates, allCapas, comparison] = await Promise.all([
      type === 'recurrence' ? findRecurrenceCandidates(org, analysisId) : Promise.resolve([]),
      type === 'comparative' ? listCapas(org) : Promise.resolve([]),
      type === 'comparative' ? getComparison(org, analysisId) : Promise.resolve([]),
    ]);
    const matchedIds = new Set(detail.recurrence.map((r) => r.matchedCapaId));

    const categoriesWithCauses = detail.categories
      .filter((c) => c.active)
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        causes: detail.hypotheses
          .filter((h) => h.ishikawaCategoryId === cat.id)
          .map((h) => ({ id: h.id, description: h.description, status: h.status })),
      }));

    return (
      <main className="container">
        <p>
          <Link href={`/dashboard/capa/${capaId}/analysis`}>← Volver a análisis</Link>
        </p>
        <div className="page-head">
          <h1>{analysis.title}</h1>
          <span className={`badge badge--analysis-${status}`}>{ANALYSIS_STATUS_LABEL[status]}</span>
        </div>
        <dl className="meta-grid">
          <div>
            <dt>Herramienta</dt>
            <dd>{ANALYSIS_TYPE_LABEL[type]}</dd>
          </div>
          <div>
            <dt>Versión</dt>
            <dd>v{analysis.version}</dd>
          </div>
          <div>
            <dt>Responsable</dt>
            <dd>{nameOf(analysis.responsibleUserId) ?? '—'}</dd>
          </div>
          <div>
            <dt>Revisor</dt>
            <dd>{nameOf(analysis.reviewerUserId) ?? '—'}</dd>
          </div>
          <div>
            <dt>CAPA</dt>
            <dd>
              <Link href={`/dashboard/capa/${capaId}`}>{capaDetail.capa.folio}</Link>
            </dd>
          </div>
        </dl>
        <p className="msg msg--info">{ANALYSIS_TYPE_HELP[type]}</p>

        <h2>Acciones</h2>
        <AnalysisEditPanel
          capaId={capaId}
          analysisId={analysisId}
          type={type}
          status={status}
          ctx={{ isAdmin: ctx.isAdmin, canEdit: ctx.canEdit, canReview: ctx.canReview }}
          capaOpen={capaOpen}
          members={members}
          categories={detail.categories
            .filter((c) => c.active)
            .map((c) => ({ id: c.id, name: c.name }))}
          hypotheses={detail.hypotheses.map((h) => ({
            id: h.id,
            description: h.description,
            status: h.status,
          }))}
          nodes={detail.nodes.map((n) => ({ id: n.id, description: n.description, type: n.type }))}
          fmeaRows={detail.fmea.map((r) => ({ id: r.id, failureMode: r.failureMode }))}
          recurrenceCandidates={recurrenceCandidates.filter((c) => !matchedIds.has(c.capaId))}
          allCapas={allCapas.map((c) => ({ id: c.id, folio: c.folio, title: c.title }))}
          paretoItems={(detail.pareto?.rows ?? []).map((r) => ({
            category: r.category,
            count: r.value,
          }))}
          conclusion={detail.conclusion as unknown as Record<string, string | null> | null}
        />

        {/* --- Visual + tabla por herramienta --- */}
        {type === 'ishikawa' && (
          <section>
            <h2>Diagrama de Ishikawa</h2>
            <IshikawaChart effect={capaDetail.capa.title} categories={categoriesWithCauses} />
            <h3>Causas (tabla accesible)</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th>Causa</th>
                    <th>Estado</th>
                    <th>Probabilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.hypotheses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted">
                        Sin causas registradas.
                      </td>
                    </tr>
                  ) : (
                    detail.hypotheses.map((h) => (
                      <tr key={h.id}>
                        <td>
                          {detail.categories.find((c) => c.id === h.ishikawaCategoryId)?.name ??
                            '—'}
                        </td>
                        <td>{h.description}</td>
                        <td>{HYPOTHESIS_STATUS_LABEL[h.status as HypothesisStatus] ?? h.status}</td>
                        <td>{h.probability}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {type === 'cause_tree' && (
          <section>
            <h2>Árbol de causas</h2>
            <CauseTreeChart
              nodes={detail.nodes.map((n) => ({
                id: n.id,
                type: n.type,
                description: n.description,
                isProposedRootCause: n.isProposedRootCause,
              }))}
              edges={detail.edges.map((e) => ({
                fromNodeId: e.fromNodeId,
                toNodeId: e.toNodeId,
                relation: e.relation,
              }))}
            />
            <h3>Nodos (tabla accesible)</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Causa raíz</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.nodes.map((n) => (
                    <tr key={n.id}>
                      <td>{CAUSE_NODE_TYPE_LABEL[n.type as CauseNodeType] ?? n.type}</td>
                      <td>{n.description}</td>
                      <td>
                        {n.isProposedRootCause ? `Sí — ${n.rootCauseJustification ?? ''}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {type === 'pareto' && detail.pareto && (
          <section>
            <h2>Análisis de Pareto</h2>
            <ParetoChart result={detail.pareto} />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th>Cantidad</th>
                    <th>%</th>
                    <th>% acumulado</th>
                    <th>Grupo vital</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.pareto.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">
                        Sin datos.
                      </td>
                    </tr>
                  ) : (
                    detail.pareto.rows.map((r) => (
                      <tr key={r.id ?? r.category}>
                        <td>{r.category}</td>
                        <td>{r.value}</td>
                        <td>{r.percentage}%</td>
                        <td>{r.cumulativePercentage}%</td>
                        <td>{r.vitalFew ? 'Sí' : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {type === 'fmea' && (
          <section>
            <h2>AMEF</h2>
            <div className="table-wrap">
              <table className="fmea-table">
                <thead>
                  <tr>
                    <th>Proceso</th>
                    <th>Modo de falla</th>
                    <th>Efecto</th>
                    <th>S</th>
                    <th>Causa</th>
                    <th>O</th>
                    <th>D</th>
                    <th>NPR</th>
                    <th>Prioridad</th>
                    <th>Acción</th>
                    <th>NPR post</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.fmea.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="muted">
                        Sin modos de falla.
                      </td>
                    </tr>
                  ) : (
                    detail.fmea.map((r) => (
                      <tr
                        key={r.id}
                        className={r.actionPriority === 'critical' ? 'row--critical' : undefined}
                      >
                        <td>{r.processStep ?? '—'}</td>
                        <td>{r.failureMode}</td>
                        <td>{r.effect ?? '—'}</td>
                        <td>{r.severity}</td>
                        <td>{r.causePotential ?? '—'}</td>
                        <td>{r.occurrence}</td>
                        <td>{r.detection}</td>
                        <td>
                          <strong>{r.npr}</strong>
                        </td>
                        <td>{r.actionPriority}</td>
                        <td>{r.recommendedAction ?? r.executedAction ?? '—'}</td>
                        <td>{r.nprPost ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {type === 'recurrence' && (
          <section>
            <h2>Recurrencia</h2>
            {detail.recurrence.length === 0 ? (
              <p className="empty-state">Sin coincidencias confirmadas.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>CAPA</th>
                      <th>Conclusión</th>
                      <th>Motivo</th>
                      <th>Justificación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.recurrence.map((r) => (
                      <tr key={r.id}>
                        <td>{r.matchedCapaId.slice(0, 8)}</td>
                        <td>
                          {RECURRENCE_CONFIRMATION_LABEL[
                            r.confirmation as RecurrenceConfirmation
                          ] ?? r.confirmation}
                        </td>
                        <td>{r.matchReason ?? '—'}</td>
                        <td>{r.justification ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {type === 'comparative' && (
          <section>
            <h2>Comparación de casos</h2>
            {comparison.length === 0 ? (
              <p className="empty-state">Selecciona entre 2 y 5 CAPA para comparar.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Aspecto</th>
                      {comparison.map((c) => (
                        <th key={c.capaId}>{c.folio}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Título</td>
                      {comparison.map((c) => (
                        <td key={c.capaId}>{c.title}</td>
                      ))}
                    </tr>
                    <tr>
                      <td>Tipo</td>
                      {comparison.map((c) => (
                        <td key={c.capaId}>{c.sourceType ?? '—'}</td>
                      ))}
                    </tr>
                    <tr>
                      <td>Área</td>
                      {comparison.map((c) => (
                        <td key={c.capaId}>{c.area ?? '—'}</td>
                      ))}
                    </tr>
                    <tr>
                      <td>Severidad</td>
                      {comparison.map((c) => (
                        <td key={c.capaId}>{c.severity ?? '—'}</td>
                      ))}
                    </tr>
                    <tr>
                      <td>Causa raíz</td>
                      {comparison.map((c) => (
                        <td key={c.capaId}>{c.rootCause ?? '—'}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Hipótesis (libre) */}
        {type === 'freeform' && (
          <section>
            <h2>Hipótesis</h2>
            {detail.hypotheses.length === 0 ? (
              <p className="empty-state">Sin hipótesis.</p>
            ) : (
              <ul className="gaps">
                {detail.hypotheses.map((h) => (
                  <li key={h.id}>
                    {h.description} —{' '}
                    {HYPOTHESIS_STATUS_LABEL[h.status as HypothesisStatus] ?? h.status}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Conclusión */}
        {detail.conclusion?.summary && (
          <section>
            <h2>Conclusión</h2>
            <ul className="gaps">
              <li>Resumen: {detail.conclusion.summary}</li>
              {detail.conclusion.proposedRootCause && (
                <li>Causa raíz propuesta: {detail.conclusion.proposedRootCause}</li>
              )}
              {detail.conclusion.confirmedRootCause && (
                <li>
                  <strong>Causa raíz confirmada:</strong> {detail.conclusion.confirmedRootCause}
                </li>
              )}
              {detail.conclusion.recommendations && (
                <li>Recomendaciones: {detail.conclusion.recommendations}</li>
              )}
            </ul>
          </section>
        )}

        {/* Acciones CAPA derivadas */}
        <section>
          <h2>Acciones CAPA derivadas</h2>
          {detail.actionLinks.length === 0 ? (
            <p className="empty-state">Sin acciones derivadas.</p>
          ) : (
            <ul className="history">
              {detail.actionLinks.map((l) => (
                <li key={l.id}>
                  {dt(l.createdAt)} · desde {l.sourceEntity} ·{' '}
                  <Link href={`/dashboard/capa/${capaId}`}>ver acción en la CAPA</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Evidencias */}
        <section>
          <h2>Evidencias</h2>
          {detail.evidence.length === 0 ? (
            <p className="empty-state">Sin evidencias.</p>
          ) : (
            <ul className="file-list">
              {detail.evidence.map((e) => (
                <li key={e.id}>
                  {e.originalName} ({Math.round(e.sizeBytes / 1024)} KB) · {e.entityType}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Historial */}
        <section>
          <h2>Historial</h2>
          <ul className="history">
            {detail.history.map((h) => (
              <li key={String(h.id)}>
                {dt(h.createdAt)} · {h.event}
                {h.summary ? ` · ${h.summary}` : ''} · {nameOf(h.actorUserId) ?? 'sistema'}
              </li>
            ))}
          </ul>
        </section>

        {/* Comentarios */}
        <section>
          <h2>Comentarios</h2>
          {detail.comments.length === 0 ? (
            <p className="empty-state">Sin comentarios.</p>
          ) : (
            <ul className="history">
              {detail.comments.map((cm) => (
                <li key={cm.id}>
                  {dt(cm.createdAt)} · {nameOf(cm.author) ?? '—'}: {cm.body}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    );
  } catch (error) {
    if (error instanceof AnalysisNotFoundError) notFound();
    throw error;
  }
}
