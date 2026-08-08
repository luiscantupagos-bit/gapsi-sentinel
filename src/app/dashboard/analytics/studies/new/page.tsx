import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { PageHeader } from '../../../_components/ui';
import { StudyActionForm } from '../_components/StudyActionForm';
import { createStudyAction } from '../actions';

export default async function NewStudyPage() {
  await requireServerSession();
  return (
    <main className="container container--narrow">
      <p>
        <Link href="/dashboard/analytics/studies">← Volver a estudios</Link>
      </p>
      <PageHeader
        title="Nuevo estudio de datos"
        subtitle="Define el objetivo. Después importarás los datos y elegirás las herramientas de análisis."
      />

      <StudyActionForm
        action={createStudyAction}
        button="Crear estudio"
        variant="primary"
        className="doc-form"
      >
        <label className="field field--full">
          <span className="field__label">Título</span>
          <input name="title" required placeholder="p. ej. Variación dimensional de pieza A" />
        </label>
        <label className="field field--full">
          <span className="field__label">Objetivo</span>
          <textarea name="objective" rows={2} placeholder="¿Qué buscas entender con estos datos?" />
        </label>
        <label className="field field--full">
          <span className="field__label">Pregunta de investigación (opcional)</span>
          <input
            name="question"
            placeholder="p. ej. ¿Qué factores se asocian a las desviaciones?"
          />
        </label>
      </StudyActionForm>
    </main>
  );
}
