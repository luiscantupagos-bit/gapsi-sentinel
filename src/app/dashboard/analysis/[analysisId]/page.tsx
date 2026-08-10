import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  AnalysisNotFoundError,
  getAnalysisDetail,
  getAnalysisUserContext,
  listAnalysisMembers,
  listFtaNodes,
  listRelationsOfAnalysis,
} from '@/server/quality-analysis';
import {
  ANALYSIS_STATUS_LABEL,
  ANALYSIS_TYPE_HELP,
  ANALYSIS_TYPE_LABEL,
  CAUSE_NODE_TYPE_LABEL,
  HYPOTHESIS_STATUS_LABEL,
  type AnalysisStatus,
  type AnalysisType,
  type CauseNodeType,
  type HypothesisStatus,
} from '@/features/capa/analysis-state';
import { interpretFta } from '@/features/analysis/fta';
import { interpretFiveWhys, type FiveWhysModel } from '@/features/analysis/five-whys';
import { PrintButton } from './_components/PrintButton';
import { FtaWorkspace } from './_components/FtaWorkspace';
import { FiveWhysWorkspace, type WhyRow } from './_components/FiveWhysWorkspace';
import { ActionForm } from './_components/ActionForm';
import { saveConclusionAction, detachRelationAction } from './actions';
import { AnalysisEditPanel } from '../../capa/[capaId]/analysis/[analysisId]/AnalysisEditPanel';
import {
  IshikawaChart,
  CauseTreeChart,
  ParetoChart,
} from '../../capa/[capaId]/analysis/_components/AnalysisVisuals';

const dt = (d: Date | null | undefined) => (d ? new Date(d).toLocaleString('es-MX') : '—');

export default async function AnalysisWorkspacePage({
  params,
}: {
  params: Promise<{ analysisId: string }>;
}) {
  const session = await requireServerSession();
  const { analysisId } = await params;
  const org = session.organizationId;

  try {
    const [detail, ctx, relations] = await Promise.all([
      getAnalysisDetail(org, analysisId),
      getAnalysisUserContext(org, session.userId, analysisId),
      listRelationsOfAnalysis(org, analysisId),
    ]);
    const { analysis, nameOf, conclusion } = detail;
    const type = analysis.type as AnalysisType;
    const status = analysis.status as AnalysisStatus;
    const editable = ctx.canEdit;

    const LEGACY_TYPES = [
      'ishikawa',
      'cause_tree',
      'pareto',
      'fmea',
      'recurrence',
      'comparative',
      'freeform',
    ];
    const isLegacy = LEGACY_TYPES.includes(type);
    const members = isLegacy && editable ? await listAnalysisMembers(org) : [];

    const ftaNodes = type === 'fta' ? await listFtaNodes(org, analysisId) : [];
    const whySteps: WhyRow[] = detail.hypotheses
      .filter((h) => h.status !== 'discarded')
      .map((h) => ({
        id: h.id,
        statement: h.description,
        parentId: h.parentHypothesisId,
        evidence: h.evidenceFor ?? null,
        note: h.conclusion ?? null,
      }));

    const interpretation =
      type === 'fta'
        ? interpretFta(ftaNodes)
        : type === '5whys'
          ? interpretFiveWhys({
              problem: analysis.objective ?? analysis.title,
              steps: whySteps.map((w, i) => ({ id: w.id, order: i + 1, statement: w.statement })),
              proposedRootCause: conclusion?.proposedRootCause ?? null,
              rootCauseByUser: Boolean(conclusion?.proposedRootCause),
              conclusion: conclusion?.summary ?? null,
            } satisfies FiveWhysModel)
          : null;

    return (
      <main className="container analysis-detail">
        <p className="no-print">
          <Link href="/dashboard/capa/analysis">← Volver a la biblioteca de análisis</Link>
        </p>

        <header className="report-head">
          <div className="report-head__main">
            <h1>{analysis.title}</h1>
            <span className={`badge badge--analysis-${status}`}>
              {ANALYSIS_STATUS_LABEL[status] ?? status}
            </span>
            <span className="report-head__meta">
              v{analysis.version} · {ANALYSIS_TYPE_LABEL[type] ?? type} · Resp.:{' '}
              {nameOf(analysis.responsibleUserId) ?? '—'}
            </span>
          </div>
          <div className="report-head__actions no-print">
            <PrintButton />
          </div>
        </header>

        <p className="msg msg--info report-help no-print">{ANALYSIS_TYPE_HELP[type]}</p>

        {interpretation && (
          <div className="interpretation">
            <p className="interpretation__principal">{interpretation.principal}</p>
            <p className="interpretation__detail">{interpretation.detail}</p>
            <p className="interpretation__next">
              <strong>Siguiente paso:</strong> {interpretation.nextStep}
            </p>
          </div>
        )}

        {/* Herramienta */}
        <section className="report-card">
          <h2>{ANALYSIS_TYPE_LABEL[type] ?? type}</h2>
          {type === 'fta' ? (
            <FtaWorkspace analysisId={analysisId} nodes={ftaNodes} editable={editable} />
          ) : type === '5whys' ? (
            <FiveWhysWorkspace
              analysisId={analysisId}
              problem={analysis.objective ?? analysis.title}
              steps={whySteps}
              editable={editable}
            />
          ) : (
            <>
              {/* Visual por herramienta */}
              {type === 'ishikawa' && (
                <IshikawaChart
                  effect={analysis.title}
                  categories={detail.categories
                    .filter((cat) => cat.active)
                    .map((cat) => ({
                      id: cat.id,
                      name: cat.name,
                      causes: detail.hypotheses
                        .filter((h) => h.ishikawaCategoryId === cat.id)
                        .map((h) => ({ id: h.id, description: h.description, status: h.status })),
                    }))}
                />
              )}
              {type === 'cause_tree' && (
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
              )}
              {type === 'pareto' && detail.pareto && <ParetoChart result={detail.pareto} />}
              {type === 'fmea' && (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Modo de falla</th>
                        <th>S</th>
                        <th>O</th>
                        <th>D</th>
                        <th>NPR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.fmea.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="muted">
                            Sin modos de falla.
                          </td>
                        </tr>
                      ) : (
                        detail.fmea.map((r) => (
                          <tr key={r.id}>
                            <td>{r.failureMode}</td>
                            <td>{r.severity}</td>
                            <td>{r.occurrence}</td>
                            <td>{r.detection}</td>
                            <td>
                              <strong>{r.npr}</strong>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {(type === 'ishikawa' || type === 'cause_tree' || type === 'freeform') &&
                detail.hypotheses.length > 0 && (
                  <ul className="gaps">
                    {detail.hypotheses.map((h) => (
                      <li key={h.id}>
                        {type === 'cause_tree' ? '' : `${h.description} — `}
                        {HYPOTHESIS_STATUS_LABEL[h.status as HypothesisStatus] ?? h.status}
                      </li>
                    ))}
                  </ul>
                )}
              {type === 'cause_tree' && detail.nodes.length > 0 && (
                <ul className="gaps">
                  {detail.nodes.map((n) => (
                    <li key={n.id}>
                      <strong>{CAUSE_NODE_TYPE_LABEL[n.type as CauseNodeType] ?? n.type}:</strong>{' '}
                      {n.description}
                      {n.isProposedRootCause ? ' · (causa raíz propuesta)' : ''}
                    </li>
                  ))}
                </ul>
              )}

              {/* Captura y acciones (edición transversal, sin depender de CAPA) */}
              <details className="more-actions no-print" open={editable}>
                <summary>Captura y acciones</summary>
                <AnalysisEditPanel
                  capaId={analysis.capaId}
                  analysisId={analysisId}
                  type={type}
                  status={status}
                  ctx={{ isAdmin: ctx.isAdmin, canEdit: ctx.canEdit, canReview: ctx.canReview }}
                  capaOpen={false}
                  members={members}
                  categories={detail.categories
                    .filter((cat) => cat.active)
                    .map((cat) => ({ id: cat.id, name: cat.name }))}
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
                  recurrenceCandidates={[]}
                  allCapas={[]}
                  paretoItems={(detail.pareto?.rows ?? []).map((r) => ({
                    category: r.category,
                    count: r.value,
                  }))}
                  conclusion={detail.conclusion as unknown as Record<string, string | null> | null}
                />
              </details>
            </>
          )}
        </section>

        {/* Relaciones (trazabilidad transversal) */}
        <section className="report-card">
          <h2>Orígenes vinculados</h2>
          {relations.length === 0 ? (
            <p className="empty-state">Análisis independiente (sin orígenes vinculados).</p>
          ) : (
            <ul className="relations-list">
              {relations.map((r) => (
                <li key={r.id}>
                  {r.href ? <Link href={r.href}>{r.label}</Link> : r.label}
                  {editable && (
                    <ActionForm
                      action={detachRelationAction}
                      hidden={{ analysisId, relationId: r.id }}
                      button="Quitar"
                      confirm="¿Quitar esta relación? No elimina el análisis."
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Conclusión del responsable */}
        <section className="report-card">
          <h2>Conclusión del responsable</h2>
          <p className="muted no-print">
            La causa raíz y la conclusión las determina una persona; Sentinel no las deduce.
          </p>
          {editable && !isLegacy && (
            <ActionForm
              action={saveConclusionAction}
              hidden={{ analysisId }}
              button="Guardar conclusión"
              variant="primary"
              className="doc-form no-print"
            >
              <label className="field field--full">
                <span className="field__label">Causa raíz propuesta</span>
                <input
                  name="proposedRootCause"
                  defaultValue={conclusion?.proposedRootCause ?? ''}
                />
              </label>
              <label className="field field--full">
                <span className="field__label">Resumen / conclusión</span>
                <textarea name="summary" rows={4} defaultValue={conclusion?.summary ?? ''} />
              </label>
              <label className="field field--full">
                <span className="field__label">Recomendaciones / siguientes acciones</span>
                <textarea
                  name="recommendations"
                  rows={3}
                  defaultValue={conclusion?.recommendations ?? ''}
                />
              </label>
            </ActionForm>
          )}
          {(conclusion?.summary || conclusion?.proposedRootCause) && (
            <ul className="gaps">
              {conclusion?.proposedRootCause && (
                <li>Causa raíz propuesta: {conclusion.proposedRootCause}</li>
              )}
              {conclusion?.summary && <li>Resumen: {conclusion.summary}</li>}
              {conclusion?.recommendations && (
                <li>Recomendaciones: {conclusion.recommendations}</li>
              )}
            </ul>
          )}
        </section>

        {/* Historial */}
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
      </main>
    );
  } catch (error) {
    if (error instanceof AnalysisNotFoundError) notFound();
    throw error;
  }
}
