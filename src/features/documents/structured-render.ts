/**
 * Renderer normalizado de documentos estructurados (DOC-001/002 + DOC-UX-001).
 *
 * Transforma DATOS estructurados + IDENTIFICACIÓN + referencias resueltas en un
 * HTML limpio, determinista y print-friendly:
 *   ENCABEZADO (branding de la ORGANIZACIÓN + identificación) · cuerpo por
 *   secciones · referencias/formatos · CONTROL DE CAMBIOS · PIE institucional
 *   (confidencialidad + atribución discreta a C3 Sentinel).
 *
 * Modos (§55): `published_document` (limpio y definitivo: omite secciones/campos
 * opcionales vacíos) y `editor_preview` (muestra placeholders útiles). Tema
 * documental por organización aplicado con moderación vía variables CSS. Sin DOM
 * ni dependencias; escapa todo texto. El branding del CLIENTE va en el
 * encabezado; C3 Sentinel va en el pie (§12/§58).
 */
import { getTemplateDefinition } from './template-registry';
import { extractReferences, type StructuredContent, type RichValue } from './structured-content';
import { richHasContent, type RefSegment } from './references';
import { getDocumentDesign } from './document-design';
import { readableTextColor } from './contrast';
import { scheduleLabel, type ProgramBlock } from './program-execution';

export interface RenderIdentity {
  organizationName?: string | null;
  organizationLogoUrl?: string | null;
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
  available: boolean;
}
export type ReferenceResolver = Record<string, ResolvedReference>;

/** Tema documental por organización (solo colores HEX validados). */
export interface DocumentTheme {
  primary: string;
  secondary: string;
  accent: string;
  /** Color del texto del cuerpo (DOC-UX-002 §96). */
  text: string;
  /** Color del texto en encabezados/títulos (DOC-UX-002 §96). */
  heading: string;
}
/** Fila del Control de cambios (derivada del versionado, §40/§41). */
export interface ChangeLogRow {
  version: string;
  date: string | null;
  change: string;
  author: string;
}
/**
 * Marca de una salida controlada (DOC-UX-002 §72/§77/§81/§82). `controlled` emite
 * "COPIA CONTROLADA" + folio; `draft` marca "BORRADOR — NO CONTROLADO" (sin folio);
 * `obsolete` marca "DOCUMENTO OBSOLETO — COPIA NO CONTROLADA".
 */
export interface CopyMark {
  kind: 'controlled' | 'draft' | 'obsolete';
  folio?: string | null;
  destinationLabel?: string | null;
  reason?: string | null;
  issuedByName?: string | null;
  issuedAt?: string | null;
}
export type RenderMode = 'editor_preview' | 'published_document' | 'controlled_copy';
export interface RenderOptions {
  resolved?: ReferenceResolver;
  mode?: RenderMode;
  theme?: DocumentTheme | null;
  changeLog?: ChangeLogRow[];
  /** Id de diseño documental (DOC-UX-002). Desconocido → fallback seguro. */
  design?: string | null;
  /** Atribución C3 EFECTIVA (ya resuelta en servidor con el entitlement). Default: true. */
  showC3Attribution?: boolean;
  /** Marca de salida controlada (solo en `controlled_copy`). */
  copyMark?: CopyMark | null;
  /** DOC-003: nombres de usuario por id, para el render del bloque de programa. */
  users?: Record<string, string>;
}

const CONFIDENTIAL_URL = 'https://www.c3digital.com.mx';
const EMPTY = '—';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Solo colores HEX (#RGB / #RRGGBB); cualquier otra cosa → fallback. */
function safeHex(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
    ? value
    : fallback;
}

// --- Contenido rich (texto + referencias) ------------------------------------

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

// --- Encabezado (branding de la organización + identificación) ----------------

function metaRow(label: string, value: string): string {
  return `<div class="doc-render__meta-item"><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
}

function renderHeader(identity: RenderIdentity): string {
  const org = identity.organizationName?.trim() || 'Organización';
  const brand = identity.organizationLogoUrl
    ? `<img class="doc-render__org-logo" src="${esc(identity.organizationLogoUrl)}" alt="${esc(org)}">`
    : `<span class="doc-render__org-name">${esc(org)}</span>`;
  const rows = [
    metaRow('Código', inlineText(identity.code)),
    metaRow('Versión', inlineText(identity.versionLabel)),
    metaRow('Área', inlineText(identity.areaLabel ?? '')),
    metaRow('Tipo', inlineText(identity.typeLabel)),
    metaRow('Fecha de emisión', inlineText(identity.issuedAt ?? '')),
    metaRow('Próxima revisión', inlineText(identity.nextReviewAt ?? '')),
  ].join('');
  // thead-friendly: en impresión el encabezado se repite por página (CSS print).
  return `
    <header class="doc-render__header">
      <div class="doc-render__org-brand">${brand}</div>
      <div class="doc-render__docid">
        <h1 class="doc-render__title">${inlineText(identity.title)}</h1>
        <dl class="doc-render__meta">${rows}</dl>
      </div>
    </header>`;
}

// --- Pie institucional (confidencialidad + atribución C3) ----------------------

function renderFooter(identity: RenderIdentity, showC3Attribution: boolean): string {
  const org = identity.organizationName?.trim() || 'la organización';
  // §90: ocultar la atribución comercial NUNCA oculta la leyenda de
  // confidencialidad (marca de seguridad del documento).
  const attribution = showC3Attribution
    ? `<p class="doc-render__attribution">Documento administrado mediante <strong>C3 Sentinel</strong> — Sistema inteligente de gestión, cumplimiento y mejora continua. <a href="${CONFIDENTIAL_URL}">www.c3digital.com.mx</a></p>`
    : '';
  return `
    <footer class="doc-render__footer">
      <p class="doc-render__confidential">DOCUMENTO CONTROLADO Y CONFIDENCIAL</p>
      <p>Prohibida su reproducción total o parcial sin autorización expresa de «${esc(org)}».</p>
      ${attribution}
    </footer>`;
}

// --- Salida controlada: watermark + bloque de copia (DOC-UX-002 §72/§77) --------

function renderCopyMark(mark: CopyMark): string {
  // Estilo propio de la marca de agua (§104): NO usa el tema del cliente, para
  // garantizar contraste/legibilidad. El documento almacenado no se altera (§73).
  const watermarkText =
    mark.kind === 'controlled'
      ? 'COPIA CONTROLADA'
      : mark.kind === 'draft'
        ? 'BORRADOR — NO CONTROLADO'
        : 'DOCUMENTO OBSOLETO — COPIA NO CONTROLADA';
  const wmClass =
    mark.kind === 'obsolete'
      ? 'doc-copy__watermark doc-copy__watermark--obsolete'
      : 'doc-copy__watermark';
  const watermark = `<div class="${wmClass}" aria-hidden="true"><span>${esc(watermarkText)}</span></div>`;

  const rows: string[] = [];
  if (mark.kind === 'controlled') {
    if (mark.folio) rows.push(metaRow('Copia', esc(mark.folio)));
    if (mark.destinationLabel) rows.push(metaRow('Destino', esc(mark.destinationLabel)));
    if (mark.reason) rows.push(metaRow('Motivo de descarga', esc(mark.reason)));
  } else {
    rows.push(
      metaRow(
        'Aviso',
        mark.kind === 'draft'
          ? 'Borrador sin control formal. No es una copia controlada.'
          : 'Versión obsoleta. Copia no controlada; verifique la versión vigente.',
      ),
    );
  }
  if (mark.issuedByName) rows.push(metaRow('Generada por', esc(mark.issuedByName)));
  if (mark.issuedAt) rows.push(metaRow('Fecha', esc(mark.issuedAt)));

  const banner =
    mark.kind === 'controlled'
      ? ''
      : `<p class="doc-copy__banner doc-copy__banner--${mark.kind}">${esc(watermarkText)}</p>`;
  return `${watermark}<aside class="doc-copy__info"><dl class="doc-render__meta">${rows.join('')}</dl>${banner}</aside>`;
}

// --- Cuerpo ------------------------------------------------------------------

function renderFields(
  fields: { key: string; label: string; kind: string; required?: boolean }[],
  content: StructuredContent,
  resolved: ReferenceResolver,
  mode: RenderMode,
): string {
  const items = fields
    .filter((f) => {
      // Published: omite campos OPCIONALES vacíos (§54). Los obligatorios siempre.
      if (mode === 'published_document' && !f.required) {
        return richHasContent(content.fields[f.key] ?? '');
      }
      return true;
    })
    .map((f) => {
      const value = content.fields[f.key] ?? '';
      const body =
        f.kind === 'textarea' ? richBody(value, resolved) : `<p>${richInline(value, resolved)}</p>`;
      return `<div class="doc-render__field"><h3>${esc(f.label)}</h3>${body}</div>`;
    });
  return items.length ? `<div class="doc-render__fields">${items.join('')}</div>` : '';
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

// --- Referencias / formatos ---------------------------------------------------

function renderReferenceTable(refs: RefSegment[], resolved: ReferenceResolver): string {
  const rows = refs
    .map((ref) => {
      const r = resolved[ref.targetDocumentId];
      if (!r || !r.available) {
        return `<tr><td colspan="4" class="doc-render__empty">Referencia no disponible</td></tr>`;
      }
      const status = `${esc(r.statusLabel ?? '')}${r.obsolete ? ' · Obsoleto' : ''}`;
      return `<tr><td class="doc-render__code">${esc(r.code)}</td><td><a class="doc-ref" href="/dashboard/documents/${esc(r.documentId)}">${esc(r.title)}</a></td><td>${esc(r.versionLabel ?? EMPTY)}</td><td>${status || EMPTY}</td></tr>`;
    })
    .join('');
  return `<div class="doc-render__table-wrap"><table class="doc-render__table"><thead><tr><th>Código</th><th>Documento</th><th>Versión</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** Sección de referencias. En published solo se muestra si hay datos (§54). */
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

// --- Control de cambios (§39-48) ---------------------------------------------

function renderChangeLog(rows: ChangeLogRow[]): string {
  if (rows.length === 0) return '';
  const body = rows
    .map(
      (r) =>
        `<tr><td class="doc-render__num">${esc(r.version)}</td><td>${esc(r.date ?? EMPTY)}</td><td>${esc(r.change)}</td><td>${esc(r.author)}</td></tr>`,
    )
    .join('');
  return `<section class="doc-render__section"><h2>Control de cambios</h2><div class="doc-render__table-wrap"><table class="doc-render__table"><thead><tr><th>Versión</th><th>Fecha</th><th>Modificación realizada</th><th>Realizado por</th></tr></thead><tbody>${body}</tbody></table></div></section>`;
}

function richRefFor(
  targetDocumentId: string,
  relationType: 'reference' | 'issued_form',
): RefSegment {
  return { type: 'ref', relationType, targetDocumentId };
}

function themeStyle(theme: DocumentTheme | null | undefined): string {
  if (!theme) return '';
  const primary = safeHex(theme.primary, '#0f2440');
  const secondary = safeHex(theme.secondary, '#e3e8ef');
  const accent = safeHex(theme.accent, '#2563eb');
  const text = safeHex(theme.text, '#1f2937');
  const heading = safeHex(theme.heading, '#0f2440');
  // §10/§14.B: texto legible (WCAG) sobre el fondo de las cabeceras de tabla.
  const tableHeadText = readableTextColor(secondary);
  return ` style="--doc-primary:${primary};--doc-secondary:${secondary};--doc-accent:${accent};--doc-text:${text};--doc-heading:${heading};--doc-table-head-text:${tableHeadText}"`;
}

/**
 * Renderiza el documento estructurado completo a HTML seguro.
 */
export function renderStructuredHtml(
  templateType: string,
  content: StructuredContent,
  identity: RenderIdentity,
  options: RenderOptions = {},
): string {
  const resolved = options.resolved ?? {};
  const users = options.users ?? {};
  const mode: RenderMode = options.mode ?? 'published_document';
  // Documento "limpio" (sin andamiaje de edición): publicado o copia controlada.
  const clean = mode === 'published_document' || mode === 'controlled_copy';
  const published = clean;
  const showC3Attribution = options.showC3Attribution ?? true;
  const def = getTemplateDefinition(templateType);
  const sections: string[] = [renderHeader(identity)];
  // Salida controlada: marca de agua + bloque de copia justo tras el encabezado.
  if (mode === 'controlled_copy' && options.copyMark) {
    sections.push(renderCopyMark(options.copyMark));
  }

  if (def && def.supportsStructuredEditor) {
    for (const section of def.sections) {
      const body =
        section.kind === 'fields'
          ? renderFields(section.fields, content, resolved, mode)
          : renderRepeatable(section.repeatable, content, resolved);
      // Published: omite una sección de campos que quedó totalmente vacía (§54).
      if (published && section.kind === 'fields' && body === '') continue;
      const desc = section.description
        ? `<p class="doc-render__section-desc">${esc(section.description)}</p>`
        : '';
      sections.push(
        `<section class="doc-render__section"><h2>${esc(section.title)}</h2>${desc}${body}</section>`,
      );
    }

    // Programa ejecutable (DOC-003): tabla formal de actividades (sin botones §67).
    if (templateType === 'program' && content.program) {
      sections.push(renderProgramBlock(content.program, users));
    }

    const referenced = extractReferences(content)
      .filter((r) => r.relationType === 'reference')
      .map((r) => richRefFor(r.targetDocumentId, 'reference'));
    const forms = extractReferences(content)
      .filter((r) => r.relationType === 'issued_form')
      .map((r) => richRefFor(r.targetDocumentId, 'issued_form'));

    // Diagrama de flujo (§53): placeholder solo en preview borrador; se omite en
    // el documento publicado.
    if (templateType === 'procedure' && !published) {
      sections.push(
        `<section class="doc-render__section doc-render__section--future"><h2>Diagrama de flujo</h2><p class="doc-render__empty">No generado todavía.</p></section>`,
      );
    }
    // Secciones de referencias: en preview el procedimiento las muestra siempre
    // (con placeholder); en published solo si hay datos (§54).
    const showEmpty = templateType === 'procedure' && !published;
    sections.push(
      referenceSection(
        'Documentos referenciados',
        referenced,
        resolved,
        'Sin documentos referenciados.',
        showEmpty,
      ),
      referenceSection(
        'Formatos y registros relacionados',
        forms,
        resolved,
        'Sin formatos ni registros asociados.',
        showEmpty,
      ),
    );

    // Control de cambios al final del documento formal (§46).
    if (options.changeLog && options.changeLog.length) {
      sections.push(renderChangeLog(options.changeLog));
    }
  }

  sections.push(renderFooter(identity, showC3Attribution));

  const design = getDocumentDesign(options.design);
  const classes = ['doc-render', design.cssClass];
  if (mode === 'controlled_copy') classes.push('doc-render--controlled-copy');
  return `<article class="${classes.join(' ')}"${themeStyle(options.theme)}>${sections.join('')}</article>`;
}

/** Render formal del bloque de programa (§67): actividades, programación, responsable. */
function renderProgramBlock(program: ProgramBlock, users: Record<string, string>): string {
  const period =
    program.periodStart || program.periodEnd
      ? `<p class="doc-render__section-desc">Periodo: ${esc(program.periodStart ?? EMPTY)} — ${esc(program.periodEnd ?? EMPTY)}</p>`
      : '';
  if (program.activities.length === 0) {
    return `<section class="doc-render__section"><h2>Actividades del programa</h2>${period}<p class="doc-render__empty">Sin actividades.</p></section>`;
  }
  const rows = program.activities
    .map((a, i) => {
      const resp = a.responsibleUserId ? (users[a.responsibleUserId] ?? 'Usuario') : EMPTY;
      const seguimiento = a.executionEnabled ? 'Sí' : 'No';
      return `<tr><td class="doc-render__num">${i + 1}</td><td>${inlineText(a.name)}</td><td>${esc(scheduleLabel(a.schedule))}</td><td>${esc(resp)}</td><td>${inlineText(a.expectedEvidence)}</td><td>${seguimiento}</td></tr>`;
    })
    .join('');
  return `<section class="doc-render__section"><h2>Actividades del programa</h2>${period}<div class="doc-render__table-wrap"><table class="doc-render__table"><thead><tr><th class="doc-render__num">#</th><th>Actividad</th><th>Programación</th><th>Responsable</th><th>Evidencia esperada</th><th>Seguimiento</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
