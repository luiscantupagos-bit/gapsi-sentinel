import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { getQualityEvent, EVENT_TYPE_LABEL } from '@/server/quality-events';
import { listAnalysesForTarget } from '@/server/quality-analysis';
import {
  ANALYSIS_STATUS_LABEL,
  ANALYSIS_TYPE_LABEL,
  type AnalysisStatus,
  type AnalysisType,
} from '@/features/capa/analysis-state';
import { PageHeader, SectionCard } from '../../_components/ui';
import { AddAnalysisForm } from '../../analysis/_components/AddAnalysisForm';

const SEVERITY_LABEL: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};
const STATUS_LABEL: Record<string, string> = {
  open: 'Abierto',
  in_progress: 'En progreso',
  closed: 'Cerrado',
  cancelled: 'Cancelado',
};

export default async function QualityEventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await requireServerSession();
  const { eventId } = await params;
  const event = await getQualityEvent(session.organizationId, eventId);
  if (!event) notFound();
  const analyses = await listAnalysesForTarget(session.organizationId, 'quality_event', eventId);

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/quality-events">← Volver a eventos</Link>
      </p>
      <PageHeader
        title={event.title}
        subtitle={`${event.folio} · ${EVENT_TYPE_LABEL[event.eventType] ?? event.eventType}`}
      />

      <dl className="meta-grid">
        <div>
          <dt>Fecha</dt>
          <dd>{event.eventDate.toISOString().slice(0, 10)}</dd>
        </div>
        <div>
          <dt>Severidad</dt>
          <dd>{SEVERITY_LABEL[event.severity] ?? event.severity}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>{STATUS_LABEL[event.status] ?? event.status}</dd>
        </div>
        <div>
          <dt>Área / Proceso</dt>
          <dd>{[event.area, event.process].filter(Boolean).join(' / ') || '—'}</dd>
        </div>
      </dl>

      {event.description && <p className="lead">{event.description}</p>}

      <SectionCard
        title="Análisis"
        action={
          <AddAnalysisForm
            relationType="quality_event"
            targetId={event.id}
            revalidate={`/dashboard/quality-events/${event.id}`}
            label="Analizar"
          />
        }
      >
        {analyses.length === 0 ? (
          <p className="empty-state">Sin análisis. Usa “Analizar” para iniciar uno.</p>
        ) : (
          <ul className="dep-list">
            {analyses.map((a) => (
              <li key={a.id}>
                <span className="badge badge--soft">
                  {ANALYSIS_TYPE_LABEL[a.type as AnalysisType] ?? a.type}
                </span>{' '}
                <Link href={`/dashboard/analysis/${a.id}`}>{a.title}</Link>{' '}
                <span className="muted small">
                  {ANALYSIS_STATUS_LABEL[a.status as AnalysisStatus] ?? a.status} ·{' '}
                  {a.responsibleName ?? '—'} · {a.updatedAt}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </main>
  );
}
