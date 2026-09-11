/**
 * DOC-CHANGE-CONTROL-FOLLOWUP — reglas PURAS del Control de cambios documental.
 *
 * Principio: el Control de cambios representa **versiones formales publicadas** (una
 * fila por versión publicada), NO cada guardado de un borrador. Un borrador solo se
 * consolida como fila cuando la versión se publica. Módulo sin React/Prisma para poder
 * probarse como unidad; lo consumen el servicio (`buildChangeLog`, `createVersion`,
 * `publishVersion`) y la UI del panel.
 */
import { INITIAL_VERSION_LABEL } from './versioning';
import type { VersionStatus } from './workflow-state';

/**
 * Estados de versión que representan una versión FORMAL (fue publicada): la vigente
 * (`published`) y las anteriores ya reemplazadas (`obsolete`). Estas —y solo estas—
 * aparecen en el Control de cambios.
 */
export const FORMAL_VERSION_STATUSES: readonly VersionStatus[] = ['published', 'obsolete'];

export function isFormalVersion(status: string): boolean {
  return (FORMAL_VERSION_STATUSES as readonly string[]).includes(status);
}

/**
 * Estados de una versión aún EN PREPARACIÓN (no publicada): borrador y etapas del
 * flujo previas a la publicación. Mientras exista una en curso no se crea otra.
 */
export const IN_PROGRESS_VERSION_STATUSES: readonly VersionStatus[] = [
  'draft',
  'in_review',
  'changes_requested',
  'in_approval',
  'approved',
];

export function isInProgressVersion(status: string): boolean {
  return (IN_PROGRESS_VERSION_STATUSES as readonly string[]).includes(status);
}

/**
 * ¿La versión requiere descripción de cambios obligatoria para publicarse? Toda
 * versión posterior a la inicial (> v1.0). La v1.0 se registra como «Documento nuevo».
 */
export function requiresChangeNotes(label: string): boolean {
  return label !== INITIAL_VERSION_LABEL;
}

/**
 * Texto de la columna «Modificación» del Control de cambios para una versión:
 * las notas del cambio si existen; «Documento nuevo» para la v1.0; y un marcador
 * explícito si una versión posterior quedó sin descripción (no debería ocurrir tras
 * la validación de publicación).
 */
export function changeDescription(label: string, changeNotes: string | null | undefined): string {
  const notes = changeNotes?.trim();
  if (notes) return notes;
  return label === INITIAL_VERSION_LABEL ? 'Documento nuevo' : 'Cambio sin descripción registrada';
}
