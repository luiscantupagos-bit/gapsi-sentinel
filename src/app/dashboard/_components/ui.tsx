/**
 * Componentes de presentación compartidos (normalización visual). Sin lógica de
 * negocio: encabezado de página, tarjeta indicador y tarjeta de sección.
 */
import Link from 'next/link';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted page-head__sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'danger' | 'warning' | 'success';
  href?: string;
}) {
  const className = `statcard${tone && tone !== 'default' ? ` statcard--${tone}` : ''}${
    href ? ' statcard--link' : ''
  }`;
  const inner = (
    <>
      <span className="statcard__label">{label}</span>
      <span className="statcard__value">{value}</span>
    </>
  );
  if (href) {
    return (
      <Link className={className} href={href}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

export function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="sectioncard">
      <header className="sectioncard__head">
        <h2>{title}</h2>
        {action}
      </header>
      <div className="sectioncard__body">{children}</div>
    </section>
  );
}
