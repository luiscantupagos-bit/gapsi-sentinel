import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { listPrograms } from '@/server/audit-programs';
import { getAuditPerms } from '@/server/audits';
import { PROGRAM_FREQUENCY_LABEL, type ProgramFrequency } from '@/features/audits/program-state';
import { PageHeader } from '../../_components/ui';
import { ProgramStatusBadge } from '../_components/AuditBits';

export default async function ProgramsPage() {
  const session = await requireServerSession();
  const [programs, ctx] = await Promise.all([
    listPrograms(session.organizationId),
    getAuditPerms(session.organizationId, session.userId),
  ]);

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/audits">← Volver a auditorías</Link>
      </p>
      <PageHeader
        title="Programas de auditoría"
        subtitle="Planes anuales de auditoría con sus auditorías planeadas."
        actions={
          ctx.isAdmin ? (
            <Link className="button button--primary" href="/dashboard/audits/programs/new">
              Nuevo programa
            </Link>
          ) : undefined
        }
      />

      {programs.length === 0 ? (
        <p className="empty-state">No hay programas.</p>
      ) : (
        <div className="table-wrap">
          <table className="tbl-linkable">
            <thead>
              <tr>
                <th>Código</th>
                <th>Programa</th>
                <th>Año</th>
                <th>Frecuencia</th>
                <th>Responsable</th>
                <th>Auditorías</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => (
                <tr key={p.id}>
                  <td className="mono">
                    <Link href={`/dashboard/audits/programs/${p.id}`}>{p.folio}</Link>
                  </td>
                  <td>
                    <Link href={`/dashboard/audits/programs/${p.id}`} className="tbl-title">
                      {p.name}
                    </Link>
                  </td>
                  <td>{p.year}</td>
                  <td>{PROGRAM_FREQUENCY_LABEL[p.frequency as ProgramFrequency] ?? p.frequency}</td>
                  <td>{p.responsibleName ?? <span className="muted">—</span>}</td>
                  <td>{p.auditCount}</td>
                  <td>
                    <ProgramStatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
