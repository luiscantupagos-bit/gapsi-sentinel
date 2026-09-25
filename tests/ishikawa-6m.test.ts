/**
 * Análisis de causas — 6M (Ishikawa por tarjetas). Constructor único de markup, reutilizado
 * por el componente del análisis y el reporte CAPA 8D. Cubre §23.
 */
import { describe, expect, it } from 'vitest';
import {
  buildIshikawa6MHtml,
  to6MCategories,
  order6MIndex,
  CANONICAL_6M,
} from '@/features/capa/ishikawa-6m';

const cats = [
  {
    id: 'c-env',
    name: 'Medio ambiente',
    causes: [
      {
        id: 'h1',
        description: 'Contaminación ambiental',
        status: 'pending',
        probability: 'medium',
      },
      {
        id: 'h2',
        description:
          'Condiciones adecuadas para la proliferación de hongo: calor, oscuridad, humedad por condensación',
        status: 'confirmed',
        probability: 'high',
      },
    ],
  },
  {
    id: 'c-mat',
    name: 'Materiales',
    causes: [
      {
        id: 'h3',
        description: 'Material de empaque contaminado',
        status: 'evaluating',
        probability: 'low',
      },
    ],
  },
];

describe('to6MCategories — 6 categorías, orden fijo, agrupación', () => {
  it('§3/§5: siempre devuelve las 6 M (aunque falten en los datos)', () => {
    const out = to6MCategories([]);
    expect(out).toHaveLength(6);
    expect(out.every((c) => c.causes.length === 0)).toBe(true);
  });

  it('§9: orden fijo Materiales, Medio ambiente, Mano de obra, Maquinaria, Medición, Método', () => {
    const out = to6MCategories(cats)
      .slice(0, 6)
      .map((c) => c.name);
    expect(out).toEqual([
      'Materiales',
      'Medio ambiente',
      'Mano de obra',
      'Maquinaria',
      'Medición',
      'Método',
    ]);
  });

  it('agrupa las causas en su categoría (no depende del orden de inserción)', () => {
    const out = to6MCategories(cats);
    const env = out.find((c) => c.name === 'Medio ambiente')!;
    const mat = out.find((c) => c.name === 'Materiales')!;
    expect(env.causes).toHaveLength(2);
    expect(mat.causes).toHaveLength(1);
  });

  it('order6MIndex casa sinónimos (Materiales→material, plural/acentos)', () => {
    expect(order6MIndex('Materiales')).toBe(0);
    expect(order6MIndex('MÉTODO')).toBe(CANONICAL_6M.length - 1);
    expect(order6MIndex('Otra cosa')).toBe(CANONICAL_6M.length);
  });
});

describe('buildIshikawa6MHtml — markup', () => {
  const html = buildIshikawa6MHtml(cats);

  it('§4/§24: texto completo, sin truncar ni ellipsis', () => {
    expect(html).toContain(
      'Condiciones adecuadas para la proliferación de hongo: calor, oscuridad, humedad por condensación',
    );
    expect(html).not.toContain('…');
  });

  it('§5: categorías sin causa muestran «Sin causas registradas.»', () => {
    expect(html).toContain('Sin causas registradas.');
  });

  it('§19: cada categoría tiene heading semántico h3', () => {
    for (const m of [
      'Materiales',
      'Medio ambiente',
      'Mano de obra',
      'Maquinaria',
      'Medición',
      'Método',
    ])
      expect(html).toContain(`<h3 class="ishi6m__cat">${m}</h3>`);
  });

  it('§11/§12: labels de estado y probabilidad en español (sin enums en inglés)', () => {
    expect(html).toContain('Pendiente'); // pending
    expect(html).toContain('Media'); // medium
    expect(html).toContain('Baja'); // low
    expect(html).not.toMatch(/>pending<|>medium<|>low<|>confirmed<|>high<|>evaluating</);
  });

  it('§10: marca la causa raíz confirmada', () => {
    expect(html).toContain('Causa raíz');
  });

  it('§17: tarjetas con clases print-safe y sin SVG de pescado', () => {
    expect(html).toContain('ishi6m__card');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('espina');
  });

  it('escapa el contenido', () => {
    const h = buildIshikawa6MHtml([
      { id: 'x', name: 'Materiales', causes: [{ id: 'c', description: '<b>x</b>' }] },
    ]);
    expect(h).not.toContain('<b>x</b>');
    expect(h).toContain('&lt;b&gt;');
  });

  it('withHeading controla el encabezado «Análisis de causas — 6M»', () => {
    expect(buildIshikawa6MHtml(cats, { withHeading: true })).toContain('Análisis de causas — 6M');
    expect(buildIshikawa6MHtml(cats, { withHeading: false })).not.toContain(
      'Análisis de causas — 6M',
    );
  });

  it('showStatus/showProbability ocultan las etiquetas', () => {
    const h = buildIshikawa6MHtml(cats, { showStatus: false, showProbability: false });
    expect(h).not.toContain('ishi6m__tag--status');
    expect(h).not.toContain('ishi6m__tag--prob');
  });
});
