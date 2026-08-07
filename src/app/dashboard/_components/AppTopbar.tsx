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
 * Barra superior. Muestra la organización y el sitio ACTIVOS de la sesión como
 * CONTEXTO (texto, no selectores interactivos: aún no hay cambio de contexto), y
 * el usuario con su rol. Sin controles falsos (sin campana decorativa ni botones
 * deshabilitados que aparenten interacción).
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
      <div className="topbar__context">
        <div className="topbar__ctxitem">
          <span className="topbar__ctxlabel">Organización</span>
          <span className="topbar__ctxvalue">{orgName}</span>
        </div>
        {siteName && (
          <div className="topbar__ctxitem">
            <span className="topbar__ctxlabel">Sitio</span>
            <span className="topbar__ctxvalue">{siteName}</span>
          </div>
        )}
      </div>

      <div className="topbar__right">
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
