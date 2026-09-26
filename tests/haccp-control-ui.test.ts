/**
 * HACCP-004 — UI de selección de medidas de control (aserciones de fuente). §48.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { HACCP_TABS, HACCP_FUTURE_TABS } from '@/features/haccp/haccp-state';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const base = '../src/app/dashboard/haccp/[planId]/_components';
const tab = read(`${base}/HaccpControlTab.tsx`);
const view = read(`${base}/HaccpControlMeasuresView.tsx`);

describe('§16 tab habilitado', () => {
  it('«medidas» es un tab activo, ya no «Próximamente»', () => {
    expect(HACCP_TABS).toContain('medidas');
    expect(HACCP_FUTURE_TABS as readonly string[]).not.toContain('Medidas de control');
    expect(HACCP_FUTURE_TABS as readonly string[]).not.toContain('PCC / PPRO');
  });
});

describe('§16/§17 sub-vistas y pendientes', () => {
  it('Pendientes / Evaluados / PCC / PPRO / PPR', () => {
    expect(tab).toContain('pendientes');
    expect(tab).toContain('evaluados');
    expect(tab).toContain('Evaluar medida de control');
  });
});

describe('§18-§21 wizard', () => {
  it('paso a paso con progreso y resultado explicable', () => {
    expect(tab).toContain('resolveClassification');
    expect(tab).toContain('Pregunta');
    expect(tab).toContain('Clasificación resultante');
    expect(tab).toContain('saveAssessmentAction');
  });
});

describe('§22 plan de control por clasificación', () => {
  it('editor con límite crítico (PCC) / criterio de acción (PPRO) / monitoreo', () => {
    expect(tab).toContain('saveControlPlanAction');
    expect(tab).toContain('Límite crítico');
    expect(tab).toContain('Criterio de acción');
    expect(tab).toContain('Monitoreo — Qué');
  });
  it('§9 override de clasificación disponible', () => {
    expect(tab).toContain('overrideClassification');
  });
});

describe('§24/§32/§41 completitud, read-only y vista reutilizable', () => {
  it('cards de completitud + gated por editable', () => {
    expect(tab).toContain('completeness');
    expect(tab).toContain('version.editable');
  });
  it('HaccpControlMeasuresView muestra clasificación, camino y plan; placeholder de registro', () => {
    expect(view).toContain('classificationLabel');
    expect(view).toContain('Registro de monitoreo: No configurado');
    expect(view).toContain('Revisión requerida');
  });
});
