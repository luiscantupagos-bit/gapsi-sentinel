import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  planProgramNotifications,
  NOTIFICATION_TYPE_LABEL,
} from '@/features/notifications/schedule';

describe('addDaysIso', () => {
  it('suma y resta días en UTC (sin off-by-one)', () => {
    expect(addDaysIso('2026-10-15', -7)).toBe('2026-10-08');
    expect(addDaysIso('2026-10-15', 0)).toBe('2026-10-15');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysIso('2024-03-01', -1)).toBe('2024-02-29'); // bisiesto
    expect(addDaysIso(null, -7)).toBeNull();
  });
});

describe('planProgramNotifications (§7/§25-27)', () => {
  const due = '2026-10-15';

  it('due_soon aparece en la ventana [due-7, due) con notifyBeforeDays=7', () => {
    // El día exacto de anticipación.
    expect(planProgramNotifications(due, 7, '2026-10-08').map((p) => p.type)).toEqual([
      'program_due_soon',
    ]);
    // Un día dentro de la ventana también.
    expect(planProgramNotifications(due, 7, '2026-10-10')[0]?.type).toBe('program_due_soon');
    // scheduledFor = fecha de anticipación (dedup estable).
    expect(planProgramNotifications(due, 7, '2026-10-10')[0]?.scheduledFor).toBe('2026-10-08');
  });

  it('due_today cuando now === due', () => {
    expect(planProgramNotifications(due, 7, due).map((p) => p.type)).toEqual(['program_due_today']);
  });

  it('overdue cuando now > due, con scheduledFor = due (uno solo, §25)', () => {
    const p = planProgramNotifications(due, 7, '2026-10-16');
    expect(p.map((x) => x.type)).toEqual(['program_overdue']);
    expect(p[0]?.scheduledFor).toBe(due);
    // Días después: mismo scheduledFor → el dedup evitará duplicar.
    expect(planProgramNotifications(due, 7, '2026-10-20')[0]?.scheduledFor).toBe(due);
  });

  it('notifyBeforeDays=0 → solo due_today, sin due_soon (§26)', () => {
    expect(planProgramNotifications(due, 0, '2026-10-14')).toEqual([]);
    expect(planProgramNotifications(due, 0, due).map((p) => p.type)).toEqual(['program_due_today']);
  });

  it('antes de la ventana no genera nada', () => {
    expect(planProgramNotifications(due, 7, '2026-10-01')).toEqual([]);
  });

  it('sin fecha de vencimiento no genera nada', () => {
    expect(planProgramNotifications(null, 7, '2026-10-10')).toEqual([]);
  });

  it('etiquetas en español', () => {
    expect(NOTIFICATION_TYPE_LABEL.program_due_soon).toBe('Próxima a vencer');
    expect(NOTIFICATION_TYPE_LABEL.program_due_today).toBe('Vence hoy');
    expect(NOTIFICATION_TYPE_LABEL.program_overdue).toBe('Vencida');
  });
});
