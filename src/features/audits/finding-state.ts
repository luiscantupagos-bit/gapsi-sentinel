/**
 * Estados y clasificación de HALLAZGOS de auditoría (TASK-010). Módulo PURO.
 */

export const FINDING_STATUSES = [
  'open',
  'correction_in_progress',
  'capa_open',
  'pending_verification',
  'effective',
  'not_effective',
  'closed',
] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const FINDING_STATUS_LABEL: Record<FindingStatus, string> = {
  open: 'Abierto',
  correction_in_progress: 'Corrección en proceso',
  capa_open: 'CAPA abierta',
  pending_verification: 'Pendiente de verificación',
  effective: 'Eficaz',
  not_effective: 'No eficaz',
  closed: 'Cerrado',
};

export const FINDING_CLASSIFICATIONS = [
  'major_nc',
  'minor_nc',
  'observation',
  'improvement',
  'strength',
  'insufficient_evidence',
] as const;
export type FindingClassification = (typeof FINDING_CLASSIFICATIONS)[number];
export const FINDING_CLASSIFICATION_LABEL: Record<FindingClassification, string> = {
  major_nc: 'No conformidad mayor',
  minor_nc: 'No conformidad menor',
  observation: 'Observación',
  improvement: 'Oportunidad de mejora',
  strength: 'Fortaleza',
  insufficient_evidence: 'Evidencia insuficiente',
};

export const FINDING_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];
export const FINDING_SEVERITY_LABEL: Record<FindingSeverity, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

/** Un hallazgo "abierto" (requiere seguimiento) frente a resuelto. */
export function isFindingOpen(s: FindingStatus): boolean {
  return s !== 'effective' && s !== 'closed';
}

/** ¿Esta clasificación exige seguimiento/cierre formal? Fortaleza no. */
export function requiresFollowUp(c: FindingClassification): boolean {
  return c === 'major_nc' || c === 'minor_nc' || c === 'observation';
}

const ALLOWED: Record<FindingStatus, readonly FindingStatus[]> = {
  open: ['correction_in_progress', 'capa_open', 'closed'],
  correction_in_progress: ['pending_verification', 'capa_open', 'closed'],
  capa_open: ['pending_verification', 'closed'],
  pending_verification: ['effective', 'not_effective'],
  not_effective: ['correction_in_progress', 'capa_open'],
  effective: ['closed'],
  closed: [],
};

export function canTransitionFinding(from: FindingStatus, to: FindingStatus): boolean {
  return ALLOWED[from].includes(to);
}

export class InvalidFindingTransitionError extends Error {
  constructor(from: FindingStatus, to: FindingStatus) {
    super(`Transición de hallazgo no permitida: ${from} → ${to}.`);
    this.name = 'InvalidFindingTransitionError';
  }
}
export function assertFindingTransition(from: FindingStatus, to: FindingStatus): void {
  if (!canTransitionFinding(from, to)) throw new InvalidFindingTransitionError(from, to);
}
