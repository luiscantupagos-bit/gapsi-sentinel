import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { ProjectNotFoundError, getProjectDetail, listOrgMembers } from '@/server/projects';
import { PROJECT_PRIORITIES, PROJECT_PRIORITY_LABEL } from '@/features/projects/project-state';
import { PageHeader } from '../../../_components/ui';
import { ProjectActionForm } from '../../_components/ProjectActionForm';
import { updateProjectAction } from '../../actions';

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await requireServerSession();
  const { projectId } = await params;
  let detail;
  try {
    detail = await getProjectDetail(session.organizationId, projectId);
  } catch (error) {
    if (error instanceof ProjectNotFoundError) notFound();
    throw error;
  }
  const members = await listOrgMembers(session.organizationId);
  const p = detail.project;

  return (
    <main className="container container--narrow">
      <p>
        <Link href={`/dashboard/projects/${p.id}`}>← Volver al proyecto</Link>
      </p>
      <PageHeader title="Editar proyecto" subtitle={`${p.folio} · ${p.name}`} />

      <ProjectActionForm
        action={updateProjectAction}
        hidden={{ projectId: p.id }}
        button="Guardar cambios"
        variant="primary"
        className="doc-form"
      >
        <label className="field field--full">
          <span className="field__label">Nombre</span>
          <input name="name" defaultValue={p.name} required />
        </label>
        <label className="field field--full">
          <span className="field__label">Descripción</span>
          <textarea name="description" rows={2} defaultValue={p.description ?? ''} />
        </label>
        <label className="field field--full">
          <span className="field__label">Objetivo</span>
          <textarea name="objective" rows={2} defaultValue={p.objective ?? ''} />
        </label>
        <label className="field field--full">
          <span className="field__label">Riesgos resumidos</span>
          <textarea name="risksSummary" rows={2} defaultValue={p.risksSummary ?? ''} />
        </label>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Prioridad</span>
            <select name="priority" defaultValue={p.priority ?? 'normal'}>
              {PROJECT_PRIORITIES.map((pr) => (
                <option key={pr} value={pr}>
                  {PROJECT_PRIORITY_LABEL[pr]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Responsable</span>
            <select name="responsibleUserId" defaultValue={p.responsibleUserId ?? ''}>
              <option value="">— Sin asignar —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Fecha de inicio</span>
            <input type="date" name="startDate" defaultValue={p.startDate ?? ''} />
          </label>
          <label className="field">
            <span className="field__label">Fecha objetivo</span>
            <input type="date" name="targetDate" defaultValue={p.targetDate ?? ''} />
          </label>
        </div>
      </ProjectActionForm>
    </main>
  );
}
