/**
 * HACCP-003 — UI del análisis de peligros (aserciones de fuente). §50.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { HACCP_TABS, HACCP_FUTURE_TABS } from '@/features/haccp/haccp-state';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const base = '../src/app/dashboard/haccp/[planId]/_components';
const tab = read(`${base}/HaccpHazardsTab.tsx`);
const view = read(`${base}/HaccpHazardAnalysisView.tsx`);
const matrix = read(`${base}/RiskMatrixView.tsx`);

describe('§2 tab habilitado', () => {
  it('«peligros» es un tab activo, ya no «Próximamente»', () => {
    expect(HACCP_TABS).toContain('peligros');
    expect(HACCP_FUTURE_TABS as readonly string[]).not.toContain('Análisis de peligros');
  });
});

describe('§1/§23 subtabs', () => {
  it('Materias primas / Proceso / Criterios de riesgo', () => {
    expect(tab).toContain('Materias primas');
    expect(tab).toContain('Proceso');
    expect(tab).toContain('Criterios de riesgo');
  });
});

describe('§26/§32 formularios y gestión', () => {
  it('agregar/editar/eliminar peligro; score calculado; override', () => {
    expect(tab).toContain('addHazardAction');
    expect(tab).toContain('updateHazardAction');
    expect(tab).toContain('removeHazardAction');
    expect(tab).toContain('overrideSignificant');
  });
  it('§23 editor de criterios (matriz)', () => {
    expect(tab).toContain('saveRiskMatrixAction');
    expect(tab).toContain('significanceThreshold');
  });
  it('§31 filtros básicos', () => {
    expect(tab).toContain('Significativos');
    expect(tab).toContain('filterHazards');
  });
  it('§33 aviso de cambio de flujo y §37 resumen', () => {
    expect(tab).toContain('flowChangedWarning');
    expect(tab).toContain('Significativos');
    expect(tab).toContain('Materias analizadas');
  });
  it('§32 read-only publicado (gated por editable)', () => {
    expect(tab).toContain('version.editable');
  });
});

describe('§52 vistas reutilizables', () => {
  it('HaccpHazardAnalysisView agrupa y colapsa, muestra significativos', () => {
    expect(view).toContain('haccp-hazard-group');
    expect(view).toContain('significativo');
    expect(view).toContain('Medida existente');
  });
  it('§24/§25 RiskMatrixView muestra score (no solo color), semántica HACCP', () => {
    expect(matrix).toContain('risk-cell__score');
    expect(matrix).toContain('computeRiskScore');
    expect(matrix).toContain('riskBand');
  });
  it('§53 fuentes clickeables', () => {
    expect(tab).toContain('/dashboard/documents/');
    expect(view).toContain('Ver fuente');
  });
});
