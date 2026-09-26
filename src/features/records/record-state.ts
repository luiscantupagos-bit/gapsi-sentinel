/**
 * DOC-004 — estados PUROS del REGISTRO (record instance) y sus transiciones. Sin BD.
 *
 * El estado del REGISTRO (workflow de captura) es independiente de la conformidad del
 * RESULTADO (§8): un registro «Cerrado» puede documentar un resultado no conforme. La
 * conformidad, si aplica, vive en los datos capturados, no aquí.
 */

export const RECORD_STATUSES = [
  'draft',
  'in_progress',
  'submitted',
  'reviewed',
  'closed',
  'cancelled',
] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export const RECORD_STATUS_LABEL: Record<RecordStatus, string> = {
  draft: 'Borrador',
  in_progress: 'En proceso',
  submitted: 'Enviado',
  reviewed: 'Revisado',
  closed: 'Cerrado',
  cancelled: 'Cancelado',
};
export const recordStatusLabel = (s: string): string => RECORD_STATUS_LABEL[s as RecordStatus] ?? s;

/** Estados en los que el registro es EDITABLE por el capturista (§26/§36). */
export const EDITABLE_RECORD_STATUSES: ReadonlySet<RecordStatus> = new Set([
  'draft',
  'in_progress',
]);
export const isRecordEditable = (status: string): boolean =>
  EDITABLE_RECORD_STATUSES.has(status as RecordStatus);

/** Estados finales (solo lectura, §36). */
export const CLOSED_RECORD_STATUSES: ReadonlySet<RecordStatus> = new Set(['closed', 'cancelled']);
export const isRecordClosed = (status: string): boolean =>
  CLOSED_RECORD_STATUSES.has(status as RecordStatus);

/** Transiciones permitidas del workflow del registro. */
const TRANSITIONS: Record<RecordStatus, RecordStatus[]> = {
  draft: ['in_progress', 'submitted', 'cancelled'],
  in_progress: ['submitted', 'cancelled'],
  submitted: ['reviewed', 'closed', 'in_progress', 'cancelled'], // devolver a proceso = corrección controlada
  reviewed: ['closed', 'in_progress', 'cancelled'],
  closed: [], // inmutable (§36); corrección formal = follow-up RECORD-AMENDMENT
  cancelled: [],
};
export function canTransition(from: string, to: string): boolean {
  const allowed = TRANSITIONS[from as RecordStatus];
  return Boolean(allowed && allowed.includes(to as RecordStatus));
}

/** Origen/procedencia de un registro (§32). Prepara la integración HACCP/Programa/Tarea. */
export const RECORD_SOURCE_TYPES = [
  'manual',
  'haccp_control_plan',
  'program',
  'task',
  'audit',
] as const;
export type RecordSourceType = (typeof RECORD_SOURCE_TYPES)[number];

export const RECORD_SOURCE_LABEL: Record<RecordSourceType, string> = {
  manual: 'Manual',
  haccp_control_plan: 'Plan de control HACCP',
  program: 'Programa',
  task: 'Tarea',
  audit: 'Auditoría',
};
export const recordSourceLabel = (s: string | null | undefined): string =>
  (s && RECORD_SOURCE_LABEL[s as RecordSourceType]) || 'Manual';

/** Folio humano REG-{año}-{consecutivo} (§7). El consecutivo es atómico por tenant+año. */
export function formatRecordNumber(year: number, seq: number): string {
  return `REG-${year}-${String(seq).padStart(6, '0')}`;
}
