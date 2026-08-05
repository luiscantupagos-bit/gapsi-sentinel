/**
 * Esquema de contenido del editor documental (TASK-005).
 *
 * Modelo de contenido: JSON estructurado tipo ProseMirror/TipTap. La seguridad
 * se aplica en SERVIDOR con un saneador ALLOWLIST (descarta nodos/marcas
 * desconocidos, valida enlaces e imágenes) y un serializador a HTML seguro para
 * la vista previa. NO usa DOM ni TipTap; es puro y determinista.
 *
 * `CONTENT_SCHEMA_VERSION` permite compatibilidad futura.
 */
import { createHash } from 'node:crypto';
import {
  ALLOWED_FONT_SIZES,
  ALLOWED_FONT_VALUES,
  TEXT_ALIGNMENTS,
  isSafeColor,
} from './editor-config';

export const CONTENT_SCHEMA_VERSION = 1;

export function maxContentBytes(): number {
  const raw = Number(process.env.DOCUMENTS_MAX_CONTENT_BYTES);
  return Number.isFinite(raw) && raw > 0 ? raw : 512 * 1024; // 512 KB por defecto
}

export interface DocMark {
  type: string;
  attrs?: Record<string, unknown>;
}
export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: DocMark[];
  text?: string;
}

export const EMPTY_DOC: DocNode = { type: 'doc', content: [{ type: 'paragraph' }] };

const BLOCK_CHILDREN_ALLOWED: Record<string, Set<string>> = {
  doc: new Set([
    'paragraph',
    'heading',
    'bulletList',
    'orderedList',
    'blockquote',
    'horizontalRule',
    'pageBreak',
    'table',
    'image',
  ]),
  blockquote: new Set(['paragraph', 'heading']),
  bulletList: new Set(['listItem']),
  orderedList: new Set(['listItem']),
  listItem: new Set(['paragraph', 'bulletList', 'orderedList']),
  table: new Set(['tableRow']),
  tableRow: new Set(['tableHeader', 'tableCell']),
  tableHeader: new Set(['paragraph']),
  tableCell: new Set(['paragraph']),
};

const INLINE_PARENTS = new Set(['paragraph', 'heading']);

function isInternalPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\/dashboard\/documents\/[^"'<>\\]*\/files\/[^"'<>\\]*$/.test(value)
  );
}

function isSafeLink(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (/^(https?:|mailto:)/i.test(value)) return true;
  if (/^\/[^/]/.test(value)) return true; // ruta interna relativa
  return false;
}

function sanitizeMarks(marks: unknown): DocMark[] {
  if (!Array.isArray(marks)) return [];
  const out: DocMark[] = [];
  for (const m of marks) {
    if (!m || typeof m !== 'object') continue;
    const type = (m as DocMark).type;
    const attrs = (m as DocMark).attrs ?? {};
    switch (type) {
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strike':
        out.push({ type });
        break;
      case 'link':
        if (isSafeLink(attrs.href)) {
          out.push({
            type: 'link',
            attrs: { href: String(attrs.href), target: '_blank', rel: 'noopener noreferrer' },
          });
        }
        break;
      case 'highlight':
        out.push({
          type: 'highlight',
          attrs: isSafeColor(attrs.color) ? { color: attrs.color } : {},
        });
        break;
      case 'textStyle': {
        const clean: Record<string, unknown> = {};
        if (isSafeColor(attrs.color)) clean.color = attrs.color;
        if (typeof attrs.fontFamily === 'string' && ALLOWED_FONT_VALUES.has(attrs.fontFamily)) {
          clean.fontFamily = attrs.fontFamily;
        }
        if (typeof attrs.fontSize === 'string' && ALLOWED_FONT_SIZES.has(attrs.fontSize)) {
          clean.fontSize = attrs.fontSize;
        }
        if (Object.keys(clean).length) out.push({ type: 'textStyle', attrs: clean });
        break;
      }
      default:
        break; // marca desconocida → descartada
    }
  }
  return out;
}

function alignAttr(attrs: Record<string, unknown> | undefined): string | undefined {
  const a = attrs?.textAlign;
  return typeof a === 'string' && (TEXT_ALIGNMENTS as readonly string[]).includes(a)
    ? a
    : undefined;
}

function posInt(value: unknown, fallback = 1): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function sanitizeNode(node: unknown, parentType: string): DocNode | null {
  if (!node || typeof node !== 'object') return null;
  const type = (node as DocNode).type;
  if (typeof type !== 'string') return null;

  // Nodos de texto (inline)
  if (type === 'text') {
    if (!INLINE_PARENTS.has(parentType)) return null;
    const text = (node as DocNode).text;
    if (typeof text !== 'string' || text.length === 0) return null;
    return { type: 'text', text, marks: sanitizeMarks((node as DocNode).marks) };
  }
  if (type === 'hardBreak') {
    return INLINE_PARENTS.has(parentType) ? { type: 'hardBreak' } : null;
  }

  // Imagen (puede ir en doc o en párrafo)
  if (type === 'image') {
    const attrs = (node as DocNode).attrs ?? {};
    if (!isInternalPath(attrs.src)) return null;
    const width = Math.min(100, Math.max(10, posInt(attrs.width, 100)));
    const align = ['left', 'center', 'right'].includes(String(attrs.align))
      ? String(attrs.align)
      : 'left';
    return {
      type: 'image',
      attrs: {
        src: String(attrs.src),
        alt: typeof attrs.alt === 'string' ? attrs.alt.slice(0, 300) : '',
        width,
        align,
      },
    };
  }

  const childrenAllowed = BLOCK_CHILDREN_ALLOWED[type];
  const isInlineContainer = INLINE_PARENTS.has(type);
  if (!childrenAllowed && !isInlineContainer) return null; // nodo desconocido

  const attrs: Record<string, unknown> = {};
  if (type === 'heading')
    attrs.level = [1, 2, 3].includes(Number((node as DocNode).attrs?.level))
      ? Number((node as DocNode).attrs?.level)
      : 1;
  if (type === 'paragraph' || type === 'heading') {
    const al = alignAttr((node as DocNode).attrs);
    if (al) attrs.textAlign = al;
  }
  if (type === 'tableHeader' || type === 'tableCell') {
    attrs.colspan = posInt((node as DocNode).attrs?.colspan, 1);
    attrs.rowspan = posInt((node as DocNode).attrs?.rowspan, 1);
    const bg = (node as DocNode).attrs?.backgroundColor;
    if (isSafeColor(bg)) attrs.backgroundColor = bg;
  }

  const rawChildren = Array.isArray((node as DocNode).content) ? (node as DocNode).content! : [];
  const content: DocNode[] = [];
  for (const child of rawChildren) {
    const allowedSet = childrenAllowed;
    const childType = (child as DocNode)?.type;
    if (isInlineContainer && (childType === 'text' || childType === 'hardBreak')) {
      const c = sanitizeNode(child, type);
      if (c) content.push(c);
    } else if (allowedSet && typeof childType === 'string' && allowedSet.has(childType)) {
      const c = sanitizeNode(child, type);
      if (c) content.push(c);
    }
  }

  const result: DocNode = { type };
  if (Object.keys(attrs).length) result.attrs = attrs;
  // Nodos vacíos permitidos: paragraph, tableCell/Header, horizontalRule, pageBreak
  if (content.length) result.content = content;
  else if (['paragraph', 'tableHeader', 'tableCell'].includes(type)) result.content = [];
  return result;
}

/** Sanea el documento completo. Devuelve siempre un `doc` válido. */
export function sanitizeContent(input: unknown): DocNode {
  if (!input || typeof input !== 'object' || (input as DocNode).type !== 'doc') {
    return structuredClone(EMPTY_DOC);
  }
  const clean = sanitizeNode(input, 'root');
  if (!clean || clean.type !== 'doc' || !clean.content || clean.content.length === 0) {
    return structuredClone(EMPTY_DOC);
  }
  return clean;
}

export function contentByteSize(doc: DocNode): number {
  return Buffer.byteLength(JSON.stringify(doc), 'utf8');
}

export function contentChecksum(doc: DocNode): string {
  return createHash('sha256').update(JSON.stringify(doc)).digest('hex');
}

// --- Serializador a HTML seguro (para la vista previa / solo lectura) ---------

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderText(node: DocNode): string {
  let html = esc(node.text ?? '');
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case 'bold':
        html = `<strong>${html}</strong>`;
        break;
      case 'italic':
        html = `<em>${html}</em>`;
        break;
      case 'underline':
        html = `<u>${html}</u>`;
        break;
      case 'strike':
        html = `<s>${html}</s>`;
        break;
      case 'highlight':
        html = `<mark${mark.attrs?.color ? ` style="background-color:${esc(String(mark.attrs.color))}"` : ''}>${html}</mark>`;
        break;
      case 'link':
        html = `<a href="${esc(String(mark.attrs?.href ?? '#'))}" target="_blank" rel="noopener noreferrer">${html}</a>`;
        break;
      case 'textStyle': {
        const styles: string[] = [];
        if (mark.attrs?.color) styles.push(`color:${esc(String(mark.attrs.color))}`);
        if (mark.attrs?.fontFamily)
          styles.push(`font-family:${esc(String(mark.attrs.fontFamily))}`);
        if (mark.attrs?.fontSize) styles.push(`font-size:${esc(String(mark.attrs.fontSize))}`);
        if (styles.length) html = `<span style="${styles.join(';')}">${html}</span>`;
        break;
      }
      default:
        break;
    }
  }
  return html;
}

function alignStyle(node: DocNode): string {
  const a = node.attrs?.textAlign;
  return a ? ` style="text-align:${esc(String(a))}"` : '';
}

function renderNode(node: DocNode): string {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(renderNode).join('');
    case 'paragraph':
      return `<p${alignStyle(node)}>${(node.content ?? []).map(renderNode).join('') || '<br>'}</p>`;
    case 'heading': {
      const level = [1, 2, 3].includes(Number(node.attrs?.level)) ? Number(node.attrs?.level) : 1;
      return `<h${level}${alignStyle(node)}>${(node.content ?? []).map(renderNode).join('')}</h${level}>`;
    }
    case 'text':
      return renderText(node);
    case 'hardBreak':
      return '<br>';
    case 'bulletList':
      return `<ul>${(node.content ?? []).map(renderNode).join('')}</ul>`;
    case 'orderedList':
      return `<ol>${(node.content ?? []).map(renderNode).join('')}</ol>`;
    case 'listItem':
      return `<li>${(node.content ?? []).map(renderNode).join('')}</li>`;
    case 'blockquote':
      return `<blockquote>${(node.content ?? []).map(renderNode).join('')}</blockquote>`;
    case 'horizontalRule':
      return '<hr>';
    case 'pageBreak':
      return '<hr class="page-break">';
    case 'table':
      return `<table><tbody>${(node.content ?? []).map(renderNode).join('')}</tbody></table>`;
    case 'tableRow':
      return `<tr>${(node.content ?? []).map(renderNode).join('')}</tr>`;
    case 'tableHeader':
    case 'tableCell': {
      const tag = node.type === 'tableHeader' ? 'th' : 'td';
      const attrs: string[] = [];
      if (Number(node.attrs?.colspan) > 1) attrs.push(`colspan="${Number(node.attrs?.colspan)}"`);
      if (Number(node.attrs?.rowspan) > 1) attrs.push(`rowspan="${Number(node.attrs?.rowspan)}"`);
      if (node.attrs?.backgroundColor)
        attrs.push(`style="background-color:${esc(String(node.attrs.backgroundColor))}"`);
      return `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>${(node.content ?? []).map(renderNode).join('')}</${tag}>`;
    }
    case 'image': {
      const src = esc(String(node.attrs?.src ?? ''));
      const alt = esc(String(node.attrs?.alt ?? ''));
      const width = Number(node.attrs?.width ?? 100);
      const align = String(node.attrs?.align ?? 'left');
      const margin =
        align === 'center'
          ? 'margin:0 auto;display:block'
          : align === 'right'
            ? 'margin-left:auto;display:block'
            : '';
      return `<img src="${src}" alt="${alt}" style="width:${width}%;${margin}">`;
    }
    default:
      return '';
  }
}

export function renderContentHtml(doc: DocNode): string {
  return renderNode(doc);
}
