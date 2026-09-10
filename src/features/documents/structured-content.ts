/**
 * Contenido documental ESTRUCTURADO (DOC-001 §25/§26/§27, DOC-002 §27/§28).
 *
 * Fuente de verdad de los documentos por tipo. A diferencia de
 * `content-schema.ts` (ProseMirror/HTML del editor libre), aquí el contenido son
 * DATOS: campos y bloques repetibles definidos por el registro de plantillas.
 * El HTML/render se DERIVA de estos datos (ver `structured-render.ts`); nunca al
 * revés.
 *
 * Un valor de campo es `RichValue = string | { segments }` (DOC-002): texto plano
 * (retrocompatible) o una secuencia con REFERENCIAS a otros documentos (`@`) y a
 * formatos emitidos (`//`). Solo los campos `textarea` admiten referencias.
 *
 * Seguridad/robustez (patrón del repositorio, sin `zod`): saneo con ALLOWLIST a
 * partir del registro (solo claves conocidas, coerción, topes de longitud y de
 * número de ítems) + validación de obligatorios en SERVIDOR. `schemaVersion`
 * permite compatibilidad futura del renderer.
 *
 * Módulo PURO y seguro para cliente (sin builtins de Node): el checksum y el
 * tamaño en bytes viven en `structured-checksum.ts` (solo servidor).
 */
import {
  getTemplateDefinition,
  type DocumentTemplateDefinition,
  type FieldDef,
} from './template-registry';
import {
  sanitizeRichValue,
  richHasContent,
  richPlainText,
  richReferences,
  refKey,
  type RichValue,
  type RefRelationType,
} from './references';
import { sanitizeProgramBlock, type ProgramBlock } from './program-execution';

/** Versión del esquema estructurado. Obligatoria; el renderer soporta esta versión. */
export const STRUCTURED_SCHEMA_VERSION = 1;

/** Máximo de ítems por bloque repetible (evita payloads abusivos). */
export const MAX_REPEATABLE_ITEMS = 200;

const DEFAULT_TEXT_MAX = 300;
const DEFAULT_TEXTAREA_MAX = 2000;

export interface StructuredContent {
  schemaVersion: number;
  templateType: string;
  /** Valores de campos simples, por clave de campo (únicas dentro del tipo). */
  fields: Record<string, RichValue>;
  /** Bloques repetibles: por clave de bloque, una lista de ítems (subcampo→valor). */
  repeatables: Record<string, Array<Record<string, RichValue>>>;
  /** DOC-003: bloque ejecutable del Programa (periodo + actividades con id estable). */
  program?: ProgramBlock;
}

/** Referencia extraída del contenido (deduplicada por tipo + destino). */
export interface ExtractedReference {
  relationType: RefRelationType;
  targetDocumentId: string;
}

function maxLenOf(field: FieldDef): number {
  if (typeof field.maxLength === 'number' && field.maxLength > 0) return field.maxLength;
  return field.kind === 'textarea' ? DEFAULT_TEXTAREA_MAX : DEFAULT_TEXT_MAX;
}

/**
 * Coacciona el valor de un campo. Los `textarea` admiten `RichValue` (con
 * referencias); los `text` se mantienen como string plano.
 */
function coerceField(value: unknown, field: FieldDef): RichValue {
  const max = maxLenOf(field);
  if (field.kind === 'textarea') return sanitizeRichValue(value, max);
  // Campo de texto simple: solo string plano.
  if (typeof value === 'string') return value.replace(/\r\n?/g, '\n').slice(0, max);
  // Si llega un rich value en un campo no-rich, aplanamos a su texto.
  const flat = sanitizeRichValue(value, max);
  return typeof flat === 'string' ? flat : richPlainText(flat).slice(0, max);
}

/** ¿Un ítem repetible quedó completamente vacío tras sanear? (para descartarlo). */
function isEmptyItem(item: Record<string, RichValue>): boolean {
  return Object.values(item).every((v) => !richHasContent(v));
}

/** Contenido estructurado vacío para un tipo (campos en blanco, repetibles sin ítems). */
export function emptyStructuredContent(templateType: string): StructuredContent {
  return {
    schemaVersion: STRUCTURED_SCHEMA_VERSION,
    templateType,
    fields: {},
    repeatables: {},
  };
}

/**
 * Sanea el contenido estructural contra el registro del tipo: descarta claves
 * desconocidas, coacciona valores, aplica topes y elimina ítems vacíos. Devuelve
 * SIEMPRE un contenido válido y normalizado. Si el tipo no tiene plantilla
 * estructurada, devuelve un contenido vacío para ese tipo.
 */
export function sanitizeStructuredContent(templateType: string, input: unknown): StructuredContent {
  const def = getTemplateDefinition(templateType);
  const out = emptyStructuredContent(templateType);
  if (!def || !def.supportsStructuredEditor) return out;

  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const rawFields = (raw.fields && typeof raw.fields === 'object' ? raw.fields : {}) as Record<
    string,
    unknown
  >;
  const rawRepeatables = (
    raw.repeatables && typeof raw.repeatables === 'object' ? raw.repeatables : {}
  ) as Record<string, unknown>;

  for (const section of def.sections) {
    if (section.kind === 'fields') {
      for (const field of section.fields) {
        const value = coerceField(rawFields[field.key], field);
        if (richHasContent(value)) out.fields[field.key] = value;
      }
    } else {
      const rep = section.repeatable;
      const rawItems = Array.isArray(rawRepeatables[rep.key])
        ? (rawRepeatables[rep.key] as unknown[])
        : [];
      const items: Array<Record<string, RichValue>> = [];
      for (const rawItem of rawItems.slice(0, MAX_REPEATABLE_ITEMS)) {
        const src = (rawItem && typeof rawItem === 'object' ? rawItem : {}) as Record<
          string,
          unknown
        >;
        const item: Record<string, RichValue> = {};
        for (const field of rep.fields) {
          const value = coerceField(src[field.key], field);
          if (richHasContent(value)) item[field.key] = value;
        }
        if (!isEmptyItem(item)) items.push(item);
      }
      if (items.length) out.repeatables[rep.key] = items;
    }
  }

  // DOC-003: bloque ejecutable del Programa (saneo determinista; el servidor
  // acuña los activityId faltantes al guardar con `ensureActivityIds`).
  if (templateType === 'program') {
    out.program = sanitizeProgramBlock(raw.program);
  }
  return out;
}

/**
 * Campos LEGACY (retirados del registry) que se PRESERVAN explícitamente al
 * guardar, para compatibilidad con documentos previos (DOC-UX-001 §14). Mapa
 * acotado: tipo → bloque repetible → claves legacy conocidas. **No** es un
 * passthrough genérico: solo estas claves y solo desde el contenido previo
 * almacenado (el allowlist ya descartó cualquier clave del payload del cliente).
 */
export const KNOWN_LEGACY_REPEATABLE_FIELDS: Record<string, Record<string, readonly string[]>> = {
  procedure: { activities: ['evidencia', 'observaciones'] },
};

function asPlainText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    Array.isArray((value as { segments?: unknown }).segments)
  ) {
    return richPlainText(value as RichValue);
  }
  return '';
}

/** Clave de emparejamiento estable de una actividad: su nombre normalizado. */
function activityMatchKey(item: Record<string, unknown>): string {
  return asPlainText(item.nombre).trim().toLowerCase();
}

/**
 * Fusiona en el contenido saneado los CAMPOS LEGACY conocidos que existían en el
 * contenido previo almacenado, para que un re-guardado desde la UI actual (que ya
 * no expone esos campos) no los borre silenciosamente (DOC-UX-001 §14).
 *
 * - Fuente = SOLO `previousStored` (nunca el payload del cliente).
 * - Emparejamiento por NOMBRE de actividad (DOC-001 no tiene activityId): una
 *   actividad eliminada no reaparece; una actividad nueva no hereda legacy ajeno.
 * - Los valores se aplanan a TEXTO PLANO: no son claves del registry (el renderer
 *   no los muestra) y no participan de referencias `@`/`//` (no duplican relaciones).
 */
export function preserveLegacyRepeatableFields(
  templateType: string,
  sanitized: StructuredContent,
  previousStored: unknown,
): StructuredContent {
  const spec = KNOWN_LEGACY_REPEATABLE_FIELDS[templateType];
  if (!spec) return sanitized;
  const prev = (
    previousStored && typeof previousStored === 'object' ? previousStored : {}
  ) as Record<string, unknown>;
  const prevReps = (
    prev.repeatables && typeof prev.repeatables === 'object' ? prev.repeatables : {}
  ) as Record<string, unknown>;

  const nextRepeatables = { ...sanitized.repeatables };
  let changed = false;

  for (const [repKey, legacyKeys] of Object.entries(spec)) {
    const newItems = sanitized.repeatables[repKey];
    if (!newItems || newItems.length === 0) continue;
    const prevItems = Array.isArray(prevReps[repKey]) ? (prevReps[repKey] as unknown[]) : [];
    if (prevItems.length === 0) continue;

    // Cola de payloads legacy por nombre (determinista ante nombres repetidos).
    const byName = new Map<string, Array<Record<string, string>>>();
    for (const raw of prevItems) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Record<string, unknown>;
      const legacy: Record<string, string> = {};
      for (const k of legacyKeys) {
        const txt = asPlainText(item[k]).slice(0, DEFAULT_TEXTAREA_MAX);
        if (txt.trim()) legacy[k] = txt;
      }
      if (Object.keys(legacy).length === 0) continue;
      const key = activityMatchKey(item);
      const queue = byName.get(key) ?? [];
      queue.push(legacy);
      byName.set(key, queue);
    }
    if (byName.size === 0) continue;

    const merged: Array<Record<string, RichValue>> = newItems.map((item) => {
      const queue = byName.get(activityMatchKey(item));
      if (!queue || queue.length === 0) return item;
      const legacy = queue.shift() as Record<string, string>;
      changed = true;
      return { ...item, ...legacy };
    });
    nextRepeatables[repKey] = merged;
  }

  if (!changed) return sanitized;
  return { ...sanitized, repeatables: nextRepeatables };
}

/**
 * Valida obligatorios contra el registro. Devuelve mensajes en español (vacío =
 * válido). Los campos simples obligatorios deben estar presentes; en los ítems
 * repetibles presentes, sus subcampos obligatorios deben estar completos.
 */
export function validateStructuredContent(templateType: string, content: unknown): string[] {
  const def = getTemplateDefinition(templateType);
  if (!def) return ['Tipo documental sin plantilla registrada.'];
  if (!def.supportsStructuredEditor) return [];

  const c = sanitizeStructuredContent(templateType, content);
  const errors: string[] = [];

  for (const section of def.sections) {
    if (section.kind === 'fields') {
      for (const field of section.fields) {
        if (field.required && !richHasContent(c.fields[field.key] ?? '')) {
          errors.push(`${section.title}: "${field.label}" es obligatorio.`);
        }
      }
    } else {
      const rep = section.repeatable;
      const items = c.repeatables[rep.key] ?? [];
      items.forEach((item, index) => {
        for (const field of rep.fields) {
          if (field.required && !richHasContent(item[field.key] ?? '')) {
            errors.push(`${rep.label} #${index + 1}: "${field.label}" es obligatorio.`);
          }
        }
      });
    }
  }
  return errors;
}

/** Recorre todos los valores del contenido. */
function forEachValue(content: StructuredContent, fn: (value: RichValue) => void): void {
  for (const v of Object.values(content.fields)) fn(v);
  for (const items of Object.values(content.repeatables)) {
    for (const item of items) for (const v of Object.values(item)) fn(v);
  }
}

/**
 * Extrae las REFERENCIAS del contenido (deduplicadas por tipo + destino). Base de
 * la sincronización contenido↔relaciones (DOC-002 §26).
 */
export function extractReferences(content: StructuredContent): ExtractedReference[] {
  const seen = new Set<string>();
  const out: ExtractedReference[] = [];
  forEachValue(content, (value) => {
    for (const ref of richReferences(value)) {
      const key = refKey(ref.relationType, ref.targetDocumentId);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ relationType: ref.relationType, targetDocumentId: ref.targetDocumentId });
    }
  });
  return out;
}

/** Ítems saneados de un bloque repetible (helper para el renderer y pruebas). */
export function repeatableItems(
  content: StructuredContent,
  key: string,
): Array<Record<string, RichValue>> {
  return content.repeatables[key] ?? [];
}

/** Valor (rich) de un campo simple (cadena vacía si ausente). */
export function fieldValue(content: StructuredContent, key: string): RichValue {
  return content.fields[key] ?? '';
}

/** Texto plano de un campo simple. */
export function fieldText(content: StructuredContent, key: string): string {
  return richPlainText(content.fields[key] ?? '');
}

export type { DocumentTemplateDefinition };
export type { RichValue };
