/**
 * Programación de avisos de Programa (DOC-003 §5-7/§25-27). PURO y determinista.
 *
 * Dada la fecha de vencimiento de una ocurrencia, los días de anticipación y un
 * `now` explícito (inyectado para tests/cron), decide qué avisos corresponden en
 * ese momento. Comparación por cadena ISO `YYYY-MM-DD` (lexicográfica = cronológica).
 *
 * Reglas:
 *  - `program_due_soon`: solo si `notifyBeforeDays > 0` y estamos en la ventana
 *    `[dueAt - notifyBeforeDays, dueAt)` (§26: 0 días → no hay due_soon separado).
 *  - `program_due_today`: `now === dueAt`.
 *  - `program_overdue`: `now > dueAt`; `scheduledFor = dueAt` → un único overdue por
 *    ocurrencia gracias al dedup (§25).
 */
export const PROGRAM_NOTIFICATION_TYPES = [
  'program_due_soon',
  'program_due_today',
  'program_overdue',
] as const;
export type ProgramNotificationType = (typeof PROGRAM_NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABEL: Record<ProgramNotificationType, string> = {
  program_due_soon: 'Próxima a vencer',
  program_due_today: 'Vence hoy',
  program_overdue: 'Vencida',
};

export interface NotificationPlan {
  type: ProgramNotificationType;
  /** ISO YYYY-MM-DD que se usa como parte de la clave de dedup. */
  scheduledFor: string;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Suma (o resta) días a una fecha ISO `YYYY-MM-DD` en UTC. Devuelve ISO o `null`. */
export function addDaysIso(iso: string | null | undefined, days: number): string | null {
  if (!iso) return null;
  const m = ISO_RE.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Avisos que corresponden a una ocurrencia (dueAt) en el instante `now` (ISO). */
export function planProgramNotifications(
  dueAt: string | null,
  notifyBeforeDays: number,
  now: string,
): NotificationPlan[] {
  if (!dueAt) return [];
  const due = dueAt.slice(0, 10);
  const today = now.slice(0, 10);
  const out: NotificationPlan[] = [];

  const soon = addDaysIso(due, -Math.max(0, notifyBeforeDays));
  if (notifyBeforeDays > 0 && soon && today >= soon && today < due) {
    out.push({ type: 'program_due_soon', scheduledFor: soon });
  }
  if (today === due) {
    out.push({ type: 'program_due_today', scheduledFor: due });
  }
  if (today > due) {
    out.push({ type: 'program_overdue', scheduledFor: due });
  }
  return out;
}
