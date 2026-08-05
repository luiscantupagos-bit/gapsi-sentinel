import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { listCapas, listMembers, getCreateOptions } from '@/server/capa';
import {
  CAPA_PRIORITY_LABEL,
  CAPA_SEVERITY_LABEL,
  CAPA_SOURCE_TYPE_LABEL,
  CAPA_STATUSES,
  CAPA_STATUS_LABEL,
  CAPA_SEVERITIES,
  CAPA_PRIORITIES,
  CAPA_SOURCE_TYPES,
  type CapaPriority,
  type CapaSeverity,
  type CapaSourceType,
  type CapaStatus,
} from '@/features/capa/capa-state';

interface SP {
  q?: string;
  site?: string;
  responsible?: string;
  status?: string;
  priority?: string;
  severity?: string;
  type?: string;
  overdue?: string;
}

export default async function CapaListPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requireServerSession();
  const sp = await searchParams;
  const [rows, members, options] = await Promise.all([
    listCapas(session.organizationId, {
      search: sp.q,
      siteId: sp.site,
      responsibleUserId: sp.responsible,
      status: sp.status,
      priority: sp.priority,
      severity: sp.severity,
      sourceType: sp.type,
      overdue: sp.overdue === '1',
    }),
    listMembers(session.organizationId),
    getCreateOptions(session.organizationId),
  ]);

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <h1>Acciones correctivas (CAPA)</h1>
          <p className="muted page-head__sub">
            Gestiona el ciclo completo de acciones correctivas y preventivas
          </p>
        </div>
        <Link className="button" href="/dashboard/capa/new">
          Nueva CAPA
        </Link>
      </div>
      <p>
        <Link href="/dashboard/capa/tasks">Ver bandeja de tareas →</Link>
      </p>

      <form className="filters" method="get">
        <input type="search" name="q" placeholder="Folio o título" defaultValue={sp.q ?? ''} />
        <select name="status" defaultValue={sp.status ?? ''}>
          <option value="">Todos los estados</option>
          {CAPA_STATUSES.map((x) => (
            <option key={x} value={x}>
              {CAPA_STATUS_LABEL[x]}
            </option>
          ))}
        </select>
        <select name="severity" defaultValue={sp.severity ?? ''}>
          <option value="">Toda severidad</option>
          {CAPA_SEVERITIES.map((x) => (
            <option key={x} value={x}>
              {CAPA_SEVERITY_LABEL[x]}
            </option>
          ))}
        </select>
        <select name="priority" defaultValue={sp.priority ?? ''}>
          <option value="">Toda prioridad</option>
          {CAPA_PRIORITIES.map((x) => (
            <option key={x} value={x}>
              {CAPA_PRIORITY_LABEL[x]}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={sp.type ?? ''}>
          <option value="">Todo tipo</option>
          {CAPA_SOURCE_TYPES.map((x) => (
            <option key={x} value={x}>
              {CAPA_SOURCE_TYPE_LABEL[x]}
            </option>
          ))}
        </select>
        <select name="site" defaultValue={sp.site ?? ''}>
          <option value="">Todos los sitios</option>
          {options.sites.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <select name="responsible" defaultValue={sp.responsible ?? ''}>
          <option value="">Todo responsable</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <label className="props-check">
          <input type="checkbox" name="overdue" value="1" defaultChecked={sp.overdue === '1'} />{' '}
          Solo vencidas
        </label>
        <button className="button button--ghost" type="submit">
          Aplicar
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="empty-state">No hay CAPA que coincidan con los filtros.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Título</th>
                <th>Tipo</th>
                <th>Sitio</th>
                <th>Severidad</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Responsable</th>
                <th>Fecha objetivo</th>
                <th>Vencimiento</th>
                <th>Avance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.folio}</td>
                  <td>{c.title}</td>
                  <td>{CAPA_SOURCE_TYPE_LABEL[c.sourceType as CapaSourceType] ?? c.sourceType}</td>
                  <td>{c.siteName ?? '—'}</td>
                  <td>
                    <span className={`badge badge--sev-${c.severity}`}>
                      {CAPA_SEVERITY_LABEL[c.severity as CapaSeverity] ?? c.severity}
                    </span>
                  </td>
                  <td>{CAPA_PRIORITY_LABEL[c.priority as CapaPriority] ?? c.priority}</td>
                  <td>
                    <span className={`badge badge--capa-${c.status}`}>
                      {CAPA_STATUS_LABEL[c.status as CapaStatus] ?? c.status}
                    </span>
                  </td>
                  <td>{c.responsibleName ?? '—'}</td>
                  <td>{c.targetDate ?? '—'}</td>
                  <td>
                    {c.daysRemaining === null ? (
                      '—'
                    ) : c.overdue ? (
                      <span className="badge badge--critical">
                        Vencida {Math.abs(c.daysRemaining)}d
                      </span>
                    ) : (
                      `${c.daysRemaining}d`
                    )}
                  </td>
                  <td>{c.progress}%</td>
                  <td>
                    <Link className="button button--ghost" href={`/dashboard/capa/${c.id}`}>
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
