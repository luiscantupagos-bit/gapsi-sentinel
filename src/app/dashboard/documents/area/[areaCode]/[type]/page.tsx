import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { getAreaByCode, listDocuments } from '@/server/documents';
import { labelOf, DOCUMENT_TYPES } from '@/features/documents/catalog';
import { DocumentsTable } from '../../../_components/DocumentsTable';

export default async function DocumentAreaTypePage({
  params,
}: {
  params: Promise<{ areaCode: string; type: string }>;
}) {
  const session = await requireServerSession();
  const { areaCode, type } = await params;
  const area = await getAreaByCode(session.organizationId, decodeURIComponent(areaCode));
  if (!area) notFound();

  const documents = await listDocuments(session.organizationId, { area: area.name, type });
  const typeLabel = labelOf(DOCUMENT_TYPES, type);

  return (
    <main className="container">
      <p className="doc-lib__crumb">
        <Link href="/dashboard/documents">Documentos</Link> ›{' '}
        <Link href={`/dashboard/documents/area/${encodeURIComponent(area.code ?? '')}`}>
          {area.name}
        </Link>{' '}
        › {typeLabel}
      </p>
      <h1>
        {typeLabel} · {area.name}
      </h1>
      <DocumentsTable
        documents={documents}
        variant="type"
        emptyText={`Sin documentos de tipo ${typeLabel.toLowerCase()} en ${area.name}.`}
      />
    </main>
  );
}
