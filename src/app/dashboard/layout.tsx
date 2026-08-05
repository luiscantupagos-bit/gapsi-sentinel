import { redirect } from 'next/navigation';
import { getServerSession } from '@/server/session';
import { getPrisma } from '@/server/db';
import { AppSidebar } from './_components/AppSidebar';
import { AppTopbar } from './_components/AppTopbar';

/**
 * Layout del área privada. Segunda barrera de autorización en servidor: aunque
 * el middleware ya protege el enrutado, cada área privada revalida la sesión
 * antes de renderizar (defensa en profundidad). El chrome (sidebar + topbar) se
 * normaliza en componentes compartidos.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession();

  if (!session) {
    redirect('/login?from=/dashboard');
  }

  const prisma = getPrisma();
  const [org, user, site] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { name: true },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { displayName: true, email: true },
    }),
    prisma.site.findFirst({
      where: { organizationId: session.organizationId, deletedAt: null },
      select: { name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="shell">
      <AppSidebar />
      <div className="shell__main">
        <AppTopbar
          orgName={org?.name ?? 'Organización'}
          siteName={site?.name ?? null}
          userName={user?.displayName ?? user?.email ?? 'Usuario'}
          role={session.role}
        />
        <div className="shell__content">{children}</div>
      </div>
    </div>
  );
}
