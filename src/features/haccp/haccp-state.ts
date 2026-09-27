/**
 * HACCP-001 — estados, etiquetas y helpers PUROS del módulo HACCP. Sin dependencia de
 * Prisma/servidor (testeable en aislamiento). El módulo HACCP es la fuente de verdad
 * operativa; el Plan formal será una salida documental (HACCP-007).
 */

// --- Estados del plan --------------------------------------------------------
export const HACCP_PLAN_STATUSES = [
  'draft',
  'in_review',
  'published',
  'reevaluation_required',
  'obsolete',
] as const;
export type HaccpPlanStatus = (typeof HACCP_PLAN_STATUSES)[number];

export const HACCP_PLAN_STATUS_LABEL: Record<HaccpPlanStatus, string> = {
  draft: 'Borrador',
  in_review: 'En revisión',
  published: 'Vigente',
  reevaluation_required: 'Reevaluación requerida',
  obsolete: 'Obsoleto',
};

// --- Estados de la versión ---------------------------------------------------
export const HACCP_VERSION_STATUSES = ['draft', 'in_review', 'published', 'obsolete'] as const;
export type HaccpVersionStatus = (typeof HACCP_VERSION_STATUSES)[number];

export const HACCP_VERSION_STATUS_LABEL: Record<HaccpVersionStatus, string> = {
  draft: 'Borrador',
  in_review: 'En revisión',
  published: 'Vigente',
  obsolete: 'Obsoleto',
};

/** Solo un borrador (o en revisión) es editable; lo publicado/obsoleto es inmutable (§34). */
export function isVersionEditable(status: string): boolean {
  return status === 'draft' || status === 'in_review';
}

// --- Tipos de referencia de fuente (tabla unificada) -------------------------
export const HACCP_REFERENCE_KINDS = ['product', 'material', 'prerequisite', 'document'] as const;
export type HaccpReferenceKind = (typeof HACCP_REFERENCE_KINDS)[number];

export const HACCP_REFERENCE_KIND_LABEL: Record<HaccpReferenceKind, string> = {
  product: 'Producto terminado',
  material: 'Materia prima',
  prerequisite: 'Prerrequisito (PPR)',
  document: 'Documento soporte',
};

export const HACCP_SOURCE_TYPES = ['document', 'program'] as const;
export type HaccpSourceType = (typeof HACCP_SOURCE_TYPES)[number];

export const HACCP_SOURCE_TYPE_LABEL: Record<HaccpSourceType, string> = {
  document: 'Documento',
  program: 'Programa',
};

/**
 * Categorías sugeridas de PPR (§19). NO es un enum cerrado del esquema: es un catálogo de
 * apoyo para la UI; el usuario puede escribir otra categoría.
 */
export const HACCP_PPR_CATEGORIES = [
  'Limpieza y desinfección',
  'Control de plagas',
  'Mantenimiento',
  'Proveedores',
  'Agua',
  'Residuos',
  'Higiene del personal',
  'Trazabilidad',
  'Capacitación',
  'Control de químicos',
  'Alérgenos',
  'Otro',
] as const;

// --- Roles HACCP sugeridos ---------------------------------------------------
export const HACCP_ROLE_SUGGESTIONS = [
  'Líder HACCP',
  'Calidad / Inocuidad',
  'Producción / Operación',
  'Mantenimiento',
  'Aseguramiento de calidad',
  'Asesor externo',
] as const;

// --- Tabs del workspace (HACCP-001) ------------------------------------------
/**
 * WORKSPACE-REORG — el workspace se organiza según la METODOLOGÍA HACCP (no según los módulos
 * internos de Sentinel): 12 pestañas = 5 PASOS PRELIMINARES + 7 PRINCIPIOS. El «Resumen» se movió
 * al encabezado del plan; Producto/Materias se consolidan en «Descripción del producto»; PPR es
 * soporte transversal (contextual, no ocupa pestaña); «Proceso» pasa a ser «Diagrama de flujo»;
 * Documentos → «Registros y documentación». Sin cambios de modelo de datos.
 */
export const HACCP_TABS = [
  // Pasos preliminares (1-5)
  'team',
  'product',
  'intended-use',
  'flow',
  'onsite-confirmation',
  // Principios HACCP (6-12)
  'hazards',
  'ccp',
  'limits',
  'monitoring',
  'corrective-actions',
  'validation-verification',
  'records',
] as const;
export type HaccpTab = (typeof HACCP_TABS)[number];

/** Número del paso (1-12) para mostrarlo en la pestaña. */
export const HACCP_TAB_NUMBER: Record<HaccpTab, number> = {
  team: 1,
  product: 2,
  'intended-use': 3,
  flow: 4,
  'onsite-confirmation': 5,
  hazards: 6,
  ccp: 7,
  limits: 8,
  monitoring: 9,
  'corrective-actions': 10,
  'validation-verification': 11,
  records: 12,
};

export const HACCP_TAB_LABEL: Record<HaccpTab, string> = {
  team: 'Equipo HACCP',
  product: 'Descripción del producto',
  'intended-use': 'Uso previsto',
  flow: 'Diagrama de flujo',
  'onsite-confirmation': 'Confirmación in situ',
  hazards: 'Análisis de peligros',
  ccp: 'Determinación de PCC',
  limits: 'Límites críticos',
  monitoring: 'Monitoreo',
  'corrective-actions': 'Acciones correctivas',
  'validation-verification': 'Validación y verificación',
  records: 'Registros y documentación',
};

/** Grupos visuales: pasos preliminares (1-5) y principios HACCP (6-12). */
export const HACCP_TAB_GROUPS: { title: string; tabs: HaccpTab[] }[] = [
  {
    title: 'Pasos preliminares',
    tabs: ['team', 'product', 'intended-use', 'flow', 'onsite-confirmation'],
  },
  {
    title: 'Principios HACCP',
    tabs: [
      'hazards',
      'ccp',
      'limits',
      'monitoring',
      'corrective-actions',
      'validation-verification',
      'records',
    ],
  },
];

/** Compatibilidad de deep links antiguos → nueva pestaña (§backward compatibility). */
export const HACCP_TAB_ALIASES: Record<string, HaccpTab> = {
  resumen: 'team',
  equipo: 'team',
  producto: 'product',
  materias: 'product',
  ppr: 'hazards',
  documentos: 'records',
  flujo: 'flow',
  peligros: 'hazards',
  medidas: 'ccp',
  validacion: 'validation-verification',
  verificacion: 'validation-verification',
};

/** Tabs de fases futuras: se muestran deshabilitadas («Próximamente»). Ya no queda ninguna. */
export const HACCP_FUTURE_TABS = [] as const;

export function resolveTab(raw: string | null | undefined): HaccpTab {
  const key = raw ?? '';
  if ((HACCP_TABS as readonly string[]).includes(key)) return key as HaccpTab;
  if (HACCP_TAB_ALIASES[key]) return HACCP_TAB_ALIASES[key]!;
  return 'team';
}

// --- Detección de actualización de fuentes (§24/§25) -------------------------
export interface SourceUpdateInput {
  /** Versión exacta usada por el plan (snapshot). */
  usedVersionId: string | null;
  /** Versión publicada más reciente del documento fuente (o null si no hay). */
  latestPublishedVersionId: string | null;
}

/**
 * ¿La fuente tiene una versión más reciente que la usada por el plan? Solo DETECCIÓN
 * (§25): no transiciona el estado del plan. Si no se conoce la versión usada o no hay
 * versión publicada más reciente, no se marca actualización.
 */
export function hasSourceUpdate(input: SourceUpdateInput): boolean {
  if (!input.usedVersionId || !input.latestPublishedVersionId) return false;
  return input.usedVersionId !== input.latestPublishedVersionId;
}

/** Validaciones mínimas para publicar (§35). Devuelve la lista de errores (vacía = OK). */
export interface HaccpPublishCheck {
  title: string | null | undefined;
  scope: string | null | undefined;
  responsibleUserId: string | null | undefined;
  productProcess: string | null | undefined;
  hasTeam: boolean;
  hasLeader: boolean;
}

export function validateHaccpPublish(c: HaccpPublishCheck): string[] {
  const errors: string[] = [];
  if (!c.title?.trim()) errors.push('El nombre del plan es obligatorio.');
  if (!c.scope?.trim()) errors.push('El alcance es obligatorio.');
  if (!c.responsibleUserId) errors.push('El responsable del plan es obligatorio.');
  if (!c.productProcess?.trim()) errors.push('El producto/proceso es obligatorio.');
  if (!c.hasTeam) errors.push('El equipo HACCP debe tener al menos un integrante.');
  if (!c.hasLeader) errors.push('El equipo HACCP debe tener un líder.');
  return errors;
}
