/**
 * Componentes compartidos del PATRÓN DE DETALLE (CORE-ALIGN-001), adoptado de
 * Auditorías: encabezado → siguiente acción → progreso por etapas → pestañas.
 * Solo presentación; reutilizables en Diagnósticos, Documentos, CAPA y Proyectos.
 */
import Link from 'next/link';

/** Encabezado de entidad: volver + título + estado + meta + acción dominante. */
export function DetailHeader({
  backHref,
  backLabel,
  title,
  badge,
  meta,
  actions,
}: {
  backHref: string;
  backLabel: string;
  title: React.ReactNode;
  badge?: React.ReactNode;
  meta?: { label: string; value: React.ReactNode }[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="detailhead">
      <Link href={backHref} className="detailhead__back">
        ← {backLabel}
      </Link>
      <div className="detailhead__top">
        <div className="detailhead__titlewrap">
          <h1 className="detailhead__title">{title}</h1>
          {badge}
        </div>
        {actions && <div className="detailhead__actions">{actions}</div>}
      </div>
      {meta && meta.length > 0 && (
        <dl className="detailhead__meta">
          {meta.map((m) => (
            <div key={m.label}>
              <dt>{m.label}</dt>
              <dd>{m.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Tarjeta de "siguiente acción": qué falta y el botón dominante para avanzar. */
export function NextActionCard({
  text,
  action,
  tone = 'default',
}: {
  text: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'default' | 'success' | 'warning';
}) {
  return (
    <div className={`nextaction nextaction--${tone}`}>
      <div className="nextaction__body">
        <span className="nextaction__label">Siguiente acción</span>
        <p className="nextaction__text">{text}</p>
      </div>
      {action && <div className="nextaction__cta">{action}</div>}
    </div>
  );
}

/** Progreso por etapas (stepper horizontal). `current` es el índice 0-based. */
export function StageProgress({ stages, current }: { stages: string[]; current: number }) {
  return (
    <ol className="stageprogress" aria-label="Progreso por etapas">
      {stages.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li
            key={s}
            className={`stageprogress__step is-${state}`}
            aria-current={i === current ? 'step' : undefined}
          >
            <span className="stageprogress__dot" aria-hidden>
              {i < current ? '✓' : i + 1}
            </span>
            <span className="stageprogress__label">{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Barra de pestañas del detalle (navegación por query param `?tab=`). */
export function DetailTabs({
  tabs,
  current,
  hrefFor,
}: {
  tabs: { key: string; label: string }[];
  current: string;
  hrefFor: (key: string) => string;
}) {
  return (
    <nav className="tabs" aria-label="Secciones del detalle">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={hrefFor(t.key)}
          className={`tab${current === t.key ? ' is-active' : ''}`}
          aria-current={current === t.key ? 'page' : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
