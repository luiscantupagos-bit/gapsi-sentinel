import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { getAreaByCode, getAreaTypeCounts } from '@/server/documents';

export default async function DocumentAreaPage({
  params,
}: {
  params: Promise<{ areaCode: string }>;
}) {
  const session = await requireServerSession();
  const { areaCode } = await params;
  const area = await getAreaByCode(session.organizationId, decodeURIComponent(areaCode));
  if (!area) notFound();

  const types = await getAreaTypeCounts(session.organizationId, area.name);

  return (
    <main className="container">
      <p className="doc-lib__crumb">
        <Link href="/dashboard/documents">Documentos</Link> › {area.name}
      </p>
      <h1>{area.name}</h1>
      <p className="muted">Tipos documentales del área.</p>

      <ul className="doc-lib__folders" role="list">
        {types.map((t) => (
          <li key={t.type}>
            <Link
              className="doc-lib__folder"
              href={`/dashboard/documents/area/${encodeURIComponent(area.code ?? '')}/${t.type}`}
            >
              <span>
                <span className="doc-lib__folder-name">{t.label}</span>
                <br />
                <span className="doc-lib__folder-count">
                  {t.total} {t.total === 1 ? 'documento' : 'documentos'}
                  {t.dueSoon > 0 ? ` · ${t.dueSoon} por revisar` : ''}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
