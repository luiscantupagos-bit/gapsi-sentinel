'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { devSignOut } from '@/features/auth/dev-actions';
import {
  IconAnalysis,
  IconAudit,
  IconCapa,
  IconDoc,
  IconInbox,
  IconLogout,
  IconPanel,
  IconProjects,
  IconReport,
  IconRisk,
  IconSettings,
  IconSupplier,
  IconTasks,
  IconTraining,
} from './icons';

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const MAIN: Item[] = [
  { href: '/dashboard', label: 'Panel', icon: IconPanel },
  { href: '/dashboard/documents', label: 'Documentos', icon: IconDoc },
  { href: '/dashboard/documents/tasks', label: 'Tareas', icon: IconTasks },
  { href: '/dashboard/capa', label: 'Acciones correctivas', icon: IconCapa },
  { href: '/dashboard/capa/tasks', label: 'Bandeja CAPA', icon: IconInbox },
  { href: '/dashboard/capa/analysis', label: 'Análisis', icon: IconAnalysis },
];

// Módulos previstos; aún sin ruta funcional → se muestran deshabilitados.
const MODULES: { label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'Auditorías', icon: IconAudit },
  { label: 'Proyectos', icon: IconProjects },
  { label: 'Riesgos', icon: IconRisk },
  { label: 'Proveedores', icon: IconSupplier },
  { label: 'Capacitación', icon: IconTraining },
  { label: 'Reportes', icon: IconReport },
];

function activeHref(pathname: string): string {
  const matches = MAIN.filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  );
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

      <ul className="sidebar__nav">
        {MAIN.map((it) => {
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

      <p className="sidebar__group">Módulos</p>
      <ul className="sidebar__nav">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <li key={m.label}>
              <span
                className="sidebar__link sidebar__link--disabled"
                aria-disabled="true"
                title="Próximamente"
              >
                <Icon className="sidebar__icon" />
                <span>{m.label}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="sidebar__foot">
        <span
          className="sidebar__link sidebar__link--disabled"
          aria-disabled="true"
          title="Próximamente"
        >
          <IconSettings className="sidebar__icon" />
          <span>Configuración</span>
        </span>
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
