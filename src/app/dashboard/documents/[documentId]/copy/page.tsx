import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { getControlledCopyForRender, renderDocumentControlledCopy } from '@/server/documents';
import type { CopyMark } from '@/features/documents/structured-render';
import { PrintControls } from './_components/PrintControls';

/**
 * Salida controlada (DOC-UX-002 §70-77): render en modo `controlled_copy` con
 * watermark. `?copyId=` = copia formal (versión publicada, con folio). Para
 * borrador/obsoleto se usa `?uncontrolled=draft|obsolete&version=<id>` y NO se
 * registra copia (§81/§82).
 */
export default async function ControlledCopyPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireServerSession();
  const { documentId } = await params;
  const sp = await searchParams;
  const backHref = `/dashboard/documents/${documentId}`;

  let versionId: string | null = null;
  let copyMark: CopyMark | null = null;
  let note = '';

  if (sp.copyId) {
    const copy = await getControlledCopyForRender(session.organizationId, sp.copyId);
    if (!copy || copy.documentId !== documentId) notFound();
    versionId = copy.versionId;
    copyMark = copy.copyMark;
    note = `Copia controlada ${copyMark.folio ?? ''}. Selecciona “Guardar como PDF” en el diálogo para exportar.`;
  } else if (sp.uncontrolled === 'draft' || sp.uncontrolled === 'obsolete') {
    if (!sp.version) notFound();
    versionId = sp.version;
    copyMark = { kind: sp.uncontrolled };
    note =
      sp.uncontrolled === 'draft'
        ? 'Borrador sin control formal: no se emite folio de copia controlada.'
        : 'Versión obsoleta: copia NO controlada. Verifique la versión vigente.';
  } else {
    notFound();
  }

  let rendered: { html: string; documentCode: string; documentTitle: string };
  try {
    rendered = await renderDocumentControlledCopy(
      session.organizationId,
      documentId,
      versionId!,
      copyMark!,
    );
  } catch {
    notFound();
  }

  return (
    <main className="container copy-page">
      <PrintControls backHref={backHref} note={note} />
      {/* HTML generado en servidor desde datos estructurados (allowlist, sin scripts). */}
      <div dangerouslySetInnerHTML={{ __html: rendered!.html }} />
    </main>
  );
}
