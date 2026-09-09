/**
 * Referencias inteligentes en contenido estructurado (DOC-002 §27/§28).
 *
 * Un valor de campo pasa de `string` a `RichValue = string | { segments }`:
 * - `string`  → texto plano (retrocompatible con DOC-001; sin referencias).
 * - `{ segments }` → secuencia de segmentos de texto y de REFERENCIA a otro
 *   documento (creadas con `@`) o a un formato emitido (creadas con `//`).
 *
 * La referencia NO es texto: su identificador REAL es `targetDocumentId` (id
 * estable) + `relationId` (fila en `document_relations`). `code`/`title` son solo
 * un snapshot visual; la UI y el renderer resuelven los datos actuales por id.
 *
 * Módulo PURO y seguro para cliente (sin builtins de Node). Determinista.
 */

/** Tipos de relación producidos por el CONTENIDO (tokens). */
export const REF_RELATION_TYPES = ['reference', 'issued_form'] as const;
export type RefRelationType = (typeof REF_RELATION_TYPES)[number];

/**
 * Todos los tipos que puede almacenar `document_relations` (extensible). Solo
 * `reference` e `issued_form` se implementan en DOC-002; el resto se reserva
 * (§4) para flujos futuros y NO se produce todavía.
 */
export const RELATION_TYPES = [
  'reference',
  'issued_form',
  'supersedes',
  'related',
  'evidence',
  'generated_record',
  'attachment_reference',
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export interface TextSegment {
  type: 'text';
  text: string;
}
export interface RefSegment {
  type: 'ref';
  relationType: RefRelationType;
  /** Identificador REAL del documento destino (id estable). */
  targetDocumentId: string;
  /** Id de la fila de relación (opcional; se completa tras sincronizar). */
  relationId?: string;
  /** Snapshot visual NO autoritativo. */
  code?: string;
  title?: string;
}
export type Segment = TextSegment | RefSegment;
export type RichValue = string | { segments: Segment[] };

/** UUID laxo (acepta el formato de Prisma). */
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const REF_TYPE_SET = new Set<string>(REF_RELATION_TYPES);

export function isRichObject(v: unknown): v is { segments: unknown[] } {
  return Boolean(
    v && typeof v === 'object' && Array.isArray((v as { segments?: unknown }).segments),
  );
}

/** Une segmentos de texto contiguos y descarta los vacíos. */
function mergeSegments(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const seg of segments) {
    if (seg.type === 'text') {
      if (seg.text === '') continue;
      const last = out[out.length - 1];
      if (last && last.type === 'text') last.text += seg.text;
      else out.push({ type: 'text', text: seg.text });
    } else {
      out.push(seg);
    }
  }
  return out;
}

/**
 * Sanea un valor de campo (allowlist). Un string permanece string; un objeto con
 * `segments` se depura: los segmentos de texto se coaccionan y recortan al tope;
 * los de referencia validan `targetDocumentId` (uuid), `relationType` permitido y
 * conservan snapshot corto. Si tras sanear no queda ninguna referencia, se colapsa
 * a string plano (retrocompatibilidad).
 */
export function sanitizeRichValue(value: unknown, maxLen: number): RichValue {
  if (typeof value === 'string') return value.replace(/\r\n?/g, '\n').slice(0, maxLen);
  if (!isRichObject(value)) return '';

  const segs: Segment[] = [];
  let textBudget = maxLen;
  for (const raw of value.segments) {
    if (!raw || typeof raw !== 'object') continue;
    const type = (raw as { type?: unknown }).type;
    if (type === 'ref') {
      const r = raw as Partial<RefSegment>;
      if (
        typeof r.targetDocumentId === 'string' &&
        UUID_RE.test(r.targetDocumentId) &&
        typeof r.relationType === 'string' &&
        REF_TYPE_SET.has(r.relationType)
      ) {
        const seg: RefSegment = {
          type: 'ref',
          relationType: r.relationType as RefRelationType,
          targetDocumentId: r.targetDocumentId,
        };
        if (typeof r.relationId === 'string' && UUID_RE.test(r.relationId))
          seg.relationId = r.relationId;
        if (typeof r.code === 'string' && r.code.trim()) seg.code = r.code.slice(0, 60);
        if (typeof r.title === 'string' && r.title.trim()) seg.title = r.title.slice(0, 200);
        segs.push(seg);
      }
    } else if (type === 'text') {
      const t =
        typeof (raw as { text?: unknown }).text === 'string' ? (raw as TextSegment).text : '';
      if (t && textBudget > 0) {
        const clipped = t.replace(/\r\n?/g, '\n').slice(0, textBudget);
        textBudget -= clipped.length;
        if (clipped) segs.push({ type: 'text', text: clipped });
      }
    }
  }

  const merged = mergeSegments(segs);
  // Sin referencias → texto plano; vacío → cadena vacía.
  if (!merged.some((s) => s.type === 'ref')) {
    return merged.map((s) => (s as TextSegment).text).join('');
  }
  return { segments: merged };
}

/** Texto plano de un valor (para validación, longitud y búsqueda). */
export function richPlainText(value: RichValue): string {
  if (typeof value === 'string') return value;
  return value.segments.map((s) => (s.type === 'text' ? s.text : (s.code ?? ''))).join('');
}

/** ¿El valor tiene contenido (texto o al menos una referencia)? */
export function richHasContent(value: RichValue): boolean {
  if (typeof value === 'string') return value.trim() !== '';
  return value.segments.some((s) => (s.type === 'text' ? s.text.trim() !== '' : true));
}

/** Segmentos de referencia de un valor. */
export function richReferences(value: RichValue): RefSegment[] {
  if (typeof value === 'string') return [];
  return value.segments.filter((s): s is RefSegment => s.type === 'ref');
}

/** Clave de deduplicación de una referencia (tipo + destino). */
export function refKey(relationType: RefRelationType, targetDocumentId: string): string {
  return `${relationType}:${targetDocumentId}`;
}
