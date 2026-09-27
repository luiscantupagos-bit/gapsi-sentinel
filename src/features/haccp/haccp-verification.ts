/**
 * HACCP-006 — helpers PUROS de VERIFICACIÓN operacional. Sin BD. La verificación demuestra que
 * el sistema SE ESTÁ EJECUTANDO conforme a lo establecido (distinta de la validación, HACCP-005,
 * que demuestra que una medida ES CAPAZ de controlar el peligro). Reutiliza el motor de
 * recurrencia de Programas (`program-execution`): una definición → ProgramSchedule →
 * ocurrencias → Task nativa → Record → resultado. NO implementa un segundo scheduler.
 */
import { type ProgramSchedule, type ProgramActivity } from '@/features/documents/program-execution';

// --- Alcance (§4) ------------------------------------------------------------
export const VERIFICATION_SCOPES = ['plan', 'pcc', 'ppro', 'hazard', 'control_measure'] as const;
export type VerificationScope = (typeof VERIFICATION_SCOPES)[number];
export const VERIFICATION_SCOPE_LABEL: Record<VerificationScope, string> = {
  plan: 'Plan completo',
  pcc: 'PCC',
  ppro: 'PPRO',
  hazard: 'Peligro',
  control_measure: 'Medida de control',
};
export const verificationScopeLabel = (s: string): string =>
  VERIFICATION_SCOPE_LABEL[s as VerificationScope] ?? s;

// --- Frecuencias (§6) — mapean al motor de Programas -------------------------
export const VERIFICATION_FREQUENCIES = [
  { value: 'single', label: 'Única' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'bimonthly', label: 'Bimestral' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' },
] as const;
export type VerificationFrequency = (typeof VERIFICATION_FREQUENCIES)[number]['value'];
export const verificationFrequencyLabel = (f: string): string =>
  VERIFICATION_FREQUENCIES.find((x) => x.value === f)?.label ?? f;

// --- Estrategia de versión del formato (§10) ---------------------------------
export const RECORD_STRATEGIES = ['none', 'latest_published', 'pinned_version'] as const;
export type RecordStrategy = (typeof RECORD_STRATEGIES)[number];
export const RECORD_STRATEGY_LABEL: Record<RecordStrategy, string> = {
  none: 'Sin formato configurado',
  latest_published: 'Versión vigente al ejecutar',
  pinned_version: 'Versión fija',
};
export const recordStrategyLabel = (s: string): string =>
  RECORD_STRATEGY_LABEL[s as RecordStrategy] ?? s;

// --- Estado de la DEFINICIÓN (§23) — separado del resultado de ejecuciones ----
export const VERIFICATION_DEF_STATUSES = ['active', 'paused', 'archived'] as const;
export type VerificationDefStatus = (typeof VERIFICATION_DEF_STATUSES)[number];
export const VERIFICATION_DEF_STATUS_LABEL: Record<VerificationDefStatus, string> = {
  active: 'Activa',
  paused: 'Pausada',
  archived: 'Archivada',
};
export const verificationDefStatusLabel = (s: string): string =>
  VERIFICATION_DEF_STATUS_LABEL[s as VerificationDefStatus] ?? s;

// --- Resultado técnico de la EJECUCIÓN (§16) — separado del estado Task -------
export const VERIFICATION_RESULTS = ['conforme', 'no_conforme', 'no_concluyente'] as const;
export type VerificationResult = (typeof VERIFICATION_RESULTS)[number];
export const VERIFICATION_RESULT_LABEL: Record<VerificationResult, string> = {
  conforme: 'Conforme',
  no_conforme: 'No conforme',
  no_concluyente: 'No concluyente',
};
export const verificationResultLabel = (r: string | null | undefined): string =>
  (r && VERIFICATION_RESULT_LABEL[r as VerificationResult]) || '—';

/** §17 — la conclusión/observaciones es obligatoria para no conforme / no concluyente. */
export const resultRequiresConclusion = (result: string | null | undefined): boolean =>
  result === 'no_conforme' || result === 'no_concluyente';

/** Construye el ProgramSchedule para el motor de recurrencia a partir de la definición. */
export function buildVerificationSchedule(def: {
  frequencyType: string;
  startAt: string | null;
  frequencyConfig?: { interval?: number | null; endDate?: string | null } | null;
}): ProgramSchedule {
  const start = def.startAt;
  if (def.frequencyType === 'single') {
    return {
      type: 'single',
      startDate: start,
      dueDate: start,
      frequency: null,
      interval: null,
      endDate: null,
    };
  }
  return {
    type: 'recurring',
    startDate: start,
    dueDate: null,
    frequency: def.frequencyType as ProgramSchedule['frequency'],
    interval: def.frequencyConfig?.interval ?? 1,
    endDate: def.frequencyConfig?.endDate ?? null,
  };
}

/**
 * Adapta una definición a la forma `ProgramActivity` que consume `generateOccurrences`. El
 * horizonte por defecto (sin endDate) se acota con el `periodEnd` del bloque que pasa el servidor.
 */
export function definitionToActivity(def: {
  verificationLogicalId: string;
  title: string;
  purpose: string | null;
  responsibleUserId: string | null;
  frequencyType: string;
  startAt: string | null;
  frequencyConfig?: { interval?: number | null; endDate?: string | null } | null;
  evidenceRequired: boolean;
  notifyBeforeDays?: number;
}): ProgramActivity {
  return {
    activityId: def.verificationLogicalId,
    name: def.title,
    description: def.purpose ?? '',
    executionEnabled: true,
    responsibleUserId: def.responsibleUserId,
    schedule: buildVerificationSchedule(def),
    expectedEvidence: def.evidenceRequired ? 'Evidencia requerida' : '',
    observations: '',
    notifyBeforeDays: def.notifyBeforeDays ?? 7,
  };
}

/** ¿La ocurrencia está vencida? (vencida = due < hoy y no completada, §22). */
export function isOccurrenceOverdue(
  dueAt: string | null,
  completedAt: string | null,
  today: string,
): boolean {
  return Boolean(dueAt && !completedAt && dueAt < today);
}

// --- Completitud (§45) -------------------------------------------------------
export interface VerificationCompletenessInput {
  activeDefinitions: number;
  withoutResponsible: number;
  withoutFrequency: number;
  requiredFormatMissing: number;
  overdue: number;
  nonConforming: number;
}
export function verificationCompleteness(i: VerificationCompletenessInput) {
  return {
    active: i.activeDefinitions,
    withoutResponsible: i.withoutResponsible,
    withoutFrequency: i.withoutFrequency,
    requiredFormatMissing: i.requiredFormatMissing,
    overdue: i.overdue,
    nonConforming: i.nonConforming,
  };
}

/** Errores de validación de una definición para poder activarse. */
export function validateDefinition(def: {
  title?: string | null;
  frequencyType?: string | null;
  recordStrategy?: string | null;
  requiredDocumentId?: string | null;
}): string[] {
  const errors: string[] = [];
  if (!def.title?.trim()) errors.push('El título de la verificación es obligatorio.');
  if (!def.frequencyType) errors.push('La frecuencia es obligatoria.');
  if (
    (def.recordStrategy === 'latest_published' || def.recordStrategy === 'pinned_version') &&
    !def.requiredDocumentId
  )
    errors.push('La estrategia de versión requiere un formato.');
  return errors;
}
