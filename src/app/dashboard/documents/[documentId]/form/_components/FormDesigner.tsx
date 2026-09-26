'use client';

/**
 * DOC-004 — diseñador de formulario (cliente). Agregar/editar/eliminar/reordenar/duplicar
 * secciones y campos (§17/§18), con propiedades por tipo (opciones, rango, obligatorio,
 * visibilidad condicional) y vista previa (§19). El id LÓGICO de cada campo/sección es estable
 * (§12): se conserva al editar el label. Guarda el esquema completo como JSON.
 */
import { useActionState, useMemo, useState } from 'react';
import {
  FIELD_KINDS,
  FIELD_KIND_LABEL,
  OPTION_KINDS,
  NUMERIC_KINDS,
  sanitizeFormSchema,
  validateFormSchema,
  type FormSchema,
  type FormSection,
  type FormField,
  type FieldKind,
} from '@/features/records/form-schema';
import { SubmitButton } from '../../../_components/SubmitButton';
import { saveFormSchemaAction, type FormState } from '../../../../records/actions';

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  const rand = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? String(Date.now());
  return `${prefix}_${rand}_${counter}`;
}

function emptyField(): FormField {
  return { id: newId('field'), label: 'Nuevo campo', kind: 'text', required: false };
}
function emptySection(): FormSection {
  return { id: newId('section'), title: 'Nueva sección', repeatable: false, fields: [] };
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length || from < 0 || from >= arr.length) return arr;
  const copy = [...arr];
  const item = copy[from]!;
  copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function FieldEditor({
  section,
  field,
  index,
  count,
  onChange,
  onMove,
  onDelete,
  onDuplicate,
  siblingFields,
}: {
  section: FormSection;
  field: FormField;
  index: number;
  count: number;
  onChange: (f: FormField) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  siblingFields: FormField[];
}) {
  const set = (patch: Partial<FormField>) => onChange({ ...field, ...patch });
  return (
    <div className="fd-field">
      <div className="fd-field__row">
        <label className="fd-grow">
          Etiqueta
          <input value={field.label} onChange={(e) => set({ label: e.target.value })} />
        </label>
        <label>
          Tipo
          <select
            value={field.kind}
            onChange={(e) => set({ kind: e.target.value as FieldKind, options: undefined })}
          >
            {FIELD_KINDS.map((k) => (
              <option key={k} value={k}>
                {FIELD_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="fd-check">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => set({ required: e.target.checked })}
          />
          Obligatorio
        </label>
      </div>

      {OPTION_KINDS.has(field.kind) && (
        <label>
          Opciones (una por línea)
          <textarea
            rows={2}
            value={(field.options ?? []).map((o) => o.label).join('\n')}
            onChange={(e) =>
              set({
                options: e.target.value
                  .split('\n')
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .map((l) => ({ value: l, label: l })),
              })
            }
          />
        </label>
      )}

      {NUMERIC_KINDS.has(field.kind) && (
        <div className="fd-field__row">
          <label>
            Mínimo
            <input
              type="number"
              value={field.min ?? ''}
              onChange={(e) =>
                set({ min: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
          </label>
          <label>
            Máximo
            <input
              type="number"
              value={field.max ?? ''}
              onChange={(e) =>
                set({ max: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
          </label>
          {field.kind === 'decimal' && (
            <label>
              Decimales
              <input
                type="number"
                min={0}
                max={6}
                value={field.decimals ?? 2}
                onChange={(e) => set({ decimals: Number(e.target.value) })}
              />
            </label>
          )}
          <label className="fd-grow">
            Unidad
            <input
              value={field.unit ?? ''}
              onChange={(e) => set({ unit: e.target.value || undefined })}
            />
          </label>
        </div>
      )}

      <div className="fd-field__row">
        <label className="fd-grow">
          Ayuda
          <input
            value={field.help ?? ''}
            onChange={(e) => set({ help: e.target.value || undefined })}
          />
        </label>
        <label className="fd-grow">
          Visible si (campo)
          <select
            value={field.visibleWhen?.fieldId ?? ''}
            onChange={(e) =>
              set({
                visibleWhen: e.target.value
                  ? { fieldId: e.target.value, equals: field.visibleWhen?.equals ?? '' }
                  : undefined,
              })
            }
          >
            <option value="">— Siempre —</option>
            {siblingFields
              .filter((f) => f.id !== field.id)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
          </select>
        </label>
        {field.visibleWhen && (
          <label className="fd-grow">
            … es igual a
            <input
              value={field.visibleWhen.equals}
              onChange={(e) =>
                set({
                  visibleWhen: { fieldId: field.visibleWhen!.fieldId, equals: e.target.value },
                })
              }
            />
          </label>
        )}
      </div>

      <div className="fd-field__actions">
        <span className="muted">
          {section.title} · campo {index + 1}/{count}
        </span>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => onMove(-1)}
          aria-label="Subir campo"
        >
          ↑
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => onMove(1)}
          aria-label="Bajar campo"
        >
          ↓
        </button>
        <button type="button" className="button button--ghost" onClick={onDuplicate}>
          Duplicar
        </button>
        <button type="button" className="button button--ghost" onClick={onDelete}>
          Eliminar
        </button>
      </div>
    </div>
  );
}

export function FormDesigner({
  documentId,
  documentVersionId,
  initialSchema,
  editable,
}: {
  documentId: string;
  documentVersionId: string;
  initialSchema: FormSchema;
  editable: boolean;
}) {
  const [schema, setSchema] = useState<FormSchema>(initialSchema);
  const [preview, setPreview] = useState(false);
  const [state, action] = useActionState<FormState | null, FormData>(saveFormSchemaAction, null);

  const designErrors = useMemo(() => validateFormSchema(sanitizeFormSchema(schema)), [schema]);

  const setSection = (i: number, patch: Partial<FormSection>) =>
    setSchema((s) => ({
      ...s,
      sections: s.sections.map((sec, idx) => (idx === i ? { ...sec, ...patch } : sec)),
    }));
  const setSections = (sections: FormSection[]) => setSchema((s) => ({ ...s, sections }));

  const addSection = () => setSections([...schema.sections, emptySection()]);
  const deleteSection = (i: number) => setSections(schema.sections.filter((_, idx) => idx !== i));
  const moveSection = (i: number, dir: -1 | 1) => setSections(move(schema.sections, i, i + dir));

  const fieldsOf = (si: number): FormField[] => schema.sections[si]?.fields ?? [];
  const addField = (si: number) => setSection(si, { fields: [...fieldsOf(si), emptyField()] });
  const setField = (si: number, fi: number, f: FormField) =>
    setSection(si, { fields: fieldsOf(si).map((x, idx) => (idx === fi ? f : x)) });
  const deleteField = (si: number, fi: number) =>
    setSection(si, { fields: fieldsOf(si).filter((_, idx) => idx !== fi) });
  const moveField = (si: number, fi: number, dir: -1 | 1) =>
    setSection(si, { fields: move(fieldsOf(si), fi, fi + dir) });
  const dupField = (si: number, fi: number) => {
    const src = fieldsOf(si)[fi];
    if (!src) return;
    const copy: FormField = { ...src, id: newId('field'), label: `${src.label} (copia)` };
    const fields = [...fieldsOf(si)];
    fields.splice(fi + 1, 0, copy);
    setSection(si, { fields });
  };

  if (!editable) {
    return <PreviewSchema schema={schema} />;
  }

  return (
    <div className="fd">
      <div className="fd-toolbar">
        <button type="button" className="button button--ghost" onClick={addSection}>
          Agregar sección
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => setPreview((p) => !p)}
        >
          {preview ? 'Volver al diseño' : 'Vista previa'}
        </button>
      </div>

      {preview ? (
        <PreviewSchema schema={schema} />
      ) : (
        <>
          {schema.sections.length === 0 && (
            <p className="empty-state">
              Agrega la primera sección para empezar a diseñar el formulario.
            </p>
          )}
          {schema.sections.map((section, si) => (
            <section key={section.id} className="fd-section">
              <div className="fd-section__head">
                <label className="fd-grow">
                  Título de la sección
                  <input
                    value={section.title}
                    onChange={(e) => setSection(si, { title: e.target.value })}
                  />
                </label>
                <label className="fd-check">
                  <input
                    type="checkbox"
                    checked={section.repeatable}
                    onChange={(e) => setSection(si, { repeatable: e.target.checked })}
                  />
                  Tabla repetible
                </label>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => moveSection(si, -1)}
                  aria-label="Subir sección"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => moveSection(si, 1)}
                  aria-label="Bajar sección"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => deleteSection(si)}
                >
                  Eliminar sección
                </button>
              </div>
              {section.fields.map((field, fi) => (
                <FieldEditor
                  key={field.id}
                  section={section}
                  field={field}
                  index={fi}
                  count={section.fields.length}
                  siblingFields={section.fields}
                  onChange={(f) => setField(si, fi, f)}
                  onMove={(dir) => moveField(si, fi, dir)}
                  onDelete={() => deleteField(si, fi)}
                  onDuplicate={() => dupField(si, fi)}
                />
              ))}
              <button type="button" className="button button--ghost" onClick={() => addField(si)}>
                Agregar campo
              </button>
            </section>
          ))}
        </>
      )}

      {designErrors.length > 0 && (
        <ul className="record-errors">
          {designErrors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      <form action={action} className="wf-form fd-save">
        <input type="hidden" name="documentId" value={documentId} />
        <input type="hidden" name="documentVersionId" value={documentVersionId} />
        <input type="hidden" name="schema" value={JSON.stringify(sanitizeFormSchema(schema))} />
        <SubmitButton variant="primary" pendingLabel="Guardando…">
          Guardar formulario
        </SubmitButton>
        {state && (
          <span className={state.ok ? 'msg msg--ok' : 'msg msg--error'}>{state.message}</span>
        )}
      </form>
    </div>
  );
}

/** Vista previa estructural del formulario diseñado (§19). */
function PreviewSchema({ schema }: { schema: FormSchema }) {
  return (
    <div className="fd-preview">
      {schema.sections.map((section) => (
        <section key={section.id} className="fd-preview__section">
          <h3>
            {section.title}
            {section.repeatable && <span className="badge"> Tabla repetible</span>}
          </h3>
          <ul>
            {section.fields.map((field) => (
              <li key={field.id}>
                <strong>{field.label}</strong>
                {field.required && <span className="record-field__req"> *</span>} —{' '}
                {FIELD_KIND_LABEL[field.kind]}
                {field.visibleWhen ? ' · condicional' : ''}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
