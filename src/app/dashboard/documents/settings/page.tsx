import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { getDocumentTheme } from '@/server/documents';
import { DocumentThemeForm } from '../_components/DocumentThemeForm';

export default async function DocumentSettingsPage() {
  const session = await requireServerSession();
  const theme = await getDocumentTheme(session.organizationId);

  return (
    <main className="container">
      <p className="doc-lib__crumb">
        <Link href="/dashboard/documents">Documentos</Link> › Configuración documental
      </p>
      <h1>Configuración documental</h1>
      <p className="muted">
        Apariencia documental: colores aplicados con moderación a los documentos (encabezados,
        títulos y tablas). No cambia el tema general de C3 Sentinel.
      </p>
      <DocumentThemeForm initial={theme} />
    </main>
  );
}
