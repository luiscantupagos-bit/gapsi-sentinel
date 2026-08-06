import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { listOrgMembers } from '@/server/projects';
import {
  PROJECT_PRIORITIES,
  PROJECT_PRIORITY_LABEL,
  PROJECT_TYPES,
  PROJECT_TYPE_LABEL,
} from '@/features/projects/project-state';
import { PageHeader } from '../../_components/ui';
import { ProjectActionForm } from '../_components/ProjectActionForm';
import { createProjectAction } from '../actions';

export default async function NewProjectPage() {
  const session = await requireServerSession();
  const members = await listOrgMembers(session.organizationId);

  return (
    <main className="container container--narrow">
      <p>
        <Link href="/dashboard/projects">← Volver a proyectos</Link>
      </p>
      <PageHeader title="Nuevo proyecto" subtitle="Define una iniciativa y su responsable." />

      <ProjectActionForm
        action={createProjectAction}
        button="Crear proyecto"
        variant="primary"
        className="doc-form"
      >
        <label className="field field--full">
          <span className="field__label">Nombre</span>
          <input name="name" required placeholder="Nombre del proyecto" />
        </label>
        <label className="field field--full">
          <span className="field__label">Descripción</span>
          <textarea name="description" rows={2} />
        </label>
        <label className="field field--full">
          <span className="field__label">Objetivo</span>
          <textarea name="objective" rows={2} />
        </label>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Tipo</span>
            <select name="projectType" defaultValue="continuous_improvement">
              {PROJECT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PROJECT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Prioridad</span>
            <select name="priority" defaultValue="normal">
              {PROJECT_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PROJECT_PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Responsable</span>
            <select name="responsibleUserId" defaultValue="">
              <option value="">— Sin asignar —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Patrocinador</span>
            <select name="sponsorUserId" defaultValue="">
              <option value="">— Ninguno —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Fecha de inicio</span>
            <input type="date" name="startDate" />
          </label>
          <label className="field">
            <span className="field__label">Fecha objetivo</span>
            <input type="date" name="targetDate" />
          </label>
        </div>
      </ProjectActionForm>
    </main>
  );
}
