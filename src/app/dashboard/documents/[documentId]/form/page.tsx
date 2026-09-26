import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { getFormDesigner } from '@/server/records';
import { FormDesigner } from './_components/FormDesigner';

/**
 * DOC-004 — diseñador de formulario de un Formato. Se habilita sobre la versión BORRADOR
 * (§17); la versión publicada se muestra en solo lectura. El esquema pertenece a la versión.
 */
export default async function FormDesignerPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const session = await requireServerSession();
  const data = await getFormDesigner(session.organizationId, documentId);
  if (!data) notFound();

  return (
    <main className="container">
      <p className="breadcrumb">
        <Link href={`/dashboard/documents/${documentId}`}>{data.code}</Link> › Diseñar formulario
      </p>
      <div className="page-head">
        <div>
          <h1>Diseñar formulario</h1>
          <p className="muted">
            {data.code} · {data.title} · Versión {data.versionLabel}
          </p>
        </div>
      </div>
      {!data.editable && (
        <p className="msg msg--info">
          Esta versión está publicada y es de solo lectura. Crea una nueva versión del documento
          para modificar el formulario.
        </p>
      )}
      <FormDesigner
        documentId={data.documentId}
        documentVersionId={data.documentVersionId}
        initialSchema={data.schema}
        editable={data.editable}
      />
    </main>
  );
}
