import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/server/session';
import { devSignOut } from '@/features/auth/dev-actions';

/**
 * Layout del área privada. Segunda barrera de autorización en servidor: aunque
 * el middleware ya protege el enrutado, cada área privada revalida la sesión
 * antes de renderizar (defensa en profundidad).
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession();

  if (!session) {
    redirect('/login?from=/dashboard');
  }

  return (
    <div>
      <header className="topbar">
        <strong>GAPSI Sentinel</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="muted">
            {session.role} · org {session.organizationId}
          </span>
          <form action={devSignOut}>
            <button className="button button--ghost" type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>
      <div className="shell">
        <nav className="sidebar" aria-label="Navegación principal">
          <Link href="/dashboard">Panel</Link>
          <Link href="/dashboard/documents">Documentos</Link>
          <Link href="/dashboard/documents/tasks">Tareas</Link>
        </nav>
        <div className="shell__content">{children}</div>
      </div>
    </div>
  );
}
