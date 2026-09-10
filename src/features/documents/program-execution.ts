/**
 * Programas ejecutables (DOC-003) — modelo PURO de actividades, programación y
 * generación de OCURRENCIAS. Sin BD ni E/S; determinista; seguro para cliente.
 *
 * Una ACTIVIDAD (definición) vive en `structured_content.program.activities` con
 * un `activityId` estable. Una definición con programación válida y
 * `executionEnabled` produce una o varias OCURRENCIAS (cada una → una tarea). Las
 * ocurrencias se persisten en `program_activity_instances` (no en el JSON).
 */
import { addMonthsIso } from './dates';

// --- Frecuencias / tipos de programación -------------------------------------

export const PROGRAM_FREQUENCIES = [
  { value: 'weekly', label: 'Semanal', months: 0 },
  { value: 'monthly', label: 'Mensual', months: 1 },
  { value: 'bimonthly', label: 'Bimestral', months: 2 },
  { value: 'quarterly', label: 'Trimestral', months: 3 },
  { value: 'semiannual', label: 'Semestral', months: 6 },
  { value: 'annual', label: 'Anual', months: 12 },
] as const;
export type ProgramFrequency = (typeof PROGRAM_FREQUENCIES)[number]['value'];
const FREQ_SET = new Set<string>(PROGRAM_FREQUENCIES.map((f) => f.value));
const FREQ_MONTHS: Record<ProgramFrequency, number> = {
  weekly: 0,
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

export const SCHEDULE_TYPES = ['single', 'range', 'recurring'] as const;
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

export const NOTIFY_BEFORE_OPTIONS = [0, 1, 3, 7, 15, 30] as const;
export const DEFAULT_NOTIFY_BEFORE_DAYS = 7;

/** Tope duro de ocurrencias por actividad recurrente (evita generación infinita). */
export const MAX_OCCURRENCES = 366;

export interface ProgramSchedule {
  type: ScheduleType;
  /** ISO YYYY-MM-DD. `single`: usa `dueDate`. `range`: start+due. `recurring`: start(+end). */
  startDate: string | null;
  dueDate: string | null;
  frequency: ProgramFrequency | null;
  interval: number | null;
  endDate: string | null;
}

export interface ProgramActivity {
  activityId: string;
  name: string;
  description: string;
  /** Si false, es una actividad DOCUMENTAL: no genera ocurrencias ni tareas (§46/§47). */
  executionEnabled: boolean;
  /** MVP: responsable por usuario (rol reservado a futuro). */
  responsibleUserId: string | null;
  schedule: ProgramSchedule;
  expectedEvidence: string;
  observations: string;
  notifyBeforeDays: number;
}

export interface ProgramBlock {
  periodStart: string | null;
  periodEnd: string | null;
  activities: ProgramActivity[];
}

export interface GeneratedOccurrence {
  occurrenceKey: string;
  plannedStart: string | null;
  dueAt: string; // ISO YYYY-MM-DD
}

// --- Helpers de fecha --------------------------------------------------------

function isIso(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v + 'T00:00:00Z'))
  );
}
function isoOrNull(v: unknown): string | null {
  return isIso(v) ? (v as string) : null;
}
function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
/** Semana ISO-8601 de una fecha: {year, week}. */
export function isoWeek(iso: string): { year: number; week: number } {
  const d = new Date(iso + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7; // lunes=0
  d.setUTCDate(d.getUTCDate() - day + 3); // jueves de esa semana
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return { year: d.getUTCFullYear(), week };
}

// --- Saneo -------------------------------------------------------------------

const MAX_TEXT = 300;
const MAX_LONG = 2000;

function sanitizeSchedule(input: unknown): ProgramSchedule {
  const s = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const type = SCHEDULE_TYPES.includes(s.type as ScheduleType)
    ? (s.type as ScheduleType)
    : 'single';
  const frequency = FREQ_SET.has(s.frequency as string) ? (s.frequency as ProgramFrequency) : null;
  const intervalRaw = Math.trunc(Number(s.interval));
  const interval = Number.isFinite(intervalRaw) && intervalRaw > 0 ? Math.min(intervalRaw, 52) : 1;
  return {
    type,
    startDate: isoOrNull(s.startDate),
    dueDate: isoOrNull(s.dueDate),
    frequency: type === 'recurring' ? frequency : null,
    interval: type === 'recurring' ? interval : null,
    endDate: type === 'recurring' ? isoOrNull(s.endDate) : null,
  };
}

function sanitizeActivity(input: unknown): ProgramActivity {
  const a = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) =>
    typeof v === 'string' ? v.replace(/\r\n?/g, '\n').slice(0, max) : '';
  const notifyRaw = Math.trunc(Number(a.notifyBeforeDays));
  const notify = (NOTIFY_BEFORE_OPTIONS as readonly number[]).includes(notifyRaw)
    ? notifyRaw
    : DEFAULT_NOTIFY_BEFORE_DAYS;
  // ID estable: se conserva el existente; si falta, queda '' y el SERVIDOR lo
  // acuña al guardar (ver `ensureActivityIds`). El saneo NO acuña (determinista).
  const activityId =
    typeof a.activityId === 'string' && /^[0-9a-fA-F-]{8,40}$/.test(a.activityId)
      ? a.activityId
      : '';
  return {
    activityId,
    name: str(a.name, MAX_TEXT),
    description: str(a.description, MAX_LONG),
    executionEnabled: a.executionEnabled === true,
    responsibleUserId:
      typeof a.responsibleUserId === 'string' && a.responsibleUserId ? a.responsibleUserId : null,
    schedule: sanitizeSchedule(a.schedule),
    expectedEvidence: str(a.expectedEvidence, MAX_TEXT),
    observations: str(a.observations, MAX_LONG),
    notifyBeforeDays: notify,
  };
}

/**
 * Sanea el bloque de programa (PURO y determinista: no acuña IDs). Conserva los
 * `activityId` existentes; los que falten quedan '' hasta que el servidor los
 * acuñe con `ensureActivityIds` al guardar.
 */
export function sanitizeProgramBlock(input: unknown): ProgramBlock {
  const b = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const rawActivities = Array.isArray(b.activities) ? b.activities : [];
  const activities = rawActivities
    .slice(0, MAX_OCCURRENCES)
    .map((a) => sanitizeActivity(a))
    .filter((a) => a.name.trim() !== '' || a.description.trim() !== '');
  return {
    periodStart: isoOrNull(b.periodStart),
    periodEnd: isoOrNull(b.periodEnd),
    activities,
  };
}

/**
 * Acuña `activityId` para las actividades que no lo tengan (§3/§54). Se llama en
 * SERVIDOR antes de persistir; los IDs ya existentes se conservan (reordenar/
 * editar/nueva versión no los cambia).
 */
export function ensureActivityIds(block: ProgramBlock, gen: () => string): ProgramBlock {
  return {
    ...block,
    activities: block.activities.map((a) => (a.activityId ? a : { ...a, activityId: gen() })),
  };
}

// --- Validación (para publicar §45/§48) --------------------------------------

/** Valida una actividad EJECUTABLE. Devuelve mensajes en español (vacío = válida). */
export function validateActivity(activity: ProgramActivity, period: ProgramBlock): string[] {
  const errors: string[] = [];
  const label = activity.name.trim() || 'actividad sin nombre';
  if (!activity.name.trim()) errors.push('Cada actividad requiere un nombre.');
  if (!activity.executionEnabled) return errors; // documental: no exige ejecución
  if (!activity.responsibleUserId) errors.push(`"${label}": falta el responsable.`);
  const s = activity.schedule;
  const within = (d: string | null) =>
    !d ||
    ((!period.periodStart || d >= period.periodStart) &&
      (!period.periodEnd || d <= period.periodEnd));
  if (s.type === 'single') {
    if (!s.dueDate) errors.push(`"${label}": falta la fecha.`);
    else if (!within(s.dueDate))
      errors.push(`"${label}": la fecha está fuera del periodo del programa.`);
  } else if (s.type === 'range') {
    if (!s.startDate || !s.dueDate) errors.push(`"${label}": el rango requiere inicio y fin.`);
    else if (s.dueDate < s.startDate)
      errors.push(`"${label}": el fin del rango es anterior al inicio.`);
    else if (!within(s.startDate) || !within(s.dueDate))
      errors.push(`"${label}": el rango está fuera del periodo del programa.`);
  } else {
    if (!s.frequency) errors.push(`"${label}": falta la frecuencia de la recurrencia.`);
    if (!s.startDate) errors.push(`"${label}": la recurrencia requiere fecha de inicio.`);
    const end = s.endDate ?? period.periodEnd;
    if (!end)
      errors.push(`"${label}": la recurrencia requiere fecha final (o periodo del programa).`);
    if (s.startDate && end && end < s.startDate)
      errors.push(`"${label}": la fecha final es anterior al inicio.`);
    if (s.startDate && !within(s.startDate))
      errors.push(`"${label}": el inicio está fuera del periodo del programa.`);
  }
  return errors;
}

/** Valida todo el programa antes de publicar. */
export function validateProgramForPublish(block: ProgramBlock): string[] {
  const errors: string[] = [];
  const executable = block.activities.filter((a) => a.executionEnabled);
  for (const a of executable) errors.push(...validateActivity(a, block));
  return errors;
}

// --- Etiquetas legibles (es) -------------------------------------------------

export function frequencyLabel(frequency: ProgramFrequency | null): string {
  return PROGRAM_FREQUENCIES.find((f) => f.value === frequency)?.label ?? '';
}

/** Etiqueta legible de la programación de una actividad. */
export function scheduleLabel(schedule: ProgramSchedule): string {
  const s = schedule;
  if (s.type === 'single') return s.dueDate ?? 'Sin fecha';
  if (s.type === 'range') {
    return s.startDate && s.dueDate ? `${s.startDate} a ${s.dueDate}` : 'Rango sin fechas';
  }
  const freq = frequencyLabel(s.frequency);
  const every = s.interval && s.interval > 1 ? ` (cada ${s.interval})` : '';
  const range = s.startDate ? ` desde ${s.startDate}${s.endDate ? ` hasta ${s.endDate}` : ''}` : '';
  return `${freq || 'Recurrente'}${every}${range}`;
}

// --- Generación de ocurrencias -----------------------------------------------

function occurrenceKey(frequency: ProgramFrequency, dueAt: string): string {
  if (frequency === 'weekly') {
    const { year, week } = isoWeek(dueAt);
    return `weekly:${year}-W${String(week).padStart(2, '0')}`;
  }
  return `${frequency}:${dueAt.slice(0, 7)}`; // familia mensual → año-mes
}

// --- Reconciliación entre versiones (§2-13) ----------------------------------

/**
 * Ocurrencia DESEADA por la versión nueva (materializable). Se compara contra las
 * instancias vigentes de la versión anterior para decidir continuidad/sustitución.
 */
export interface DesiredOccurrence {
  activityId: string;
  occurrenceKey: string;
  dueAt: string | null;
  plannedStart: string | null;
  responsibleUserId: string | null;
}

/**
 * Estado de una instancia de la versión ANTERIOR relevante para reconciliar. El
 * llamador calcula `eligible` (futura, no iniciada y no terminal): solo esas se
 * reconcilian; el histórico (completadas/vencidas/pasadas) nunca se toca (§3/§4).
 */
export interface PriorInstanceState {
  instanceId: string;
  activityId: string;
  occurrenceKey: string;
  dueAt: string | null;
  plannedStart: string | null;
  responsibleUserId: string | null;
  taskId: string | null;
  eligible: boolean;
}

/**
 * Plan de reconciliación (PURO): decide, por cada instancia futura elegible de la
 * versión anterior, si se REUTILIZA (carry: misma actividad+ocurrencia y misma
 * programación/responsable → la tarea continúa en la versión nueva) o se SUSTITUYE
 * (supersede: la actividad se eliminó o su fecha/responsable cambió). Nunca duplica
 * ni borra historia.
 */
export interface ReconciliationPlan {
  carry: Array<{
    instanceId: string;
    activityId: string;
    occurrenceKey: string;
    taskId: string | null;
  }>;
  supersede: Array<{ instanceId: string; taskId: string | null }>;
}

function reconKey(activityId: string, occurrenceKey: string): string {
  return `${activityId}::${occurrenceKey}`;
}

/** ¿La ocurrencia anterior y la deseada son EQUIVALENTES (misma fecha/plan/responsable)? */
function occurrencesEquivalent(prior: PriorInstanceState, desired: DesiredOccurrence): boolean {
  return (
    (prior.dueAt ?? null) === (desired.dueAt ?? null) &&
    (prior.plannedStart ?? null) === (desired.plannedStart ?? null) &&
    (prior.responsibleUserId ?? null) === (desired.responsibleUserId ?? null)
  );
}

/**
 * Calcula el plan de reconciliación (§3-6). Determinista y sin BD. Solo considera
 * instancias `eligible` (futuras no iniciadas); el resto es histórico intocable.
 */
export function planReconciliation(
  priors: PriorInstanceState[],
  desired: DesiredOccurrence[],
): ReconciliationPlan {
  const desiredMap = new Map(desired.map((d) => [reconKey(d.activityId, d.occurrenceKey), d]));
  const plan: ReconciliationPlan = { carry: [], supersede: [] };
  for (const pi of priors) {
    if (!pi.eligible) continue; // histórico: se conserva sin cambios
    const d = desiredMap.get(reconKey(pi.activityId, pi.occurrenceKey));
    if (d && occurrencesEquivalent(pi, d)) {
      plan.carry.push({
        instanceId: pi.instanceId,
        activityId: pi.activityId,
        occurrenceKey: pi.occurrenceKey,
        taskId: pi.taskId,
      });
    } else {
      plan.supersede.push({ instanceId: pi.instanceId, taskId: pi.taskId });
    }
  }
  return plan;
}

/** Clave estable de una ocurrencia para el mapa de continuidad (actividad::ocurrencia). */
export function occurrenceMapKey(activityId: string, occurrenceKey: string): string {
  return reconKey(activityId, occurrenceKey);
}

/**
 * Genera las ocurrencias de una actividad EJECUTABLE, acotadas por su `endDate` o
 * el periodo del programa, sin drift acumulativo (cada ocurrencia se ancla en la
 * fecha de inicio). Devuelve [] si la actividad no es ejecutable o no es válida.
 */
export function generateOccurrences(
  activity: ProgramActivity,
  block: ProgramBlock,
): GeneratedOccurrence[] {
  if (!activity.executionEnabled) return [];
  const s = activity.schedule;

  if (s.type === 'single') {
    if (!s.dueDate) return [];
    return [{ occurrenceKey: `single:${s.dueDate}`, plannedStart: s.dueDate, dueAt: s.dueDate }];
  }
  if (s.type === 'range') {
    if (!s.startDate || !s.dueDate || s.dueDate < s.startDate) return [];
    return [{ occurrenceKey: `range:${s.startDate}`, plannedStart: s.startDate, dueAt: s.dueDate }];
  }

  // recurring
  if (!s.frequency || !s.startDate) return [];
  const end = s.endDate ?? block.periodEnd;
  if (!end || end < s.startDate) return [];
  const interval = s.interval && s.interval > 0 ? s.interval : 1;
  const out: GeneratedOccurrence[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < MAX_OCCURRENCES; i += 1) {
    let dueAt: string | null;
    if (s.frequency === 'weekly') {
      dueAt = addDaysIso(s.startDate, i * 7 * interval);
    } else {
      dueAt = addMonthsIso(s.startDate, i * FREQ_MONTHS[s.frequency] * interval);
    }
    if (!dueAt || dueAt > end) break;
    const key = occurrenceKey(s.frequency, dueAt);
    if (seen.has(key)) continue; // colisión de periodo (p. ej. dos fechas mismo mes)
    seen.add(key);
    out.push({ occurrenceKey: key, plannedStart: dueAt, dueAt });
  }
  return out;
}
