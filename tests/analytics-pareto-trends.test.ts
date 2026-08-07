import { describe, expect, it } from 'vitest';
import type { UnifiedEvent } from '@/features/analytics/unified-events';
import {
  computeTrend,
  leastSquaresSlope,
  paretoByDimension,
} from '@/features/analytics/pareto-trends';

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
    folio: `EVT-${seq}`,
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

describe('paretoByDimension', () => {
  it('agrupa por proceso y ordena descendente por frecuencia', () => {
    const events = [
      ev({ process: 'Llenado' }),
      ev({ process: 'Llenado' }),
      ev({ process: 'Llenado' }),
      ev({ process: 'Etiquetado' }),
      ev({ process: 'Sellado' }),
    ];
    const { result } = paretoByDimension(events, 'process', 'frequency');
    expect(result.rows[0]?.category).toBe('Llenado');
    expect(result.rows[0]?.count).toBe(3);
    expect(result.total).toBe(5);
    expect(result.rows[0]?.vitalFew).toBe(true);
  });

  it('pondera por costo cuando se solicita', () => {
    const events = [
      ev({ process: 'A', cost: 100 }),
      ev({ process: 'B', cost: 10 }),
      ev({ process: 'B', cost: 5 }),
    ];
    const { result } = paretoByDimension(events, 'process', 'cost');
    expect(result.rows[0]?.category).toBe('A');
    expect(result.rows[0]?.value).toBe(100);
  });

  it('agrupa nulos como "Sin clasificar"', () => {
    const { result } = paretoByDimension([ev({ process: null })], 'process');
    expect(result.rows[0]?.category).toBe('Sin clasificar');
  });
});

describe('leastSquaresSlope', () => {
  it('positiva para serie creciente, null para <2 puntos', () => {
    expect(leastSquaresSlope([1, 2, 3, 4])).toBeCloseTo(1, 5);
    expect(leastSquaresSlope([5])).toBeNull();
  });
});

describe('computeTrend', () => {
  it('detecta incremento mensual', () => {
    const events = [
      ev({ eventDate: '2026-01-05' }),
      ev({ eventDate: '2026-02-05' }),
      ev({ eventDate: '2026-02-15' }),
      ev({ eventDate: '2026-03-05' }),
      ev({ eventDate: '2026-03-15' }),
      ev({ eventDate: '2026-03-25' }),
    ];
    const trend = computeTrend(events, { measure: 'count', period: 'monthly' });
    expect(trend.points.map((p) => p.value)).toEqual([1, 2, 3]);
    expect(trend.direction).toBe('increasing');
    expect(trend.first).toBe(1);
    expect(trend.last).toBe(3);
    expect(trend.percentChange).toBe(200);
  });

  it('marca insuficiente con un solo periodo', () => {
    const trend = computeTrend([ev({ eventDate: '2026-01-05' })], {
      measure: 'count',
      period: 'monthly',
    });
    expect(trend.direction).toBe('insufficient');
  });
});
