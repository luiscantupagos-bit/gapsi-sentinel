import { describe, expect, it } from 'vitest';
import type { UnifiedEvent } from '@/features/analytics/unified-events';
import {
  applyFilter,
  computeKpi,
  computeMeasure,
  evaluateStatus,
  isoWeek,
  mean,
  median,
  periodBucket,
  round,
  safeDivide,
  type KpiConfig,
} from '@/features/analytics/kpi-engine';

let seq = 0;
function ev(over: Partial<UnifiedEvent> = {}): UnifiedEvent {
  seq += 1;
  return {
    key: `quality_event:e${seq}`,
    source: 'quality_event',
    sourceLabel: 'Evento',
    origin: 'native',
    sourceId: `e${seq}`,
    nativeEventId: `e${seq}`,
    organizationId: 'org-1',
    siteId: null,
    folio: `EVT-2026-${seq}`,
    href: '#',
    title: 'Evento',
    eventType: 'deviation',
    category: null,
    subcategory: null,
    status: 'open',
    rawStatus: 'open',
    severity: 'medium',
    area: null,
    process: null,
    product: null,
    machine: null,
    shift: null,
    supplier: null,
    responsibleUserId: null,
    quantityAffected: null,
    unitsProduced: null,
    cost: null,
    durationHours: null,
    npr: null,
    eventDate: '2026-01-15',
    detectedAt: null,
    dueDate: null,
    closedAt: null,
    createdAt: '2026-01-15T00:00:00.000Z',
    ...over,
  };
}

describe('precisión', () => {
  it('round half-up estable', () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(2.675, 2)).toBe(2.68);
    expect(round(10.4)).toBe(10.4);
  });
  it('safeDivide devuelve null si el denominador es 0', () => {
    expect(safeDivide(5, 0)).toBeNull();
    expect(safeDivide(3, 4)).toBe(0.75);
  });
  it('mean/median ignoran conjunto vacío', () => {
    expect(mean([])).toBeNull();
    expect(median([])).toBeNull();
    expect(mean([2, 4, 6])).toBe(4);
    expect(median([1, 3, 2, 4])).toBe(2.5);
  });
});

describe('periodBucket', () => {
  it('mensual', () => {
    expect(periodBucket('2026-03-10', 'monthly')).toEqual({
      label: '2026-03',
      start: '2026-03-01',
      end: '2026-03-31',
    });
  });
  it('trimestral', () => {
    expect(periodBucket('2026-05-20', 'quarterly')).toEqual({
      label: '2026-Q2',
      start: '2026-04-01',
      end: '2026-06-30',
    });
  });
  it('anual', () => {
    expect(periodBucket('2026-07-01', 'yearly').label).toBe('2026');
  });
  it('semana ISO', () => {
    // 2026-01-01 es jueves → semana ISO 1 de 2026.
    expect(isoWeek(new Date('2026-01-01T00:00:00.000Z')).week).toBe(1);
    expect(periodBucket('2026-01-01', 'weekly').label).toBe('2026-W01');
  });
});

describe('filtrado', () => {
  it('filtra por tipo, estado y rango de fechas', () => {
    const events = [
      ev({ eventType: 'capa', status: 'closed', eventDate: '2026-01-05' }),
      ev({ eventType: 'deviation', status: 'open', eventDate: '2026-02-05' }),
      ev({ eventType: 'deviation', status: 'open', eventDate: '2026-03-05' }),
    ];
    const out = applyFilter(events, {
      eventType: ['deviation'],
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.eventDate).toBe('2026-02-05');
  });
});

describe('medidas', () => {
  const cfg = (over: Partial<KpiConfig>): KpiConfig => ({
    measure: 'count',
    period: 'monthly',
    ...over,
  });

  it('count', () => {
    expect(computeMeasure([ev(), ev()], cfg({ measure: 'count' })).value).toBe(2);
  });
  it('sum ignora nulos; si todos son nulos → null', () => {
    const withVals = [ev({ cost: 10 }), ev({ cost: 5 }), ev({ cost: null })];
    expect(computeMeasure(withVals, cfg({ measure: 'sum', measureField: 'cost' })).value).toBe(15);
    expect(
      computeMeasure([ev(), ev()], cfg({ measure: 'sum', measureField: 'cost' })).value,
    ).toBeNull();
  });
  it('average sobre valores no nulos', () => {
    const events = [
      ev({ durationHours: 2 }),
      ev({ durationHours: 4 }),
      ev({ durationHours: null }),
    ];
    expect(computeMeasure(events, cfg({ measure: 'avg_duration' })).value).toBe(3);
  });
  it('percentage con división entre cero → null', () => {
    const r = computeMeasure([], cfg({ measure: 'percentage' }));
    expect(r.value).toBeNull();
  });
  it('percentage numerador/denominador', () => {
    const events = [
      ev({ status: 'closed' }),
      ev({ status: 'closed' }),
      ev({ status: 'open' }),
      ev({ status: 'open' }),
    ];
    const r = computeMeasure(
      events,
      cfg({ measure: 'percentage', numeratorFilter: { status: ['closed'] } }),
    );
    expect(r.value).toBe(50);
    expect(r.numerator).toBe(2);
    expect(r.denominator).toBe(4);
  });
  it('compliance por defecto usa estados cerrados', () => {
    const events = [ev({ status: 'closed' }), ev({ status: 'open' })];
    expect(computeMeasure(events, cfg({ measure: 'compliance' })).value).toBe(50);
  });
  it('recurrence cuenta ocurrencias repetidas por proceso', () => {
    const events = [
      ev({ process: 'Llenado' }),
      ev({ process: 'Llenado' }),
      ev({ process: 'Etiquetado' }),
    ];
    const r = computeMeasure(
      events,
      cfg({ measure: 'recurrence', recurrenceKeyFields: ['process'] }),
    );
    expect(r.value).toBe(2); // dos eventos de "Llenado" comparten clave
  });
});

describe('evaluateStatus', () => {
  it('menor es mejor', () => {
    const c = {
      target: 5,
      warningThreshold: 8,
      criticalThreshold: 10,
      desiredDirection: 'lower' as const,
    };
    expect(evaluateStatus(4, c)).toBe('on_target');
    expect(evaluateStatus(7, c)).toBe('warning');
    expect(evaluateStatus(11, c)).toBe('off_target');
  });
  it('mayor es mejor', () => {
    const c = {
      target: 90,
      warningThreshold: 80,
      criticalThreshold: 70,
      desiredDirection: 'higher' as const,
    };
    expect(evaluateStatus(95, c)).toBe('on_target');
    expect(evaluateStatus(85, c)).toBe('warning');
    expect(evaluateStatus(65, c)).toBe('off_target');
  });
  it('sin meta o sin valor → no_data', () => {
    expect(evaluateStatus(5, { target: null, desiredDirection: 'lower' })).toBe('no_data');
    expect(evaluateStatus(null, { target: 5, desiredDirection: 'lower' })).toBe('no_data');
  });
});

describe('computeKpi', () => {
  it('serie temporal ordenada + total + insuficiencia', () => {
    const events = [
      ev({ eventDate: '2026-01-10' }),
      ev({ eventDate: '2026-01-20' }),
      ev({ eventDate: '2026-02-05' }),
    ];
    const result = computeKpi(events, {
      measure: 'count',
      period: 'monthly',
      target: 1,
      desiredDirection: 'lower',
    });
    expect(result.series.map((s) => s.label)).toEqual(['2026-01', '2026-02']);
    expect(result.series[0]?.value).toBe(2);
    expect(result.overall.value).toBe(3);
    expect(result.insufficientData).toBe(false);
  });
  it('sin eventos → insufficientData', () => {
    const result = computeKpi([], { measure: 'average', measureField: 'cost', period: 'monthly' });
    expect(result.insufficientData).toBe(true);
    expect(result.overall.value).toBeNull();
  });
});
