'use client';

/**
 * Logo de organización (PLATFORM-002B §4). Sube/reemplaza/elimina usando el
 * almacenamiento transversal. Muestra preview del logo actual (ruta autorizada) o el
 * nombre de la organización como fallback. Solo imágenes (PNG/JPEG/WEBP), ≤ 5 MB.
 */
import { useActionState } from 'react';
import { uploadLogoAction, removeLogoAction, type LogoState } from '../actions';
import { SubmitButton } from '../../documents/_components/SubmitButton';

interface Props {
  /** Fuente actual del logo (ruta /api/files/... o URL legacy), o null. */
  logoSource: string | null;
  organizationName: string;
}

export function LogoSettings({ logoSource, organizationName }: Props) {
  const [state, action] = useActionState<LogoState | null, FormData>(uploadLogoAction, null);

  return (
    <div className="doc-form" style={{ maxWidth: '42rem' }}>
      {state && (
        <p role="status" className={`msg ${state.ok ? 'msg--ok' : 'msg--error'}`}>
          {state.message}
        </p>
      )}

      <div className="logo-settings">
        <div className="logo-settings__preview" aria-label="Logo actual">
          {logoSource ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSource} alt={`Logo de ${organizationName}`} />
          ) : (
            <span className="logo-settings__fallback">{organizationName}</span>
          )}
        </div>

        <div className="logo-settings__actions">
          <form action={action} className="attachments__upload">
            <input
              type="file"
              name="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Logo"
              required
            />
            <SubmitButton pendingLabel="Guardando…">
              {logoSource ? 'Reemplazar logo' : 'Subir logo'}
            </SubmitButton>
          </form>
          {logoSource && (
            <form action={removeLogoAction}>
              <button type="submit" className="button button--ghost">
                Eliminar logo
              </button>
            </form>
          )}
          <p className="muted">
            PNG, JPEG o WEBP · máximo 5 MB. Se usa en el encabezado de los documentos.
          </p>
        </div>
      </div>
    </div>
  );
}
