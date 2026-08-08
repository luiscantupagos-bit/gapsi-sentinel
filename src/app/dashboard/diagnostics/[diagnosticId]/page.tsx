import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { DiagnosticNotFoundError, getDiagnosticDetail } from '@/server/diagnostics';
import { DIAGNOSTIC_STATUS_LABEL, type DiagnosticStatus } from '@/features/diagnostics/state';
import { DetailHeader, NextActionCard } from '../../_components/detail';
import { AnswerForm } from './AnswerForm';

function nextAction(status: DiagnosticStatus, pending: number, resultHref: string) {
  const seeResult = (
    <Link className="button button--ghost" href={resultHref}>
      Ver resultado de evaluación
    </Link>
  );
  switch (status) {
    case 'draft':
      return { text: 'Comienza la evaluación respondiendo los requisitos.', tone: 'default' as const };
    case 'in_progress':
      return {
        text:
          pending > 0
            ? `Continúa la captura: quedan ${pending} preguntas por responder. Al completar, envía la evaluación.`
            : 'Todas las preguntas están respondidas. Envía la evaluación para registrar el resultado.',
        tone: 'default' as const,
      };
    case 'submitted':
      return {
        text: 'La evaluación fue enviada. Revisa el resultado o márcala como revisada.',
        action: seeResult,
        tone: 'success' as const,
      };
    case 'reviewed':
      return { text: 'La evaluación está revisada.', action: seeResult, tone: 'success' as const };
    case 'archived':
      return { text: 'Diagnóstico archivado (solo lectura).', tone: 'warning' as const };
  }
}

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
  const status = detail.status as DiagnosticStatus;
  const resultHref = `/dashboard/diagnostics/${detail.id}/results`;
  const na = nextAction(status, progress.total - progress.answered, resultHref);

  return (
    <main className="container">
      <DetailHeader
        backHref="/dashboard/diagnostics"
        backLabel="Volver a diagnósticos"
        title={detail.name}
        badge={<span className={`badge badge--diag-${status}`}>{DIAGNOSTIC_STATUS_LABEL[status]}</span>}
        meta={[
          { label: 'Sitio', value: detail.siteName },
          { label: 'Esquema', value: detail.templateLabel },
        ]}
        actions={
          <Link className="button button--ghost" href={resultHref}>
            Ver resultado
          </Link>
        }
      />

      <NextActionCard text={na.text} action={na.action} tone={na.tone} />

      <section aria-label="Progreso de captura" className="progress">
        <div className="progress__head">
          <span>
            Captura de respuestas: {progress.answered}/{progress.total} preguntas
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
      </section>

      <AnswerForm detail={detail} />
    </main>
  );
}
