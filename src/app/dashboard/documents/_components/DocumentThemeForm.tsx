'use client';

/**
 * Configuración documental (DOC-UX-001/002 §20/§88/§96): DISEÑO (cards con
 * preview) + COLORES (5) + MARCA (atribución C3, bloqueada sin entitlement) +
 * vista previa en vivo del render.
 */
import { useActionState, useState } from 'react';
import { saveDocumentThemeAction, type ThemeState } from '../settings-actions';
import { SubmitButton } from './SubmitButton';
import { DOCUMENT_DESIGNS } from '@/features/documents/document-design';
import { DATE_FORMATS, DATE_FORMAT_LABEL } from '@/features/documents/date-format';

interface Props {
  initial: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    heading: string;
    designId: string;
    showC3Attribution: boolean;
    dateFormat: string;
  };
  canHideC3Attribution: boolean;
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const fallback = (v: string, d: string) => (HEX_RE.test(v) ? v : d);

export function DocumentThemeForm({ initial, canHideC3Attribution }: Props) {
  const [state, action] = useActionState<ThemeState | null, FormData>(
    saveDocumentThemeAction,
    null,
  );
  const [primary, setPrimary] = useState(initial.primary);
  const [secondary, setSecondary] = useState(initial.secondary);
  const [accent, setAccent] = useState(initial.accent);
  const [text, setText] = useState(initial.text);
  const [heading, setHeading] = useState(initial.heading);
  const [designId, setDesignId] = useState(initial.designId);
  const [showC3, setShowC3] = useState(initial.showC3Attribution);
  const [dateFormat, setDateFormat] = useState(initial.dateFormat);

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
    <form action={action} className="doc-form" style={{ maxWidth: '46rem' }}>
      {state && (
        <p role="status" className={`msg ${state.ok ? 'msg--ok' : 'msg--error'}`}>
          {state.message}
          {state.errors && <span> {state.errors.join(' ')}</span>}
        </p>
      )}

      <h3>Diseño documental</h3>
      <p className="muted">Define cómo se ve el documento. Los colores se eligen aparte.</p>
      <div className="design-cards" role="radiogroup" aria-label="Diseño documental">
        {DOCUMENT_DESIGNS.map((d) => (
          <label
            key={d.id}
            className={`design-card${designId === d.id ? ' design-card--active' : ''}`}
          >
            <input
              type="radio"
              name="designId"
              value={d.id}
              checked={designId === d.id}
              onChange={() => setDesignId(d.id)}
              className="design-card__radio"
            />
            <span className={`design-card__preview design-card__preview--${d.id}`} aria-hidden>
              <span className="design-card__pv-head" />
              <span className="design-card__pv-line" />
              <span className="design-card__pv-line design-card__pv-line--short" />
              <span className="design-card__pv-table" />
            </span>
            <span className="design-card__label">{d.label}</span>
            <span className="design-card__desc">{d.description}</span>
          </label>
        ))}
      </div>

      <h3>Colores</h3>
      <div className="form-grid-2">
        {swatch(primary, setPrimary, 'primary', 'Color principal')}
        {swatch(secondary, setSecondary, 'secondary', 'Color secundario')}
        {swatch(accent, setAccent, 'accent', 'Color de acento')}
        {swatch(text, setText, 'text', 'Color del texto')}
        {swatch(heading, setHeading, 'heading', 'Color del texto en encabezados')}
      </div>

      <h3>Formato de fecha</h3>
      <div className="field" style={{ maxWidth: '22rem' }}>
        <label className="field__label" htmlFor="dateFormat">
          Formato de fecha en documentos
        </label>
        <select
          id="dateFormat"
          name="dateFormat"
          value={dateFormat}
          onChange={(e) => setDateFormat(e.target.value)}
        >
          {DATE_FORMATS.map((f) => (
            <option key={f} value={f}>
              {DATE_FORMAT_LABEL[f]}
            </option>
          ))}
        </select>
        <p className="muted">Aplica a emisión, próxima revisión, control de cambios y copias.</p>
      </div>

      <h3>Marca</h3>
      <div className="field">
        <label className="field__inline" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
          <input
            type="checkbox"
            name="showC3Attribution"
            checked={showC3}
            disabled={!canHideC3Attribution}
            onChange={(e) => setShowC3(e.target.checked)}
          />
          <span>Mostrar atribución de C3 Sentinel en el pie del documento</span>
        </label>
        {!canHideC3Attribution && (
          <p className="muted">
            <span className="badge">Función premium</span> Disponible con facturación anual o en los
            planes Intermedio e Industrial.
          </p>
        )}
      </div>

      <h3>Vista previa</h3>
      <div
        className={`doc-render doc-render--design-${designId}`}
        style={
          {
            '--doc-primary': fallback(primary, '#0f2440'),
            '--doc-secondary': fallback(secondary, '#e3e8ef'),
            '--doc-accent': fallback(accent, '#2563eb'),
            '--doc-text': fallback(text, '#1f2937'),
            '--doc-heading': fallback(heading, '#0f2440'),
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
        <footer className="doc-render__footer">
          <p className="doc-render__confidential">DOCUMENTO CONTROLADO Y CONFIDENCIAL</p>
          {showC3 && (
            <p className="doc-render__attribution">
              Documento administrado mediante <strong>C3 Sentinel</strong> — www.c3digital.com.mx
            </p>
          )}
        </footer>
      </div>

      <div className="form-actions">
        <SubmitButton pendingLabel="Guardando…">Guardar configuración documental</SubmitButton>
      </div>
    </form>
  );
}
