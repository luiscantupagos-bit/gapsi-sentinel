/**
 * DOC-004 — esquema PURO de formularios y validación de registros. Sin BD ni E/S.
 *
 * Un FORMATO (documento tipo `form`) define, en su versión documental exacta, un
 * `FormSchema`: secciones (algunas repetibles = tablas) con campos tipados. Cada campo
 * tiene un `id` LÓGICO estable (§12) que sobrevive al clon de versión mientras el campo
 * siga siendo conceptualmente el mismo; NUNCA se usa el label como identidad.
 *
 * Un REGISTRO (record instance) captura valores contra una versión EXACTA del formato.
 * La validación de obligatorios/tipos/condiciones se hace en SERVIDOR con estas funciones
 * puras (el cliente nunca es autoridad única, §14). Saneo por ALLOWLIST (patrón del repo,
 * sin `zod`): solo claves conocidas, coerción y topes de tamaño.
 */

// --- Tipos de campo (§10) ----------------------------------------------------
export const FIELD_KINDS = [
  'text',
  'textarea',
  'number',
  'decimal',
  'date',
  'datetime',
  'time',
  'boolean',
  'select',
  'multiselect',
  'checkbox',
  'signature',
  'photo',
  'file',
  'user',
  'lot',
] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

export const FIELD_KIND_LABEL: Record<FieldKind, string> = {
  text: 'Texto corto',
  textarea: 'Texto largo',
  number: 'Número',
  decimal: 'Decimal',
  date: 'Fecha',
  datetime: 'Fecha y hora',
  time: 'Hora',
  boolean: 'Sí / No',
  select: 'Selección única',
  multiselect: 'Selección múltiple',
  checkbox: 'Casilla de confirmación',
  signature: 'Firma / confirmación',
  photo: 'Foto',
  file: 'Archivo',
  user: 'Usuario',
  lot: 'Lote / identificador',
};
export const fieldKindLabel = (k: string): string => FIELD_KIND_LABEL[k as FieldKind] ?? k;

/** Tipos que llevan opciones (§16). */
export const OPTION_KINDS: ReadonlySet<FieldKind> = new Set(['select', 'multiselect']);
/** Tipos numéricos (§45). */
export const NUMERIC_KINDS: ReadonlySet<FieldKind> = new Set(['number', 'decimal']);
/** Tipos que referencian un archivo en stored_files/file_relations (§28). */
export const FILE_KINDS: ReadonlySet<FieldKind> = new Set(['photo', 'file']);

// --- Fórmulas / campos calculados (§13, arquitectura mínima) ------------------
export const CALC_OPS = ['sum', 'average', 'min', 'max', 'percentage'] as const;
export type CalcOp = (typeof CALC_OPS)[number];

export interface FieldOption {
  value: string;
  label: string;
}
export interface FieldCondition {
  /** id lógico del campo (de la MISMA sección o de una sección no repetible) del que depende. */
  fieldId: string;
  /** se muestra/obliga si el valor del campo referido es igual a este (string comparado). */
  equals: string;
}
export interface FormField {
  id: string; // field_logical_id estable (§12)
  label: string;
  kind: FieldKind;
  required: boolean;
  help?: string;
  placeholder?: string;
  options?: FieldOption[]; // select/multiselect
  min?: number; // number/decimal
  max?: number;
  decimals?: number; // precisión decimal (§45)
  minLength?: number;
  maxLength?: number;
  pattern?: string; // regex acotado (§16)
  unit?: string;
  visibleWhen?: FieldCondition; // visibilidad/obligatoriedad condicional (§15)
  calc?: { op: CalcOp; of: string[] }; // campo calculado (§13)
}
export interface FormSection {
  id: string; // section logical id estable
  title: string;
  description?: string;
  repeatable: boolean; // sección/tabla repetible (§11)
  minRows?: number;
  maxRows?: number;
  fields: FormField[];
}
export interface FormSchema {
  schemaVersion: number;
  title?: string;
  sections: FormSection[];
}

export const FORM_SCHEMA_VERSION = 1;
export const MAX_SECTIONS = 40;
export const MAX_FIELDS_PER_SECTION = 60;
export const MAX_OPTIONS = 60;
export const MAX_ROWS = 500;
const LABEL_MAX = 200;
const HELP_MAX = 500;
const TEXT_MAX = 4000;

export function emptyFormSchema(): FormSchema {
  return { schemaVersion: FORM_SCHEMA_VERSION, sections: [] };
}

const str = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim().slice(0, max) : '';
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const bool = (v: unknown): boolean => v === true || v === 'true' || v === 'on' || v === '1';

function sanitizeOptions(raw: unknown): FieldOption[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: FieldOption[] = [];
  for (const o of raw.slice(0, MAX_OPTIONS)) {
    const rec = (o ?? {}) as Record<string, unknown>;
    const value = str(rec.value ?? rec.label, 120);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push({ value, label: str(rec.label ?? rec.value, 120) || value });
  }
  return out;
}

function sanitizeCondition(raw: unknown): FieldCondition | undefined {
  const rec = (raw ?? {}) as Record<string, unknown>;
  const fieldId = str(rec.fieldId, 120);
  if (!fieldId) return undefined;
  return { fieldId, equals: str(rec.equals, 200) };
}

function sanitizeField(raw: unknown, index: number, usedIds: Set<string>): FormField | null {
  const rec = (raw ?? {}) as Record<string, unknown>;
  const kind = (FIELD_KINDS as readonly string[]).includes(rec.kind as string)
    ? (rec.kind as FieldKind)
    : 'text';
  let id = str(rec.id, 120).replace(/[^a-zA-Z0-9_]+/g, '_');
  if (!id || usedIds.has(id)) id = `field_${index + 1}`;
  let uniq = id;
  let n = 2;
  while (usedIds.has(uniq)) uniq = `${id}_${n++}`;
  usedIds.add(uniq);

  const field: FormField = {
    id: uniq,
    label: str(rec.label, LABEL_MAX) || `Campo ${index + 1}`,
    kind,
    required: bool(rec.required),
  };
  const help = str(rec.help, HELP_MAX);
  if (help) field.help = help;
  const placeholder = str(rec.placeholder, LABEL_MAX);
  if (placeholder) field.placeholder = placeholder;
  const unit = str(rec.unit, 40);
  if (unit) field.unit = unit;
  if (OPTION_KINDS.has(kind)) field.options = sanitizeOptions(rec.options);
  if (NUMERIC_KINDS.has(kind)) {
    const min = num(rec.min);
    const max = num(rec.max);
    if (min !== undefined) field.min = min;
    if (max !== undefined) field.max = max;
    if (kind === 'decimal') {
      const d = num(rec.decimals);
      field.decimals = d !== undefined ? Math.max(0, Math.min(6, Math.trunc(d))) : 2;
    }
  }
  if (kind === 'text' || kind === 'textarea' || kind === 'lot') {
    const minL = num(rec.minLength);
    const maxL = num(rec.maxLength);
    if (minL !== undefined) field.minLength = Math.max(0, Math.trunc(minL));
    if (maxL !== undefined) field.maxLength = Math.max(1, Math.trunc(maxL));
    const pattern = str(rec.pattern, 200);
    if (pattern) field.pattern = pattern;
  }
  const cond = sanitizeCondition(rec.visibleWhen);
  if (cond) field.visibleWhen = cond;
  const calcRaw = (rec.calc ?? null) as Record<string, unknown> | null;
  if (calcRaw && (CALC_OPS as readonly string[]).includes(calcRaw.op as string)) {
    const of = Array.isArray(calcRaw.of)
      ? calcRaw.of
          .map((x) => str(x, 120))
          .filter(Boolean)
          .slice(0, MAX_FIELDS_PER_SECTION)
      : [];
    field.calc = { op: calcRaw.op as CalcOp, of };
  }
  return field;
}

function sanitizeSection(raw: unknown, index: number, usedIds: Set<string>): FormSection {
  const rec = (raw ?? {}) as Record<string, unknown>;
  let id = str(rec.id, 120).replace(/[^a-zA-Z0-9_]+/g, '_');
  if (!id || usedIds.has(id)) id = `section_${index + 1}`;
  let uniq = id;
  let n = 2;
  while (usedIds.has(uniq)) uniq = `${id}_${n++}`;
  usedIds.add(uniq);

  const fieldIds = new Set<string>();
  const rawFields = Array.isArray(rec.fields) ? rec.fields.slice(0, MAX_FIELDS_PER_SECTION) : [];
  const fields = rawFields
    .map((f, i) => sanitizeField(f, i, fieldIds))
    .filter((f): f is FormField => f !== null);

  const section: FormSection = {
    id: uniq,
    title: str(rec.title, LABEL_MAX) || `Sección ${index + 1}`,
    repeatable: bool(rec.repeatable),
    fields,
  };
  const description = str(rec.description, HELP_MAX);
  if (description) section.description = description;
  if (section.repeatable) {
    const minR = num(rec.minRows);
    const maxR = num(rec.maxRows);
    if (minR !== undefined) section.minRows = Math.max(0, Math.min(MAX_ROWS, Math.trunc(minR)));
    if (maxR !== undefined) section.maxRows = Math.max(1, Math.min(MAX_ROWS, Math.trunc(maxR)));
  }
  return section;
}

/** Sanea un esquema de formulario (allowlist) desde datos arbitrarios (editor/cliente). */
export function sanitizeFormSchema(raw: unknown): FormSchema {
  const rec = (raw ?? {}) as Record<string, unknown>;
  const usedSectionIds = new Set<string>();
  const rawSections = Array.isArray(rec.sections) ? rec.sections.slice(0, MAX_SECTIONS) : [];
  const sections = rawSections.map((s, i) => sanitizeSection(s, i, usedSectionIds));
  const schema: FormSchema = { schemaVersion: FORM_SCHEMA_VERSION, sections };
  const title = str(rec.title, LABEL_MAX);
  if (title) schema.title = title;
  return schema;
}

/** Todos los campos (planos) del esquema, con la sección a la que pertenecen. */
export function allFields(schema: FormSchema): Array<{ section: FormSection; field: FormField }> {
  return schema.sections.flatMap((section) => section.fields.map((field) => ({ section, field })));
}

/** ¿El esquema tiene al menos un campo? (para poder publicar / capturar). */
export function schemaHasFields(schema: FormSchema): boolean {
  return schema.sections.some((s) => s.fields.length > 0);
}

/** Errores de DISEÑO del formulario (§17): secciones/campos vacíos, opciones faltantes, ids dup. */
export function validateFormSchema(schema: FormSchema): string[] {
  const errors: string[] = [];
  if (!schemaHasFields(schema)) errors.push('El formulario debe tener al menos un campo.');
  const seen = new Set<string>();
  for (const section of schema.sections) {
    if (!section.title.trim()) errors.push('Cada sección requiere un título.');
    for (const field of section.fields) {
      const key = `${section.id}.${field.id}`;
      if (seen.has(key)) errors.push(`Campo duplicado: ${field.label}.`);
      seen.add(key);
      if (!field.label.trim()) errors.push('Cada campo requiere una etiqueta.');
      if (OPTION_KINDS.has(field.kind) && (!field.options || field.options.length === 0))
        errors.push(`El campo «${field.label}» requiere al menos una opción.`);
      if (field.min !== undefined && field.max !== undefined && field.min > field.max)
        errors.push(`El campo «${field.label}» tiene un rango numérico inválido.`);
    }
  }
  return errors;
}

// --- Datos del registro -------------------------------------------------------
/**
 * Datos capturados de un registro: valores de campos de secciones NO repetibles y
 * filas de las secciones repetibles (tablas). Espejo de structuredContent (§9, JSONB
 * validado; no EAV).
 */
export interface RecordData {
  values: Record<string, unknown>; // fieldId -> valor (secciones no repetibles)
  rows: Record<string, Array<Record<string, unknown>>>; // sectionId -> filas
}

export function emptyRecordData(): RecordData {
  return { values: {}, rows: {} };
}

const asString = (v: unknown): string =>
  v === null || v === undefined ? '' : typeof v === 'string' ? v : String(v);

/** ¿Un campo condicional es visible dado el conjunto de valores de su ámbito? (§15) */
export function isFieldVisible(field: FormField, scope: Record<string, unknown>): boolean {
  if (!field.visibleWhen) return true;
  return asString(scope[field.visibleWhen.fieldId]) === field.visibleWhen.equals;
}

function coerceValue(field: FormField, value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (NUMERIC_KINDS.has(field.kind)) {
    const n = num(value);
    if (n === undefined) return undefined;
    return field.kind === 'decimal' && field.decimals !== undefined
      ? Number(n.toFixed(field.decimals))
      : n;
  }
  if (field.kind === 'boolean' || field.kind === 'checkbox') return bool(value);
  if (field.kind === 'multiselect') {
    const arr = Array.isArray(value) ? value : asString(value) ? [value] : [];
    return arr.map((x) => asString(x)).filter(Boolean);
  }
  return asString(value).slice(0, TEXT_MAX);
}

const hasValue = (field: FormField, v: unknown): boolean => {
  if (v === undefined || v === null) return false;
  if (field.kind === 'multiselect') return Array.isArray(v) && v.length > 0;
  if (field.kind === 'boolean' || field.kind === 'checkbox') return v === true;
  return asString(v).trim() !== '';
};

/** Sanea/coacciona los datos capturados contra el esquema (descarta claves desconocidas). */
export function sanitizeRecordData(schema: FormSchema, raw: unknown): RecordData {
  const rec = (raw ?? {}) as Record<string, unknown>;
  const inValues = (rec.values ?? {}) as Record<string, unknown>;
  const inRows = (rec.rows ?? {}) as Record<string, unknown>;
  const out = emptyRecordData();
  for (const section of schema.sections) {
    if (section.repeatable) {
      const rows = Array.isArray(inRows[section.id]) ? (inRows[section.id] as unknown[]) : [];
      out.rows[section.id] = rows.slice(0, section.maxRows ?? MAX_ROWS).map((row) => {
        const r = (row ?? {}) as Record<string, unknown>;
        const cell: Record<string, unknown> = {};
        for (const field of section.fields) {
          const c = coerceValue(field, r[field.id]);
          if (c !== undefined) cell[field.id] = c;
        }
        return cell;
      });
    } else {
      for (const field of section.fields) {
        const c = coerceValue(field, inValues[field.id]);
        if (c !== undefined) out.values[field.id] = c;
      }
    }
  }
  return out;
}

function validateField(field: FormField, value: unknown, prefix: string, errors: string[]): void {
  const present = hasValue(field, value);
  if (field.required && !present) {
    errors.push(`${prefix}«${field.label}» es obligatorio.`);
    return;
  }
  if (!present) return;
  if (NUMERIC_KINDS.has(field.kind)) {
    const n = num(value);
    if (n === undefined) errors.push(`${prefix}«${field.label}» debe ser numérico.`);
    else {
      if (field.min !== undefined && n < field.min)
        errors.push(`${prefix}«${field.label}» debe ser ≥ ${field.min}.`);
      if (field.max !== undefined && n > field.max)
        errors.push(`${prefix}«${field.label}» debe ser ≤ ${field.max}.`);
    }
  }
  if (
    field.kind === 'select' &&
    field.options &&
    !field.options.some((o) => o.value === asString(value))
  )
    errors.push(`${prefix}«${field.label}» tiene un valor no permitido.`);
  if (field.kind === 'multiselect' && field.options) {
    const allowed = new Set(field.options.map((o) => o.value));
    const vals = Array.isArray(value) ? value : [];
    if (vals.some((v) => !allowed.has(asString(v))))
      errors.push(`${prefix}«${field.label}» tiene un valor no permitido.`);
  }
  const text = asString(value);
  if (field.minLength !== undefined && text.length < field.minLength)
    errors.push(`${prefix}«${field.label}» requiere al menos ${field.minLength} caracteres.`);
  if (field.maxLength !== undefined && text.length > field.maxLength)
    errors.push(`${prefix}«${field.label}» excede ${field.maxLength} caracteres.`);
  if (field.pattern) {
    try {
      if (!new RegExp(field.pattern).test(text))
        errors.push(`${prefix}«${field.label}» no cumple el formato requerido.`);
    } catch {
      /* patrón inválido en el esquema: se ignora en validación de datos */
    }
  }
}

/**
 * Valida los datos capturados contra el esquema (§14/§15/§44). Respeta la visibilidad
 * condicional: un campo oculto no es obligatorio. Valida cada fila de las tablas.
 * Devuelve la lista de errores (vacía = válido para enviar).
 */
export function validateRecordData(schema: FormSchema, data: RecordData): string[] {
  const errors: string[] = [];
  for (const section of schema.sections) {
    if (section.repeatable) {
      const rows = data.rows[section.id] ?? [];
      if (section.minRows && rows.length < section.minRows)
        errors.push(`«${section.title}» requiere al menos ${section.minRows} fila(s).`);
      rows.forEach((row, i) => {
        for (const field of section.fields) {
          if (!isFieldVisible(field, row)) continue;
          validateField(field, row[field.id], `${section.title} · fila ${i + 1}: `, errors);
        }
      });
    } else {
      for (const field of section.fields) {
        if (!isFieldVisible(field, data.values)) continue;
        validateField(field, data.values[field.id], '', errors);
      }
    }
  }
  return errors;
}

/** Completitud del registro (campos visibles obligatorios cubiertos). Para barra de progreso. */
export function recordCompleteness(
  schema: FormSchema,
  data: RecordData,
): { required: number; filled: number } {
  let required = 0;
  let filled = 0;
  for (const section of schema.sections) {
    if (section.repeatable) continue; // las tablas no cuentan al progreso escalar
    for (const field of section.fields) {
      if (!field.required || !isFieldVisible(field, data.values)) continue;
      required += 1;
      if (hasValue(field, data.values[field.id])) filled += 1;
    }
  }
  return { required, filled };
}
