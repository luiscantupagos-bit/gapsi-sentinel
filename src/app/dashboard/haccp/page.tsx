import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { listHaccpPlans } from '@/server/haccp';
import { HACCP_PLAN_STATUS_LABEL, type HaccpPlanStatus } from '@/features/haccp/haccp-state';

/**
 * HACCP-001 — índice de Planes HACCP. El módulo HACCP es la fuente de verdad operativa; el
 * Plan formal será una salida documental (HACCP-007).
 */
export default async function HaccpIndexPage() {
  const session = await requireServerSession();
  const plans = await listHaccpPlans(session.organizationId);

  return (
    <main className="container">
      <div className="page-head">
        <h1>Planes HACCP</h1>
        <Link className="button button--primary" href="/dashboard/haccp/new">
          Nuevo Plan HACCP
        </Link>
      </div>
      <p className="msg msg--info">
        El módulo HACCP concentra la información operativa (equipo, producto, materias primas,
        prerrequisitos y documentos). El Plan HACCP formal se generará como salida documental en una
        fase posterior.
      </p>

      {plans.length === 0 ? (
        <p className="empty-state">Aún no hay planes HACCP. Crea el primero.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Sitio</th>
                <th>Versión vigente</th>
                <th>Estado</th>
                <th>Responsable</th>
                <th>Próxima revisión</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td className="mono">
                    <Link href={`/dashboard/haccp/${p.id}`}>{p.code}</Link>
                  </td>
                  <td>
                    <Link href={`/dashboard/haccp/${p.id}`}>{p.title}</Link>
                  </td>
                  <td>{p.siteName ?? '—'}</td>
                  <td>{p.currentVersionLabel ?? '—'}</td>
                  <td>
                    <span className={`badge badge--haccp-${p.status}`}>
                      {HACCP_PLAN_STATUS_LABEL[p.status as HaccpPlanStatus] ?? p.status}
                    </span>
                  </td>
                  <td>{p.responsibleName ?? '—'}</td>
                  <td>{p.nextReviewAt ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
