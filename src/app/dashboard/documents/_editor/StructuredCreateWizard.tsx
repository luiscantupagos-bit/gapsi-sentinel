'use client';

/**
 * Asistente de creación de documentos (DOC-001 §20/§21).
 *
 * PASO 1 — selección de tipo (tarjetas). PASO 2 — identificación (nombre, área,
 * código propuesto editable, responsable, fechas). El PASO 3 (contenido) es la
 * página del editor por tipo, a la que se redirige tras crear.
 *
 * Los tipos estructurados usan `createStructuredDocumentAction`; el "Documento
 * libre" reutiliza el editor enriquecido (`createEditorDocumentAction`).
 */
import { useActionState, useEffect, useState } from 'react';
import { TEMPLATE_DEFINITIONS } from '@/features/documents/template-registry';
import { REVIEW_PERIODS } from '@/features/documents/dates';
import {
  createEditorDocumentAction,
  createStructuredDocumentAction,
  proposeStructuredCodeAction,
  type FormState,
} from '../editor-actions';
import { SubmitButton } from '../_components/SubmitButton';

interface Option {
  id: string;
  name: string;
}
interface AreaOption {
  code: string | null;
  name: string;
}

export function StructuredCreateWizard({
  areas,
  sites,
  responsibles,
}: {
  areas: AreaOption[];
  sites: Option[];
  responsibles: Option[];
}) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const def = TEMPLATE_DEFINITIONS.find((t) => t.type === selectedType) ?? null;

  if (!def) {
    return (
      <section aria-labelledby="wizard-step1">
        <h2 id="wizard-step1" className="wizard__step-title">
          Paso 1 · Elige el tipo de documento
        </h2>
        <ul className="type-grid" role="list">
          {TEMPLATE_DEFINITIONS.map((t) => (
            <li key={t.type}>
              <button type="button" className="type-card" onClick={() => setSelectedType(t.type)}>
                <span className="type-card__prefix">{t.codePrefix}</span>
                <span className="type-card__label">{t.label}</span>
                <span className="type-card__desc">{t.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section aria-labelledby="wizard-step2">
      <div className="wizard__crumb">
        <button
          type="button"
          className="button button--ghost"
          onClick={() => setSelectedType(null)}
        >
          ← Cambiar tipo
        </button>
        <span className="wizard__chosen">
          <span className="type-card__prefix">{def.codePrefix}</span> {def.label}
        </span>
      </div>
      <h2 id="wizard-step2" className="wizard__step-title">
        Paso 2 · Identificación
      </h2>
      {def.supportsStructuredEditor ? (
        <StructuredIdentification
          def={def}
          areas={areas}
          sites={sites}
          responsibles={responsibles}
        />
      ) : (
        <FreeIdentification documentType={def.type} />
      )}
    </section>
  );
}

function ErrorBox({ state }: { state: FormState | null }) {
  if (!state || state.ok) return null;
  return (
    <div role="alert" className="msg msg--error">
      <p>{state.message}</p>
      {state.errors && (
        <ul>
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StructuredIdentification({
  def,
  areas,
  sites,
  responsibles,
}: {
  def: (typeof TEMPLATE_DEFINITIONS)[number];
  areas: AreaOption[];
  sites: Option[];
  responsibles: Option[];
}) {
  const [state, action] = useActionState<FormState | null, FormData>(
    createStructuredDocumentAction,
    null,
  );
  const [areaCode, setAreaCode] = useState<string>(areas[0]?.code ?? '');
  const [customCode, setCustomCode] = useState(false);
  const [code, setCode] = useState('');

  // Propone el código automático al montar y al cambiar de área (si no es manual).
  useEffect(() => {
    if (customCode) return;
    let active = true;
    proposeStructuredCodeAction({ documentType: def.type, areaCode })
      .then((r) => {
        if (active) setCode(r.code);
      })
      .catch(() => {
        /* la propuesta es orientativa; el servidor reserva al crear */
      });
    return () => {
      active = false;
    };
  }, [def.type, areaCode, customCode]);

  const areaName = areas.find((a) => (a.code ?? '') === areaCode)?.name ?? '';
  const defaultPeriod = def.defaultReviewMonths === null ? 'none' : String(def.defaultReviewMonths);

  return (
    <form action={action} className="doc-form">
      <ErrorBox state={state} />
      <input type="hidden" name="documentType" value={def.type} />
      <input type="hidden" name="areaName" value={areaName} />

      <div className="field">
        <label className="field__label" htmlFor="sd-title">
          Nombre del documento *
        </label>
        <input id="sd-title" name="title" required maxLength={200} autoComplete="off" />
      </div>

      <div className="form-grid-2">
        <div className="field">
          <label className="field__label" htmlFor="sd-area">
            Área
          </label>
          <select
            id="sd-area"
            name="areaCode"
            value={areaCode}
            onChange={(e) => setAreaCode(e.target.value)}
          >
            <option value="">Sin área</option>
            {areas.map((a) => (
              <option key={a.code ?? a.name} value={a.code ?? ''}>
                {a.code ? `${a.code} · ${a.name}` : a.name}
              </option>
            ))}
          </select>
          <p className="field__help">
            Las áreas se toman del catálogo de calidad. El código de área forma parte del código del
            documento.
          </p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="sd-code">
            Código {customCode ? '*' : '(propuesto)'}
          </label>
          <input
            id="sd-code"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            readOnly={!customCode}
            aria-readonly={!customCode}
            maxLength={40}
          />
          <label className="field__inline">
            <input
              type="checkbox"
              name="codeIsCustom"
              checked={customCode}
              onChange={(e) => setCustomCode(e.target.checked)}
            />
            Personalizar código
          </label>
          <p className="field__help">
            Puedes editar el código antes de publicar. Debe ser único en la organización.
          </p>
        </div>
      </div>

      <div className="form-grid-2">
        <div className="field">
          <label className="field__label" htmlFor="sd-responsible">
            Responsable
          </label>
          <select id="sd-responsible" name="responsibleUserId" defaultValue="">
            <option value="">Yo (creador)</option>
            {responsibles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="sd-site">
            Sitio
          </label>
          <select id="sd-site" name="siteId" defaultValue="">
            <option value="">Sin sitio</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-grid-2">
        <div className="field">
          <label className="field__label" htmlFor="sd-issued">
            Fecha de emisión
          </label>
          <input id="sd-issued" name="issuedAt" type="date" />
          <p className="field__help">Opcional. Por defecto se fija al aprobar/publicar.</p>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="sd-period">
            Periodo de revisión
          </label>
          <select id="sd-period" name="reviewPeriod" defaultValue={defaultPeriod}>
            {REVIEW_PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="field__help">La próxima revisión se calcula desde la emisión.</p>
        </div>
      </div>

      <div className="form-actions">
        <SubmitButton pendingLabel="Creando…">Crear y continuar al contenido</SubmitButton>
      </div>
    </form>
  );
}

/** Documento libre: crea un documento interno con editor enriquecido. */
function FreeIdentification({ documentType }: { documentType: string }) {
  const [state, action] = useActionState<FormState | null, FormData>(
    createEditorDocumentAction,
    null,
  );
  return (
    <form action={action} className="doc-form">
      <ErrorBox state={state} />
      <input type="hidden" name="documentType" value={documentType} />
      <input type="hidden" name="templateKey" value="free" />
      <div className="form-grid-2">
        <div className="field">
          <label className="field__label" htmlFor="free-code">
            Código *
          </label>
          <input id="free-code" name="code" required maxLength={40} autoComplete="off" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="free-title">
            Título *
          </label>
          <input id="free-title" name="title" required maxLength={200} autoComplete="off" />
        </div>
      </div>
      <p className="field__help">
        El documento libre usa el editor enriquecido sin estructura fija.
      </p>
      <div className="form-actions">
        <SubmitButton pendingLabel="Creando…">Crear y editar</SubmitButton>
      </div>
    </form>
  );
}
