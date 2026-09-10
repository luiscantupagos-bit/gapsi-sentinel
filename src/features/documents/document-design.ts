/**
 * Diseños documentales predeterminados (DOC-UX-002 §91-102). PURO.
 *
 * Un DISEÑO define cómo se VE un documento (estructura visual, densidad, estilo
 * de encabezado/tablas), NO su contenido (eso lo define la plantilla de tipo:
 * Procedimiento, Política, …). Un solo renderer aplica el diseño mediante una
 * clase CSS raíz `doc-render--design-<id>`; los diseños no duplican lógica de
 * contenido (§94). El TEMA (colores) es ortogonal al diseño (§95).
 */

export interface DocumentDesignDefinition {
  id: string;
  label: string;
  description: string;
  /** Clase raíz que activa los estilos del diseño en `globals.css`. */
  cssClass: string;
}

export const DOCUMENT_DESIGNS: readonly DocumentDesignDefinition[] = [
  {
    id: 'c3-modern',
    label: 'C3 Moderno',
    description: 'Limpio y contemporáneo, líneas finas y aire generoso. Aspecto SaaS profesional.',
    cssClass: 'doc-render--design-c3-modern',
  },
  {
    id: 'corporate',
    label: 'Corporativo',
    description:
      'Encabezado en tabla, metadata compacta y líneas marcadas. Estilo ISO/QMS tradicional.',
    cssClass: 'doc-render--design-corporate',
  },
  {
    id: 'technical',
    label: 'Técnico',
    description:
      'Alta densidad y tablas estructuradas. Ideal para manufactura, farmacéutica e ingeniería.',
    cssClass: 'doc-render--design-technical',
  },
  {
    id: 'minimal',
    label: 'Minimalista',
    description: 'Poco color, tipografía limpia y encabezado simple. Impresión económica.',
    cssClass: 'doc-render--design-minimal',
  },
] as const;

export const DEFAULT_DESIGN_ID = 'c3-modern';

const DESIGN_BY_ID = new Map(DOCUMENT_DESIGNS.map((d) => [d.id, d]));

export function isValidDesignId(value: unknown): value is string {
  return typeof value === 'string' && DESIGN_BY_ID.has(value);
}

/** Devuelve el diseño pedido o, si es desconocido, el diseño por defecto (§98). */
export function getDocumentDesign(designId: unknown): DocumentDesignDefinition {
  if (typeof designId === 'string' && DESIGN_BY_ID.has(designId)) {
    return DESIGN_BY_ID.get(designId) as DocumentDesignDefinition;
  }
  return DESIGN_BY_ID.get(DEFAULT_DESIGN_ID) as DocumentDesignDefinition;
}

/** Normaliza un id de diseño a uno válido (fallback seguro §98). */
export function sanitizeDesignId(designId: unknown): string {
  return isValidDesignId(designId) ? designId : DEFAULT_DESIGN_ID;
}
