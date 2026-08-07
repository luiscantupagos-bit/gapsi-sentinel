import { describe, expect, it } from 'vitest';
import type { UnifiedEvent } from '@/features/analytics/unified-events';
import { analyzeDataQuality } from '@/features/analytics/data-quality';
import { generateAlerts, type AlertRule } from '@/features/analytics/alerts';

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
    href: `/dashboard/quality-events/e${seq}`,
    title: 'Evento',
    eventType: 'deviation',
    category: 'defecto',
    subcategory: null,
    status: 'open',
    rawStatus: 'open',
    severity: 'medium',
    area: 'Producción',
    process: 'Llenado',
    product: null,
    machine: null,
    shift: null,
    supplier: null,
    responsibleUserId: 'user-1',
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

describe('analyzeDataQuality', () => {
  it('reporta campos faltantes y completitud', () => {
    const events = [
      ev(),
      ev({ area: null, severity: null, category: null, responsibleUserId: null }),
    ];
    const report = analyzeDataQuality(events);
    expect(report.totalEvents).toBe(2);
    expect(report.completeness).not.toBeNull();
    expect(report.missingByField['área']).toBe(1);
    const unclassified = report.issues.find((i) => i.type === 'unclassified');
    expect(unclassified?.count).toBe(1);
  });

  it('detecta posibles duplicados nativos', () => {
    const events = [
      ev({ title: 'Fuga en línea', eventDate: '2026-02-01', area: 'A' }),
      ev({ title: 'fuga en línea', eventDate: '2026-02-01', area: 'A' }),
    ];
    const report = analyzeDataQuality(events);
    const dup = report.issues.find((i) => i.type === 'potential_duplicate');
    expect(dup?.count).toBe(2);
  });

  it('detecta inconsistencia de fechas (compromiso antes del evento)', () => {
    const report = analyzeDataQuality([ev({ eventDate: '2026-03-10', dueDate: '2026-03-01' })]);
    const inc = report.issues.find((i) => i.type === 'inconsistent');
    expect(inc?.count).toBe(1);
  });

  it('sin eventos → completitud null', () => {
    expect(analyzeDataQuality([]).completeness).toBeNull();
  });
});

describe('generateAlerts', () => {
  it('kpi_off_target dispara cuando el KPI está fuera de meta', () => {
    const events = [ev(), ev(), ev(), ev(), ev()]; // 5 eventos
    const rules: AlertRule[] = [
      {
        id: 'r1',
        name: 'Defectos altos',
        ruleType: 'kpi_off_target',
        severity: 'warning',
        config: {
          kpiName: 'Defectos',
          kpiConfig: {
            measure: 'count',
            period: 'yearly',
            target: 2,
            criticalThreshold: 4,
            desiredDirection: 'lower',
          },
        },
      },
    ];
    const alerts = generateAlerts(rules, { events });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.dedupeKey).toBe('r1:overall');
  });

  it('category_threshold agrupa por dimensión y respeta el umbral', () => {
    const events = [
      ev({ process: 'Llenado' }),
      ev({ process: 'Llenado' }),
      ev({ process: 'Llenado' }),
      ev({ process: 'Sellado' }),
    ];
    const rules: AlertRule[] = [
      {
        id: 'r2',
        name: 'Proceso recurrente',
        ruleType: 'category_threshold',
        severity: 'warning',
        config: { dimension: 'process', threshold: 3 },
      },
    ];
    const alerts = generateAlerts(rules, { events });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.entityRef).toBe('Llenado');
    expect(alerts[0]?.message).toContain('establecer causalidad');
  });

  it('missing_data alerta por baja completitud', () => {
    const events = [
      ev({ area: null, severity: null, category: null, responsibleUserId: null, process: null }),
    ];
    const rules: AlertRule[] = [
      {
        id: 'r3',
        name: 'Calidad de datos',
        ruleType: 'missing_data',
        severity: 'info',
        config: { minCompleteness: 90 },
      },
    ];
    const alerts = generateAlerts(rules, { events });
    expect(alerts.some((a) => a.dedupeKey === 'r3:completeness')).toBe(true);
  });
});
