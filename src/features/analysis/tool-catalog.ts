// CORE-UX-004 — Catálogo COMPARTIDO de herramientas de análisis (Obj 5).
//
// Fuente única de verdad de las herramientas disponibles y su presentación, para
// que TODAS las pantallas (biblioteca global, Proyecto, CAPA, hallazgo, evento,
// estudio) consuman el mismo catálogo en vez de listas hardcodeadas por pantalla.

import { ANALYSIS_TYPE_LABEL, type AnalysisType } from '@/features/capa/analysis-state';

/** Origen desde el que se puede iniciar un análisis (relación canónica). */
export type OriginType =
  | 'independent'
  | 'capa'
  | 'project'
  | 'audit_finding'
  | 'audit'
  | 'quality_event'
  | 'data_study';

/** Categoría para el selector agrupado. */
export type ToolCategory = 'cause' | 'risk' | 'comparison' | 'data';

export const TOOL_CATEGORY_LABEL: Record<ToolCategory, string> = {
  cause: 'Investigación de causa',
  risk: 'Riesgo / priorización',
  comparison: 'Comparación',
  data: 'Datos',
};

/** Dónde se edita/abre la herramienta. */
export type ToolWorkspace = 'analysis' | 'study';

export interface ToolDef {
  /** id: AnalysisType, o 'data_study' para el Estudio de Datos. */
  id: AnalysisType | 'data_study';
  label: string;
  category: ToolCategory;
  description: string;
  /** Orígenes desde los que se puede iniciar. */
  compatibleOrigins: OriginType[];
  /** Workspace de edición: análisis transversal o estudio de datos. */
  workspace: ToolWorkspace;
  available: boolean;
  icon: string;
}

const ALL_ORIGINS: OriginType[] = [
  'independent',
  'capa',
  'project',
  'audit_finding',
  'audit',
  'quality_event',
  'data_study',
];

// Orígenes de las herramientas que analizan CAPAs (recurrencia/comparación): se
// permiten desde cualquier origen, pero su valor pleno es dentro de una CAPA.
const CAPA_ANALYTICS_ORIGINS: OriginType[] = ALL_ORIGINS;

/**
 * Catálogo. El orden define la presentación dentro de cada categoría. Todas las
 * herramientas de `quality_analyses` abren el workspace transversal
 * `/dashboard/analysis/[id]`; el Estudio de Datos abre `/dashboard/analytics/studies/[id]`.
 */
export const ANALYSIS_TOOLS: ToolDef[] = [
  {
    id: '5whys',
    label: ANALYSIS_TYPE_LABEL['5whys'],
    category: 'cause',
    description: 'Encadena preguntas «¿por qué?» hacia una causa raíz propuesta.',
    compatibleOrigins: ALL_ORIGINS,
    workspace: 'analysis',
    available: true,
    icon: 'why',
  },
  {
    id: 'ishikawa',
    label: ANALYSIS_TYPE_LABEL.ishikawa,
    category: 'cause',
    description: 'Organiza causas posibles por categorías (6M).',
    compatibleOrigins: ALL_ORIGINS,
    workspace: 'analysis',
    available: true,
    icon: 'fishbone',
  },
  {
    id: 'cause_tree',
    label: ANALYSIS_TYPE_LABEL.cause_tree,
    category: 'cause',
    description: 'Relaciona eventos, condiciones y controles fallidos.',
    compatibleOrigins: ALL_ORIGINS,
    workspace: 'analysis',
    available: true,
    icon: 'tree',
  },
  {
    id: 'fta',
    label: ANALYSIS_TYPE_LABEL.fta,
    category: 'cause',
    description: 'Descompone un evento no deseado con compuertas AND/OR.',
    compatibleOrigins: ALL_ORIGINS,
    workspace: 'analysis',
    available: true,
    icon: 'tree',
  },
  {
    id: 'freeform',
    label: ANALYSIS_TYPE_LABEL.freeform,
    category: 'cause',
    description: 'Análisis personalizado con hipótesis y evidencia.',
    compatibleOrigins: ALL_ORIGINS,
    workspace: 'analysis',
    available: true,
    icon: 'doc',
  },
  {
    id: 'fmea',
    label: ANALYSIS_TYPE_LABEL.fmea,
    category: 'risk',
    description: 'Evalúa modos de falla, efectos y controles (NPR).',
    compatibleOrigins: ALL_ORIGINS,
    workspace: 'analysis',
    available: true,
    icon: 'risk',
  },
  {
    id: 'pareto',
    label: ANALYSIS_TYPE_LABEL.pareto,
    category: 'risk',
    description: 'Ordena problemas por frecuencia o impacto (80/20).',
    compatibleOrigins: ALL_ORIGINS,
    workspace: 'analysis',
    available: true,
    icon: 'chart',
  },
  {
    id: 'recurrence',
    label: ANALYSIS_TYPE_LABEL.recurrence,
    category: 'comparison',
    description: 'Revisa si el problema o sus causas ya se presentaron.',
    compatibleOrigins: CAPA_ANALYTICS_ORIGINS,
    workspace: 'analysis',
    available: true,
    icon: 'recurrence',
  },
  {
    id: 'comparative',
    label: ANALYSIS_TYPE_LABEL.comparative,
    category: 'comparison',
    description: 'Compara varios casos para identificar patrones.',
    compatibleOrigins: CAPA_ANALYTICS_ORIGINS,
    workspace: 'analysis',
    available: true,
    icon: 'compare',
  },
  {
    id: 'data_study',
    label: 'Estudio de Datos',
    category: 'data',
    description: 'Análisis estadístico ad hoc sobre datos importados.',
    compatibleOrigins: ['independent', 'project', 'capa', 'audit_finding', 'quality_event'],
    workspace: 'study',
    available: true,
    icon: 'analysis',
  },
];

const BY_ID = new Map(ANALYSIS_TOOLS.map((t) => [t.id, t]));

export function getTool(id: string): ToolDef | undefined {
  return BY_ID.get(id as ToolDef['id']);
}

/** Herramientas disponibles para un origen dado. */
export function toolsForOrigin(origin: OriginType): ToolDef[] {
  return ANALYSIS_TOOLS.filter((t) => t.available && t.compatibleOrigins.includes(origin));
}

/** Herramientas agrupadas por categoría (para el selector agrupado). */
export function groupedTools(origin: OriginType): { category: ToolCategory; tools: ToolDef[] }[] {
  const order: ToolCategory[] = ['cause', 'risk', 'comparison', 'data'];
  return order
    .map((category) => ({
      category,
      tools: toolsForOrigin(origin).filter((t) => t.category === category),
    }))
    .filter((g) => g.tools.length > 0);
}

/** Ruta de detalle/edición de un análisis según su herramienta. */
export function toolDetailHref(toolId: string, analysisOrStudyId: string): string {
  const t = getTool(toolId);
  if (t?.workspace === 'study') return `/dashboard/analytics/studies/${analysisOrStudyId}`;
  return `/dashboard/analysis/${analysisOrStudyId}`;
}
