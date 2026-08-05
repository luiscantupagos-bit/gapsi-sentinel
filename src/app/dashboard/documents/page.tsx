import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { listDocuments, listSites, type DocumentFilters } from '@/server/documents';
import {
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  DOCUMENT_ORIGINS,
  labelOf,
} from '@/features/documents/catalog';

export default async function DocumentsListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireServerSession();
  const sp = await searchParams;

  const filters: DocumentFilters = {
    search: sp.search,
    type: sp.type,
    status: sp.status,
    siteId: sp.site,
    origin: sp.origin,
    sort: sp.sort === 'updated' ? 'updated' : 'code',
  };

  const [documents, sites] = await Promise.all([
    listDocuments(session.organizationId, filters),
    listSites(session.organizationId),
  ]);

  return (
    <main className="container">
      <div className="page-head">
        <h1>Listado maestro de documentos</h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link className="button button--ghost" href="/dashboard/documents/new">
            Registrar (externo)
          </Link>
          <Link className="button button--primary" href="/dashboard/documents/new/editor">
            Crear dentro de Sentinel
          </Link>
        </div>
      </div>

      <form method="get" className="filters" aria-label="Filtros de documentos">
        <input
          type="search"
          name="search"
          placeholder="Buscar por código o nombre"
          defaultValue={sp.search ?? ''}
          aria-label="Buscar"
        />
        <select name="type" defaultValue={sp.type ?? ''} aria-label="Tipo">
          <option value="">Todos los tipos</option>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status ?? ''} aria-label="Estado">
          <option value="">Todos los estados</option>
          {DOCUMENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="site" defaultValue={sp.site ?? ''} aria-label="Sitio">
          <option value="">Todos los sitios</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select name="origin" defaultValue={sp.origin ?? ''} aria-label="Origen">
          <option value="">Todo origen</option>
          {DOCUMENT_ORIGINS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={sp.sort ?? 'code'} aria-label="Orden">
          <option value="code">Orden: código</option>
          <option value="updated">Orden: actualización</option>
        </select>
        <button className="button button--ghost" type="submit">
          Aplicar
        </button>
      </form>

      {documents.length === 0 ? (
        <div className="empty-state" role="status">
          <p>No hay documentos que coincidan.</p>
          <p className="muted">Registra el primero con “Nuevo documento”.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Origen</th>
                <th>Versión</th>
                <th>Sitio</th>
                <th>Responsable</th>
                <th>Estado</th>
                <th>Emisión</th>
                <th>Próx. revisión</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id}>
                  <td>{d.code}</td>
                  <td>{d.title}</td>
                  <td>{labelOf(DOCUMENT_TYPES, d.documentType)}</td>
                  <td>{labelOf(DOCUMENT_ORIGINS, d.origin)}</td>
                  <td>{d.currentVersionLabel ?? '—'}</td>
                  <td>{d.siteName ?? '—'}</td>
                  <td>{d.responsibleName ?? '—'}</td>
                  <td>
                    <span className={`badge badge--doc-${d.status}`}>
                      {labelOf(DOCUMENT_STATUSES, d.status)}
                    </span>
                  </td>
                  <td>{d.issuedAt ?? '—'}</td>
                  <td>
                    {d.nextReviewAt ?? '—'}{' '}
                    {d.overdue && <span className="badge badge--critical">Vencido</span>}
                    {!d.overdue && d.dueSoon && (
                      <span className="badge badge--risk-moderate">Próximo</span>
                    )}
                  </td>
                  <td>
                    <Link className="button button--ghost" href={`/dashboard/documents/${d.id}`}>
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
