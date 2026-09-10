import Link from 'next/link';

/**
 * Tabs Documento | Ejecución de un Programa (DOC-003 §1). Documento = definición
 * aprobada (render formal); Ejecución = estado operativo real. No se mezclan.
 */
export function ProgramTabs({
  documentId,
  active,
}: {
  documentId: string;
  active: 'document' | 'execution';
}) {
  const base = `/dashboard/documents/${documentId}`;
  return (
    <nav className="prog-tabs" aria-label="Vistas del programa">
      <Link
        href={base}
        className={`prog-tab${active === 'document' ? ' is-active' : ''}`}
        aria-current={active === 'document' ? 'page' : undefined}
      >
        Documento
      </Link>
      <Link
        href={`${base}/execution`}
        className={`prog-tab${active === 'execution' ? ' is-active' : ''}`}
        aria-current={active === 'execution' ? 'page' : undefined}
      >
        Ejecución
      </Link>
    </nav>
  );
}
