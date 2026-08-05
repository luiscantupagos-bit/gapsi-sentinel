'use client';

import { AnalysisActionForm } from './AnalysisActionForm';
import type { AnalysisStatus } from '@/features/capa/analysis-state';
import {
  addAnalysisCommentAction,
  addParticipantAction,
  createActionFromAnalysisAction,
  generateParetoAction,
  newVersionAction,
  saveConclusionAction,
  sendRootCauseAction,
  setParetoAction,
  transitionAnalysisAction,
  uploadAnalysisEvidenceAction,
} from '../analysis-actions';

type Member = { id: string; name: string };
type Base = { capaId: string; analysisId: string };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}

/** Panel de estado / flujo del análisis (mismos botones y permisos). */
export function AnalysisStatusPanel({
  capaId,
  analysisId,
  status,
  canEdit,
  canReview,
  isAdmin,
}: Base & { status: AnalysisStatus; canEdit: boolean; canReview: boolean; isAdmin: boolean }) {
  const base = { capaId, analysisId };
  return (
    <div className="step-actions">
      {canEdit && status === 'draft' && (
        <AnalysisActionForm
          action={transitionAnalysisAction}
          hidden={{ ...base, to: 'in_progress' }}
          button="Iniciar desarrollo"
          variant="primary"
        />
      )}
      {canEdit && status === 'in_progress' && (
        <AnalysisActionForm
          action={transitionAnalysisAction}
          hidden={{ ...base, to: 'under_review' }}
          button="Enviar a revisión"
          variant="primary"
        />
      )}
      {canEdit && status === 'changes_requested' && (
        <AnalysisActionForm
          action={transitionAnalysisAction}
          hidden={{ ...base, to: 'in_progress' }}
          button="Reanudar edición"
        />
      )}
      {status === 'under_review' && canReview && (
        <>
          <AnalysisActionForm
            action={transitionAnalysisAction}
            hidden={{ ...base, to: 'approved' }}
            button="Aprobar"
            variant="primary"
          />
          <AnalysisActionForm
            action={transitionAnalysisAction}
            hidden={{ ...base, to: 'changes_requested' }}
            button="Solicitar cambios"
          >
            <Field label="¿Qué se debe cambiar?">
              <input name="comment" placeholder="Indica los cambios" required />
            </Field>
          </AnalysisActionForm>
        </>
      )}
      {status !== 'approved' && status !== 'cancelled' && isAdmin && (
        <AnalysisActionForm
          action={transitionAnalysisAction}
          hidden={{ ...base, to: 'cancelled' }}
          button="Cancelar análisis"
        >
          <Field label="Motivo">
            <input name="comment" placeholder="Motivo de la cancelación" />
          </Field>
        </AnalysisActionForm>
      )}
      {status === 'approved' && (
        <>
          <AnalysisActionForm
            action={newVersionAction}
            hidden={base}
            button="Crear nueva versión"
          />
          <AnalysisActionForm
            action={sendRootCauseAction}
            hidden={base}
            button="Enviar causa raíz a la CAPA"
            variant="primary"
          />
        </>
      )}
      {!canEdit && status !== 'approved' && (
        <p className="muted">
          Este análisis no es editable en su estado actual o no tienes permiso.
        </p>
      )}
    </div>
  );
}

/** Panel de equipo (agregar participante). */
export function AnalysisTeamPanel({ capaId, analysisId, members }: Base & { members: Member[] }) {
  return (
    <AnalysisActionForm
      action={addParticipantAction}
      hidden={{ capaId, analysisId }}
      button="Agregar"
    >
      <Field label="Participante">
        <select name="userId" required defaultValue="">
          <option value="" disabled>
            Selecciona…
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>
    </AnalysisActionForm>
  );
}

/** Captura de datos del Pareto (generar desde CAPA + rejilla + guardar). */
export function ParetoDataForm({
  capaId,
  analysisId,
  items,
}: Base & { items: { category: string; count: number }[] }) {
  const base = { capaId, analysisId };
  return (
    <div className="pareto-capture">
      <AnalysisActionForm
        action={generateParetoAction}
        hidden={base}
        button="Generar desde CAPA"
        className="wf-form pareto-capture__gen"
      >
        <Field label="Agrupar CAPA por">
          <select name="dimension" defaultValue="sourceType">
            <option value="sourceType">Tipo</option>
            <option value="severity">Severidad</option>
            <option value="priority">Prioridad</option>
            <option value="area">Área</option>
            <option value="process">Proceso</option>
          </select>
        </Field>
      </AnalysisActionForm>
      <AnalysisActionForm
        action={setParetoAction}
        hidden={base}
        button="Guardar datos"
        variant="primary"
        className="wf-form pareto-capture__form"
      >
        <div className="pareto-capture__grid">
          {Array.from({ length: 8 }).map((_, i) => {
            const item = items[i];
            return (
              <div key={i} className="pareto-capture__cell">
                <input
                  name="category"
                  aria-label={`Categoría ${i + 1}`}
                  placeholder={`Categoría ${i + 1}`}
                  defaultValue={item?.category ?? ''}
                />
                <input
                  name="count"
                  type="number"
                  min={0}
                  aria-label={`Cantidad ${i + 1}`}
                  placeholder="Cant."
                  defaultValue={item ? String(item.count) : ''}
                />
              </div>
            );
          })}
        </div>
      </AnalysisActionForm>
    </div>
  );
}

const CONCLUSION_FIELDS: [string, string, boolean][] = [
  ['summary', 'Resumen', true],
  ['immediateCause', 'Causa inmediata', false],
  ['contributingCauses', 'Causas contribuyentes', false],
  ['proposedRootCause', 'Causa raíz propuesta', false],
  ['confirmedRootCause', 'Causa raíz confirmada', false],
  ['mainEvidence', 'Evidencia principal', false],
  ['contradictoryEvidence', 'Evidencia contradictoria', false],
  ['limitations', 'Limitaciones', false],
  ['recurrenceRisk', 'Riesgo de recurrencia', false],
  ['recommendations', 'Recomendaciones', true],
];

/** Formulario de conclusión (rejilla; resumen y recomendaciones a ancho completo). */
export function ConclusionForm({
  capaId,
  analysisId,
  conclusion,
}: Base & { conclusion: Record<string, string | null> | null }) {
  const v = (k: string) => conclusion?.[k] ?? '';
  return (
    <AnalysisActionForm
      action={saveConclusionAction}
      hidden={{ capaId, analysisId }}
      button="Guardar conclusión"
      variant="primary"
      className="doc-form conclusion-form"
    >
      {CONCLUSION_FIELDS.map(([name, label, full]) =>
        full ? (
          <label key={name} className="field conclusion-form__full">
            <span className="field__label">{label}</span>
            <textarea name={name} defaultValue={v(name)} rows={2} />
          </label>
        ) : null,
      )}
      <div className="conclusion-form__grid">
        {CONCLUSION_FIELDS.filter(([, , full]) => !full).map(([name, label]) => (
          <label key={name} className="field">
            <span className="field__label">{label}</span>
            <input name={name} defaultValue={v(name)} />
          </label>
        ))}
      </div>
    </AnalysisActionForm>
  );
}

/** Convertir un hallazgo en acción CAPA (compacto). */
export function CapaActionForm({ capaId, analysisId }: Base) {
  return (
    <AnalysisActionForm
      action={createActionFromAnalysisAction}
      hidden={{ capaId, analysisId, sourceEntity: 'conclusion' }}
      button="Crear acción CAPA"
      variant="primary"
    >
      <Field label="Descripción de la acción">
        <input name="description" placeholder="Qué se hará" required />
      </Field>
      <Field label="Prioridad">
        <select name="priority" defaultValue="normal">
          <option value="low">Baja</option>
          <option value="normal">Normal</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
      </Field>
    </AnalysisActionForm>
  );
}

/** Adjuntar evidencia. */
export function EvidenceForm({ capaId, analysisId }: Base) {
  return (
    <AnalysisActionForm
      action={uploadAnalysisEvidenceAction}
      hidden={{ capaId, analysisId, entityType: 'analysis' }}
      button="Adjuntar evidencia"
      encType="multipart/form-data"
    >
      <Field label="Archivo">
        <input type="file" name="file" required />
      </Field>
    </AnalysisActionForm>
  );
}

/** Agregar comentario. */
export function CommentForm({ capaId, analysisId }: Base) {
  return (
    <AnalysisActionForm
      action={addAnalysisCommentAction}
      hidden={{ capaId, analysisId }}
      button="Comentar"
    >
      <Field label="Comentario">
        <input name="body" placeholder="Escribe un comentario" required />
      </Field>
    </AnalysisActionForm>
  );
}
