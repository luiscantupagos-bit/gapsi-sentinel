import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { DiagnosticNotFoundError, getDiagnosticDetail } from '@/server/diagnostics';
import { AnswerForm } from './AnswerForm';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  in_progress: 'En captura',
  submitted: 'Enviado',
  reviewed: 'Revisado',
  archived: 'Archivado',
};

export default async function DiagnosticDetailPage({
  params,
}: {
  params: Promise<{ diagnosticId: string }>;
}) {
  const session = await requireServerSession();
  const { diagnosticId } = await params;

  let detail;
  try {
    detail = await getDiagnosticDetail(session.organizationId, diagnosticId);
  } catch (error) {
    if (error instanceof DiagnosticNotFoundError) notFound();
    throw error;
  }

  const { progress } = detail;

  return (
    <main className="container">
      <p>
        <Link href="/dashboard">← Volver al panel</Link>
      </p>

      <h1>{detail.name}</h1>
      <dl className="meta-grid">
        <div>
          <dt>Organización</dt>
          <dd>{detail.organizationName}</dd>
        </div>
        <div>
          <dt>Sitio</dt>
          <dd>{detail.siteName}</dd>
        </div>
        <div>
          <dt>Plantilla</dt>
          <dd>{detail.templateLabel}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            <span className={`badge badge--status-${detail.status}`}>
              {STATUS_LABEL[detail.status] ?? detail.status}
            </span>
          </dd>
        </div>
      </dl>

      <section aria-label="Progreso de captura" className="progress">
        <div className="progress__head">
          <span>
            Progreso de captura: {progress.answered}/{progress.total} preguntas
          </span>
          <strong>{progress.percentage}%</strong>
        </div>
        <div
          className="progress__bar"
          role="progressbar"
          aria-valuenow={progress.percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="progress__fill" style={{ width: `${progress.percentage}%` }} />
        </div>
        <p className="muted">Este porcentaje es de captura, no de cumplimiento.</p>
      </section>

      <AnswerForm detail={detail} />

      <p style={{ marginTop: '1.5rem' }}>
        <Link className="button button--ghost" href={`/dashboard/diagnostics/${detail.id}/results`}>
          Ver resultado preliminar
        </Link>
      </p>
    </main>
  );
}
