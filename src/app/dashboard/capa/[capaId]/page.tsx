import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  CapaNotFoundError,
  getCapaDetail,
  getCapaUserContext,
  getCreateOptions,
} from '@/server/capa';
import {
  ACTION_STATUS_LABEL,
  ACTION_TYPE_LABEL,
  CAPA_EVIDENCE_TYPE_LABEL,
  CAPA_PRIORITY_LABEL,
  CAPA_SCOPE_LABEL,
  CAPA_SEVERITY_LABEL,
  CAPA_SOURCE_TYPE_LABEL,
  CAPA_STATUS_LABEL,
  EFFECTIVENESS_RESULT_LABEL,
  IMMEDIATE_ACTION_TYPE_LABEL,
  RCA_METHOD_LABEL,
  type ActionStatus,
  type ActionType,
  type CapaEvidenceType,
  type CapaPriority,
  type CapaScope,
  type CapaSeverity,
  type CapaSourceType,
  type CapaStatus,
  type EffectivenessResult,
  type ImmediateActionType,
  type RcaMethod,
} from '@/features/capa/capa-state';
import { CapaWorkflowPanel } from './CapaWorkflowPanel';
import { NextActionCard, StageProgress } from '../../_components/detail';

const CAPA_STAGES = [
  'Registro',
  'Contención',
  'Investigación',
  'Plan',
  'Implementación',
  'Eficacia',
  'Cierre',
];
function capaStageIndex(status: CapaStatus): number {
  switch (status) {
    case 'draft':
    case 'reported':
      return 0;
    case 'containment':
      return 1;
    case 'under_investigation':
      return 2;
    case 'action_plan':
      return 3;
    case 'in_implementation':
      return 4;
    case 'effectiveness_review':
      return 5;
    case 'closed':
      return 6;
    default:
      return 0;
  }
}
function capaNextAction(status: CapaStatus): {
  text: string;
  tone: 'default' | 'success' | 'warning';
} {
  switch (status) {
    case 'draft':
      return { text: 'Reporta la CAPA para iniciar el flujo.', tone: 'default' };
    case 'reported':
      return { text: 'Registra la contención inmediata del problema.', tone: 'default' };
    case 'containment':
      return { text: 'Investiga y determina la causa raíz.', tone: 'default' };
    case 'under_investigation':
      return { text: 'Define el plan de acciones correctivas.', tone: 'default' };
    case 'action_plan':
      return { text: 'Implementa las acciones del plan.', tone: 'default' };
    case 'in_implementation':
      return { text: 'Verifica la eficacia de las acciones.', tone: 'default' };
    case 'effectiveness_review':
      return { text: 'Cierra la CAPA si la eficacia es satisfactoria.', tone: 'warning' };
    case 'closed':
      return { text: 'CAPA cerrada.', tone: 'success' };
    case 'cancelled':
      return { text: 'CAPA cancelada.', tone: 'warning' };
    default:
      return { text: '', tone: 'default' };
  }
}

const dt = (d: Date | null | undefined) => (d ? new Date(d).toLocaleString('es-MX') : '—');
const day = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

export default async function CapaDetailPage({ params }: { params: Promise<{ capaId: string }> }) {
  const session = await requireServerSession();
  const { capaId } = await params;

  try {
    const [detail, ctx, options] = await Promise.all([
      getCapaDetail(session.organizationId, capaId),
      getCapaUserContext(session.organizationId, session.userId, capaId),
      getCreateOptions(session.organizationId),
    ]);
    const { capa, nameOf } = detail;
    const status = capa.status as CapaStatus;

    return (
      <main className="container">
        <p>
          <Link href="/dashboard/capa">← Volver al listado</Link>
        </p>
        <div className="page-head">
          <h1>
            {capa.folio} · {capa.title}
          </h1>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className={`badge badge--capa-${status}`}>{CAPA_STATUS_LABEL[status]}</span>
            <Link className="button button--ghost" href={`/dashboard/capa/${capa.id}/analysis`}>
              Análisis
            </Link>
            {ctx.canEdit && (
              <Link className="button button--ghost" href={`/dashboard/capa/${capa.id}/edit`}>
                Editar
              </Link>
            )}
          </div>
        </div>

        <dl className="meta-grid">
          <div>
            <dt>Tipo / origen</dt>
            <dd>{CAPA_SOURCE_TYPE_LABEL[capa.sourceType as CapaSourceType]}</dd>
          </div>
          <div>
            <dt>Severidad</dt>
            <dd>{CAPA_SEVERITY_LABEL[capa.severity as CapaSeverity]}</dd>
          </div>
          <div>
            <dt>Prioridad</dt>
            <dd>{CAPA_PRIORITY_LABEL[capa.priority as CapaPriority]}</dd>
          </div>
          <div>
            <dt>Alcance</dt>
            <dd>{CAPA_SCOPE_LABEL[capa.scope as CapaScope]}</dd>
          </div>
          <div>
            <dt>Responsable</dt>
            <dd>{detail.responsibleName ?? '—'}</dd>
          </div>
          <div>
            <dt>Sitio</dt>
            <dd>{detail.siteName ?? '—'}</dd>
          </div>
          <div>
            <dt>Detección</dt>
            <dd>{day(capa.detectedAt)}</dd>
          </div>
          <div>
            <dt>Fecha objetivo</dt>
            <dd>{day(capa.targetDate)}</dd>
          </div>
          <div>
            <dt>Impacto</dt>
            <dd>{capa.impacts.length ? capa.impacts.join(', ') : '—'}</dd>
          </div>
          <div>
            <dt>Reportó</dt>
            <dd>{detail.reporterName ?? '—'}</dd>
          </div>
        </dl>

        <p className="muted">{capa.description}</p>
        {capa.area || capa.process || capa.product ? (
          <p className="muted">
            {capa.area ? `Área: ${capa.area}. ` : ''}
            {capa.process ? `Proceso: ${capa.process}. ` : ''}
            {capa.product ? `Producto: ${capa.product}.` : ''}
          </p>
        ) : null}

        {status !== 'cancelled' && (
          <StageProgress stages={CAPA_STAGES} current={capaStageIndex(status)} />
        )}
        {(() => {
          const na = capaNextAction(status);
          return na.text ? <NextActionCard text={na.text} tone={na.tone} /> : null;
        })()}

        <h2>Acciones</h2>
        <CapaWorkflowPanel
          capaId={capa.id}
          status={status}
          isAdmin={ctx.isAdmin}
          canEdit={ctx.canEdit}
          members={options.members}
          documents={options.documents}
          immediateActions={detail.immediateActions.map((a) => ({
            id: a.id,
            actionType: a.actionType,
            description: a.description,
            status: a.status,
          }))}
          actions={detail.actions.map((a) => ({
            id: a.id,
            description: a.description,
            status: a.status,
            progress: a.progress,
          }))}
        />

        {/* Descripción estructurada */}
        {(capa.problemWhat || capa.conditionObserved || capa.objectiveEvidence) && (
          <section>
            <h2>Descripción del problema</h2>
            <ul className="gaps">
              {capa.problemWhat && <li>Qué: {capa.problemWhat}</li>}
              {capa.problemWhere && <li>Dónde: {capa.problemWhere}</li>}
              {capa.problemWhen && <li>Cuándo: {capa.problemWhen}</li>}
              {capa.problemHow && <li>Cómo se detectó: {capa.problemHow}</li>}
              {capa.conditionObserved && <li>Condición observada: {capa.conditionObserved}</li>}
              {capa.requirementBreached && (
                <li>Requisito incumplido: {capa.requirementBreached}</li>
              )}
              {capa.objectiveEvidence && <li>Evidencia objetiva: {capa.objectiveEvidence}</li>}
            </ul>
          </section>
        )}

        {/* Contención */}
        <section>
          <h2>Contención y correcciones inmediatas</h2>
          {detail.immediateActions.length === 0 ? (
            <p className="empty-state">Sin acciones inmediatas.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Responsable</th>
                    <th>Estado</th>
                    <th>Ejecución</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.immediateActions.map((a) => (
                    <tr key={a.id}>
                      <td>{IMMEDIATE_ACTION_TYPE_LABEL[a.actionType as ImmediateActionType]}</td>
                      <td>{a.description}</td>
                      <td>{nameOf(a.responsibleUserId) ?? '—'}</td>
                      <td>{ACTION_STATUS_LABEL[a.status as ActionStatus] ?? a.status}</td>
                      <td>{day(a.executedAt)}</td>
                      <td>{a.result ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Investigación y causa raíz */}
        <section>
          <h2>Investigación y causa raíz</h2>
          {detail.rca ? (
            <>
              <p>
                Método: {RCA_METHOD_LABEL[detail.rca.method as RcaMethod]} ·{' '}
                {detail.rca.concludedAt ? `Concluida ${dt(detail.rca.concludedAt)}` : 'En progreso'}
              </p>
              {detail.whySteps.length > 0 && (
                <ol className="gaps">
                  {detail.whySteps.map((w) => (
                    <li key={w.id}>
                      ¿Por qué {w.level}? {w.answer}
                    </li>
                  ))}
                </ol>
              )}
              {detail.rca.immediateCause && <p>Causa inmediata: {detail.rca.immediateCause}</p>}
              {detail.rca.contributingCause && (
                <p>Causa contribuyente: {detail.rca.contributingCause}</p>
              )}
              <p>
                <strong>Causa raíz:</strong> {detail.rca.rootCause ?? '—'}
              </p>
            </>
          ) : (
            <p className="empty-state">Sin análisis de causa.</p>
          )}
        </section>

        {/* Plan de acciones */}
        <section>
          <h2>Plan de acciones</h2>
          {detail.actions.length === 0 ? (
            <p className="empty-state">Sin acciones.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Responsable</th>
                    <th>Compromiso</th>
                    <th>Estado</th>
                    <th>Avance</th>
                    <th>Documento</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.actions.map((a) => (
                    <tr key={a.id}>
                      <td>{ACTION_TYPE_LABEL[a.actionType as ActionType]}</td>
                      <td>{a.description}</td>
                      <td>{nameOf(a.responsibleUserId) ?? '—'}</td>
                      <td>{day(a.dueDate)}</td>
                      <td>{ACTION_STATUS_LABEL[a.status as ActionStatus]}</td>
                      <td>{a.progress}%</td>
                      <td>
                        {a.documentId ? (
                          <Link href={`/dashboard/documents/${a.documentId}`}>Ver documento</Link>
                        ) : (
                          (a.docChangeRequest ?? '—')
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Eficacia */}
        <section>
          <h2>Verificación de eficacia</h2>
          {detail.reviews.length === 0 ? (
            <p className="empty-state">Sin verificaciones.</p>
          ) : (
            <ul className="gaps">
              {detail.reviews.map((r) => (
                <li key={r.id}>
                  {dt(r.createdAt)} ·{' '}
                  {EFFECTIVENESS_RESULT_LABEL[r.conclusion as EffectivenessResult]} · Verificó:{' '}
                  {nameOf(r.verifierUserId) ?? '—'} · {r.criterion}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Cierre */}
        {capa.status === 'closed' && (
          <section>
            <h2>Cierre</h2>
            <p>
              {dt(capa.closedAt)} · {nameOf(capa.closedBy) ?? '—'}
            </p>
            <p>{capa.closureSummary}</p>
          </section>
        )}

        {/* Evidencias */}
        <section>
          <h2>Evidencias</h2>
          {detail.files.length === 0 ? (
            <p className="empty-state">Sin evidencias.</p>
          ) : (
            <ul className="file-list">
              {detail.files.map((f) => (
                <li key={f.id}>
                  [{CAPA_EVIDENCE_TYPE_LABEL[f.evidenceType as CapaEvidenceType]}] {f.originalName}{' '}
                  ({Math.round(f.sizeBytes / 1024)} KB)
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
                {h.fromStatus || h.toStatus
                  ? ` (${h.fromStatus ?? '—'} → ${h.toStatus ?? '—'})`
                  : ''}
                {h.detail ? ` · ${h.detail}` : ''} · {nameOf(h.actorUserId) ?? 'sistema'}
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
              {detail.comments.map((c) => (
                <li key={c.id}>
                  {dt(c.createdAt)} · {nameOf(c.author) ?? '—'}: {c.body}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    );
  } catch (error) {
    if (error instanceof CapaNotFoundError) notFound();
    throw error;
  }
}
