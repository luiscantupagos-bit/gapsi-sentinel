/**
 * CAPA-8D §D — constructor único del Ishikawa (compartido por el componente del
 * análisis y el reporte 8D). SVG determinista, escapado y escalable (viewBox).
 */
import { describe, expect, it } from 'vitest';
import { buildIshikawaSvg } from '@/features/capa/ishikawa-svg';

describe('buildIshikawaSvg', () => {
  const svg = buildIshikawaSvg({
    effect: 'Producto no conforme',
    categories: [
      {
        id: 'c1',
        name: 'Mano de obra',
        causes: [{ id: 'h1', description: 'Falta de capacitación', status: 'open' }],
      },
      { id: 'c2', name: 'Método', causes: [] },
    ],
  });

  it('produce un SVG escalable (viewBox + preserveAspectRatio)', () => {
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 960 460"');
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
  });

  it('incluye el efecto y las categorías/causas', () => {
    expect(svg).toContain('Producto no conforme');
    expect(svg).toContain('Mano de obra');
    expect(svg).toContain('Falta de capacitación');
  });

  it('escapa el contenido (no inyecta HTML crudo)', () => {
    const s = buildIshikawaSvg({
      effect: '<script>x</script>',
      categories: [],
    });
    expect(s).not.toContain('<script>');
    expect(s).toContain('&lt;script&gt;');
  });

  it('limita a 6 categorías (layout de espina)', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      id: `c${i}`,
      name: `Cat ${i}`,
      causes: [],
    }));
    const s = buildIshikawaSvg({ effect: 'E', categories: many });
    expect(s).toContain('Cat 5');
    expect(s).not.toContain('Cat 6');
  });
});
