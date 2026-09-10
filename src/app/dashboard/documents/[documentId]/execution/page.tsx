import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { getDocumentDetail, DocumentNotFoundError } from '@/server/documents';
import { getProgramExecution, type ExecutionRow } from '@/server/programs';
import { EXECUTION_STATUS_LABEL, type ExecutionStatus } from '@/features/documents/program-status';
import { getOrganizationCompliancePolicy } from '@/server/compliance';
import { resolveComplianceBand } from '@/features/compliance/compliance-band';
import { ProgramTabs } from '../ProgramTabs';

/**
 * Vista de EJECUCIÓN de un Programa (DOC-003 §4-16). Estado operativo real
 * (derivado de las Tareas), separado del documento formal. Filtros MVP en memoria
 * (las ocurrencias de un programa son acotadas); el orden usa la fecha RAW.
 */
export default async function ProgramExecutionPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireServerSession();
  const { documentId } = await params;
  const sp = await searchParams;

  let doc;
  try {
    doc = await getDocumentDetail(session.organizationId, documentId);
  } catch (error) {
    if (error instanceof DocumentNotFoundError) notFound();
    throw error;
  }
  if (doc.documentType !== 'program') notFound();

  const exec = await getProgramExecution(session.organizationId, documentId);
  // CORE-UX-005: el % de cumplimiento del programa (mayor = mejor) usa el semáforo.
  const compliancePolicy = await getOrganizationCompliancePolicy(session.organizationId);
  const progressColor = resolveComplianceBand(exec.progress.percent, compliancePolicy).color;

  // Filtros (§35): estado, responsable, actividad, rango de fechas.
  const fStatus = sp.status ?? '';
  const fResp = sp.resp ?? '';
  const fActivity = (sp.activity ?? '').trim().toLowerCase();
  const fFrom = sp.from ?? '';
  const fTo = sp.to ?? '';
  const responsibles = Array.from(new Set(exec.rows.map((r) => r.responsibleName))).sort();

  const rows = exec.rows.filter((r) => {
    if (fStatus && r.status !== fStatus) return false;
    if (fResp && r.responsibleName !== fResp) return false;
    if (fActivity && !r.activityName.toLowerCase().includes(fActivity)) return false;
    if (fFrom && (!r.dueAtRaw || r.dueAtRaw < fFrom)) return false;
    if (fTo && (!r.dueAtRaw || r.dueAtRaw > fTo)) return false;
    return true;
  });

  const kpis = [
    { label: 'Total ejecutables', value: exec.summary.total },
    { label: 'Completadas', value: exec.summary.completed },
    { label: 'Pendientes', value: exec.summary.pending },
    { label: 'Vencidas', value: exec.summary.overdue },
    { label: 'Próximas 30 días', value: exec.summary.dueSoon30 },
  ];

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/documents">← Volver al listado</Link>
      </p>
      <div className="page-head">
        <h1>
          <span className="muted">{exec.code}</span> {exec.title}
        </h1>
      </div>
      <ProgramTabs documentId={documentId} active="execution" />

      <p className="muted">
        Ejecución {exec.versionLabel ? `· versión ${exec.versionLabel}` : ''}
        {exec.periodStart || exec.periodEnd
          ? ` · periodo ${exec.periodStart ?? '—'} — ${exec.periodEnd ?? '—'}`
          : ''}
      </p>

      {!exec.published ? (
        <div className="empty-state" role="status">
          <p>
            Este programa aún no está publicado. Las actividades se activarán al publicar una
            versión vigente.
          </p>
        </div>
      ) : exec.rows.length === 0 ? (
        <div className="empty-state" role="status">
          <p>No hay actividades ejecutables en la versión vigente.</p>
        </div>
      ) : (
        <>
          <div className="statcard-row" role="list">
            {kpis.map((k) => (
              <div key={k.label} className="statcard" role="listitem">
                <span className="statcard__value">{k.value}</span>
                <span className="statcard__label">{k.label}</span>
              </div>
            ))}
          </div>

          <p className="prog-progress">
            <strong>
              {exec.progress.completed} / {exec.progress.total}
            </strong>{' '}
            completadas ({exec.progress.percent}%)
            <span className="prog-bar" aria-hidden>
              <span
                className="prog-bar__fill"
                style={{ width: `${exec.progress.percent}%`, background: progressColor }}
              />
            </span>
          </p>

          <form method="get" className="filters" aria-label="Filtros de ejecución">
            <select name="status" defaultValue={fStatus} aria-label="Estado">
              <option value="">Todos los estados</option>
              {(Object.keys(EXECUTION_STATUS_LABEL) as ExecutionStatus[]).map((s) => (
                <option key={s} value={s}>
                  {EXECUTION_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <select name="resp" defaultValue={fResp} aria-label="Responsable">
              <option value="">Todos los responsables</option>
              {responsibles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              type="search"
              name="activity"
              placeholder="Actividad"
              defaultValue={sp.activity ?? ''}
              aria-label="Actividad"
            />
            <input type="date" name="from" defaultValue={fFrom} aria-label="Desde" />
            <input type="date" name="to" defaultValue={fTo} aria-label="Hasta" />
            <button className="button button--ghost" type="submit">
              Filtrar
            </button>
          </form>

          <ExecutionTable rows={rows} />
        </>
      )}
    </main>
  );
}

function ExecutionTable({ rows }: { rows: ExecutionRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="empty-state" role="status">
        <p>Ninguna ocurrencia coincide con los filtros.</p>
      </div>
    );
  }
  return (
    <div className="table-wrap prog-exec">
      <table>
        <thead>
          <tr>
            <th>Actividad</th>
            <th>Fecha</th>
            <th>Responsable</th>
            <th>Estado</th>
            <th>Evidencia requerida</th>
            <th>Tarea</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.instanceId}>
              <td data-label="Actividad">{r.activityName}</td>
              <td data-label="Fecha">{r.dueAtDisplay ?? '—'}</td>
              <td data-label="Responsable">{r.responsibleName}</td>
              <td data-label="Estado">
                <span className={`badge badge--exec-${r.status}`}>
                  {EXECUTION_STATUS_LABEL[r.status]}
                </span>
              </td>
              <td data-label="Evidencia requerida">
                {r.expectedEvidence ?? <span className="muted">Sin evidencia registrada</span>}
              </td>
              <td data-label="Tarea">
                {r.taskId ? (
                  <Link className="button button--ghost" href={`/dashboard/tasks/${r.taskId}`}>
                    Ver tarea
                  </Link>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
