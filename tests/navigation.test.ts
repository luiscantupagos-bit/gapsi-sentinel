import { describe, expect, it } from 'vitest';
import { NAV_GROUPS, NAV_ITEMS, activeNavHref } from '@/app/dashboard/_components/nav-config';
import {
  DIAGNOSTIC_STATUS_LABEL,
  DIAGNOSTIC_RISK_LABEL,
  DIAGNOSTIC_STATUSES,
} from '@/features/diagnostics/state';

const hrefs = NAV_ITEMS.map((i) => i.href);

describe('navegación principal (CORE-ALIGN-001)', () => {
  it('Diagnósticos está presente en el menú', () => {
    expect(hrefs).toContain('/dashboard/diagnostics');
  });

  it('Bandeja CAPA NO está en el nivel principal', () => {
    expect(hrefs).not.toContain('/dashboard/capa/tasks');
  });

  it('Eventos de calidad NO está en el nivel principal', () => {
    expect(hrefs).not.toContain('/dashboard/quality-events');
  });

  it('no hay módulos futuros deshabilitados en el menú', () => {
    const labels = NAV_ITEMS.map((i) => i.label);
    for (const future of ['Riesgos', 'Proveedores', 'Capacitación', 'Reportes', 'Configuración']) {
      expect(labels).not.toContain(future);
    }
  });

  it('todos los ítems apuntan a rutas del dashboard', () => {
    for (const h of hrefs) expect(h.startsWith('/dashboard')).toBe(true);
  });

  it('está agrupado por las secciones definitivas', () => {
    const titles = NAV_GROUPS.map((g) => g.title).filter(Boolean);
    expect(titles).toEqual(['Cumplimiento', 'Mejora', 'Trabajo', 'Desempeño']);
  });

  it('resuelve el ítem activo por prefijo más específico', () => {
    expect(activeNavHref('/dashboard/capa/analysis')).toBe('/dashboard/capa/analysis');
    expect(activeNavHref('/dashboard/capa/123')).toBe('/dashboard/capa');
    expect(activeNavHref('/dashboard')).toBe('/dashboard');
  });
});

describe('etiquetas de diagnóstico', () => {
  it('hay etiqueta humana para cada estado', () => {
    for (const s of DIAGNOSTIC_STATUSES) {
      expect(DIAGNOSTIC_STATUS_LABEL[s]).toBeTruthy();
    }
  });
  it('las etiquetas de riesgo cubren la escala', () => {
    expect(Object.keys(DIAGNOSTIC_RISK_LABEL).sort()).toEqual([
      'critical',
      'high',
      'low',
      'moderate',
    ]);
  });
});
