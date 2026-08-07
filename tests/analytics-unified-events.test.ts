import { describe, expect, it } from 'vitest';
import {
  buildUnifiedDataset,
  mapCapa,
  normalizeStatus,
  severityFromNpr,
  sourceTypeToUnifiedSource,
  toISODate,
  type CapaRow,
  type NativeEventRow,
  type UnifiedInput,
} from '@/features/analytics/unified-events';

const emptyInput = (): UnifiedInput => ({
  native: [],
  capas: [],
  capaActions: [],
  findings: [],
  tasks: [],
  projects: [],
  fmeaRows: [],
  analyses: [],
});

const capa = (over: Partial<CapaRow> = {}): CapaRow => ({
  id: 'capa-1',
  organizationId: 'org-1',
  siteId: null,
  folio: 'CAPA-2026-0001',
  title: 'Fuga en línea 2',
  status: 'action_plan',
  severity: 'high',
  sourceType: 'internal_nc',
  area: 'Producción',
  process: 'Llenado',
  product: 'Producto X',
  responsibleUserId: null,
  detectedAt: '2026-03-10',
  targetDate: '2026-04-10',
  closedAt: null,
  createdAt: '2026-03-10T12:00:00.000Z',
  ...over,
});

const nativeRef = (over: Partial<NativeEventRow> = {}): NativeEventRow => ({
  id: 'ev-1',
  organizationId: 'org-1',
  siteId: null,
  folio: 'EVT-2026-0001',
  eventDate: '2026-05-01',
  eventType: 'deviation',
  categoryName: null,
  subcategoryName: null,
  title: 'Desviación manual',
  status: 'open',
  severity: 'medium',
  area: null,
  process: null,
  productText: null,
  machineText: null,
  shiftText: null,
  supplierText: null,
  responsibleUserId: null,
  quantityAffected: null,
  unitsProduced: null,
  cost: null,
  durationHours: null,
  sourceType: null,
  sourceId: null,
  createdAt: '2026-05-01T00:00:00.000Z',
  ...over,
});

describe('normalizeStatus', () => {
  it('mapea vocabularios de módulos al ciclo común', () => {
    expect(normalizeStatus('draft')).toBe('open');
    expect(normalizeStatus('action_plan')).toBe('in_progress');
    expect(normalizeStatus('effective')).toBe('closed');
    expect(normalizeStatus('cancelled')).toBe('cancelled');
  });

  it('cae a "open" ante valores desconocidos o nulos', () => {
    expect(normalizeStatus(undefined)).toBe('open');
    expect(normalizeStatus('valor_raro')).toBe('open');
  });
});

describe('severityFromNpr', () => {
  it('es determinista por umbrales documentados', () => {
    expect(severityFromNpr(null)).toBeNull();
    expect(severityFromNpr(40)).toBe('low');
    expect(severityFromNpr(80)).toBe('medium');
    expect(severityFromNpr(150)).toBe('high');
    expect(severityFromNpr(250)).toBe('critical');
  });
});

describe('toISODate', () => {
  it('normaliza DATE/timestamp a YYYY-MM-DD en UTC', () => {
    expect(toISODate('2026-03-10')).toBe('2026-03-10');
    expect(toISODate(new Date('2026-03-10T23:30:00.000Z'))).toBe('2026-03-10');
    expect(toISODate(null)).toBeNull();
    expect(toISODate('no-es-fecha')).toBeNull();
  });
});

describe('sourceTypeToUnifiedSource', () => {
  it('traduce source_type de eventos nativos a fuente agregada', () => {
    expect(sourceTypeToUnifiedSource('capa_action')).toBe('capa_action');
    expect(sourceTypeToUnifiedSource('audit_finding')).toBe('audit_finding');
    expect(sourceTypeToUnifiedSource('manual')).toBeNull();
    expect(sourceTypeToUnifiedSource(null)).toBeNull();
  });
});

describe('mapCapa', () => {
  it('proyecta un CAPA al evento unificado con navegación al origen', () => {
    const u = mapCapa(capa());
    expect(u.source).toBe('capa');
    expect(u.origin).toBe('aggregated');
    expect(u.href).toBe('/dashboard/capa/capa-1');
    expect(u.eventType).toBe('capa');
    expect(u.status).toBe('in_progress');
    expect(u.eventDate).toBe('2026-03-10');
    expect(u.category).toBe('internal_nc');
  });
});

describe('buildUnifiedDataset', () => {
  it('combina nativos + agregados', () => {
    const ds = buildUnifiedDataset({ ...emptyInput(), native: [nativeRef()], capas: [capa()] });
    expect(ds).toHaveLength(2);
    expect(ds.map((e) => e.source).sort()).toEqual(['capa', 'quality_event']);
  });

  it('deduplica: un evento nativo que referencia un módulo suprime el agregado', () => {
    const linked = nativeRef({
      id: 'ev-2',
      sourceType: 'capa_action',
      sourceId: 'act-9',
    });
    const ds = buildUnifiedDataset({
      ...emptyInput(),
      native: [linked],
      capaActions: [
        {
          id: 'act-9',
          organizationId: 'org-1',
          capaId: 'capa-1',
          description: 'Acción enlazada',
          status: 'in_progress',
          priority: 'high',
          responsibleUserId: null,
          startDate: '2026-05-01',
          dueDate: '2026-05-20',
          closedAt: null,
          createdAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    });
    // El evento nativo permanece; la acción agregada equivalente se omite.
    expect(ds).toHaveLength(1);
    expect(ds[0]?.key).toBe('quality_event:ev-2');
    expect(ds[0]?.origin).toBe('converted');
  });

  it('marca como nativo el evento sin fuente y como convertido el enlazado', () => {
    const ds = buildUnifiedDataset({ ...emptyInput(), native: [nativeRef()] });
    expect(ds[0]?.origin).toBe('native');
  });
});
