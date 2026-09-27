/**
 * HACCP-006 — helpers PUROS de verificación: frecuencias, mapeo al motor de recurrencia,
 * resultado/conclusión, vencida, completitud, validación. §51.
 */
import { describe, expect, it } from 'vitest';
import {
  VERIFICATION_SCOPES,
  VERIFICATION_FREQUENCIES,
  verificationScopeLabel,
  verificationFrequencyLabel,
  verificationResultLabel,
  verificationDefStatusLabel,
  recordStrategyLabel,
  resultRequiresConclusion,
  buildVerificationSchedule,
  definitionToActivity,
  isOccurrenceOverdue,
  verificationCompleteness,
  validateDefinition,
} from '@/features/haccp/haccp-verification';
import { generateOccurrences } from '@/features/documents/program-execution';

describe('etiquetas y alcance (§4/§6/§16)', () => {
  it('etiqueta cada alcance, frecuencia y resultado', () => {
    for (const s of VERIFICATION_SCOPES) expect(verificationScopeLabel(s)).toBeTruthy();
    for (const f of VERIFICATION_FREQUENCIES)
      expect(verificationFrequencyLabel(f.value)).toBeTruthy();
    expect(verificationResultLabel('no_conforme')).toBe('No conforme');
    expect(verificationDefStatusLabel('paused')).toBe('Pausada');
    expect(recordStrategyLabel('pinned_version')).toBe('Versión fija');
  });
});

describe('mapeo al motor de recurrencia (§6, sin scheduler paralelo)', () => {
  it('«single» → una ocurrencia; «monthly» → ocurrencias mensuales acotadas', () => {
    const single = definitionToActivity({
      verificationLogicalId: 'v1',
      title: 'Rev',
      purpose: null,
      responsibleUserId: null,
      frequencyType: 'single',
      startAt: '2026-11-01',
      frequencyConfig: {},
      evidenceRequired: false,
    });
    expect(
      generateOccurrences(single, { periodStart: null, periodEnd: null, activities: [] }),
    ).toHaveLength(1);

    const monthly = definitionToActivity({
      verificationLogicalId: 'v2',
      title: 'Rev',
      purpose: null,
      responsibleUserId: null,
      frequencyType: 'monthly',
      startAt: '2026-01-01',
      frequencyConfig: { interval: 1, endDate: '2026-06-30' },
      evidenceRequired: false,
    });
    const occs = generateOccurrences(monthly, {
      periodStart: '2026-01-01',
      periodEnd: '2026-06-30',
      activities: [],
    });
    expect(occs.length).toBe(6); // ene..jun
    expect(occs[0]!.occurrenceKey).toBe('monthly:2026-01');
  });
  it('buildVerificationSchedule respeta tipo/inicio/intervalo', () => {
    const s = buildVerificationSchedule({
      frequencyType: 'quarterly',
      startAt: '2026-01-01',
      frequencyConfig: { interval: 1, endDate: null },
    });
    expect(s.type).toBe('recurring');
    expect(s.frequency).toBe('quarterly');
  });
});

describe('resultado y conclusión (§17)', () => {
  it('conclusión obligatoria solo para no conforme / no concluyente', () => {
    expect(resultRequiresConclusion('conforme')).toBe(false);
    expect(resultRequiresConclusion('no_conforme')).toBe(true);
    expect(resultRequiresConclusion('no_concluyente')).toBe(true);
  });
});

describe('vencida y completitud (§22/§45)', () => {
  it('vencida = due<hoy y no completada', () => {
    expect(isOccurrenceOverdue('2026-01-01', null, '2026-02-01')).toBe(true);
    expect(isOccurrenceOverdue('2026-01-01', '2026-01-02', '2026-02-01')).toBe(false); // completada
    expect(isOccurrenceOverdue('2026-03-01', null, '2026-02-01')).toBe(false); // futura
  });
  it('completitud cuenta activas/sin responsable/vencidas/no conformes', () => {
    const c = verificationCompleteness({
      activeDefinitions: 3,
      withoutResponsible: 1,
      withoutFrequency: 0,
      requiredFormatMissing: 1,
      overdue: 2,
      nonConforming: 1,
    });
    expect(c.active).toBe(3);
    expect(c.overdue).toBe(2);
    expect(c.nonConforming).toBe(1);
  });
});

describe('validación de definición', () => {
  it('exige título, frecuencia y formato cuando la estrategia lo requiere (§26)', () => {
    expect(validateDefinition({ title: '', frequencyType: 'monthly' }).length).toBe(1);
    expect(validateDefinition({ title: 'X', frequencyType: '' }).length).toBe(1);
    expect(
      validateDefinition({
        title: 'X',
        frequencyType: 'monthly',
        recordStrategy: 'latest_published',
      }).length,
    ).toBe(1); // falta formato
    expect(
      validateDefinition({ title: 'X', frequencyType: 'monthly', recordStrategy: 'none' }),
    ).toEqual([]);
  });
});
