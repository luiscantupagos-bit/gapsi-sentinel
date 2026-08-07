import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { CERTIFICATION_STATUS_LABEL, listCertifications } from '@/server/certifications';
import { listSites } from '@/server/documents';
import { getAuditPerms } from '@/server/audits';
import { PageHeader, SectionCard } from '../../_components/ui';
import { AuditActionForm } from '../_components/AuditActionForm';
import { createCertAction } from '../actions';

export default async function CertificationsPage() {
  const session = await requireServerSession();
  const [certs, sites, ctx] = await Promise.all([
    listCertifications(session.organizationId),
    listSites(session.organizationId),
    getAuditPerms(session.organizationId, session.userId),
  ]);

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/audits">← Volver a auditorías</Link>
      </p>
      <PageHeader
        title="Esquemas y certificaciones"
        subtitle="Seguimiento de esquemas aplicables. Sentinel NO valida certificados externos."
      />

      <div className="two-col">
        <div>
          <SectionCard title="Registro">
            {certs.length === 0 ? (
              <p className="empty-state">Sin esquemas registrados.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Esquema</th>
                      <th>Sitio</th>
                      <th>Próxima auditoría</th>
                      <th>Vence</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certs.map((c) => (
                      <tr key={c.id} className={c.expired ? 'is-overdue' : undefined}>
                        <td>
                          <strong>{c.schemeName}</strong>
                          {c.version ? ` v${c.version}` : ''}
                        </td>
                        <td>{c.siteName ?? '—'}</td>
                        <td className={c.dueSoon ? 'due due--overdue' : 'due'}>
                          {c.nextAuditDate ?? '—'}
                        </td>
                        <td>{c.expiryDate ?? '—'}</td>
                        <td>
                          <span className={`badge badge--cert-${c.status}`}>
                            {CERTIFICATION_STATUS_LABEL[
                              c.status as keyof typeof CERTIFICATION_STATUS_LABEL
                            ] ?? c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
        <div>
          {ctx.isAdmin && (
            <SectionCard title="Nuevo esquema / certificación">
              <AuditActionForm action={createCertAction} button="Registrar" variant="primary">
                <label className="field">
                  <span className="field__label">Esquema</span>
                  <input name="schemeName" required placeholder="FSSC 22000" />
                </label>
                <div className="form-grid">
                  <label className="field">
                    <span className="field__label">Versión</span>
                    <input name="version" placeholder="6" />
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
                  <label className="field">
                    <span className="field__label">Organismo certificador</span>
                    <input name="certifierName" />
                  </label>
                  <label className="field">
                    <span className="field__label">Estado</span>
                    <select name="status" defaultValue="preparation">
                      {Object.entries(CERTIFICATION_STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field__label">Próxima auditoría</span>
                    <input type="date" name="nextAuditDate" />
                  </label>
                  <label className="field">
                    <span className="field__label">Vencimiento</span>
                    <input type="date" name="expiryDate" />
                  </label>
                </div>
              </AuditActionForm>
            </SectionCard>
          )}
        </div>
      </div>
    </main>
  );
}
