'use client';

/**
 * HACCP-005 — pestaña «Validación». Sub-vistas Pendientes / En proceso / Satisfactorias /
 * Revisión requerida / Todas. Formulario de validación con contexto del control (no editable
 * desde aquí), evidencia (resumen + documento Sentinel), resultado y conclusión. El status se
 * deriva del resultado + requisitos (server-side). Publicado = read-only.
 */
import { useActionState, useState, type ReactNode } from 'react';
import {
  HACCP_VALIDATION_METHODS,
  HACCP_VALIDATION_METHOD_LABEL,
} from '@/features/haccp/haccp-validation';
import type { getValidations } from '@/server/haccp-validation';
import { SubmitButton } from '../../../documents/_components/SubmitButton';
import { removeValidationAction, saveValidationAction, type FormState } from '../../actions';
import { HaccpValidationView, type ValidationView } from './HaccpValidationView';

type ValidationData = NonNullable<Awaited<ReturnType<typeof getValidations>>>;
type Action = (prev: FormState | null, fd: FormData) => Promise<FormState>;
type Sub = 'pendientes' | 'proceso' | 'satisfactorias' | 'revision' | 'todas';

function ActionForm({
  action,
  hidden,
  button,
  children,
  variant = 'ghost',
}: {
  action: Action;
  hidden: Record<string, string>;
  button: string;
  children?: ReactNode;
  variant?: 'primary' | 'ghost';
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(action, null);
  return (
    <form action={formAction} className="wf-form">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <SubmitButton variant={variant} pendingLabel="Procesando…">
        {button}
      </SubmitButton>
      {state && (
        <span role="status" className={state.ok ? 'msg msg--ok' : 'msg msg--error'}>
          {state.message}
          {state.errors?.length ? ` — ${state.errors.join(' ')}` : ''}
        </span>
      )}
    </form>
  );
}

function ValidationForm({
  planId,
  versionId,
  control,
  members,
  documents,
  existing,
}: {
  planId: string;
  versionId: string;
  control: ValidationData['controls'][number];
  members: { id: string; name: string }[];
  documents: { id: string; code: string; title: string }[];
  existing?: ValidationView;
}) {
  return (
    <ActionForm
      action={saveValidationAction}
      hidden={{
        planId,
        planVersionId: versionId,
        controlMeasureLogicalId: control.controlMeasureLogicalId,
      }}
      button="Guardar validación"
      variant="primary"
    >
      {/* §29 contexto visible (no editable). */}
      <div className="msg msg--info">
        <strong>{control.hazardName}</strong> · {control.classificationLabel} ·{' '}
        {control.sourceLabel}
        {control.controlMeasure ? ` · Medida: ${control.controlMeasure}` : ''}
        {control.classification === 'pcc' && control.criticalLimit
          ? ` · Límite crítico: ${control.criticalLimit}`
          : ''}
        {control.classification === 'ppro' && control.actionCriterion
          ? ` · Criterio de acción: ${control.actionCriterion}`
          : ''}
      </div>
      <label>
        Objetivo de validación
        <input name="objective" defaultValue={existing?.objective ?? ''} />
      </label>
      <label>
        Método
        <select name="methodType" defaultValue={existing?.methodType ?? ''}>
          <option value="">— Selecciona —</option>
          {HACCP_VALIDATION_METHODS.map((m) => (
            <option key={m} value={m}>
              {HACCP_VALIDATION_METHOD_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Descripción del método
        <input name="methodDescription" defaultValue={existing?.methodDescription ?? ''} />
      </label>
      <label>
        Fundamento técnico
        <textarea name="technicalBasis" rows={2} defaultValue={existing?.technicalBasis ?? ''} />
      </label>
      <label>
        Criterio de aceptación
        <input name="acceptanceCriteria" defaultValue={existing?.acceptanceCriteria ?? ''} />
      </label>
      <label>
        Evidencia (resumen)
        <textarea name="evidenceSummary" rows={2} defaultValue={existing?.evidenceSummary ?? ''} />
      </label>
      <label>
        Documento de evidencia (Sentinel)
        <select name="evidenceDocumentId" defaultValue={existing?.evidenceDocumentId ?? ''}>
          <option value="">— Sin documento —</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} · {d.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Fecha de realización
        <input type="date" name="performedAt" defaultValue={existing?.performedAtLabel ?? ''} />
      </label>
      <label>
        Realizado por (interno)
        <select name="performedByUserId" defaultValue="">
          <option value="">— Externo / sin asignar —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Realizado por (externo)
        <input name="performedByExternalName" placeholder="Laboratorio / consultor" />
      </label>
      <label>
        Revisado por
        <select name="reviewedByUserId" defaultValue="">
          <option value="">— Sin revisor —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Conclusión
        <textarea name="conclusion" rows={2} defaultValue={existing?.conclusion ?? ''} />
      </label>
      <label>
        Resultado
        <select name="result" defaultValue={existing?.result ?? ''}>
          <option value="">— Sin resultado —</option>
          <option value="satisfactory">Satisfactorio</option>
          <option value="unsatisfactory">No satisfactorio</option>
          <option value="inconclusive">No concluyente</option>
        </select>
      </label>
      <label>
        Próxima validación
        <input
          type="date"
          name="nextValidationAt"
          defaultValue={existing?.nextValidationAtLabel ?? ''}
        />
      </label>
    </ActionForm>
  );
}

export function HaccpValidationTab({
  planId,
  data,
  members,
  documents,
  canEdit,
}: {
  planId: string;
  data: ValidationData;
  members: { id: string; name: string }[];
  documents: { id: string; code: string; title: string }[];
  canEdit: boolean;
}) {
  const [sub, setSub] = useState<Sub>('pendientes');
  const editable = canEdit && data.version.editable;
  const c = data.completeness;
  const validationByMeasure = new Map(data.validations.map((v) => [v.controlMeasureLogicalId, v]));

  const filtered: ValidationView[] =
    sub === 'todas'
      ? data.validations
      : sub === 'proceso'
        ? data.validations.filter((v) => v.status === 'in_progress')
        : sub === 'satisfactorias'
          ? data.validations.filter((v) => v.status === 'satisfactory')
          : sub === 'revision'
            ? data.validations.filter((v) => v.needsReview)
            : [];

  return (
    <>
      <section className="haccp-cards">
        <div className="report-card">
          <h3>Por validar</h3>
          <p className="stat">{c.required}</p>
        </div>
        <div className="report-card">
          <h3>Satisfactorias</h3>
          <p className="stat">{c.satisfactory}</p>
        </div>
        <div className="report-card">
          <h3>Pendientes</h3>
          <p className="stat">{c.pending}</p>
        </div>
        <div className="report-card">
          <h3>Revisión requerida</h3>
          <p className="stat">{c.needsReview}</p>
        </div>
      </section>
      <p className="muted doc-panel__hint">
        La validación demuestra que la medida ES CAPAZ de controlar el peligro (distinta de la
        verificación, que confirma su ejecución — HACCP-006).
      </p>

      <div className="doc-panel__tablist" role="tablist" aria-label="Validación">
        {(['pendientes', 'proceso', 'satisfactorias', 'revision', 'todas'] as Sub[]).map(
          (sName) => (
            <button
              key={sName}
              type="button"
              role="tab"
              aria-selected={sub === sName}
              className={`doc-panel__tab${sub === sName ? ' is-active' : ''}`}
              onClick={() => setSub(sName)}
            >
              {sName === 'pendientes'
                ? 'Pendientes'
                : sName === 'proceso'
                  ? 'En proceso'
                  : sName === 'satisfactorias'
                    ? 'Satisfactorias'
                    : sName === 'revision'
                      ? 'Revisión requerida'
                      : 'Todas'}
            </button>
          ),
        )}
      </div>

      {sub === 'pendientes' && (
        <>
          {data.pending.length === 0 ? (
            <p className="empty-state empty-state--compact">
              No hay medidas de control pendientes de validación.
            </p>
          ) : (
            data.pending.map((ctrl) => {
              const existing = validationByMeasure.get(ctrl.controlMeasureLogicalId);
              return (
                <div key={ctrl.controlMeasureLogicalId} className="haccp-pending">
                  <p>
                    <strong>{ctrl.hazardName}</strong> · {ctrl.classificationLabel} ·{' '}
                    {ctrl.sourceLabel}
                    {existing ? ` · ${existing.statusLabel}` : ' · Pendiente'}
                  </p>
                  {editable ? (
                    <details>
                      <summary className="button button--ghost">Validar medida</summary>
                      <ValidationForm
                        planId={planId}
                        versionId={data.version.id}
                        control={ctrl}
                        members={members}
                        documents={documents}
                        existing={existing}
                      />
                    </details>
                  ) : (
                    <span className="badge badge--warn">Pendiente</span>
                  )}
                </div>
              );
            })
          )}
        </>
      )}

      {sub !== 'pendientes' && (
        <>
          <HaccpValidationView
            validations={filtered}
            emptyLabel="Sin validaciones en esta categoría."
          />
          {editable &&
            filtered.map((v) => (
              <ActionForm
                key={v.id}
                action={removeValidationAction}
                hidden={{ planId, validationId: v.id }}
                button="Eliminar validación"
              />
            ))}
        </>
      )}
    </>
  );
}
