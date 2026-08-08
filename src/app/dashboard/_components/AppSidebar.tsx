'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { devSignOut } from '@/features/auth/dev-actions';
import { IconLogout } from './icons';
import { NAV_GROUPS, activeNavHref } from './nav-config';

export function AppSidebar() {
  const pathname = usePathname();
  const active = activeNavHref(pathname);

  return (
    <nav className="sidebar" aria-label="Navegación principal">
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden>
          GS
        </span>
        <span className="sidebar__brandtext">GAPSI Sentinel</span>
      </div>

      <div className="sidebar__scroll">
        {NAV_GROUPS.map((group, gi) => (
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
