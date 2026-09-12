/**
 * CAPA-8D-OUTPUT — reporte formal 8D (D0-D8) de un expediente CAPA como HTML seguro con
 * la estructura `.doc-render` (para reutilizar el motor de páginas y el estilo del
 * documento). CAPA es un EXPEDIENTE por folio (sin versionado documental). No se incluye
 * el historial técnico interno (§K17). Sin datos → «Sin información registrada» (§K20).
 */
import {
  CAPA_STATUS_LABEL,
  CAPA_SOURCE_TYPE_LABEL,
  CAPA_SEVERITY_LABEL,
  CAPA_PRIORITY_LABEL,
  ACTION_TYPE_LABEL,
  ACTION_STATUS_LABEL,
  EFFECTIVENESS_RESULT_LABEL,
  RCA_METHOD_LABEL,
} from './capa-state';

const EMPTY = '—';
const NONE = 'Sin información registrada.';

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
const lbl = (map: Record<string, string>, k: string | null | undefined): string =>
  (k && map[k]) || (k ?? EMPTY);

export interface CapaReportData {
  capa: Record<string, unknown>;
  immediateActions: Record<string, unknown>[];
  rca: Record<string, unknown> | null;
  whySteps: Record<string, unknown>[];
  actions: Record<string, unknown>[];
  reviews: Record<string, unknown>[];
  /**
   * DOC-OUTPUT §D — SVG del diagrama de Ishikawa ya renderizado (mismo componente que
   * el análisis, vía renderToStaticMarkup). `null`/ausente → «Sin análisis de Ishikawa
   * registrado». La marca de agua queda por encima (motor de páginas, §D5/§F4).
   */
  ishikawaSvg?: string | null;
}

export interface CapaReportIdentity {
  organizationName: string;
  organizationLogoUrl?: string | null;
  name: (id: string | null | undefined) => string | null;
  date: (d: unknown) => string;
}

function metaRow(label: string, value: string): string {
  return `<div class="doc-render__meta-item"><dt>${esc(label)}</dt><dd>${value || EMPTY}</dd></div>`;
}

function field(label: string, value: unknown): string {
  const v = value == null || value === '' ? NONE : esc(value);
  return `<div class="doc-report__field"><span class="doc-report__field-label">${esc(label)}</span><p>${v}</p></div>`;
}

function section(title: string, body: string): string {
  return `<section class="doc-render__section"><h2>${esc(title)}</h2>${body}</section>`;
}

function table(headers: string[], rows: string[][], empty = NONE): string {
  if (!rows.length) return `<p class="doc-render__empty">${esc(empty)}</p>`;
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${c || EMPTY}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="doc-render__table-wrap"><table class="doc-render__table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

const CORRECTIVE = new Set(['corrective', 'correction', 'immediate_correction']);
const PREVENTIVE = new Set([
  'preventive',
  'document_change',
  'process_change',
  'training',
  'specification_change',
  'system_change',
]);

/** Construye el reporte 8D completo como HTML `.doc-render`. */
export function renderCapaReportHtml(data: CapaReportData, id: CapaReportIdentity): string {
  const c = data.capa;
  const org = id.organizationName?.trim() || 'Organización';
  const brand = id.organizationLogoUrl
    ? `<img class="doc-render__org-logo" src="${esc(id.organizationLogoUrl)}" alt="${esc(org)}">`
    : `<span class="doc-render__org-name">${esc(org)}</span>`;

  const header = `<header class="doc-render__header">
    <div class="doc-render__org-brand">${brand}</div>
    <div class="doc-render__docid">
      <h1 class="doc-render__title">${esc(c.title)}</h1>
      <dl class="doc-render__meta">
        ${metaRow('Folio', esc(c.folio))}
        ${metaRow('Tipo', 'Reporte CAPA / 8D')}
        ${metaRow('Estado', esc(lbl(CAPA_STATUS_LABEL, c.status as string)))}
        ${metaRow('Área', esc((c.area as string) ?? ''))}
        ${metaRow('Fecha de apertura', id.date(c.detectedAt))}
        ${metaRow('Fecha objetivo', id.date(c.targetDate))}
      </dl>
    </div>
  </header>`;

  // --- D0 (opcional): respuesta inmediata / origen ---------------------------
  const corrections = data.immediateActions.filter((a) => a.actionType === 'correction');
  const d0 =
    c.description || corrections.length
      ? section(
          'D0 — Respuesta inmediata',
          field('Descripción / origen', c.description) +
            metaRow('Origen', esc(lbl(CAPA_SOURCE_TYPE_LABEL, c.sourceType as string))) +
            table(
              ['Corrección inmediata', 'Responsable', 'Estado', 'Resultado'],
              corrections.map((a) => [
                esc(a.description),
                esc(id.name(a.responsibleUserId as string) ?? ''),
                esc(lbl(ACTION_STATUS_LABEL, a.status as string)),
                esc((a.result as string) ?? ''),
              ]),
              'Sin correcciones inmediatas registradas.',
            ),
        )
      : '';

  // --- D1 equipo -------------------------------------------------------------
  const team: string[][] = [];
  if (c.responsibleUserId)
    team.push([esc(id.name(c.responsibleUserId as string) ?? ''), 'Responsable / Líder', 'Sí']);
  if (c.reportedBy && c.reportedBy !== c.responsibleUserId)
    team.push([esc(id.name(c.reportedBy as string) ?? ''), 'Reportó', EMPTY]);
  if (data.rca?.investigatorUserId && data.rca.investigatorUserId !== c.responsibleUserId)
    team.push([esc(id.name(data.rca.investigatorUserId as string) ?? ''), 'Investigador', EMPTY]);
  const d1 = section('D1 — Equipo', table(['Nombre', 'Rol', 'Líder'], team));

  // --- D2 descripción del problema (5W2H) ------------------------------------
  const d2 = section(
    'D2 — Descripción del problema',
    field('Qué', c.problemWhat) +
      field('Dónde', c.problemWhere) +
      field('Cuándo', c.problemWhen) +
      field('Quién detectó', c.problemWhoDetect) +
      field('A quién afecta', c.problemWhoAffect) +
      field('Cuánto / magnitud', c.problemHowMuch) +
      field('Cómo', c.problemHow) +
      field('Condición observada', c.conditionObserved) +
      field('Requisito incumplido', c.requirementBreached) +
      field('Producto', c.product) +
      field('Proceso', c.process),
  );

  // --- D3 contención ---------------------------------------------------------
  const containment = data.immediateActions.filter((a) => a.actionType === 'containment');
  const d3 = section(
    'D3 — Contención',
    table(
      ['Acción', 'Responsable', 'Compromiso', 'Realizada', 'Estado', 'Resultado'],
      containment.map((a) => [
        esc(a.description),
        esc(id.name(a.responsibleUserId as string) ?? ''),
        id.date(a.committedAt),
        id.date(a.executedAt),
        esc(lbl(ACTION_STATUS_LABEL, a.status as string)),
        esc((a.result as string) ?? ''),
      ]),
    ),
  );

  // --- D4 causa raíz ---------------------------------------------------------
  const rca = data.rca;
  const whys = table(
    ['Nivel', 'Pregunta', 'Respuesta'],
    data.whySteps.map((w) => [esc(w.level), esc(w.question), esc(w.answer)]),
    'Sin análisis 5 porqués registrado.',
  );
  // §D: el Ishikawa se embebe (mismo SVG que el análisis). §D3: evita partirlo entre
  // páginas (break-inside). §D4: se escala al ancho disponible sin deformar (el SVG usa
  // viewBox + preserveAspectRatio). §D6: sin análisis → texto formal, no hueco vacío.
  const ishikawa = data.ishikawaSvg
    ? `<figure class="doc-report__figure doc-report__figure--ishikawa">${data.ishikawaSvg}<figcaption>Diagrama de Ishikawa (espina de pescado).</figcaption></figure>`
    : `<p class="doc-render__empty">Sin análisis de Ishikawa registrado.</p>`;
  const d4 = section(
    'D4 — Causa raíz',
    (rca
      ? metaRow('Método', esc(lbl(RCA_METHOD_LABEL, rca.method as string))) +
        field('Causa inmediata', rca.immediateCause) +
        field('Causa contribuyente', rca.contributingCause) +
        field('Causa raíz (verificada)', rca.rootCause) +
        field('Justificación / verificación', rca.justification)
      : `<p class="doc-render__empty">${NONE}</p>`) +
      `<h3>Diagrama de Ishikawa</h3>${ishikawa}` +
      `<h3>5 porqués</h3>${whys}` +
      `<p class="doc-report__note">La distinción causa de ocurrencia / de escape (no detección) es un follow-up registrado (CAPA-8D-ROOT-CAUSE-EXPANSION).</p>`,
  );

  // --- D5 correctivas permanentes -------------------------------------------
  const correctiveActions = data.actions.filter(
    (a) => CORRECTIVE.has(a.actionType as string) || !PREVENTIVE.has(a.actionType as string),
  );
  const preventiveActions = data.actions.filter((a) => PREVENTIVE.has(a.actionType as string));
  const d5 = section(
    'D5 — Acciones correctivas permanentes',
    table(
      ['Acción', 'Tipo', 'Responsable', 'Compromiso', 'Estado'],
      correctiveActions.map((a) => [
        esc(a.description),
        esc(lbl(ACTION_TYPE_LABEL, a.actionType as string)),
        esc(id.name(a.responsibleUserId as string) ?? ''),
        id.date(a.dueDate),
        esc(lbl(ACTION_STATUS_LABEL, a.status as string)),
      ]),
    ),
  );

  // --- D6 implementación y validación ---------------------------------------
  const d6 = section(
    'D6 — Implementación y validación',
    table(
      ['Acción', 'Avance', 'Estado', 'Resultado'],
      data.actions.map((a) => [
        esc(a.description),
        `${esc(a.progress ?? 0)}%`,
        esc(lbl(ACTION_STATUS_LABEL, a.status as string)),
        esc((a.result as string) ?? ''),
      ]),
    ) +
      '<h3>Verificación de eficacia</h3>' +
      table(
        ['Criterio', 'Método', 'Fecha', 'Resultado observado', 'Conclusión'],
        data.reviews.map((r) => [
          esc(r.criterion),
          esc(r.method),
          id.date(r.executedAt ?? r.plannedAt),
          esc((r.observedResult as string) ?? ''),
          esc(lbl(EFFECTIVENESS_RESULT_LABEL, r.conclusion as string)),
        ]),
      ),
  );

  // --- D7 prevención de recurrencia -----------------------------------------
  const d7 = section(
    'D7 — Prevención de recurrencia',
    table(
      ['Acción', 'Tipo', 'Responsable', 'Estado'],
      preventiveActions.map((a) => [
        esc(a.description),
        esc(lbl(ACTION_TYPE_LABEL, a.actionType as string)),
        esc(id.name(a.responsibleUserId as string) ?? ''),
        esc(lbl(ACTION_STATUS_LABEL, a.status as string)),
      ]),
      'Sin acciones preventivas/sistémicas registradas.',
    ),
  );

  // --- D8 cierre -------------------------------------------------------------
  const lastReview = data.reviews[0];
  const d8 = section(
    'D8 — Cierre',
    field(
      'Verificación de eficacia',
      lastReview ? lbl(EFFECTIVENESS_RESULT_LABEL, lastReview.conclusion as string) : null,
    ) +
      field('Conclusión / resumen de cierre', c.closureSummary) +
      metaRow('Fecha de cierre', id.date(c.closedAt)) +
      metaRow('Aprobado por', esc(id.name(c.closedBy as string) ?? '')),
  );

  const footer = `<footer class="doc-render__footer">
    <p class="doc-render__confidential">DOCUMENTO CONTROLADO Y CONFIDENCIAL</p>
    <p>Expediente CAPA de «${esc(org)}». Prohibida su reproducción total o parcial sin autorización.</p>
  </footer>`;

  const classification =
    metaRow('Severidad', esc(lbl(CAPA_SEVERITY_LABEL, c.severity as string))) +
    metaRow('Prioridad', esc(lbl(CAPA_PRIORITY_LABEL, c.priority as string)));
  const overview = section('Clasificación', `<dl class="doc-render__meta">${classification}</dl>`);

  return `<article class="doc-render doc-render--design-c3-modern doc-report">${header}${overview}${d0}${d1}${d2}${d3}${d4}${d5}${d6}${d7}${d8}${footer}</article>`;
}
