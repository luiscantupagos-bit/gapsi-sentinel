/**
 * Contenido documental ESTRUCTURADO (DOC-001 §25/§26/§27).
 *
 * Fuente de verdad de los documentos por tipo. A diferencia de
 * `content-schema.ts` (ProseMirror/HTML del editor libre), aquí el contenido son
 * DATOS: campos y bloques repetibles definidos por el registro de plantillas.
 * El HTML/render se DERIVA de estos datos (ver `structured-render.ts`); nunca al
 * revés.
 *
 * Seguridad/robustez (patrón del repositorio, sin `zod`): saneo con ALLOWLIST a
 * partir del registro (solo claves conocidas, coerción a string, topes de
 * longitud y de número de ítems) + validación de obligatorios en SERVIDOR.
 * `schemaVersion` permite compatibilidad futura del renderer.
 *
 * Módulo PURO y seguro para cliente (sin builtins de Node): el checksum y el
 * tamaño en bytes viven en `structured-checksum.ts` (solo servidor).
 */
import {
  getTemplateDefinition,
  type DocumentTemplateDefinition,
  type FieldDef,
} from './template-registry';

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
  fields: Record<string, string>;
  /** Bloques repetibles: por clave de bloque, una lista de ítems (subcampo→valor). */
  repeatables: Record<string, Array<Record<string, string>>>;
}

function maxLenOf(field: FieldDef): number {
  if (typeof field.maxLength === 'number' && field.maxLength > 0) return field.maxLength;
  return field.kind === 'textarea' ? DEFAULT_TEXTAREA_MAX : DEFAULT_TEXT_MAX;
}

function coerce(value: unknown, field: FieldDef): string {
  if (typeof value !== 'string') return '';
  // Normaliza saltos de línea y recorta al tope; conserva contenido interno.
  const normalized = value.replace(/\r\n?/g, '\n');
  return normalized.slice(0, maxLenOf(field));
}

/** ¿Un ítem repetible quedó completamente vacío tras sanear? (para descartarlo). */
function isEmptyItem(item: Record<string, string>): boolean {
  return Object.values(item).every((v) => v.trim() === '');
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
 * desconocidas, coacciona a string, aplica topes y elimina ítems vacíos. Devuelve
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
        const value = coerce(rawFields[field.key], field);
        if (value !== '') out.fields[field.key] = value;
      }
    } else {
      const rep = section.repeatable;
      const rawItems = Array.isArray(rawRepeatables[rep.key])
        ? (rawRepeatables[rep.key] as unknown[])
        : [];
      const items: Array<Record<string, string>> = [];
      for (const rawItem of rawItems.slice(0, MAX_REPEATABLE_ITEMS)) {
        const src = (rawItem && typeof rawItem === 'object' ? rawItem : {}) as Record<
          string,
          unknown
        >;
        const item: Record<string, string> = {};
        for (const field of rep.fields) {
          const value = coerce(src[field.key], field);
          if (value !== '') item[field.key] = value;
        }
        if (!isEmptyItem(item)) items.push(item);
      }
      if (items.length) out.repeatables[rep.key] = items;
    }
  }
  return out;
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
        if (field.required && !(c.fields[field.key] ?? '').trim()) {
          errors.push(`${section.title}: "${field.label}" es obligatorio.`);
        }
      }
    } else {
      const rep = section.repeatable;
      const items = c.repeatables[rep.key] ?? [];
      items.forEach((item, index) => {
        for (const field of rep.fields) {
          if (field.required && !(item[field.key] ?? '').trim()) {
            errors.push(`${rep.label} #${index + 1}: "${field.label}" es obligatorio.`);
          }
        }
      });
    }
  }
  return errors;
}

/** Ítems saneados de un bloque repetible (helper para el renderer y pruebas). */
export function repeatableItems(
  content: StructuredContent,
  key: string,
): Array<Record<string, string>> {
  return content.repeatables[key] ?? [];
}

/** Valor de un campo simple (cadena vacía si ausente). */
export function fieldValue(content: StructuredContent, key: string): string {
  return content.fields[key] ?? '';
}

export type { DocumentTemplateDefinition };
