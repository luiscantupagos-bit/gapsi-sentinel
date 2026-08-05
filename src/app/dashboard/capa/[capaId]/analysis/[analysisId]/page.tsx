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
import { paretoInsights } from '@/features/capa/analysis-state';
import { CauseTreeChart, IshikawaChart, ParetoChart } from '../_components/AnalysisVisuals';
import { PrintButton } from '../_components/PrintButton';
import { ParetoResults } from '../_components/ParetoResults';
import { ParetoInsights } from '../_components/ParetoInsights';
import {
  AnalysisStatusPanel,
  AnalysisTeamPanel,
  CapaActionForm,
  CommentForm,
  ConclusionForm,
  EvidenceForm,
  ParetoDataForm,
} from '../_components/AnalysisFormSections';
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

    // ===== Pareto: layout ejecutivo reordenado (captura → resultado → …) =====
    if (type === 'pareto' && detail.pareto) {
      const chartRows = detail.pareto.rows.map((r) => ({
        id: r.id,
        category: r.category,
        value: r.value,
        percentage: r.percentage,
        cumulativePercentage: r.cumulativePercentage,
        vitalFew: r.vitalFew,
      }));
      const insights = paretoInsights(detail.pareto);
      const dataItems = chartRows.map((r) => ({ category: r.category, count: r.value }));

      return (
        <main className="container analysis-detail pareto-detail">
          <p className="no-print">
            <Link href={`/dashboard/capa/${capaId}/analysis`}>← Volver a análisis</Link>
          </p>

          {/* 1. Encabezado compacto */}
          <header className="report-head">
            <div className="report-head__main">
              <h1>{analysis.title}</h1>
              <span className={`badge badge--analysis-${status}`}>
                {ANALYSIS_STATUS_LABEL[status]}
              </span>
              <span className="report-head__meta">
                v{analysis.version} · {ANALYSIS_TYPE_LABEL[type]} ·{' '}
                <Link href={`/dashboard/capa/${capaId}`}>{capaDetail.capa.folio}</Link>
                {' · '}Resp.: {nameOf(analysis.responsibleUserId) ?? '—'} · Rev.:{' '}
                {nameOf(analysis.reviewerUserId) ?? '—'}
              </span>
            </div>
            <div className="report-head__actions no-print">
              <PrintButton />
            </div>
          </header>

          {/* 2. Estado + Equipo (compactos, 2 columnas) */}
          <div className="analysis-2col no-print">
            <div className="report-card">
              <h2>Estado del análisis</h2>
              <AnalysisStatusPanel
                capaId={capaId}
                analysisId={analysisId}
                status={status}
                canEdit={ctx.canEdit}
                canReview={ctx.canReview}
                isAdmin={ctx.isAdmin}
              />
            </div>
            {ctx.canEdit && (
              <div className="report-card">
                <h2>Equipo</h2>
                <p className="muted">Agrega colaboradores que capturarán información.</p>
                <AnalysisTeamPanel capaId={capaId} analysisId={analysisId} members={members} />
              </div>
            )}
          </div>

          {/* 3. Captura de datos (antes del gráfico) */}
          {ctx.canEdit && (
            <div className="report-card no-print">
              <h2>Captura de datos</h2>
              <p className="muted">
                Escribe cada categoría y su cantidad, o genera los datos desde las CAPA. El sistema
                calcula %, acumulado y el grupo vital (corte {detail.pareto.cutoff}%).
              </p>
              <ParetoDataForm capaId={capaId} analysisId={analysisId} items={dataItems} />
            </div>
          )}

          {/* ===== Reporte imprimible ===== */}
          <div className="analysis-report">
            {/* 4. Resultado: gráfico (60%) + tabla (40%) */}
            <ParetoResults rows={chartRows} cutoff={detail.pareto.cutoff} />

            {/* 5. Interpretación rápida */}
            {insights && <ParetoInsights insights={insights} />}

            {/* 6. Conclusión */}
            {ctx.canEdit && (
              <div className="report-card no-print">
                <h2>Conclusión</h2>
                <p className="muted">
                  Requerida antes de enviar a revisión (resumen y causa raíz propuesta).
                </p>
                <ConclusionForm
                  capaId={capaId}
                  analysisId={analysisId}
                  conclusion={detail.conclusion as unknown as Record<string, string | null> | null}
                />
              </div>
            )}
            {detail.conclusion?.summary && (
              <section className="report-card">
                <h2>Conclusión registrada</h2>
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

            {/* 7. Convertir en acción CAPA */}
            {capaOpen && (
              <div className="report-card no-print">
                <h2>Convertir en acción CAPA</h2>
                <CapaActionForm capaId={capaId} analysisId={analysisId} />
              </div>
            )}

            {/* 8. Evidencia y comentarios (2 columnas) */}
            <div className="analysis-2col no-print">
              {ctx.canEdit && (
                <div className="report-card">
                  <h2>Evidencia</h2>
                  <p className="muted">Adjunta soporte (PDF, Word, Excel, imagen).</p>
                  <EvidenceForm capaId={capaId} analysisId={analysisId} />
                </div>
              )}
              <div className="report-card">
                <h2>Comentar</h2>
                <p className="muted">Deja una nota para el equipo (queda en el historial).</p>
                <CommentForm capaId={capaId} analysisId={analysisId} />
              </div>
            </div>

            {/* 9. Resultados derivados (3 columnas) */}
            <section className="analysis-3col">
              <div className="report-card">
                <h2>Acciones CAPA derivadas</h2>
                {detail.actionLinks.length === 0 ? (
                  <p className="empty-state">Sin acciones derivadas.</p>
                ) : (
                  <ul className="history">
                    {detail.actionLinks.map((l) => (
                      <li key={l.id}>
                        {dt(l.createdAt)} · desde {l.sourceEntity} ·{' '}
                        <Link className="no-print" href={`/dashboard/capa/${capaId}`}>
                          ver en la CAPA
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="report-card">
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
              </div>
              <div className="report-card">
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
              </div>
            </section>

            {/* 10. Historial */}
            <section className="report-card">
              <h2>Historial</h2>
              <ul className="history history--compact">
                {detail.history.map((h) => (
                  <li key={String(h.id)}>
                    {dt(h.createdAt)} · {h.event}
                    {h.summary ? ` · ${h.summary}` : ''} · {nameOf(h.actorUserId) ?? 'sistema'}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </main>
      );
    }

    return (
      <main className="container analysis-detail">
        <p className="no-print">
          <Link href={`/dashboard/capa/${capaId}/analysis`}>← Volver a análisis</Link>
        </p>

        {/* Encabezado del reporte (se imprime) */}
        <header className="report-head">
          <div className="report-head__main">
            <h1>{analysis.title}</h1>
            <span className={`badge badge--analysis-${status}`}>
              {ANALYSIS_STATUS_LABEL[status]}
            </span>
          </div>
          <div className="report-head__actions no-print">
            <PrintButton />
          </div>
        </header>
        <dl className="report-meta">
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
        <p className="msg msg--info report-help">{ANALYSIS_TYPE_HELP[type]}</p>

        {/* Captura y acciones: colapsable y fuera de la impresión */}
        <details className="analysis-capture no-print" open>
          <summary>Captura y acciones</summary>
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
            nodes={detail.nodes.map((n) => ({
              id: n.id,
              description: n.description,
              type: n.type,
            }))}
            fmeaRows={detail.fmea.map((r) => ({ id: r.id, failureMode: r.failureMode }))}
            recurrenceCandidates={recurrenceCandidates.filter((c) => !matchedIds.has(c.capaId))}
            allCapas={allCapas.map((c) => ({ id: c.id, folio: c.folio, title: c.title }))}
            paretoItems={(detail.pareto?.rows ?? []).map((r) => ({
              category: r.category,
              count: r.value,
            }))}
            conclusion={detail.conclusion as unknown as Record<string, string | null> | null}
          />
        </details>

        {/* ===== Reporte imprimible (hoja tamaño carta) ===== */}
        <div className="analysis-report">
          {/* Ishikawa: diagrama + tabla lado a lado */}
          {type === 'ishikawa' && (
            <section className="analysis-2col">
              <div className="report-card">
                <h2>Diagrama de Ishikawa</h2>
                <IshikawaChart effect={capaDetail.capa.title} categories={categoriesWithCauses} />
              </div>
              <div className="report-card">
                <h2>Causas</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Categoría</th>
                        <th>Causa</th>
                        <th>Estado</th>
                        <th>Prob.</th>
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
                            <td>
                              {HYPOTHESIS_STATUS_LABEL[h.status as HypothesisStatus] ?? h.status}
                            </td>
                            <td>{h.probability}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* Árbol de causas: diagrama + tabla lado a lado */}
          {type === 'cause_tree' && (
            <section className="analysis-2col">
              <div className="report-card">
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
              </div>
              <div className="report-card">
                <h2>Nodos</h2>
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
              </div>
            </section>
          )}

          {/* Pareto: gráfico + tabla lado a lado */}
          {type === 'pareto' && detail.pareto && (
            <section className="analysis-2col">
              <div className="report-card">
                <h2>Diagrama de Pareto</h2>
                <ParetoChart result={detail.pareto} />
              </div>
              <div className="report-card">
                <h2>Datos</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Categoría</th>
                        <th>Cant.</th>
                        <th>%</th>
                        <th>% Acum</th>
                        <th>Vital</th>
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
              </div>
            </section>
          )}

          {/* AMEF: tabla ancha */}
          {type === 'fmea' && (
            <section className="report-card">
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

          {/* Recurrencia */}
          {type === 'recurrence' && (
            <section className="report-card">
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

          {/* Comparación */}
          {type === 'comparative' && (
            <section className="report-card">
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
                      {(
                        [
                          ['Título', (c: (typeof comparison)[number]) => c.title],
                          ['Tipo', (c: (typeof comparison)[number]) => c.sourceType ?? '—'],
                          ['Área', (c: (typeof comparison)[number]) => c.area ?? '—'],
                          ['Severidad', (c: (typeof comparison)[number]) => c.severity ?? '—'],
                          ['Causa raíz', (c: (typeof comparison)[number]) => c.rootCause ?? '—'],
                        ] as const
                      ).map(([label, get]) => (
                        <tr key={label}>
                          <td>{label}</td>
                          {comparison.map((c) => (
                            <td key={c.capaId}>{get(c)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Hipótesis (libre) */}
          {type === 'freeform' && (
            <section className="report-card">
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
            <section className="report-card">
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

          {/* Cajas en 3 columnas: acciones derivadas · evidencias · comentarios */}
          <section className="analysis-3col">
            <div className="report-card">
              <h2>Acciones CAPA derivadas</h2>
              {detail.actionLinks.length === 0 ? (
                <p className="empty-state">Sin acciones derivadas.</p>
              ) : (
                <ul className="history">
                  {detail.actionLinks.map((l) => (
                    <li key={l.id}>
                      {dt(l.createdAt)} · desde {l.sourceEntity} ·{' '}
                      <Link className="no-print" href={`/dashboard/capa/${capaId}`}>
                        ver en la CAPA
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="report-card">
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
            </div>
            <div className="report-card">
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
            </div>
          </section>

          {/* Historial (compacto) */}
          <section className="report-card">
            <h2>Historial</h2>
            <ul className="history history--compact">
              {detail.history.map((h) => (
                <li key={String(h.id)}>
                  {dt(h.createdAt)} · {h.event}
                  {h.summary ? ` · ${h.summary}` : ''} · {nameOf(h.actorUserId) ?? 'sistema'}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    );
  } catch (error) {
    if (error instanceof AnalysisNotFoundError) notFound();
    throw error;
  }
}
