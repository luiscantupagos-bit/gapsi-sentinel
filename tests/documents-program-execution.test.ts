import { describe, expect, it } from 'vitest';
import {
  sanitizeProgramBlock,
  ensureActivityIds,
  validateProgramForPublish,
  generateOccurrences,
  isoWeek,
  DEFAULT_NOTIFY_BEFORE_DAYS,
  type ProgramActivity,
  type ProgramBlock,
} from '@/features/documents/program-execution';

let counter = 0;
const genId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;

const activity = (over: Partial<ProgramActivity> = {}): ProgramActivity => ({
  activityId: 'aaaaaaaa-0000-4000-8000-000000000001',
  name: 'Auditoría',
  description: '',
  executionEnabled: true,
  responsibleUserId: 'user-1',
  schedule: {
    type: 'single',
    startDate: null,
    dueDate: '2026-10-15',
    frequency: null,
    interval: null,
    endDate: null,
  },
  expectedEvidence: 'Informe',
  observations: '',
  notifyBeforeDays: 7,
  ...over,
});

const block = (
  activities: ProgramActivity[],
  periodStart = '2026-01-01',
  periodEnd = '2026-12-31',
): ProgramBlock => ({
  periodStart,
  periodEnd,
  activities,
});

describe('saneo del bloque de programa (§3/§4)', () => {
  it('saneo determinista (no acuña); ensureActivityIds acuña los faltantes', () => {
    counter = 0;
    const b = sanitizeProgramBlock({
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      activities: [{ name: 'Sin id', schedule: { type: 'single', dueDate: '2026-03-01' } }],
    });
    expect(b.activities).toHaveLength(1);
    expect(b.activities[0]?.activityId).toBe(''); // el saneo NO acuña
    expect(b.activities[0]?.executionEnabled).toBe(false); // por defecto documental
    expect(b.activities[0]?.notifyBeforeDays).toBe(DEFAULT_NOTIFY_BEFORE_DAYS);
    const withIds = ensureActivityIds(b, genId);
    expect(withIds.activities[0]?.activityId).toMatch(/^[0-9a-f-]{8,}/);
  });

  it('conserva un activityId válido existente (reordenar/editar no lo cambia)', () => {
    const b = ensureActivityIds(
      sanitizeProgramBlock({
        activities: [{ activityId: 'bbbbbbbb-0000-4000-8000-000000000009', name: 'X' }],
      }),
      genId,
    );
    expect(b.activities[0]?.activityId).toBe('bbbbbbbb-0000-4000-8000-000000000009');
  });
});

describe('generación de ocurrencias (§16/§17)', () => {
  it('fecha única → 1 ocurrencia', () => {
    const occ = generateOccurrences(activity(), block([]));
    expect(occ).toHaveLength(1);
    expect(occ[0]?.dueAt).toBe('2026-10-15');
    expect(occ[0]?.occurrenceKey).toBe('single:2026-10-15');
  });

  it('rango → 1 ocurrencia que abarca inicio-fin', () => {
    const occ = generateOccurrences(
      activity({
        schedule: {
          type: 'range',
          startDate: '2026-03-01',
          dueDate: '2026-03-31',
          frequency: null,
          interval: null,
          endDate: null,
        },
      }),
      block([]),
    );
    expect(occ).toHaveLength(1);
    expect(occ[0]?.plannedStart).toBe('2026-03-01');
    expect(occ[0]?.dueAt).toBe('2026-03-31');
  });

  it('mensual → 12 ocurrencias en el año', () => {
    const occ = generateOccurrences(
      activity({
        schedule: {
          type: 'recurring',
          startDate: '2026-01-15',
          dueDate: null,
          frequency: 'monthly',
          interval: 1,
          endDate: null,
        },
      }),
      block([]),
    );
    expect(occ).toHaveLength(12);
    expect(occ[0]?.occurrenceKey).toBe('monthly:2026-01');
    expect(occ[11]?.dueAt).toBe('2026-12-15');
  });

  it('trimestral → 4 ocurrencias', () => {
    const occ = generateOccurrences(
      activity({
        schedule: {
          type: 'recurring',
          startDate: '2026-01-15',
          dueDate: null,
          frequency: 'quarterly',
          interval: 1,
          endDate: null,
        },
      }),
      block([]),
    );
    expect(occ.map((o) => o.dueAt)).toEqual([
      '2026-01-15',
      '2026-04-15',
      '2026-07-15',
      '2026-10-15',
    ]);
  });

  it('semestral y anual', () => {
    const semi = generateOccurrences(
      activity({
        schedule: {
          type: 'recurring',
          startDate: '2026-01-01',
          dueDate: null,
          frequency: 'semiannual',
          interval: 1,
          endDate: null,
        },
      }),
      block([]),
    );
    expect(semi).toHaveLength(2);
    const annual = generateOccurrences(
      activity({
        schedule: {
          type: 'recurring',
          startDate: '2026-06-01',
          dueDate: null,
          frequency: 'annual',
          interval: 1,
          endDate: '2028-12-31',
        },
      }),
      block([], '2026-01-01', '2030-12-31'),
    );
    expect(annual.map((o) => o.dueAt)).toEqual(['2026-06-01', '2027-06-01', '2028-06-01']);
  });

  it('mensual desde fin de mes ajusta el día sin drift (§8)', () => {
    const occ = generateOccurrences(
      activity({
        schedule: {
          type: 'recurring',
          startDate: '2026-01-31',
          dueDate: null,
          frequency: 'monthly',
          interval: 1,
          endDate: '2026-04-30',
        },
      }),
      block([], '2026-01-01', '2026-12-31'),
    );
    expect(occ.map((o) => o.dueAt)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('febrero bisiesto', () => {
    const occ = generateOccurrences(
      activity({
        schedule: {
          type: 'recurring',
          startDate: '2024-01-31',
          dueDate: null,
          frequency: 'monthly',
          interval: 1,
          endDate: '2024-03-31',
        },
      }),
      block([], '2024-01-01', '2024-12-31'),
    );
    expect(occ[1]?.dueAt).toBe('2024-02-29');
  });

  it('semanal genera ocurrencias con clave ISO-week', () => {
    const occ = generateOccurrences(
      activity({
        schedule: {
          type: 'recurring',
          startDate: '2026-01-05',
          dueDate: null,
          frequency: 'weekly',
          interval: 1,
          endDate: '2026-01-31',
        },
      }),
      block([]),
    );
    expect(occ).toHaveLength(4);
    expect(occ[0]?.occurrenceKey).toMatch(/^weekly:2026-W\d{2}$/);
  });

  it('sin endDate usa el fin del periodo del programa (§18/§19)', () => {
    const occ = generateOccurrences(
      activity({
        schedule: {
          type: 'recurring',
          startDate: '2026-10-01',
          dueDate: null,
          frequency: 'monthly',
          interval: 1,
          endDate: null,
        },
      }),
      block([], '2026-01-01', '2026-12-31'),
    );
    expect(occ).toHaveLength(3); // oct, nov, dic
  });

  it('una actividad NO ejecutable no genera ocurrencias (§46/§47)', () => {
    expect(generateOccurrences(activity({ executionEnabled: false }), block([]))).toHaveLength(0);
  });

  it('isoWeek es determinista', () => {
    expect(isoWeek('2026-01-01').week).toBeGreaterThanOrEqual(1);
  });
});

describe('validación para publicar (§45/§48)', () => {
  it('exige responsable y fecha en actividades ejecutables', () => {
    const errors = validateProgramForPublish(
      block([
        activity({
          responsibleUserId: null,
          schedule: {
            type: 'single',
            startDate: null,
            dueDate: null,
            frequency: null,
            interval: null,
            endDate: null,
          },
        }),
      ]),
    );
    expect(errors.some((e) => e.includes('responsable'))).toBe(true);
    expect(errors.some((e) => e.includes('fecha'))).toBe(true);
  });

  it('rechaza fechas fuera del periodo', () => {
    const errors = validateProgramForPublish(
      block([
        activity({
          schedule: {
            type: 'single',
            startDate: null,
            dueDate: '2027-05-01',
            frequency: null,
            interval: null,
            endDate: null,
          },
        }),
      ]),
    );
    expect(errors.some((e) => e.includes('fuera del periodo'))).toBe(true);
  });

  it('una actividad documental (no ejecutable) no requiere responsable ni fecha', () => {
    const errors = validateProgramForPublish(
      block([activity({ executionEnabled: false, responsibleUserId: null, name: 'Nota' })]),
    );
    expect(errors).toEqual([]);
  });

  it('recurrente válida no produce errores', () => {
    const errors = validateProgramForPublish(
      block([
        activity({
          schedule: {
            type: 'recurring',
            startDate: '2026-01-01',
            dueDate: null,
            frequency: 'monthly',
            interval: 1,
            endDate: '2026-12-31',
          },
        }),
      ]),
    );
    expect(errors).toEqual([]);
  });
});
