/**
 * Icono de ayuda "?" con una instrucción breve. Accesible: botón con
 * `aria-label`; la burbuja aparece al pasar el cursor o al enfocar (CSS). No
 * requiere JavaScript.
 */
export function HelpTip({ text }: { text: string }) {
  return (
    <span className="helptip">
      <button type="button" className="helptip__btn" aria-label={`Ayuda: ${text}`}>
        ?
      </button>
      <span className="helptip__bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}

/** Encabezado de etapa del formulario: número, título, descripción y ayuda. */
export function Step({
  n,
  title,
  desc,
  help,
  children,
}: {
  n?: number;
  title: string;
  desc?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="form-step">
      <header className="form-step__head">
        <h3 className="form-step__title">
          {n != null && <span className="form-step__num">{n}</span>}
          {title}
          {help && <HelpTip text={help} />}
        </h3>
        {desc && <p className="form-step__desc">{desc}</p>}
      </header>
      <div className="form-step__body">{children}</div>
    </section>
  );
}
