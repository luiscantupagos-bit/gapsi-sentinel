'use client';

/** Formulario de Apariencia documental (DOC-UX-001 §20/§22): 3 colores HEX + vista previa. */
import { useActionState, useState } from 'react';
import { saveDocumentThemeAction, type ThemeState } from '../settings-actions';
import { SubmitButton } from './SubmitButton';

interface Props {
  initial: { primary: string; secondary: string; accent: string };
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function DocumentThemeForm({ initial }: Props) {
  const [state, action] = useActionState<ThemeState | null, FormData>(
    saveDocumentThemeAction,
    null,
  );
  const [primary, setPrimary] = useState(initial.primary);
  const [secondary, setSecondary] = useState(initial.secondary);
  const [accent, setAccent] = useState(initial.accent);

  const swatch = (value: string, onChange: (v: string) => void, id: string, label: string) => (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__inline" style={{ gap: 'var(--space-2)' }}>
        <input
          type="color"
          aria-label={`${label} (selector)`}
          value={HEX_RE.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: '2.4rem', height: '2rem', padding: 0 }}
        />
        <input
          id={id}
          name={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          aria-invalid={!HEX_RE.test(value)}
          style={{ width: '7rem' }}
        />
      </div>
    </div>
  );

  return (
    <form action={action} className="doc-form" style={{ maxWidth: '40rem' }}>
      {state && (
        <p role="status" className={`msg ${state.ok ? 'msg--ok' : 'msg--error'}`}>
          {state.message}
          {state.errors && <span> {state.errors.join(' ')}</span>}
        </p>
      )}
      <div className="form-grid-2">
        {swatch(primary, setPrimary, 'primary', 'Color principal')}
        {swatch(secondary, setSecondary, 'secondary', 'Color secundario')}
        {swatch(accent, setAccent, 'accent', 'Color de acento')}
      </div>

      <h3>Vista previa</h3>
      <div
        className="doc-render"
        style={
          {
            '--doc-primary': HEX_RE.test(primary) ? primary : '#0f2440',
            '--doc-secondary': HEX_RE.test(secondary) ? secondary : '#e3e8ef',
            '--doc-accent': HEX_RE.test(accent) ? accent : '#2563eb',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-4)',
          } as React.CSSProperties
        }
      >
        <header className="doc-render__header">
          <div className="doc-render__org-brand">
            <span className="doc-render__org-name">Su organización</span>
          </div>
          <div className="doc-render__docid">
            <h1 className="doc-render__title">Documento de ejemplo</h1>
          </div>
        </header>
        <section className="doc-render__section">
          <h2>Sección</h2>
          <div className="doc-render__table-wrap">
            <table className="doc-render__table">
              <thead>
                <tr>
                  <th>Columna</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Ejemplo</td>
                  <td>Contenido</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="form-actions">
        <SubmitButton pendingLabel="Guardando…">Guardar apariencia</SubmitButton>
      </div>
    </form>
  );
}
