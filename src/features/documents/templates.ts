/**
 * Plantillas documentales (TASK-005). Datos ESTRUCTURADOS y editables (JSON del
 * editor), no componentes rígidos. Puro; usado por cliente, servidor y seed.
 */
import type { DocNode } from './content-schema';

export interface PageConfig {
  header: { style: 'simple' | 'tabular' | 'none'; showLogo: boolean; companyName: string };
  footer: {
    confidentiality: string;
    showCodeVersion: boolean;
    showPagination: boolean;
    controlledLegend: boolean;
    printDate: boolean;
  };
  cover: { enabled: boolean };
  margins: { top: number; right: number; bottom: number; left: number };
}

export const DEFAULT_PAGE_CONFIG: PageConfig = {
  header: { style: 'simple', showLogo: true, companyName: '' },
  footer: {
    confidentiality: 'Confidencial',
    showCodeVersion: true,
    showPagination: true,
    controlledLegend: true,
    printDate: false,
  },
  cover: { enabled: false },
  margins: { top: 25, right: 25, bottom: 25, left: 25 },
};

const h = (level: 1 | 2 | 3, text: string): DocNode => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
});
const p = (text = ''): DocNode =>
  text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' };

function sections(title: string, blocks: string[]): DocNode {
  const content: DocNode[] = [h(1, title)];
  for (const b of blocks) {
    content.push(h(2, b));
    content.push(p('Describa aquí el contenido de esta sección.'));
  }
  return { type: 'doc', content };
}

export interface DocTemplate {
  key: string;
  label: string;
  documentType: string;
  cover: boolean;
  build: () => DocNode;
}

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    key: 'policy',
    label: 'Política',
    documentType: 'policy',
    cover: true,
    build: () =>
      sections('Política', [
        'Declaración',
        'Alcance',
        'Compromisos',
        'Responsables',
        'Vigencia',
        'Aprobaciones',
      ]),
  },
  {
    key: 'manual',
    label: 'Manual',
    documentType: 'manual',
    cover: true,
    build: () =>
      sections('Manual', [
        'Introducción',
        'Alcance',
        'Contenido',
        'Referencias',
        'Control de cambios',
      ]),
  },
  {
    key: 'procedure',
    label: 'Procedimiento',
    documentType: 'procedure',
    cover: true,
    build: () =>
      sections('Procedimiento', [
        'Objetivo',
        'Alcance',
        'Responsabilidades',
        'Definiciones',
        'Desarrollo',
        'Registros relacionados',
        'Referencias',
        'Control de cambios',
        'Anexos',
      ]),
  },
  {
    key: 'instruction',
    label: 'Instructivo',
    documentType: 'instruction',
    cover: false,
    build: () =>
      sections('Instructivo', ['Objetivo', 'Materiales', 'Pasos', 'Precauciones', 'Registros']),
  },
  {
    key: 'program',
    label: 'Programa',
    documentType: 'program',
    cover: false,
    build: () =>
      sections('Programa', ['Objetivo', 'Alcance', 'Actividades', 'Cronograma', 'Responsables']),
  },
  {
    key: 'plan',
    label: 'Plan',
    documentType: 'plan',
    cover: false,
    build: () => sections('Plan', ['Objetivo', 'Alcance', 'Estrategia', 'Recursos', 'Seguimiento']),
  },
  {
    key: 'form',
    label: 'Formato',
    documentType: 'form',
    cover: false,
    build: () => ({
      type: 'doc',
      content: [
        h(1, 'Formato'),
        p('Complete los campos del formato.'),
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableHeader', content: [p('Campo')] },
                { type: 'tableHeader', content: [p('Valor')] },
              ],
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [p('Fecha')] },
                { type: 'tableCell', content: [p('')] },
              ],
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [p('Responsable')] },
                { type: 'tableCell', content: [p('')] },
              ],
            },
          ],
        },
      ],
    }),
  },
  {
    key: 'specification',
    label: 'Especificación',
    documentType: 'specification',
    cover: false,
    build: () =>
      sections('Especificación', [
        'Objeto',
        'Requisitos',
        'Métodos de verificación',
        'Criterios de aceptación',
      ]),
  },
  {
    key: 'matrix',
    label: 'Matriz',
    documentType: 'matrix',
    cover: false,
    build: () => sections('Matriz', ['Propósito', 'Criterios', 'Evaluación']),
  },
  {
    key: 'free',
    label: 'Documento libre',
    documentType: 'other',
    cover: false,
    build: () => ({ type: 'doc', content: [h(1, 'Documento'), p('')] }),
  },
];

export function getTemplate(key: string): DocTemplate | null {
  return DOC_TEMPLATES.find((t) => t.key === key) ?? null;
}

const HEADER_STYLES = new Set(['simple', 'tabular', 'none']);
function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}
function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Normaliza la configuración de página proveniente del cliente (allowlist). */
export function sanitizePageConfig(input: unknown): PageConfig {
  const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const header = (i.header ?? {}) as Record<string, unknown>;
  const footer = (i.footer ?? {}) as Record<string, unknown>;
  const cover = (i.cover ?? {}) as Record<string, unknown>;
  const margins = (i.margins ?? {}) as Record<string, unknown>;
  return {
    header: {
      style: HEADER_STYLES.has(String(header.style))
        ? (String(header.style) as PageConfig['header']['style'])
        : 'simple',
      showLogo: bool(header.showLogo, true),
      companyName: typeof header.companyName === 'string' ? header.companyName.slice(0, 120) : '',
    },
    footer: {
      confidentiality:
        typeof footer.confidentiality === 'string'
          ? footer.confidentiality.slice(0, 120)
          : 'Confidencial',
      showCodeVersion: bool(footer.showCodeVersion, true),
      showPagination: bool(footer.showPagination, true),
      controlledLegend: bool(footer.controlledLegend, true),
      printDate: bool(footer.printDate, false),
    },
    cover: { enabled: bool(cover.enabled, false) },
    margins: {
      top: num(margins.top, 25, 5, 60),
      right: num(margins.right, 25, 5, 60),
      bottom: num(margins.bottom, 25, 5, 60),
      left: num(margins.left, 25, 5, 60),
    },
  };
}
