/**
 * Renderer normalizado de documentos estructurados (DOC-001 §23/§24/§10).
 *
 * Transforma DATOS estructurados (`StructuredContent`) + IDENTIFICACIÓN de la
 * entidad en un HTML limpio y determinista: HEADER (C3 Sentinel, tipo, código,
 * versión, nombre, área, fechas) + cuerpo por secciones del registro. Sin DOM ni
 * dependencias: mismo patrón seguro que `content-schema.ts`. Reutilizable para la
 * vista previa (solo lectura) y, más adelante, para exportar a PDF/DOCX.
 *
 * El renderer NO consulta la BD: recibe la identificación ya resuelta. La marca
 * del sistema es fija "C3 Sentinel" (§45).
 */
import { getTemplateDefinition } from './template-registry';
import type { StructuredContent } from './structured-content';

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

const SYSTEM_BRAND = 'C3 Sentinel';
const EMPTY = '—';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Texto multilínea → párrafos/saltos seguros. */
function multiline(value: string): string {
  const v = value.trim();
  if (!v) return `<span class="doc-render__empty">${EMPTY}</span>`;
  return v
    .split(/\n{2,}/)
    .map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function inline(value: string): string {
  const v = value.trim();
  return v ? esc(v) : `<span class="doc-render__empty">${EMPTY}</span>`;
}

function metaRow(label: string, value: string): string {
  return `<div class="doc-render__meta-item"><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
}

function renderHeader(identity: RenderIdentity): string {
  const org = identity.organizationName?.trim();
  const rows = [
    metaRow('Tipo', inline(identity.typeLabel)),
    metaRow('Código', inline(identity.code)),
    metaRow('Versión', inline(identity.versionLabel)),
    metaRow('Área', inline(identity.areaLabel ?? '')),
    metaRow('Fecha de emisión', inline(identity.issuedAt ?? '')),
    metaRow('Próxima revisión', inline(identity.nextReviewAt ?? '')),
  ].join('');
  return `
    <header class="doc-render__header">
      <div class="doc-render__brand">
        <span class="doc-render__system">${SYSTEM_BRAND}</span>
        ${org ? `<span class="doc-render__org">${esc(org)}</span>` : ''}
      </div>
      <h1 class="doc-render__title">${inline(identity.title)}</h1>
      <dl class="doc-render__meta">${rows}</dl>
    </header>`;
}

function renderFields(
  fields: { key: string; label: string; kind: string }[],
  content: StructuredContent,
): string {
  const items = fields
    .map((f) => {
      const value = content.fields[f.key] ?? '';
      const body = f.kind === 'textarea' ? multiline(value) : `<p>${inline(value)}</p>`;
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
        ...rep.fields.map((f) => `<td>${inline(item[f.key] ?? '')}</td>`),
      ].join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<div class="doc-render__table-wrap"><table class="doc-render__table"><thead><tr>${headCols}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** Secciones futuras del Procedimiento (§10): render-only, sin datos aún. */
function renderProcedureFutureSections(): string {
  const note = (title: string, text: string) =>
    `<section class="doc-render__section doc-render__section--future"><h2>${esc(title)}</h2><p class="doc-render__empty">${esc(text)}</p></section>`;
  return [
    note('Diagrama de flujo', 'No generado todavía.'),
    note('Documentos referenciados', 'Sin documentos referenciados.'),
    note('Formatos y registros', 'Sin formatos ni registros asociados.'),
  ].join('');
}

/**
 * Renderiza el documento estructurado completo a HTML seguro (header + cuerpo).
 * Devuelve solo el contenido interno (sin `<html>`), listo para envolver en la
 * hoja de vista previa o exportación.
 */
export function renderStructuredHtml(
  templateType: string,
  content: StructuredContent,
  identity: RenderIdentity,
): string {
  const def = getTemplateDefinition(templateType);
  const sections: string[] = [renderHeader(identity)];

  if (def && def.supportsStructuredEditor) {
    for (const section of def.sections) {
      const body =
        section.kind === 'fields'
          ? renderFields(section.fields, content)
          : renderRepeatable(section.repeatable, content);
      const desc = section.description
        ? `<p class="doc-render__section-desc">${esc(section.description)}</p>`
        : '';
      sections.push(
        `<section class="doc-render__section"><h2>${esc(section.title)}</h2>${desc}${body}</section>`,
      );
    }
    if (templateType === 'procedure') {
      sections.push(renderProcedureFutureSections());
    }
  }

  return `<article class="doc-render">${sections.join('')}</article>`;
}
