import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getDocumentPresentation, getOrganizationEntitlements } from '@/server/documents';
import { DocumentThemeForm } from '../_components/DocumentThemeForm';

export default async function DocumentSettingsPage() {
  const session = await requireServerSession();
  const [presentation, entitlements] = await Promise.all([
    getDocumentPresentation(session.organizationId),
    getOrganizationEntitlements(session.organizationId),
  ]);

  return (
    <main className="container">
      <p className="doc-lib__crumb">
        <Link href="/dashboard/documents">Documentos</Link> › Configuración documental
      </p>
      <h1>Configuración documental</h1>
      <p className="muted">
        Diseño, colores y marca aplicados con moderación a los documentos (encabezados, títulos y
        tablas). No cambia el tema general de C3 Sentinel.
      </p>
      <DocumentThemeForm
        initial={{
          primary: presentation.theme.primary,
          secondary: presentation.theme.secondary,
          accent: presentation.theme.accent,
          text: presentation.theme.text,
          heading: presentation.theme.heading,
          designId: presentation.designId,
          showC3Attribution: presentation.showC3AttributionPref,
          dateFormat: presentation.dateFormat,
        }}
        canHideC3Attribution={entitlements.canHideC3Attribution}
      />
    </main>
  );
}
