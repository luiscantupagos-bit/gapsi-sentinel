'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { devSignOut } from '@/features/auth/dev-actions';
import {
  IconAnalysis,
  IconAudit,
  IconCapa,
  IconChart,
  IconDiagnostic,
  IconDoc,
  IconLogout,
  IconPanel,
  IconProjects,
  IconReport,
  IconTasks,
} from './icons';

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type Group = { title: string | null; items: Item[] };

// Arquitectura de información definitiva (CORE-ALIGN-001). Solo rutas reales.
const GROUPS: Group[] = [
  {
    title: null,
    items: [{ href: '/dashboard', label: 'Panel', icon: IconPanel }],
  },
  {
    title: 'Cumplimiento',
    items: [
      { href: '/dashboard/diagnostics', label: 'Diagnósticos', icon: IconDiagnostic },
      { href: '/dashboard/audits', label: 'Auditorías', icon: IconAudit },
      { href: '/dashboard/documents', label: 'Documentos', icon: IconDoc },
    ],
  },
  {
    title: 'Mejora',
    items: [
      { href: '/dashboard/capa', label: 'Acciones correctivas', icon: IconCapa },
      { href: '/dashboard/capa/analysis', label: 'Análisis', icon: IconAnalysis },
    ],
  },
  {
    title: 'Trabajo',
    items: [
      { href: '/dashboard/tasks', label: 'Tareas', icon: IconTasks },
      { href: '/dashboard/projects', label: 'Proyectos', icon: IconProjects },
    ],
  },
  {
    title: 'Desempeño',
    items: [
      { href: '/dashboard/kpis', label: 'Indicadores', icon: IconReport },
      { href: '/dashboard/analytics', label: 'Analítica', icon: IconChart },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

function activeHref(pathname: string): string {
  const matches = ALL_ITEMS.filter(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  ).sort((a, b) => b.href.length - a.href.length);
  return matches[0]?.href ?? '';
}

export function AppSidebar() {
  const pathname = usePathname();
  const active = activeHref(pathname);

  return (
    <nav className="sidebar" aria-label="Navegación principal">
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden>
          GS
        </span>
        <span className="sidebar__brandtext">GAPSI Sentinel</span>
      </div>

      <div className="sidebar__scroll">
        {GROUPS.map((group, gi) => (
          <div key={group.title ?? `g${gi}`} className="sidebar__section">
            {group.title && <p className="sidebar__group">{group.title}</p>}
            <ul className="sidebar__nav">
              {group.items.map((it) => {
                const Icon = it.icon;
                const isActive = active === it.href;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={`sidebar__link${isActive ? ' is-active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className="sidebar__icon" />
                      <span>{it.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="sidebar__foot">
        <form action={devSignOut}>
          <button type="submit" className="sidebar__link sidebar__signout">
            <IconLogout className="sidebar__icon" />
            <span>Cerrar sesión</span>
          </button>
        </form>
      </div>
    </nav>
  );
}
