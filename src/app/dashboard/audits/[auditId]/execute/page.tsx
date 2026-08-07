import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { AuditNotFoundError, getExecutionData, getUserAuditContext } from '@/server/audits';
import { CHECKLIST_RESULTS, CHECKLIST_RESULT_LABEL } from '@/features/audits/checklist';
import { PageHeader } from '../../../_components/ui';
import { Progress } from '../../_components/AuditBits';
import { AuditActionForm } from '../../_components/AuditActionForm';
import { addEvidenceAction, addInterviewAction, setResultAction } from '../../actions';

export default async function ExecutePage({
  params,
  searchParams,
}: {
  params: Promise<{ auditId: string }>;
  searchParams: Promise<{ filter?: string; section?: string }>;
}) {
  const session = await requireServerSession();
  const { auditId } = await params;
  const sp = await searchParams;
  let exec;
  try {
    exec = await getExecutionData(session.organizationId, auditId);
  } catch (error) {
    if (error instanceof AuditNotFoundError) notFound();
    throw error;
  }
  const ctx = await getUserAuditContext(session.organizationId, session.userId, auditId);

  const sections = [...new Set(exec.rows.map((r) => r.sectionCode).filter(Boolean))] as string[];
  let rows = exec.rows;
  if (sp.filter === 'pending') rows = rows.filter((r) => r.result === 'no_evaluado');
  if (sp.filter === 'evaluated') rows = rows.filter((r) => r.result !== 'no_evaluado');
  if (sp.section) rows = rows.filter((r) => r.sectionCode === sp.section);

  return (
    <main className="container">
      <p>
        <Link href={`/dashboard/audits/${auditId}`}>← Volver a la auditoría</Link>
      </p>
      <PageHeader
        title={`Modo ejecución · ${exec.audit.title}`}
        subtitle={`${exec.audit.folio}${exec.audit.normVersionLabel ? ` · ${exec.audit.normVersionLabel}` : ''}`}
      />

      <div className="exec-head">
        <div className="exec-progress">
          <strong>
            {exec.summary.evaluated} / {exec.summary.total} requisitos evaluados
          </strong>
          <Progress value={exec.summary.progressPct} />
        </div>
        <div className="exec-filters">
          <Link
            className={`tab${!sp.filter ? ' is-active' : ''}`}
            href={`/dashboard/audits/${auditId}/execute`}
          >
            Todos
          </Link>
          <Link
            className={`tab${sp.filter === 'pending' ? ' is-active' : ''}`}
            href={`/dashboard/audits/${auditId}/execute?filter=pending`}
          >
            Pendientes
          </Link>
          <Link
            className={`tab${sp.filter === 'evaluated' ? ' is-active' : ''}`}
            href={`/dashboard/audits/${auditId}/execute?filter=evaluated`}
          >
            Evaluados
          </Link>
        </div>
      </div>

      {sections.length > 1 && (
        <div className="exec-sections">
          <Link className="badge badge--soft" href={`/dashboard/audits/${auditId}/execute`}>
            Todas las secciones
          </Link>
          {sections.map((sc) => (
            <Link
              key={sc}
              className="badge badge--soft"
              href={`/dashboard/audits/${auditId}/execute?section=${sc}`}
            >
              {sc}
            </Link>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="empty-state">No hay requisitos para este filtro.</p>
      ) : (
        <div className="exec-list">
          {rows.map((r) => (
            <article key={r.snapshotId} className="exec-card">
              <header className="exec-card__head">
                <span className="mono">{r.requirementCode}</span>
                <span className="exec-card__title">{r.requirementTitle}</span>
                {r.isCritical && <span className="badge badge--warning small">crítico</span>}
                {r.sectionCode && <span className="badge badge--soft small">{r.sectionCode}</span>}
              </header>
              {r.requirementText && <p className="muted small">{r.requirementText}</p>}

              {ctx.canAct ? (
                <AuditActionForm
                  action={setResultAction}
                  hidden={{ auditId, checklistItemId: r.checklistItemId ?? '' }}
                  button="Guardar resultado"
                  className="exec-form"
                >
                  <div className="form-grid">
                    <label className="field">
                      <span className="field__label">Resultado</span>
                      <select name="result" defaultValue={r.result}>
                        {CHECKLIST_RESULTS.map((res) => (
                          <option key={res} value={res}>
                            {CHECKLIST_RESULT_LABEL[res]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span className="field__label">Evidencia encontrada</span>
                      <input name="foundEvidence" defaultValue={r.foundEvidence ?? ''} />
                    </label>
                  </div>
                  <label className="field field--full">
                    <span className="field__label">Comentario</span>
                    <input name="comment" defaultValue={r.comment ?? ''} />
                  </label>
                </AuditActionForm>
              ) : (
                <p className="muted">
                  Resultado: {CHECKLIST_RESULT_LABEL[r.result as never] ?? r.result}
                </p>
              )}

              {ctx.canAct && (
                <details className="exec-extra">
                  <summary>Evidencia / entrevista</summary>
                  <AuditActionForm
                    action={addEvidenceAction}
                    hidden={{ auditId, checklistItemId: r.checklistItemId ?? '' }}
                    button="Agregar evidencia"
                  >
                    <div className="form-grid">
                      <label className="field">
                        <span className="field__label">Tipo</span>
                        <select name="evidenceType" defaultValue="observation">
                          <option value="document">Documento</option>
                          <option value="record">Registro</option>
                          <option value="observation">Observación en campo</option>
                          <option value="photo">Fotografía</option>
                          <option value="measurement">Medición</option>
                          <option value="system">Sistema</option>
                          <option value="sample">Muestra</option>
                        </select>
                      </label>
                      <label className="field">
                        <span className="field__label">Descripción</span>
                        <input name="description" required />
                      </label>
                    </div>
                  </AuditActionForm>
                  <AuditActionForm
                    action={addInterviewAction}
                    hidden={{ auditId, checklistItemId: r.checklistItemId ?? '' }}
                    button="Registrar entrevista"
                  >
                    <label className="field">
                      <span className="field__label">Rol/área entrevistado</span>
                      <input name="personRole" placeholder="p. ej. Supervisor de línea" />
                    </label>
                    <label className="field">
                      <span className="field__label">Observaciones</span>
                      <input name="answers" />
                    </label>
                  </AuditActionForm>
                  <span className="muted small">Evidencias registradas: {r.evidenceCount}</span>
                </details>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
