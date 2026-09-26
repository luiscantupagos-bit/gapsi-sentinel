'use client';

/**
 * DOC-004 — captura de un REGISTRO. Renderiza el esquema del formato (versión exacta) con
 * validación de visibilidad condicional (§15) y tablas repetibles (§11/§44). Tablet-first,
 * targets táctiles grandes (§42). Guarda borrador y envía; los datos viajan como JSON en un
 * campo oculto. Publicado/cerrado = solo lectura (RecordReadOnlyView). El estado del workflow
 * (revisar/cerrar/cancelar/devolver) se opera con acciones dedicadas.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useActionState } from 'react';
import {
  isFieldVisible,
  NUMERIC_KINDS,
  type FormSchema,
  type FormField,
  type FormSection,
  type RecordData,
} from '@/features/records/form-schema';
import { SubmitButton } from '../../../documents/_components/SubmitButton';
import {
  cancelRecordAction,
  closeRecordAction,
  reopenRecordAction,
  reviewRecordAction,
  saveRecordDataAction,
  submitRecordAction,
  type FormState,
} from '../../actions';

type Scalar = string | number | boolean | string[] | undefined;
type Values = Record<string, Scalar>;
type Rows = Record<string, Array<Record<string, Scalar>>>;
type Action = (prev: FormState | null, fd: FormData) => Promise<FormState>;

function Field({
  field,
  value,
  onChange,
  members,
}: {
  field: FormField;
  value: Scalar;
  onChange: (v: Scalar) => void;
  members: { id: string; name: string }[];
}) {
  const name = `f_${field.id}`;
  const common = { id: name, name, 'aria-label': field.label };
  switch (field.kind) {
    case 'textarea':
      return (
        <textarea
          {...common}
          rows={3}
          value={(value as string) ?? ''}
          maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'number':
    case 'decimal':
      return (
        <input
          {...common}
          type="number"
          inputMode={field.kind === 'decimal' ? 'decimal' : 'numeric'}
          step={field.kind === 'decimal' ? Math.pow(10, -(field.decimals ?? 2)) : 1}
          min={field.min}
          max={field.max}
          value={value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      );
    case 'date':
      return (
        <input
          {...common}
          type="date"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'datetime':
      return (
        <input
          {...common}
          type="datetime-local"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'time':
      return (
        <input
          {...common}
          type="time"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'boolean':
    case 'checkbox':
    case 'signature':
      return (
        <label className="record-check">
          <input
            type="checkbox"
            name={name}
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{field.kind === 'signature' ? 'Confirmo (firma electrónica)' : 'Sí'}</span>
        </label>
      );
    case 'select':
      return (
        <select
          {...common}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— Selecciona —</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'multiselect': {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="record-multiselect">
          {field.options?.map((o) => (
            <label key={o.value} className="record-check">
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, o.value]
                      : selected.filter((v) => v !== o.value),
                  )
                }
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    }
    case 'user':
      return (
        <select
          {...common}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— Selecciona —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      );
    case 'photo':
    case 'file':
      // Captura compatible con cámara de tablet (§29); la referencia del archivo se guarda
      // como valor. La persistencia del binario en stored_files es un follow-up acotado.
      return (
        <div className="record-file">
          <input
            type="file"
            accept={field.kind === 'photo' ? 'image/*' : undefined}
            capture={field.kind === 'photo' ? 'environment' : undefined}
            onChange={(e) => onChange(e.target.files?.[0]?.name ?? undefined)}
          />
          <input
            type="text"
            placeholder="Referencia / nombre de la evidencia"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    default:
      return (
        <input
          {...common}
          type="text"
          value={(value as string) ?? ''}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

function FieldRow({
  field,
  value,
  onChange,
  members,
}: {
  field: FormField;
  value: Scalar;
  onChange: (v: Scalar) => void;
  members: { id: string; name: string }[];
}) {
  return (
    <label className="record-field">
      <span className="record-field__label">
        {field.label}
        {field.required && <span className="record-field__req"> *</span>}
        {field.unit && !NUMERIC_KINDS.has(field.kind) ? ` (${field.unit})` : ''}
      </span>
      <Field field={field} value={value} onChange={onChange} members={members} />
      {field.help && <span className="record-field__help">{field.help}</span>}
    </label>
  );
}

function RepeatableSection({
  section,
  rows,
  setRows,
  members,
}: {
  section: FormSection;
  rows: Array<Record<string, Scalar>>;
  setRows: (rows: Array<Record<string, Scalar>>) => void;
  members: { id: string; name: string }[];
}) {
  const addRow = () => setRows([...rows, {}]);
  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i));
  const dupRow = (i: number) =>
    setRows([...rows.slice(0, i + 1), { ...rows[i] }, ...rows.slice(i + 1)]);
  const setCell = (i: number, fieldId: string, v: Scalar) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, [fieldId]: v } : r)));

  return (
    <div className="record-repeat">
      {rows.length === 0 && <p className="empty-state empty-state--compact">Sin filas.</p>}
      {rows.map((row, i) => (
        <fieldset key={i} className="record-repeat__row">
          <legend>Fila {i + 1}</legend>
          {section.fields.map((field) =>
            isFieldVisible(field, row) ? (
              <FieldRow
                key={field.id}
                field={field}
                value={row[field.id]}
                onChange={(v) => setCell(i, field.id, v)}
                members={members}
              />
            ) : null,
          )}
          <div className="record-repeat__rowactions">
            <button type="button" className="button button--ghost" onClick={() => dupRow(i)}>
              Duplicar fila
            </button>
            <button type="button" className="button button--ghost" onClick={() => removeRow(i)}>
              Eliminar fila
            </button>
          </div>
        </fieldset>
      ))}
      <button type="button" className="button button--ghost" onClick={addRow}>
        Agregar fila
      </button>
    </div>
  );
}

function DataForm({
  action,
  recordId,
  data,
  button,
  variant = 'ghost',
}: {
  action: Action;
  recordId: string;
  data: RecordData;
  button: string;
  variant?: 'primary' | 'ghost';
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(action, null);
  return (
    <form action={formAction} className="wf-form record-actionform">
      <input type="hidden" name="recordId" value={recordId} />
      <input type="hidden" name="data" value={JSON.stringify(data)} />
      <SubmitButton variant={variant} pendingLabel="Procesando…">
        {button}
      </SubmitButton>
      {state && (
        <div role="status" className={state.ok ? 'msg msg--ok' : 'msg msg--error'}>
          {state.message}
          {state.errors?.length ? (
            <ul className="record-errors">
              {state.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </form>
  );
}

function WorkflowForm({
  action,
  recordId,
  button,
}: {
  action: Action;
  recordId: string;
  button: string;
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(action, null);
  return (
    <form action={formAction} className="wf-form record-actionform">
      <input type="hidden" name="recordId" value={recordId} />
      <SubmitButton variant="ghost" pendingLabel="Procesando…">
        {button}
      </SubmitButton>
      {state && !state.ok && <span className="msg msg--error">{state.message}</span>}
    </form>
  );
}

export function RecordForm({
  recordId,
  schema,
  initialData,
  status,
  editable,
  canReview,
  members,
  readOnlySlot,
}: {
  recordId: string;
  schema: FormSchema;
  initialData: RecordData;
  status: string;
  editable: boolean;
  canReview: boolean;
  members: { id: string; name: string }[];
  readOnlySlot: ReactNode;
}) {
  const [values, setValues] = useState<Values>((initialData.values as Values) ?? {});
  const [rows, setRows] = useState<Rows>((initialData.rows as Rows) ?? {});

  const data: RecordData = useMemo(() => ({ values, rows }), [values, rows]);
  const setValue = (id: string, v: Scalar) => setValues((prev) => ({ ...prev, [id]: v }));

  return (
    <>
      {editable ? (
        <div className="record-form">
          {schema.sections.map((section) => (
            <section key={section.id} className="record-form__section">
              <h3>{section.title}</h3>
              {section.description && <p className="muted">{section.description}</p>}
              {section.repeatable ? (
                <RepeatableSection
                  section={section}
                  rows={rows[section.id] ?? []}
                  setRows={(r) => setRows((prev) => ({ ...prev, [section.id]: r }))}
                  members={members}
                />
              ) : (
                section.fields.map((field) =>
                  isFieldVisible(field, values) ? (
                    <FieldRow
                      key={field.id}
                      field={field}
                      value={values[field.id]}
                      onChange={(v) => setValue(field.id, v)}
                      members={members}
                    />
                  ) : null,
                )
              )}
            </section>
          ))}
          <div className="record-form__actions">
            <DataForm
              action={saveRecordDataAction}
              recordId={recordId}
              data={data}
              button="Guardar borrador"
            />
            <DataForm
              action={submitRecordAction}
              recordId={recordId}
              data={data}
              button="Enviar registro"
              variant="primary"
            />
          </div>
        </div>
      ) : (
        readOnlySlot
      )}

      {/* Workflow: revisar / cerrar / devolver (revisor) y cancelar. */}
      <div className="record-workflow">
        {status === 'submitted' && canReview && (
          <>
            <WorkflowForm
              action={reviewRecordAction}
              recordId={recordId}
              button="Marcar como revisado"
            />
            <WorkflowForm action={closeRecordAction} recordId={recordId} button="Cerrar registro" />
            <WorkflowForm
              action={reopenRecordAction}
              recordId={recordId}
              button="Devolver a proceso"
            />
          </>
        )}
        {status === 'reviewed' && canReview && (
          <>
            <WorkflowForm action={closeRecordAction} recordId={recordId} button="Cerrar registro" />
            <WorkflowForm
              action={reopenRecordAction}
              recordId={recordId}
              button="Devolver a proceso"
            />
          </>
        )}
        {(status === 'draft' || status === 'in_progress' || status === 'submitted') && (
          <WorkflowForm
            action={cancelRecordAction}
            recordId={recordId}
            button="Cancelar registro"
          />
        )}
      </div>
    </>
  );
}
