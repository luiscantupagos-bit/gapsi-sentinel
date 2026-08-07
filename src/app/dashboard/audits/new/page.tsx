import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { listOrgMembers } from '@/server/projects';
import { listSites } from '@/server/documents';
import { listPrograms } from '@/server/audit-programs';
import {
  AUDIT_PRIORITIES,
  AUDIT_PRIORITY_LABEL,
  AUDIT_TYPES,
  AUDIT_TYPE_LABEL,
} from '@/features/audits/audit-state';
import { PageHeader } from '../../_components/ui';
import { AuditActionForm } from '../_components/AuditActionForm';
import { createAuditAction } from '../actions';

export default async function NewAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ programId?: string }>;
}) {
  const session = await requireServerSession();
  const sp = await searchParams;
  const [members, sites, programs] = await Promise.all([
    listOrgMembers(session.organizationId),
    listSites(session.organizationId),
    listPrograms(session.organizationId),
  ]);

  return (
    <main className="container container--narrow">
      <p>
        <Link href="/dashboard/audits">← Volver a auditorías</Link>
      </p>
      <PageHeader
        title="Nueva auditoría"
        subtitle="Define los datos generales; el checklist se genera después."
      />

      <AuditActionForm
        action={createAuditAction}
        button="Crear auditoría"
        variant="primary"
        className="doc-form"
      >
        <label className="field field--full">
          <span className="field__label">Título</span>
          <input
            name="title"
            required
            placeholder="p. ej. Auditoría interna FSSC 22000 — Planta Norte"
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Tipo</span>
            <select name="auditType" defaultValue="internal">
              {AUDIT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {AUDIT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Prioridad</span>
            <select name="priority" defaultValue="normal">
              {AUDIT_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {AUDIT_PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Programa</span>
            <select name="programId" defaultValue={sp.programId ?? ''}>
              <option value="">— Sin programa —</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.folio} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Sitio</span>
            <select name="siteId" defaultValue="">
              <option value="">— Sin sitio —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Auditor líder</span>
            <select name="leadAuditorUserId" defaultValue="">
              <option value="">— Sin asignar —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Fecha planeada</span>
            <input type="date" name="plannedDate" />
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
          <span className="field__label">Criterios (norma/versión)</span>
          <textarea name="criteria" rows={2} />
        </label>
      </AuditActionForm>
    </main>
  );
}
