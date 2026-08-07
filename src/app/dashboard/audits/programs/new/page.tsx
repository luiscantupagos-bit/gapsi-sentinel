import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { listOrgMembers } from '@/server/projects';
import { listSites } from '@/server/documents';
import { PROGRAM_FREQUENCIES, PROGRAM_FREQUENCY_LABEL } from '@/features/audits/program-state';
import { PageHeader } from '../../../_components/ui';
import { AuditActionForm } from '../../_components/AuditActionForm';
import { createProgramAction } from '../../actions';

export default async function NewProgramPage() {
  const session = await requireServerSession();
  const [members, sites] = await Promise.all([
    listOrgMembers(session.organizationId),
    listSites(session.organizationId),
  ]);
  const year = new Date().getUTCFullYear();

  return (
    <main className="container container--narrow">
      <p>
        <Link href="/dashboard/audits/programs">← Volver a programas</Link>
      </p>
      <PageHeader title="Nuevo programa" subtitle="Plan anual de auditorías." />

      <AuditActionForm
        action={createProgramAction}
        button="Crear programa"
        variant="primary"
        className="doc-form"
      >
        <label className="field field--full">
          <span className="field__label">Nombre</span>
          <input name="name" required placeholder="Programa anual de auditorías internas" />
        </label>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Año</span>
            <input type="number" name="year" defaultValue={year} min={2000} max={3000} required />
          </label>
          <label className="field">
            <span className="field__label">Frecuencia</span>
            <select name="frequency" defaultValue="annual">
              {PROGRAM_FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {PROGRAM_FREQUENCY_LABEL[f]}
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
            <span className="field__label">Sitio</span>
            <select name="siteId" defaultValue="">
              <option value="">— Todos —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field field--full">
          <span className="field__label">Objetivo</span>
          <textarea name="objective" rows={2} />
        </label>
        <label className="field field--full">
          <span className="field__label">Alcance</span>
          <textarea name="scope" rows={2} />
        </label>
        <label className="field field--full">
          <span className="field__label">Criterios / esquemas</span>
          <textarea name="criteria" rows={2} />
        </label>
      </AuditActionForm>
    </main>
  );
}
