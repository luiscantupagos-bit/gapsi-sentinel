import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getDocumentLibrary } from '@/server/documents';

function FolderIcon() {
  return (
    <svg
      className="doc-lib__folder-icon"
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

export default async function DocumentsLibraryPage() {
  const session = await requireServerSession();
  const { summary, areas } = await getDocumentLibrary(session.organizationId);

  const kpis = [
    {
      label: 'Vigentes',
      value: summary.effective,
      href: '/dashboard/documents/master?status=effective',
    },
    {
      label: 'En revisión/aprobación',
      value: summary.inReview,
      href: '/dashboard/documents/master?status=in_review',
    },
    {
      label: 'Próximos a revisión',
      value: summary.dueSoon,
      href: '/dashboard/documents/master?due=soon',
    },
    { label: 'Vencidos', value: summary.overdue, href: '/dashboard/documents/master?due=overdue' },
  ];

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <h1>Documentos</h1>
          <p className="muted page-head__sub">Biblioteca y control documental</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link className="button button--ghost" href="/dashboard/documents/master">
            Listado maestro de documentos y registros
          </Link>
          <Link className="button button--ghost" href="/dashboard/documents/settings">
            Configuración documental
          </Link>
          <Link className="button button--ghost" href="/dashboard/documents/new">
            Registrar externo
          </Link>
          <Link className="button button--primary" href="/dashboard/documents/new/editor">
            Crear documento
          </Link>
        </div>
      </div>

      <form
        method="get"
        action="/dashboard/documents/master"
        className="filters"
        aria-label="Buscar documentos"
      >
        <input
          type="search"
          name="search"
          placeholder="Buscar por código, nombre, tipo o área"
          aria-label="Buscar documentos"
        />
        <button className="button button--ghost" type="submit">
          Buscar
        </button>
      </form>

      <div className="statcard-row" role="list">
        {kpis.map((k) => (
          <Link key={k.label} className="statcard" href={k.href} role="listitem">
            <span className="statcard__value">{k.value}</span>
            <span className="statcard__label">{k.label}</span>
          </Link>
        ))}
      </div>

      <h2>Áreas</h2>
      {areas.length === 0 ? (
        <p className="empty-state">
          No hay áreas configuradas. Las áreas provienen del catálogo de calidad.
        </p>
      ) : (
        <ul className="doc-lib__folders" role="list">
          {areas.map((a) => (
            <li key={a.code ?? a.name}>
              <Link
                className="doc-lib__folder"
                href={
                  a.code
                    ? `/dashboard/documents/area/${encodeURIComponent(a.code)}`
                    : `/dashboard/documents/master?area=${encodeURIComponent(a.name)}`
                }
              >
                <FolderIcon />
                <span>
                  <span className="doc-lib__folder-name">{a.name}</span>
                  <br />
                  <span className="doc-lib__folder-count">
                    {a.count} {a.count === 1 ? 'documento' : 'documentos'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
