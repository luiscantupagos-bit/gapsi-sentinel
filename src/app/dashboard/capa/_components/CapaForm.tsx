'use client';

import { useActionState } from 'react';
import { SubmitButton } from '../../documents/_components/SubmitButton';
import {
  CAPA_IMPACTS,
  CAPA_IMPACT_LABEL,
  CAPA_PRIORITIES,
  CAPA_PRIORITY_LABEL,
  CAPA_SCOPES,
  CAPA_SCOPE_LABEL,
  CAPA_SEVERITIES,
  CAPA_SEVERITY_LABEL,
  CAPA_SOURCE_TYPES,
  CAPA_SOURCE_TYPE_LABEL,
} from '@/features/capa/capa-state';
import type { FormState } from '../capa-actions';

type Action = (prev: FormState | null, fd: FormData) => Promise<FormState>;

export interface CapaFormValues {
  id?: string;
  title: string;
  description: string;
  sourceType: string;
  siteId: string | null;
  area: string | null;
  process: string | null;
  product: string | null;
  diagnosticId: string | null;
  documentId: string | null;
  requirementId: string | null;
  externalReference: string | null;
  detectedAt: string | null;
  responsibleUserId: string | null;
  priority: string;
  severity: string;
  scope: string;
  impacts: string[];
  tags: string[];
  targetDate: string | null;
  problemWhat: string | null;
  problemWhere: string | null;
  problemWhen: string | null;
  problemWhoDetect: string | null;
  problemWhoAffect: string | null;
  problemHowMuch: string | null;
  problemHow: string | null;
  conditionObserved: string | null;
  requirementBreached: string | null;
  objectiveEvidence: string | null;
  knownScope: string | null;
  knownRecurrence: string | null;
  relatedRefs: string | null;
}

interface Options {
  members: { id: string; name: string }[];
  sites: { id: string; name: string }[];
  diagnostics: { id: string; name: string }[];
  documents: { id: string; code: string; title: string }[];
}

const v = (x: string | null | undefined) => x ?? '';

export function CapaForm({
  action,
  options,
  values,
  mode,
}: {
  action: Action;
  options: Options;
  values?: Partial<CapaFormValues>;
  mode: 'create' | 'edit';
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(action, null);
  const d = values ?? {};

  return (
    <form action={formAction} className="doc-form">
      {d.id && <input type="hidden" name="capaId" value={d.id} />}

      <h2>Identificación</h2>
      <label className="doc-form__full">
        Título *
        <input name="title" defaultValue={v(d.title)} required maxLength={200} />
      </label>
      <label className="doc-form__full">
        Descripción detallada *
        <textarea name="description" defaultValue={v(d.description)} required rows={3} />
      </label>
      <div className="form-grid">
        <label>
          Tipo / origen *
          <select name="sourceType" defaultValue={v(d.sourceType) || 'internal_nc'}>
            {CAPA_SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {CAPA_SOURCE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fecha de detección
          <input type="date" name="detectedAt" defaultValue={v(d.detectedAt)} />
        </label>
        <label>
          Responsable
          <select name="responsibleUserId" defaultValue={v(d.responsibleUserId)}>
            <option value="">— Sin asignar —</option>
            {options.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fecha objetivo
          <input type="date" name="targetDate" defaultValue={v(d.targetDate)} />
        </label>
        <label>
          Área
          <input name="area" defaultValue={v(d.area)} />
        </label>
        <label>
          Proceso
          <input name="process" defaultValue={v(d.process)} />
        </label>
        <label>
          Producto
          <input name="product" defaultValue={v(d.product)} />
        </label>
        <label>
          Etiquetas (separadas por coma)
          <input name="tags" defaultValue={(d.tags ?? []).join(', ')} />
        </label>
      </div>

      <h2>Clasificación</h2>
      <div className="form-grid">
        <label>
          Severidad
          <select name="severity" defaultValue={v(d.severity) || 'medium'}>
            {CAPA_SEVERITIES.map((x) => (
              <option key={x} value={x}>
                {CAPA_SEVERITY_LABEL[x]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prioridad
          <select name="priority" defaultValue={v(d.priority) || 'normal'}>
            {CAPA_PRIORITIES.map((x) => (
              <option key={x} value={x}>
                {CAPA_PRIORITY_LABEL[x]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Alcance
          <select name="scope" defaultValue={v(d.scope) || 'point'}>
            {CAPA_SCOPES.map((x) => (
              <option key={x} value={x}>
                {CAPA_SCOPE_LABEL[x]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="capa-impacts">
        <legend>Impacto (uno o varios)</legend>
        {CAPA_IMPACTS.map((x) => (
          <label key={x} className="props-check">
            <input
              type="checkbox"
              name="impacts"
              value={x}
              defaultChecked={(d.impacts ?? []).includes(x)}
            />{' '}
            {CAPA_IMPACT_LABEL[x]}
          </label>
        ))}
      </fieldset>

      <h2>Fuentes y relaciones (opcionales)</h2>
      <div className="form-grid">
        <label>
          Sitio / planta
          <select name="siteId" defaultValue={v(d.siteId)}>
            <option value="">—</option>
            {options.sites.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Diagnóstico
          <select name="diagnosticId" defaultValue={v(d.diagnosticId)}>
            <option value="">—</option>
            {options.diagnostics.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Documento
          <select name="documentId" defaultValue={v(d.documentId)}>
            <option value="">—</option>
            {options.documents.map((x) => (
              <option key={x.id} value={x.id}>
                {x.code} · {x.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Referencia externa
          <input name="externalReference" defaultValue={v(d.externalReference)} />
        </label>
      </div>

      <details className="props-panel">
        <summary>Descripción estructurada del problema (5W2H)</summary>
        <div className="props-grid">
          <label>
            ¿Qué ocurrió?
            <textarea name="problemWhat" defaultValue={v(d.problemWhat)} rows={2} />
          </label>
          <label>
            ¿Dónde ocurrió?
            <input name="problemWhere" defaultValue={v(d.problemWhere)} />
          </label>
          <label>
            ¿Cuándo ocurrió?
            <input name="problemWhen" defaultValue={v(d.problemWhen)} />
          </label>
          <label>
            ¿Quién detectó?
            <input name="problemWhoDetect" defaultValue={v(d.problemWhoDetect)} />
          </label>
          <label>
            ¿A quién afecta?
            <input name="problemWhoAffect" defaultValue={v(d.problemWhoAffect)} />
          </label>
          <label>
            ¿Cuánto / cuántas veces?
            <input name="problemHowMuch" defaultValue={v(d.problemHowMuch)} />
          </label>
          <label>
            ¿Cómo se detectó?
            <input name="problemHow" defaultValue={v(d.problemHow)} />
          </label>
          <label>
            Condición observada
            <textarea name="conditionObserved" defaultValue={v(d.conditionObserved)} rows={2} />
          </label>
          <label>
            Requisito incumplido
            <input name="requirementBreached" defaultValue={v(d.requirementBreached)} />
          </label>
          <label>
            Evidencia objetiva
            <textarea name="objectiveEvidence" defaultValue={v(d.objectiveEvidence)} rows={2} />
          </label>
          <label>
            Alcance conocido
            <input name="knownScope" defaultValue={v(d.knownScope)} />
          </label>
          <label>
            Recurrencia conocida
            <input name="knownRecurrence" defaultValue={v(d.knownRecurrence)} />
          </label>
          <label>
            Lotes / fechas / referencias
            <input name="relatedRefs" defaultValue={v(d.relatedRefs)} />
          </label>
        </div>
      </details>

      <div className="form-actions">
        <SubmitButton pendingLabel="Guardando…">
          {mode === 'create' ? 'Registrar CAPA' : 'Guardar cambios'}
        </SubmitButton>
        {state && !state.ok && (
          <span role="status" className="msg msg--error">
            {state.message}
            {state.errors && state.errors.length > 0 ? ` — ${state.errors.join(' ')}` : ''}
          </span>
        )}
      </div>
    </form>
  );
}
