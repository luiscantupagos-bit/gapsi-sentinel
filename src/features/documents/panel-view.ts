/**
 * DOC-UX-PANEL-001 — lógica PURA de la vista del Panel del documento (tabs + ciclo
 * de vida de versiones). Sin dependencias de React/Prisma para poder probarla como
 * unidad. La UI (`panel/_components/DocumentPanel.tsx`) y la página server la usan.
 *
 * Separación de conceptos (§objetivo):
 * - «Vista del documento» = contenido / lectura / edición / salida (rutas ../, /preview…).
 * - «Panel» = administración / estados / versiones / flujo / distribución / copias /
 *   relaciones / archivos / historial (este módulo).
 */
import type { VersionStatus } from './workflow-state';

/** Tabs del panel, en orden de presentación. */
export const PANEL_TABS = [
  'resumen',
  'flujo',
  'versiones',
  'distribucion',
  'copias',
  'relaciones',
  'archivos',
  'historial',
] as const;
export type PanelTab = (typeof PANEL_TABS)[number];

export const PANEL_TAB_LABEL: Record<PanelTab, string> = {
  resumen: 'Resumen',
  flujo: 'Flujo',
  versiones: 'Versiones',
  distribucion: 'Distribución',
  copias: 'Copias',
  relaciones: 'Relaciones',
  archivos: 'Archivos',
  historial: 'Historial',
};

/** Normaliza el `?tab=` a un tab válido; por defecto `resumen`. */
export function resolveTab(raw: string | null | undefined): PanelTab {
  return (PANEL_TABS as readonly string[]).includes(raw ?? '') ? (raw as PanelTab) : 'resumen';
}

/** Versión tal como la consume la vista del panel (datos serializables). */
export interface PanelVersion {
  id: string;
  label: string;
  status: VersionStatus;
  isCurrent: boolean;
  changeNotes: string | null;
  createdAtLabel: string;
  authorName: string | null;
  fileCount: number;
}

/** Estados de versión que representan un borrador «en preparación» (aún no vigente). */
const IN_PROGRESS: readonly VersionStatus[] = [
  'draft',
  'in_review',
  'in_approval',
  'changes_requested',
  'approved',
];

/** Estados de versión ya retiradas (históricas). */
const HISTORICAL: readonly VersionStatus[] = ['obsolete', 'archived'];

export interface VersionGroups {
  /** Versión vigente (publicada). A lo sumo una. */
  vigente: PanelVersion | null;
  /** Borrador/versión en curso hacia publicación (aún no vigente). A lo sumo una. */
  enCurso: PanelVersion | null;
  /** Versiones históricas (obsoletas/archivadas), más recientes primero. */
  historicas: PanelVersion[];
}

/**
 * Clasifica las versiones distinguiendo **vigente** (published) de **borrador en
 * curso** (draft/pipeline) y de **históricas** (obsolete/archived). No usa `isCurrent`
 * como criterio de «vigente»: `isCurrent` marca la versión activa de edición (puede ser
 * el borrador), mientras que la vigente es la última **publicada**.
 */
export function categorizeVersions(versions: PanelVersion[]): VersionGroups {
  return {
    vigente: versions.find((v) => v.status === 'published') ?? null,
    enCurso: versions.find((v) => IN_PROGRESS.includes(v.status)) ?? null,
    historicas: versions.filter((v) => HISTORICAL.includes(v.status)),
  };
}

/** ¿Ya existe un borrador en curso? (para no crear un segundo draft, §10). */
export function hasDraftInProgress(versions: PanelVersion[]): boolean {
  return versions.some((v) => IN_PROGRESS.includes(v.status));
}

/** Ruta para VER una versión específica en su vista formal (hoja). */
export function versionPreviewHref(documentId: string, versionId: string): string {
  return `/dashboard/documents/${documentId}/preview?version=${versionId}`;
}

/** Ruta para EDITAR una versión borrador (editor libre o estructurado lo resuelve la ruta). */
export function versionEditHref(documentId: string, versionId: string): string {
  return `/dashboard/documents/${documentId}/editor?version=${versionId}`;
}
