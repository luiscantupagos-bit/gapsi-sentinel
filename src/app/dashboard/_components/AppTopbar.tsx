import { IconBell, IconChevron } from './icons';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  evaluator: 'Evaluador',
  viewer: 'Lector',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'U';
}

/**
 * Barra superior. Muestra la organización y el sitio ACTIVOS (datos reales de la
 * sesión), una campana decorativa (sin backend de notificaciones aún) y el
 * usuario con su rol. Los selectores muestran el valor real; no cambian de
 * organización porque el adaptador de desarrollo usa una sesión fija.
 */
export function AppTopbar({
  orgName,
  siteName,
  userName,
  role,
}: {
  orgName: string;
  siteName: string | null;
  userName: string;
  role: string;
}) {
  return (
    <header className="topbar">
      <div className="topbar__selectors">
        <button type="button" className="topbar__select" disabled title="Organización activa">
          <span>{orgName}</span>
          <IconChevron className="topbar__chevron" />
        </button>
        {siteName && (
          <button type="button" className="topbar__select" disabled title="Sitio activo">
            <span>{siteName}</span>
            <IconChevron className="topbar__chevron" />
          </button>
        )}
      </div>

      <div className="topbar__right">
        <span className="topbar__bell" aria-hidden title="Notificaciones (próximamente)">
          <IconBell />
        </span>
        <div className="topbar__user">
          <span className="avatar" aria-hidden>
            {initials(userName)}
          </span>
          <span className="topbar__userinfo">
            <span className="topbar__username">{userName}</span>
            <span className="topbar__userrole">{ROLE_LABEL[role] ?? role}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
