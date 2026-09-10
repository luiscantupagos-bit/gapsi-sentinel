'use client';

/** Formulario de datos del negocio + fiscales + logotipo (DOC-UX-003 §12). */
import { useActionState } from 'react';
import { saveOrganizationProfileAction, type ProfileState } from '../actions';
import { SubmitButton } from '../../documents/_components/SubmitButton';

interface Props {
  initial: {
    commercialName: string;
    legalName: string;
    taxId: string;
    taxRegime: string;
    taxAddress: string;
    logoUrl: string;
  };
}

export function OrganizationProfileForm({ initial }: Props) {
  const [state, action] = useActionState<ProfileState | null, FormData>(
    saveOrganizationProfileAction,
    null,
  );

  return (
    <form action={action} className="doc-form" style={{ maxWidth: '42rem' }}>
      {state && (
        <p role="status" className={`msg ${state.ok ? 'msg--ok' : 'msg--error'}`}>
          {state.message}
        </p>
      )}

      <h2>Datos del negocio</h2>
      <div className="form-grid-2">
        <div className="field">
          <label className="field__label" htmlFor="commercialName">
            Nombre comercial
          </label>
          <input id="commercialName" name="commercialName" defaultValue={initial.commercialName} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="legalName">
            Razón social
          </label>
          <input id="legalName" name="legalName" defaultValue={initial.legalName} />
        </div>
      </div>

      <h2>Datos fiscales</h2>
      <div className="form-grid-2">
        <div className="field">
          <label className="field__label" htmlFor="taxId">
            RFC / Tax ID
          </label>
          <input id="taxId" name="taxId" defaultValue={initial.taxId} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="taxRegime">
            Régimen fiscal
          </label>
          <input id="taxRegime" name="taxRegime" defaultValue={initial.taxRegime} />
        </div>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="taxAddress">
          Domicilio fiscal
        </label>
        <input id="taxAddress" name="taxAddress" defaultValue={initial.taxAddress} />
      </div>

      <h2>Logotipo</h2>
      <div className="field">
        <label className="field__label" htmlFor="logoUrl">
          URL del logotipo de la organización
        </label>
        <input id="logoUrl" name="logoUrl" defaultValue={initial.logoUrl} placeholder="https://…" />
        <p className="muted">
          Se usará en el encabezado de los documentos. La carga directa de archivos llegará con el
          almacenamiento de organización; por ahora se referencia por URL.
        </p>
      </div>

      <div className="form-actions">
        <SubmitButton pendingLabel="Guardando…">Guardar configuración del negocio</SubmitButton>
      </div>
    </form>
  );
}
