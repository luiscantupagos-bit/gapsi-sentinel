/**
 * DOC-004 — vista READ-ONLY reutilizable de un registro (workspace de solo lectura +
 * futuro PDF/export, §43). Print-safe, sin estado de cliente. Renderiza el esquema del
 * formato con los valores capturados, respetando visibilidad condicional y tablas.
 */
import {
  allFields,
  isFieldVisible,
  fieldKindLabel,
  type FormSchema,
  type FormField,
  type RecordData,
} from '@/features/records/form-schema';

function displayValue(field: FormField, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field.kind === 'boolean' || field.kind === 'checkbox') return value ? 'Sí' : 'No';
  if (field.kind === 'multiselect') {
    const arr = Array.isArray(value) ? value : [];
    const labels = arr.map((v) => field.options?.find((o) => o.value === v)?.label ?? String(v));
    return labels.length ? labels.join(', ') : '—';
  }
  if (field.kind === 'select') {
    return field.options?.find((o) => o.value === value)?.label ?? String(value);
  }
  const text = String(value);
  return field.unit ? `${text} ${field.unit}` : text;
}

export interface RecordViewModel {
  recordNumber: string;
  formCode: string;
  formTitle: string;
  formVersionLabel: string;
  statusLabel: string;
  status: string;
  schema: FormSchema;
  data: RecordData;
}

export function RecordReadOnlyView({ record }: { record: RecordViewModel }) {
  const { schema, data } = record;
  return (
    <article className="record-view">
      <header className="record-view__head">
        <div>
          <strong>{record.recordNumber}</strong>
          <span className="muted">
            {' '}
            · {record.formCode} · {record.formTitle} · {record.formVersionLabel}
          </span>
        </div>
        <span className={`badge badge--recstatus-${record.status}`}>{record.statusLabel}</span>
      </header>

      {schema.sections.length === 0 && (
        <p className="empty-state empty-state--compact">Este formato no tiene formulario.</p>
      )}

      {schema.sections.map((section) => (
        <section key={section.id} className="record-view__section">
          <h3>{section.title}</h3>
          {section.description && <p className="muted">{section.description}</p>}

          {section.repeatable ? (
            <RepeatableTable section={section} rows={data.rows[section.id] ?? []} />
          ) : (
            <dl className="record-view__fields">
              {section.fields.map((field) =>
                isFieldVisible(field, data.values) ? (
                  <div key={field.id} className="record-view__field">
                    <dt>{field.label}</dt>
                    <dd>{displayValue(field, data.values[field.id])}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          )}
        </section>
      ))}
    </article>
  );
}

function RepeatableTable({
  section,
  rows,
}: {
  section: FormSchema['sections'][number];
  rows: Array<Record<string, unknown>>;
}) {
  if (rows.length === 0) {
    return <p className="empty-state empty-state--compact">Sin filas.</p>;
  }
  return (
    <div className="record-view__tablewrap">
      <table className="record-view__table">
        <thead>
          <tr>
            <th>#</th>
            {section.fields.map((f) => (
              <th key={f.id}>{f.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              {section.fields.map((f) => (
                <td key={f.id}>{displayValue(f, row[f.id])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Utilidad de depuración/print: lista plana de campos del esquema (para índices/PDF). */
export function recordFieldCount(schema: FormSchema): number {
  return allFields(schema).length;
}
export { fieldKindLabel };
