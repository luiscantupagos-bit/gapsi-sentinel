import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_TOOLS,
  getTool,
  groupedTools,
  toolsForOrigin,
  toolDetailHref,
} from '@/features/analysis/tool-catalog';

describe('tool-catalog (selector común)', () => {
  it('expone las herramientas esperadas con categoría', () => {
    const ids = ANALYSIS_TOOLS.map((t) => t.id);
    for (const id of [
      '5whys',
      'fta',
      'ishikawa',
      'cause_tree',
      'fmea',
      'pareto',
      'freeform',
      'data_study',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('agrupa por categoría en el orden INVESTIGACIÓN/RIESGO/COMPARACIÓN/DATOS', () => {
    const groups = groupedTools('project');
    expect(groups.map((g) => g.category)).toEqual(['cause', 'risk', 'comparison', 'data']);
    const cause = groups.find((g) => g.category === 'cause')!;
    expect(cause.tools.map((t) => t.id)).toContain('5whys');
    expect(cause.tools.map((t) => t.id)).toContain('fta');
    const risk = groups.find((g) => g.category === 'risk')!;
    expect(risk.tools.map((t) => t.id)).toEqual(['fmea', 'pareto']);
    const data = groups.find((g) => g.category === 'data')!;
    expect(data.tools.map((t) => t.id)).toEqual(['data_study']);
  });

  it('data_study es compatible con proyecto e independiente', () => {
    expect(toolsForOrigin('project').some((t) => t.id === 'data_study')).toBe(true);
    expect(toolsForOrigin('independent').some((t) => t.id === 'data_study')).toBe(true);
  });

  it('las herramientas de quality_analyses abren el workspace transversal y el estudio su ruta', () => {
    expect(toolDetailHref('fmea', 'A1')).toBe('/dashboard/analysis/A1');
    expect(toolDetailHref('ishikawa', 'A2')).toBe('/dashboard/analysis/A2');
    expect(toolDetailHref('data_study', 'S1')).toBe('/dashboard/analytics/studies/S1');
  });

  it('getTool desconocido es undefined', () => {
    expect(getTool('nope')).toBeUndefined();
  });
});
