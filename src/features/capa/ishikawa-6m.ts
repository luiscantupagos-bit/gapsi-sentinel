/**
 * Análisis de causas — 6M (metodología Ishikawa). Representación por TARJETAS de las 6
 * categorías (una por «M»), en lugar del diagrama literal de espina de pescado. Es la ÚNICA
 * fuente de markup: el componente React `Ishikawa6MView` y el reporte CAPA 8D la reutilizan
 * (sin `react-dom/server`, que Next bloquea en el App Router). No cambia el modelo de datos:
 * agrupa las MISMAS causas (hipótesis) por su categoría Ishikawa.
 *
 * Reglas: orden fijo de las 6M (no el de inserción), textos COMPLETOS sin truncar, estado
 * vacío formal por categoría, labels en español, tarjetas print-safe (`break-inside: avoid`).
 */
import { HYPOTHESIS_STATUS_LABEL, QUAL_PROBABILITY_LABEL } from './analysis-state';

export interface Ishikawa6MCause {
  id: string;
  description: string;
  status?: string | null;
  probability?: string | null;
}
export interface Ishikawa6MCategory {
  id: string;
  name: string;
  causes: Ishikawa6MCause[];
}

/** Orden fijo de las 6M (§9) con los sinónimos aceptados para casar la categoría real. */
export const CANONICAL_6M: { label: string; match: string }[] = [
  { label: 'Materiales', match: 'materia' },
  { label: 'Medio ambiente', match: 'medio' },
  { label: 'Mano de obra', match: 'mano' },
  { label: 'Maquinaria', match: 'maquina' },
  { label: 'Medición', match: 'medici' },
  { label: 'Método', match: 'metodo' },
];

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Normaliza un nombre de categoría (minúsculas sin acentos) para casarlo con las 6M. */
function normalize(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Índice de orden fijo de una categoría (las que no casan van al final, estables). */
export function order6MIndex(name: string): number {
  const n = normalize(name);
  const i = CANONICAL_6M.findIndex((m) => n.includes(m.match));
  return i === -1 ? CANONICAL_6M.length : i;
}

/**
 * Ordena/normaliza las categorías al orden fijo de las 6M. Siempre devuelve las 6 «M»
 * (aunque la categoría no exista en los datos → tarjeta con estado vacío, §5), más cualquier
 * categoría extra al final. Agrupa las causas por su categoría.
 */
export function to6MCategories(categories: Ishikawa6MCategory[]): Ishikawa6MCategory[] {
  const byIndex = new Map<number, Ishikawa6MCategory>();
  const extras: Ishikawa6MCategory[] = [];
  for (const cat of categories) {
    const idx = order6MIndex(cat.name);
    if (idx === CANONICAL_6M.length) {
      extras.push(cat);
      continue;
    }
    const existing = byIndex.get(idx);
    if (existing) existing.causes = [...existing.causes, ...cat.causes];
    else byIndex.set(idx, { ...cat });
  }
  const sixM = CANONICAL_6M.map(
    (m, i) => byIndex.get(i) ?? { id: `m-${i}`, name: m.label, causes: [] },
  );
  return [...sixM, ...extras];
}

const statusLabel = (s: string | null | undefined): string =>
  (s && HYPOTHESIS_STATUS_LABEL[s as keyof typeof HYPOTHESIS_STATUS_LABEL]) || '';
const probabilityLabel = (p: string | null | undefined): string =>
  (p && QUAL_PROBABILITY_LABEL[p as keyof typeof QUAL_PROBABILITY_LABEL]) || '';

export interface Ishikawa6MOptions {
  /** Muestra la etiqueta de estado de cada causa (por defecto true). */
  showStatus?: boolean;
  /** Muestra la etiqueta de probabilidad de cada causa (por defecto true). */
  showProbability?: boolean;
  /** Muestra el encabezado «Análisis de causas — 6M / Metodología Ishikawa» (por defecto true). */
  withHeading?: boolean;
}

function causeItem(c: Ishikawa6MCause, opts: Ishikawa6MOptions): string {
  const st = statusLabel(c.status);
  const pr = probabilityLabel(c.probability);
  const isRoot = c.status === 'confirmed';
  const tags: string[] = [];
  if (opts.showStatus !== false && st)
    tags.push(`<span class="ishi6m__tag ishi6m__tag--status">${esc(st)}</span>`);
  if (opts.showProbability !== false && pr)
    tags.push(`<span class="ishi6m__tag ishi6m__tag--prob">${esc(pr)}</span>`);
  if (isRoot) tags.push(`<span class="ishi6m__tag ishi6m__tag--root">Causa raíz</span>`);
  const tagHtml = tags.length ? `<span class="ishi6m__tags">${tags.join('')}</span>` : '';
  return `<li class="ishi6m__cause"><span class="ishi6m__desc">${esc(
    c.description,
  )}</span>${tagHtml}</li>`;
}

function card(cat: Ishikawa6MCategory, opts: Ishikawa6MOptions): string {
  const body = cat.causes.length
    ? `<ul class="ishi6m__causes">${cat.causes.map((c) => causeItem(c, opts)).join('')}</ul>`
    : `<p class="ishi6m__empty">Sin causas registradas.</p>`;
  return `<section class="ishi6m__card"><h3 class="ishi6m__cat">${esc(cat.name)}</h3>${body}</section>`;
}

/** Construye el HTML del análisis 6M (una tarjeta por categoría, orden fijo). */
export function buildIshikawa6MHtml(
  categories: Ishikawa6MCategory[],
  opts: Ishikawa6MOptions = {},
): string {
  const cats = to6MCategories(categories);
  const heading =
    opts.withHeading === false
      ? ''
      : `<div class="ishi6m__head"><p class="ishi6m__title">Análisis de causas — 6M</p><p class="ishi6m__subtitle">Metodología Ishikawa</p></div>`;
  const grid = `<div class="ishi6m__grid">${cats.map((c) => card(c, opts)).join('')}</div>`;
  return `<div class="ishi6m">${heading}${grid}</div>`;
}
