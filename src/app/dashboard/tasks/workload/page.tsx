import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { listGlobalTasks } from '@/server/tasks';
import { listOrgMembers, listProjects } from '@/server/projects';
import { PageHeader } from '../../_components/ui';

const isOpen = (status: string) => status !== 'completed' && status !== 'cancelled';

export default async function WorkloadPage() {
  const session = await requireServerSession();
  const [items, members, projects] = await Promise.all([
    listGlobalTasks(session.organizationId, session.userId, {}),
    listOrgMembers(session.organizationId),
    listProjects(session.organizationId),
  ]);

  type Row = {
    id: string;
    name: string;
    open: number;
    inProgress: number;
    overdue: number;
    dueSoon: number;
    estHours: number;
    activeProjects: number;
  };
  const rows = new Map<string, Row>();
  for (const m of members) {
    rows.set(m.id, {
      id: m.id,
      name: m.name,
      open: 0,
      inProgress: 0,
      overdue: 0,
      dueSoon: 0,
      estHours: 0,
      activeProjects: 0,
    });
  }
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  for (const it of items) {
    if (!it.responsibleUserId) continue;
    const r = rows.get(it.responsibleUserId);
    if (!r) continue;
    if (isOpen(it.status)) {
      r.open += 1;
      if (it.status === 'in_progress') r.inProgress += 1;
      if (it.estimatedHours) r.estHours += it.estimatedHours;
      if (it.targetDate && it.targetDate >= today && it.targetDate <= soon) r.dueSoon += 1;
    }
    if (it.overdue) r.overdue += 1;
  }
  for (const p of projects) {
    if (p.status === 'active' && p.responsibleUserId && rows.has(p.responsibleUserId)) {
      rows.get(p.responsibleUserId)!.activeProjects += 1;
    }
  }
  const ordered = [...rows.values()].sort((a, b) => b.open - a.open);

  const loadTone = (open: number) => (open >= 8 ? 'danger' : open >= 4 ? 'warning' : 'success');
  const loadLabel = (open: number) => (open >= 8 ? 'Alta' : open >= 4 ? 'Media' : 'Baja');

  return (
    <main className="container">
      <PageHeader
        title="Carga de trabajo"
        subtitle="Volumen y esfuerzo estimado por responsable. El semáforo refleja volumen (no capacidad configurada)."
        actions={
          <Link className="button button--ghost" href="/dashboard/tasks">
            Ver lista
          </Link>
        }
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Responsable</th>
              <th>Abiertas</th>
              <th>En progreso</th>
              <th>Vencidas</th>
              <th>Próximas (7d)</th>
              <th>Esfuerzo est. (h)</th>
              <th>Proyectos activos</th>
              <th>Carga (volumen)</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.open}</td>
                <td>{r.inProgress}</td>
                <td className={r.overdue > 0 ? 'due--overdue' : undefined}>{r.overdue}</td>
                <td>{r.dueSoon}</td>
                <td>{r.estHours > 0 ? r.estHours : <span className="muted">—</span>}</td>
                <td>{r.activeProjects}</td>
                <td>
                  <span className={`badge badge--${loadTone(r.open)}`}>{loadLabel(r.open)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
