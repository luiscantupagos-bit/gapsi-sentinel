import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { getRecord, memberDirectory } from '@/server/records';
import { recordStatusLabel, recordSourceLabel } from '@/features/records/record-state';
import { RecordForm } from './_components/RecordForm';
import { RecordReadOnlyView } from '../_components/RecordReadOnlyView';

/**
 * DOC-004 — detalle/captura de un Registro. Encabezado con folio, formato, código, versión y
 * estado (§24). Editable → formulario; enviado/cerrado → vista de solo lectura (§36).
 */
export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = await params;
  const session = await requireServerSession();
  const [record, members] = await Promise.all([
    getRecord(session.organizationId, recordId),
    memberDirectory(session.organizationId),
  ]);
  if (!record) notFound();

  const canReview = session.role === 'owner' || session.role === 'admin';
  const memberList = [...members.entries()].map(([id, name]) => ({ id, name }));

  const readOnly = (
    <RecordReadOnlyView
      record={{
        recordNumber: record.recordNumber,
        formCode: record.formCode,
        formTitle: record.formTitle,
        formVersionLabel: record.formVersionLabel,
        statusLabel: recordStatusLabel(record.status),
        status: record.status,
        schema: record.schema,
        data: record.data,
      }}
    />
  );

  return (
    <main className="container">
      <p className="breadcrumb">
        <Link href="/dashboard/records">Registros</Link> › {record.recordNumber}
      </p>
      <div className="page-head">
        <div>
          <h1>{record.recordNumber}</h1>
          <p className="muted">
            {record.formCode} · {record.formTitle} · Versión {record.formVersionLabel} ·{' '}
            {recordSourceLabel(record.sourceType)}
            {record.siteName ? ` · ${record.siteName}` : ''}
          </p>
        </div>
        <span className={`badge badge--recstatus-${record.status}`}>
          {recordStatusLabel(record.status)}
        </span>
      </div>

      <dl className="record-meta">
        {record.createdByName && (
          <div>
            <dt>Creado por</dt>
            <dd>
              {record.createdByName} · {record.createdAt}
            </dd>
          </div>
        )}
        {record.submittedAt && (
          <div>
            <dt>Enviado</dt>
            <dd>
              {record.submittedByName ?? '—'} · {record.submittedAt}
            </dd>
          </div>
        )}
        {record.reviewedAt && (
          <div>
            <dt>Revisado</dt>
            <dd>
              {record.reviewedByName ?? '—'} · {record.reviewedAt}
            </dd>
          </div>
        )}
        {record.closedAt && (
          <div>
            <dt>Cerrado</dt>
            <dd>
              {record.closedByName ?? '—'} · {record.closedAt}
            </dd>
          </div>
        )}
      </dl>

      {record.editable && record.completeness.required > 0 && (
        <p className="muted record-progress">
          Obligatorios: {record.completeness.filled}/{record.completeness.required}
        </p>
      )}

      <RecordForm
        recordId={record.id}
        schema={record.schema}
        initialData={record.data}
        status={record.status}
        editable={record.editable}
        canReview={canReview}
        members={memberList}
        readOnlySlot={readOnly}
      />
    </main>
  );
}
