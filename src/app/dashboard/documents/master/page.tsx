import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import {
  listDocuments,
  listSites,
  listDocumentAreas,
  type DocumentFilters,
} from '@/server/documents';
import { DOCUMENT_TYPES, DOCUMENT_ORIGINS } from '@/features/documents/catalog';
import { DocumentsTable } from '../_components/DocumentsTable';

// Estado documental (§37): agrupaciones legibles en español.
const STATUS_OPTIONS = [
  { value: 'active', label: 'Activos' },
  { value: 'all', label: 'Todos' },
  { value: 'effective', label: 'Vigentes' },
  { value: 'in_review', label: 'En revisión' },
  { value: 'draft', label: 'Borradores' },
  { value: 'obsolete', label: 'Obsoletos' },
];

export default async function DocumentMasterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireServerSession();
  const sp = await searchParams;
  const statusSel = sp.status ?? 'active'; // por defecto: activos/controlados (§37)

  const filters: DocumentFilters = {
    search: sp.search,
    type: sp.type,
    area: sp.area,
    siteId: sp.site,
    origin: sp.origin,
    statusGroup: statusSel === 'active' ? 'active' : statusSel === 'all' ? 'all' : undefined,
    status: ['effective', 'in_review', 'draft', 'obsolete'].includes(statusSel)
      ? statusSel
      : undefined,
  };

  const [documentsRaw, sites, areas] = await Promise.all([
    listDocuments(session.organizationId, filters),
    listSites(session.organizationId),
    listDocumentAreas(session.organizationId),
  ]);
  // KPI de la biblioteca enlaza aquí con due=soon|overdue.
  const documents =
    sp.due === 'soon'
      ? documentsRaw.filter((d) => d.dueSoon)
      : sp.due === 'overdue'
        ? documentsRaw.filter((d) => d.overdue)
        : documentsRaw;

  return (
    <main className="container">
      <p className="doc-lib__crumb">
        <Link href="/dashboard/documents">Documentos</Link> › Listado maestro
      </p>
      <h1>Listado maestro de documentos y registros</h1>
      <p className="muted">
        Documentos y formatos controlados. Se ampliará con los registros ejecutados (DOC-004).
      </p>

      <form method="get" className="filters" aria-label="Filtros del listado maestro">
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
        <select name="area" defaultValue={sp.area ?? ''} aria-label="Área">
          <option value="">Todas las áreas</option>
          {areas.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={statusSel} aria-label="Estado documental">
          {STATUS_OPTIONS.map((s) => (
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
        <button className="button button--ghost" type="submit">
          Aplicar
        </button>
      </form>

      <DocumentsTable documents={documents} variant="master" />
    </main>
  );
}
