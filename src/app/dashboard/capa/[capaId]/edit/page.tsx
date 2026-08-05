import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  CapaNotFoundError,
  getCapaDetail,
  getCapaUserContext,
  getCreateOptions,
} from '@/server/capa';
import { CapaForm, type CapaFormValues } from '../../_components/CapaForm';
import { updateCapaAction } from '../../capa-actions';

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function EditCapaPage({ params }: { params: Promise<{ capaId: string }> }) {
  const session = await requireServerSession();
  const { capaId } = await params;

  try {
    const [{ capa }, ctx, options] = await Promise.all([
      getCapaDetail(session.organizationId, capaId),
      getCapaUserContext(session.organizationId, session.userId, capaId),
      getCreateOptions(session.organizationId),
    ]);
    if (!ctx.canEdit) redirect(`/dashboard/capa/${capaId}`);

    const values: Partial<CapaFormValues> = {
      id: capa.id,
      title: capa.title,
      description: capa.description,
      sourceType: capa.sourceType,
      siteId: capa.siteId,
      area: capa.area,
      process: capa.process,
      product: capa.product,
      diagnosticId: capa.diagnosticId,
      documentId: capa.documentId,
      requirementId: capa.requirementId,
      externalReference: capa.externalReference,
      detectedAt: day(capa.detectedAt),
      responsibleUserId: capa.responsibleUserId,
      priority: capa.priority,
      severity: capa.severity,
      scope: capa.scope,
      impacts: capa.impacts,
      tags: capa.tags,
      targetDate: day(capa.targetDate),
      problemWhat: capa.problemWhat,
      problemWhere: capa.problemWhere,
      problemWhen: capa.problemWhen,
      problemWhoDetect: capa.problemWhoDetect,
      problemWhoAffect: capa.problemWhoAffect,
      problemHowMuch: capa.problemHowMuch,
      problemHow: capa.problemHow,
      conditionObserved: capa.conditionObserved,
      requirementBreached: capa.requirementBreached,
      objectiveEvidence: capa.objectiveEvidence,
      knownScope: capa.knownScope,
      knownRecurrence: capa.knownRecurrence,
      relatedRefs: capa.relatedRefs,
    };

    return (
      <main className="container">
        <p>
          <Link href={`/dashboard/capa/${capaId}`}>← Volver a la CAPA</Link>
        </p>
        <h1>Editar {capa.folio}</h1>
        <CapaForm action={updateCapaAction} options={options} values={values} mode="edit" />
      </main>
    );
  } catch (error) {
    if (error instanceof CapaNotFoundError) notFound();
    throw error;
  }
}
