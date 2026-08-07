import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  AuditNotFoundError,
  getAuditDetail,
  getExecutionData,
  getUserAuditContext,
  listChecklistSources,
} from '@/server/audits';
import { listOrgMembers } from '@/server/projects';
import { type AuditStatus } from '@/features/audits/audit-state';
import { PageHeader, SectionCard } from '../../_components/ui';
import {
  AuditStatusBadge,
  FindingClassBadge,
  FindingStatusBadge,
  Progress,
  ResultBadge,
  auditTypeLabel,
  severityLabel,
} from '../_components/AuditBits';
import { AuditActionForm } from '../_components/AuditActionForm';
import {
  addAgendaAction,
  addAuditCommentAction,
  addScopeAction,
  addTeamAction,
  createFindingAction,
  generateChecklistAction,
  transitionAuditAction,
  uploadAuditFileAction,
} from '../actions';

const TABS = [
  'resumen',
  'plan',
  'checklist',
  'evidencia',
  'hallazgos',
  'informe',
  'seguimiento',
  'archivos',
  'historial',
] as const;
const TAB_LABEL: Record<(typeof TABS)[number], string> = {
  resumen: 'Resumen',
  plan: 'Plan',
  checklist: 'Checklist',
  evidencia: 'Evidencia',
  hallazgos: 'Hallazgos',
  informe: 'Informe',
  seguimiento: 'Seguimiento',
  archivos: 'Archivos',
  historial: 'Historial',
};

const STAGES = ['Planificación', 'Preparación', 'Ejecución', 'Informe', 'Seguimiento', 'Cierre'];
function stageIndex(status: AuditStatus): number {
  switch (status) {
    case 'draft':
      return 0;
    case 'planned':
    case 'ready':
      return 1;
    case 'in_progress':
      return 2;
    case 'report_drafting':
    case 'under_review':
      return 3;
    case 'completed':
    case 'follow_up':
      return 4;
    case 'closed':
      return 5;
    default:
      return 0;
  }
}

function nextAction(status: AuditStatus, canAct: boolean, pending: number) {
  switch (status) {
    case 'draft':
      return {
        text: 'Completa el plan (alcance, criterios y líder) y genera el checklist.',
        to: 'planned',
        label: 'Marcar planeada',
      };
    case 'planned':
    case 'ready':
      return {
        text: 'La auditoría está lista para iniciar.',
        to: 'in_progress',
        label: 'Iniciar auditoría',
      };
    case 'in_progress':
      return {
        text: `Continúa con los ${pending} requisitos pendientes.`,
        to: 'report_drafting',
        label: 'Elaborar informe',
      };
    case 'report_drafting':
      return {
        text: 'Completa el informe antes de enviarlo a revisión.',
        to: 'under_review',
        label: 'Enviar a revisión',
      };
    case 'under_review':
      return { text: 'El aprobador revisa el informe.', to: 'completed', label: 'Completar' };
    case 'completed':
      return {
        text: 'La auditoría está completada. Inicia el seguimiento o ciérrala.',
        to: 'follow_up',
        label: 'Iniciar seguimiento',
      };
    case 'follow_up':
      return {
        text: 'Existen hallazgos pendientes de cierre.',
        to: 'closed',
        label: 'Cerrar auditoría',
      };
    default:
      return canAct
        ? { text: 'Auditoría cerrada o cancelada (solo lectura).', to: null, label: '' }
        : { text: '', to: null, label: '' };
  }
}

const dt = (d: Date) => new Date(d).toLocaleString('es-MX');

export default async function AuditDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ auditId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireServerSession();
  const { auditId } = await params;
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? '')
    ? (sp.tab as (typeof TABS)[number])
    : 'resumen';

  let detail;
  try {
    detail = await getAuditDetail(session.organizationId, auditId);
  } catch (error) {
    if (error instanceof AuditNotFoundError) notFound();
    throw error;
  }
  const [ctx, members] = await Promise.all([
    getUserAuditContext(session.organizationId, session.userId, auditId),
    listOrgMembers(session.organizationId),
  ]);
  const a = detail.audit;
  const needsChecklist = tab === 'checklist' || tab === 'evidencia' || tab === 'hallazgos';
  const exec = needsChecklist ? await getExecutionData(session.organizationId, auditId) : null;
  const sources =
    tab === 'plan' || (tab === 'checklist' && detail.summary.total === 0)
      ? await listChecklistSources(session.organizationId)
      : [];
  const curStage = stageIndex(a.status as AuditStatus);
  const na = nextAction(a.status as AuditStatus, ctx.canAct, detail.summary.pending);

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/audits">← Volver a auditorías</Link>
      </p>
      <PageHeader
        title={a.title}
        subtitle={`${a.folio} · ${auditTypeLabel(a.auditType)}${a.normVersionLabel ? ` · ${a.normVersionLabel}` : ''}`}
        actions={
          <div className="page-head__actions">
            {detail.summary.total > 0 && (
              <Link className="button button--ghost" href={`/dashboard/audits/${a.id}/execute`}>
                Modo ejecución
              </Link>
            )}
            <Link className="button button--ghost" href={`/dashboard/audits/${a.id}/report`}>
              Informe
            </Link>
          </div>
        }
      />

      <dl className="meta-grid">
        <div>
          <dt>Estado</dt>
          <dd>
            <AuditStatusBadge status={a.status} />
          </dd>
        </div>
        <div>
          <dt>Sitio</dt>
          <dd>{a.siteName ?? '—'}</dd>
        </div>
        <div>
          <dt>Auditor líder</dt>
          <dd>{a.leadAuditorName ?? '—'}</dd>
        </div>
        <div>
          <dt>Fecha planeada</dt>
          <dd>{a.plannedDate ?? '—'}</dd>
        </div>
        <div>
          <dt>Preparación</dt>
          <dd>
            <Progress value={detail.summary.progressPct} />
          </dd>
        </div>
      </dl>

      {na.text && (
        <div className="next-action">
          <div>
            <strong>Siguiente acción</strong>
            <p className="muted">{na.text}</p>
          </div>
          {na.to && ctx.canAct && !a.readOnly && (
            <AuditActionForm
              action={transitionAuditAction}
              hidden={{ auditId: a.id, to: na.to }}
              button={na.label}
              variant="primary"
            >
              {na.to === 'closed' && (
                <label className="field">
                  <span className="field__label">Justificación (si hay hallazgos abiertos)</span>
                  <input name="justification" placeholder="Opcional si todo está cerrado" />
                </label>
              )}
            </AuditActionForm>
          )}
        </div>
      )}

      <ol className="progressbar" aria-label="Progreso de la auditoría">
        {STAGES.map((st, i) => (
          <li
            key={st}
            className={`progressbar__step${i < curStage ? ' is-done' : ''}${i === curStage ? ' is-current' : ''}`}
          >
            <span className="progressbar__dot">{i + 1}</span>
            <span className="progressbar__label">{st}</span>
          </li>
        ))}
      </ol>

      <nav className="tabs" aria-label="Secciones de la auditoría">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/dashboard/audits/${a.id}?tab=${t}`}
            className={`tab${t === tab ? ' is-active' : ''}`}
          >
            {TAB_LABEL[t]}
          </Link>
        ))}
      </nav>

      {tab === 'resumen' && (
        <div className="two-col">
          <div>
            <SectionCard title="Datos generales">
              <ul className="dep-list">
                <li>
                  <strong>Objetivo:</strong> {a.objective ?? '—'}
                </li>
                <li>
                  <strong>Alcance:</strong> {a.scope ?? '—'}
                </li>
                <li>
                  <strong>Criterios:</strong> {a.criteria ?? '—'}
                </li>
                {detail.program && (
                  <li>
                    <strong>Programa:</strong>{' '}
                    <Link href={`/dashboard/audits/programs/${detail.program.id}`}>
                      {detail.program.folio} · {detail.program.name}
                    </Link>
                  </li>
                )}
              </ul>
            </SectionCard>
            <SectionCard title="Resultados del checklist">
              <ul className="dep-list">
                <li>Total requisitos: {detail.summary.total}</li>
                <li>Evaluados: {detail.summary.evaluated}</li>
                <li>Conformes: {detail.summary.byResult.conforme}</li>
                <li>Parciales: {detail.summary.byResult.parcial}</li>
                <li>No conformes: {detail.summary.byResult.no_conforme}</li>
                <li>Evidencia insuficiente: {detail.summary.byResult.evidencia_insuficiente}</li>
              </ul>
            </SectionCard>
          </div>
          <div>
            <SectionCard title="Comentar">
              <AuditActionForm
                action={addAuditCommentAction}
                hidden={{ auditId: a.id }}
                button="Comentar"
              >
                <label className="field">
                  <span className="field__label">Comentario</span>
                  <input name="body" required placeholder="Nota para el equipo" />
                </label>
              </AuditActionForm>
              {detail.comments.length > 0 && (
                <ul className="history">
                  {detail.comments.map((c) => (
                    <li key={c.id}>
                      <span className="muted">{dt(c.createdAt)}</span> · {c.author ?? '—'}: {c.body}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {tab === 'plan' && (
        <div className="two-col">
          <div>
            <SectionCard title="Equipo auditor">
              {detail.team.length === 0 ? (
                <p className="empty-state">Sin equipo.</p>
              ) : (
                <ul className="dep-list">
                  {detail.team.map((m) => (
                    <li key={m.id}>
                      <span className="badge badge--soft">{m.role}</span> {m.name}
                      {m.potentialConflict && (
                        <span className="badge badge--warning small">
                          {' '}
                          Posible conflicto de independencia
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {ctx.canAct && !a.readOnly && (
                <AuditActionForm
                  action={addTeamAction}
                  hidden={{ auditId: a.id }}
                  button="Agregar participante"
                >
                  <label className="field">
                    <span className="field__label">Persona</span>
                    <select name="userId" required defaultValue="">
                      <option value="" disabled>
                        Selecciona…
                      </option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field__label">Rol</span>
                    <select name="role" defaultValue="auditor">
                      <option value="lead">Auditor líder</option>
                      <option value="auditor">Auditor</option>
                      <option value="technical_expert">Experto técnico</option>
                      <option value="observer">Observador</option>
                      <option value="auditee">Auditado</option>
                    </select>
                  </label>
                </AuditActionForm>
              )}
            </SectionCard>
            <SectionCard title="Alcance (sitios/procesos)">
              {detail.scope.length === 0 ? (
                <p className="empty-state">Sin elementos de alcance.</p>
              ) : (
                <ul className="dep-list">
                  {detail.scope.map((s) => (
                    <li key={s.id}>
                      <span className="badge badge--soft">{s.kind}</span> {s.label ?? '—'}
                    </li>
                  ))}
                </ul>
              )}
              {ctx.canAct && !a.readOnly && (
                <AuditActionForm
                  action={addScopeAction}
                  hidden={{ auditId: a.id }}
                  button="Agregar al alcance"
                >
                  <label className="field">
                    <span className="field__label">Tipo</span>
                    <select name="kind" defaultValue="process">
                      <option value="process">Proceso</option>
                      <option value="site">Sitio</option>
                      <option value="framework">Esquema</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="field__label">Descripción</span>
                    <input name="label" placeholder="p. ej. Recepción de materia prima" />
                  </label>
                </AuditActionForm>
              )}
            </SectionCard>
          </div>
          <div>
            <SectionCard title="Agenda">
              {detail.agenda.length === 0 ? (
                <p className="empty-state">Sin agenda.</p>
              ) : (
                <ul className="dep-list">
                  {detail.agenda.map((g) => (
                    <li key={g.id}>
                      <span className="mono">
                        {g.startTime ?? '—'}
                        {g.endTime ? `–${g.endTime}` : ''}
                      </span>{' '}
                      {g.processArea ?? ''} {g.location ? `· ${g.location}` : ''}
                    </li>
                  ))}
                </ul>
              )}
              {ctx.canAct && !a.readOnly && (
                <AuditActionForm
                  action={addAgendaAction}
                  hidden={{ auditId: a.id }}
                  button="Agregar bloque"
                >
                  <div className="form-grid">
                    <label className="field">
                      <span className="field__label">Inicio</span>
                      <input type="time" name="startTime" />
                    </label>
                    <label className="field">
                      <span className="field__label">Fin</span>
                      <input type="time" name="endTime" />
                    </label>
                  </div>
                  <label className="field">
                    <span className="field__label">Proceso/área</span>
                    <input name="processArea" />
                  </label>
                </AuditActionForm>
              )}
            </SectionCard>
            {detail.summary.total === 0 && ctx.canAct && !a.readOnly && (
              <SectionCard title="Generar checklist">
                <p className="muted">
                  Congela los requisitos de una versión de plantilla publicada.
                </p>
                {sources.length === 0 ? (
                  <p className="empty-state">No hay versiones de plantilla publicadas.</p>
                ) : (
                  <AuditActionForm
                    action={generateChecklistAction}
                    hidden={{ auditId: a.id }}
                    button="Generar checklist"
                    variant="primary"
                  >
                    <label className="field">
                      <span className="field__label">Norma / versión</span>
                      <select name="templateVersionId" required defaultValue="">
                        <option value="" disabled>
                          Selecciona…
                        </option>
                        {sources.map((s) => (
                          <option key={s.templateVersionId} value={s.templateVersionId}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </AuditActionForm>
                )}
              </SectionCard>
            )}
          </div>
        </div>
      )}

      {tab === 'checklist' && (
        <SectionCard
          title="Checklist por requisito"
          action={
            exec && exec.rows.length > 0 ? (
              <Link className="button button--ghost" href={`/dashboard/audits/${a.id}/execute`}>
                Modo ejecución
              </Link>
            ) : undefined
          }
        >
          {!exec || exec.rows.length === 0 ? (
            <p className="empty-state">Genera el checklist en la pestaña Plan.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Sección</th>
                    <th>Requisito</th>
                    <th>Resultado</th>
                    <th>Evidencia</th>
                  </tr>
                </thead>
                <tbody>
                  {exec.rows.map((r) => (
                    <tr key={r.snapshotId}>
                      <td>{r.sequence}</td>
                      <td>{r.sectionCode ?? '—'}</td>
                      <td>
                        <span className="mono">{r.requirementCode}</span> {r.requirementTitle}
                        {r.isCritical && (
                          <span className="badge badge--warning small"> crítico</span>
                        )}
                      </td>
                      <td>
                        <ResultBadge result={r.result} />
                      </td>
                      <td>{r.evidenceCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'hallazgos' && (
        <div className="two-col">
          <div>
            <SectionCard title="Hallazgos">
              {detail.findings.length === 0 ? (
                <p className="empty-state">Sin hallazgos.</p>
              ) : (
                <ul className="dep-list">
                  {detail.findings.map((f) => (
                    <li key={f.id}>
                      <FindingStatusBadge status={f.status} />{' '}
                      <FindingClassBadge classification={f.classification} />{' '}
                      <Link href={`/dashboard/audits/findings/${f.id}`}>
                        {f.folio} · {f.title}
                      </Link>{' '}
                      <span className="muted small">{severityLabel(f.severity)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
          <div>
            {ctx.canAct && !a.readOnly && (
              <SectionCard title="Nuevo hallazgo">
                <p className="muted">
                  Separa: requisito → evidencia objetiva → brecha → clasificación.
                </p>
                <AuditActionForm
                  action={createFindingAction}
                  hidden={{ auditId: a.id }}
                  button="Crear hallazgo"
                  variant="primary"
                >
                  <label className="field">
                    <span className="field__label">Requisito evaluado (opcional)</span>
                    <select name="snapshotId" defaultValue="">
                      <option value="">— Ninguno —</option>
                      {(exec?.rows ?? []).map((r) => (
                        <option key={r.snapshotId} value={r.snapshotId}>
                          {r.requirementCode} · {r.requirementTitle}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field__label">Título (brecha)</span>
                    <input name="title" required />
                  </label>
                  <label className="field">
                    <span className="field__label">Evidencia objetiva</span>
                    <textarea name="objectiveEvidence" rows={2} />
                  </label>
                  <div className="form-grid">
                    <label className="field">
                      <span className="field__label">Clasificación</span>
                      <select name="classification" defaultValue="observation">
                        <option value="major_nc">No conformidad mayor</option>
                        <option value="minor_nc">No conformidad menor</option>
                        <option value="observation">Observación</option>
                        <option value="improvement">Oportunidad de mejora</option>
                        <option value="strength">Fortaleza</option>
                        <option value="insufficient_evidence">Evidencia insuficiente</option>
                      </select>
                    </label>
                    <label className="field">
                      <span className="field__label">Severidad</span>
                      <select name="severity" defaultValue="medium">
                        <option value="low">Baja</option>
                        <option value="medium">Media</option>
                        <option value="high">Alta</option>
                        <option value="critical">Crítica</option>
                      </select>
                    </label>
                  </div>
                </AuditActionForm>
              </SectionCard>
            )}
          </div>
        </div>
      )}

      {tab === 'evidencia' && (
        <SectionCard title="Evidencia y entrevistas">
          <p className="muted">
            Registra la evidencia y las entrevistas desde el{' '}
            <Link href={`/dashboard/audits/${a.id}/execute`}>modo ejecución</Link>, asociándolas a
            cada requisito.
          </p>
          {ctx.canAct && !a.readOnly && (
            <AuditActionForm
              action={uploadAuditFileAction}
              hidden={{ auditId: a.id, kind: 'evidence' }}
              button="Adjuntar evidencia"
              encType="multipart/form-data"
            >
              <label className="field">
                <span className="field__label">Archivo</span>
                <input type="file" name="file" required />
              </label>
            </AuditActionForm>
          )}
        </SectionCard>
      )}

      {tab === 'informe' && (
        <SectionCard title="Informe de auditoría">
          <p className="muted">
            Vista imprimible con portada, resumen, resultados, hallazgos y conclusión.
          </p>
          <Link className="button button--primary" href={`/dashboard/audits/${a.id}/report`}>
            Abrir informe
          </Link>
        </SectionCard>
      )}

      {tab === 'seguimiento' && (
        <SectionCard title="Seguimiento de hallazgos">
          {detail.findings.length === 0 ? (
            <p className="empty-state">Sin hallazgos que dar seguimiento.</p>
          ) : (
            <ul className="dep-list">
              {detail.findings.map((f) => (
                <li key={f.id}>
                  <FindingStatusBadge status={f.status} />{' '}
                  <Link href={`/dashboard/audits/findings/${f.id}`}>
                    {f.folio} · {f.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {tab === 'archivos' && (
        <SectionCard title="Archivos">
          {detail.files.length === 0 ? (
            <p className="empty-state">Sin archivos.</p>
          ) : (
            <ul className="file-list">
              {detail.files.map((f) => (
                <li key={f.id}>
                  <span className="badge">{f.kind}</span> {f.originalName}{' '}
                  <span className="muted">({Math.round(f.sizeBytes / 1024)} KB)</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {tab === 'historial' && (
        <SectionCard title="Historial">
          {detail.history.length === 0 ? (
            <p className="empty-state">Sin eventos.</p>
          ) : (
            <ul className="history history--compact">
              {detail.history.map((h) => (
                <li key={h.id}>
                  <span className="muted">{dt(h.createdAt)}</span> · {h.event}
                  {h.toStatus ? ` → ${h.toStatus}` : ''}
                  {h.detail ? ` · ${h.detail}` : ''} · {h.actorName ?? 'sistema'}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}
    </main>
  );
}
