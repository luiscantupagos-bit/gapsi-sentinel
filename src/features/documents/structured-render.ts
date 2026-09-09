/**
 * Renderer normalizado de documentos estructurados (DOC-001 §23/§24/§10,
 * DOC-002 §11/§12/§20/§49).
 *
 * Transforma DATOS estructurados (`StructuredContent`) + IDENTIFICACIÓN + las
 * REFERENCIAS resueltas en un HTML limpio y determinista: HEADER + cuerpo por
 * secciones + referencias inline (chips/links) + secciones "Documentos
 * referenciados" y "Formatos y registros". Sin DOM ni dependencias; escapa todo
 * texto. Reutilizable para vista previa y exportación futura.
 *
 * El renderer NO consulta la BD: recibe la identificación y el resolvedor de
 * referencias ya calculados por el servidor. Marca fija "C3 Sentinel" (§45).
 */
import { getTemplateDefinition } from './template-registry';
import { extractReferences, type StructuredContent, type RichValue } from './structured-content';
import { type RefSegment } from './references';

export interface RenderIdentity {
  organizationName?: string | null;
  typeLabel: string;
  code: string;
  versionLabel: string;
  title: string;
  areaLabel?: string | null;
  issuedAt?: string | null; // ISO YYYY-MM-DD
  nextReviewAt?: string | null; // ISO YYYY-MM-DD
}

/** Datos actuales de un documento referenciado (resueltos por id, no por código). */
export interface ResolvedReference {
  documentId: string;
  code: string;
  title: string;
  typeLabel?: string;
  versionLabel?: string | null;
  statusLabel?: string;
  obsolete?: boolean;
  /** false → no encontrado o sin permisos: no se exponen datos. */
  available: boolean;
}
/** Mapa targetDocumentId → datos actuales. */
export type ReferenceResolver = Record<string, ResolvedReference>;

const SYSTEM_BRAND = 'C3 Sentinel';
const EMPTY = '—';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Chip/link de una referencia, resuelto por id (nunca expone datos si no visible). */
function renderChip(seg: RefSegment, resolved: ReferenceResolver): string {
  const r = resolved[seg.targetDocumentId];
  if (!r || !r.available) {
    return `<span class="doc-ref doc-ref--missing" title="Referencia no disponible">Referencia no disponible</span>`;
  }
  const cls = r.obsolete ? 'doc-ref doc-ref--obsolete' : 'doc-ref';
  const label = `${esc(r.code)}${r.title ? ` — ${esc(r.title)}` : ''}${r.obsolete ? ' · Obsoleto' : ''}`;
  return `<a class="${cls}" href="/dashboard/documents/${esc(r.documentId)}">${label}</a>`;
}

function segmentsToHtml(value: Exclude<RichValue, string>, resolved: ReferenceResolver): string {
  return value.segments
    .map((seg) =>
      seg.type === 'text' ? esc(seg.text).replace(/\n/g, '<br>') : renderChip(seg, resolved),
    )
    .join('');
}

/** Cuerpo de campo (párrafos si es texto plano; flujo con chips si es rich). */
function richBody(value: RichValue, resolved: ReferenceResolver): string {
  if (typeof value === 'string') {
    const v = value.trim();
    if (!v) return `<span class="doc-render__empty">${EMPTY}</span>`;
    return v
      .split(/\n{2,}/)
      .map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }
  const inner = segmentsToHtml(value, resolved);
  return inner ? `<p>${inner}</p>` : `<span class="doc-render__empty">${EMPTY}</span>`;
}

/** Valor inline (celdas de tabla). */
function richInline(value: RichValue, resolved: ReferenceResolver): string {
  if (typeof value === 'string') {
    const v = value.trim();
    return v ? esc(v) : `<span class="doc-render__empty">${EMPTY}</span>`;
  }
  const inner = segmentsToHtml(value, resolved);
  return inner || `<span class="doc-render__empty">${EMPTY}</span>`;
}

function inlineText(value: string): string {
  const v = value.trim();
  return v ? esc(v) : `<span class="doc-render__empty">${EMPTY}</span>`;
}

function metaRow(label: string, value: string): string {
  return `<div class="doc-render__meta-item"><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
}

function renderHeader(identity: RenderIdentity): string {
  const org = identity.organizationName?.trim();
  const rows = [
    metaRow('Tipo', inlineText(identity.typeLabel)),
    metaRow('Código', inlineText(identity.code)),
    metaRow('Versión', inlineText(identity.versionLabel)),
    metaRow('Área', inlineText(identity.areaLabel ?? '')),
    metaRow('Fecha de emisión', inlineText(identity.issuedAt ?? '')),
    metaRow('Próxima revisión', inlineText(identity.nextReviewAt ?? '')),
  ].join('');
  return `
    <header class="doc-render__header">
      <div class="doc-render__brand">
        <span class="doc-render__system">${SYSTEM_BRAND}</span>
        ${org ? `<span class="doc-render__org">${esc(org)}</span>` : ''}
      </div>
      <h1 class="doc-render__title">${inlineText(identity.title)}</h1>
      <dl class="doc-render__meta">${rows}</dl>
    </header>`;
}

function renderFields(
  fields: { key: string; label: string; kind: string }[],
  content: StructuredContent,
  resolved: ReferenceResolver,
): string {
  const items = fields
    .map((f) => {
      const value = content.fields[f.key] ?? '';
      const body =
        f.kind === 'textarea' ? richBody(value, resolved) : `<p>${richInline(value, resolved)}</p>`;
      return `<div class="doc-render__field"><h3>${esc(f.label)}</h3>${body}</div>`;
    })
    .join('');
  return `<div class="doc-render__fields">${items}</div>`;
}

function renderRepeatable(
  rep: {
    key: string;
    label: string;
    autoNumber?: boolean;
    fields: { key: string; label: string }[];
  },
  content: StructuredContent,
  resolved: ReferenceResolver,
): string {
  const items = content.repeatables[rep.key] ?? [];
  if (items.length === 0) {
    return `<p class="doc-render__empty">Sin ${esc(rep.label.toLowerCase())} registradas.</p>`;
  }
  const headCols = [
    rep.autoNumber ? '<th class="doc-render__num">#</th>' : '',
    ...rep.fields.map((f) => `<th>${esc(f.label)}</th>`),
  ].join('');
  const rows = items
    .map((item, index) => {
      const cells = [
        rep.autoNumber ? `<td class="doc-render__num">${index + 1}</td>` : '',
        ...rep.fields.map((f) => `<td>${richInline(item[f.key] ?? '', resolved)}</td>`),
      ].join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<div class="doc-render__table-wrap"><table class="doc-render__table"><thead><tr>${headCols}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** Tabla de una sección de referencias (Documentos referenciados / Formatos). */
function renderReferenceTable(refs: RefSegment[], resolved: ReferenceResolver): string {
  const rows = refs
    .map((ref) => {
      const r = resolved[ref.targetDocumentId];
      if (!r || !r.available) {
        return `<tr><td colspan="4" class="doc-render__empty">Referencia no disponible</td></tr>`;
      }
      const status = `${esc(r.statusLabel ?? '')}${r.obsolete ? ' · Obsoleto' : ''}`;
      return `<tr><td class="doc-render__num">${esc(r.code)}</td><td><a class="doc-ref" href="/dashboard/documents/${esc(r.documentId)}">${esc(r.title)}</a></td><td>${esc(r.versionLabel ?? EMPTY)}</td><td>${status || EMPTY}</td></tr>`;
    })
    .join('');
  return `<div class="doc-render__table-wrap"><table class="doc-render__table"><thead><tr><th>Código</th><th>Documento</th><th>Versión</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function referenceSection(
  title: string,
  refs: RefSegment[],
  resolved: ReferenceResolver,
  emptyText: string,
  showWhenEmpty: boolean,
): string {
  if (refs.length === 0) {
    if (!showWhenEmpty) return '';
    return `<section class="doc-render__section doc-render__section--future"><h2>${esc(title)}</h2><p class="doc-render__empty">${esc(emptyText)}</p></section>`;
  }
  return `<section class="doc-render__section"><h2>${esc(title)}</h2>${renderReferenceTable(refs, resolved)}</section>`;
}

/**
 * Renderiza el documento estructurado completo a HTML seguro (header + cuerpo +
 * referencias). `resolved` mapea cada targetDocumentId a sus datos actuales.
 */
export function renderStructuredHtml(
  templateType: string,
  content: StructuredContent,
  identity: RenderIdentity,
  resolved: ReferenceResolver = {},
): string {
  const def = getTemplateDefinition(templateType);
  const sections: string[] = [renderHeader(identity)];

  if (def && def.supportsStructuredEditor) {
    for (const section of def.sections) {
      const body =
        section.kind === 'fields'
          ? renderFields(section.fields, content, resolved)
          : renderRepeatable(section.repeatable, content, resolved);
      const desc = section.description
        ? `<p class="doc-render__section-desc">${esc(section.description)}</p>`
        : '';
      sections.push(
        `<section class="doc-render__section"><h2>${esc(section.title)}</h2>${desc}${body}</section>`,
      );
    }

    // Referencias (DOC-002). El Procedimiento muestra siempre las secciones
    // (con su diagrama de flujo futuro §10); otros tipos, solo si hay referencias.
    const isProcedure = templateType === 'procedure';
    const referenced = extractReferences(content)
      .filter((r) => r.relationType === 'reference')
      .map((r) => richRefFor(r.targetDocumentId, 'reference'));
    const forms = extractReferences(content)
      .filter((r) => r.relationType === 'issued_form')
      .map((r) => richRefFor(r.targetDocumentId, 'issued_form'));

    if (isProcedure) {
      sections.push(
        `<section class="doc-render__section doc-render__section--future"><h2>Diagrama de flujo</h2><p class="doc-render__empty">No generado todavía.</p></section>`,
      );
    }
    sections.push(
      referenceSection(
        'Documentos referenciados',
        referenced,
        resolved,
        'Sin documentos referenciados.',
        isProcedure,
      ),
      referenceSection(
        'Formatos y registros relacionados',
        forms,
        resolved,
        'Sin formatos ni registros asociados.',
        isProcedure,
      ),
    );
  }

  return `<article class="doc-render">${sections.join('')}</article>`;
}

/** Construye un RefSegment mínimo (solo id + tipo) para las tablas de sección. */
function richRefFor(
  targetDocumentId: string,
  relationType: 'reference' | 'issued_form',
): RefSegment {
  return { type: 'ref', relationType, targetDocumentId };
}
