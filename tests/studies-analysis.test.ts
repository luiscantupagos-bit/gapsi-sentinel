import { describe, expect, it } from 'vitest';
import { runAnalysis, type StudyRowValues } from '@/features/studies/analysis-adapter';
import { interpret } from '@/features/studies/interpretation';

// Dataset sintético: medida vs turno/maquina, con fecha para tendencia.
const ROWS: StudyRowValues[] = [
  {
    fecha: '2026-01-05',
    turno: 'A',
    maquina: 'M1',
    nominal: '10',
    real: '10.4',
    defecto: 'rebaba',
  },
  { fecha: '2026-01-20', turno: 'B', maquina: 'M2', nominal: '10', real: '9.6', defecto: 'rebaba' },
  { fecha: '2026-02-05', turno: 'A', maquina: 'M1', nominal: '10', real: '10.8', defecto: 'poro' },
  { fecha: '2026-02-18', turno: 'B', maquina: 'M2', nominal: '10', real: '9.2', defecto: 'poro' },
  {
    fecha: '2026-03-05',
    turno: 'A',
    maquina: 'M1',
    nominal: '10',
    real: '11.2',
    defecto: 'rebaba',
  },
  { fecha: '2026-03-22', turno: 'B', maquina: 'M2', nominal: '10', real: '8.9', defecto: 'grieta' },
];

describe('runAnalysis · descriptive', () => {
  it('numérica devuelve estadísticos', () => {
    const r = runAnalysis('descriptive', { variable: 'real' }, ROWS);
    expect(r.kind).toBe('descriptive-numeric');
    if (r.kind === 'descriptive-numeric') {
      expect(r.n).toBe(6);
      expect(r.stats.mean).not.toBeNull();
    }
  });
  it('categórica devuelve frecuencias ordenadas', () => {
    const r = runAnalysis('descriptive', { variable: 'defecto' }, ROWS);
    expect(r.kind).toBe('descriptive-categorical');
    if (r.kind === 'descriptive-categorical') {
      expect(r.frequencies[0]?.label).toBe('rebaba');
      expect(r.frequencies[0]?.count).toBe(3);
    }
  });
});

describe('runAnalysis · pareto', () => {
  it('concentra por frecuencia de defecto', () => {
    const r = runAnalysis('pareto', { category: 'defecto', weight: '__count__' }, ROWS);
    expect(r.kind).toBe('pareto');
    if (r.kind === 'pareto') {
      expect(r.result.total).toBe(6);
      expect(r.result.rows[0]?.category).toBe('rebaba');
    }
  });
});

describe('runAnalysis · trend', () => {
  it('agrupa por mes y calcula cambio', () => {
    const r = runAnalysis('trend', { date: 'fecha', value: '__count__', period: 'monthly' }, ROWS);
    expect(r.kind).toBe('trend');
    if (r.kind === 'trend') {
      expect(r.points).toHaveLength(3); // ene, feb, mar
      expect(r.points.every((p) => p.value === 2)).toBe(true);
    }
  });
  it('un solo periodo → insuficiente', () => {
    const r = runAnalysis('trend', { date: 'fecha', period: 'yearly' }, ROWS);
    expect(r.kind).toBe('insufficient');
  });
  it('semanal agrupa por semana ISO y cruza mes/año', () => {
    const rows = [
      { f: '2025-12-30' }, // martes → ISO 2026-W01
      { f: '2026-01-01' }, // jueves → ISO 2026-W01 (mismo bucket, cruza el año)
      { f: '2026-01-05' }, // lunes → ISO 2026-W02
      { f: '2026-01-11' }, // domingo → ISO 2026-W02 (mismo bucket, cruza el mes)
      { f: '2026-01-12' }, // lunes → ISO 2026-W03
    ];
    const r = runAnalysis('trend', { date: 'f', period: 'weekly' }, rows);
    expect(r.kind).toBe('trend');
    if (r.kind === 'trend') {
      expect(r.points.map((p) => p.label)).toEqual(['2026-W01', '2026-W02', '2026-W03']);
      const byLabel = Object.fromEntries(r.points.map((p) => [p.label, p.value]));
      expect(byLabel['2026-W01']).toBe(2);
      expect(byLabel['2026-W02']).toBe(2);
      expect(byLabel['2026-W03']).toBe(1);
    }
  });
});

describe('runAnalysis · correlation & regression', () => {
  it('correlación perfecta positiva', () => {
    const rows: StudyRowValues[] = [
      { x: '1', y: '2' },
      { x: '2', y: '4' },
      { x: '3', y: '6' },
      { x: '4', y: '8' },
    ];
    const r = runAnalysis('correlation', { x: 'x', y: 'y' }, rows);
    expect(r.kind).toBe('correlation');
    if (r.kind === 'correlation') expect(r.pearson.r).toBeCloseTo(1, 5);
  });
  it('regresión recupera la pendiente', () => {
    const rows: StudyRowValues[] = [
      { x: '1', y: '3' },
      { x: '2', y: '5' },
      { x: '3', y: '7' },
      { x: '4', y: '9' },
    ];
    const r = runAnalysis('regression', { x: 'x', y: 'y' }, rows);
    expect(r.kind).toBe('regression');
    if (r.kind === 'regression') {
      expect(r.regression.slope).toBeCloseTo(2, 5);
      expect(r.regression.intercept).toBeCloseTo(1, 5);
    }
  });
});

describe('runAnalysis · group_compare, anova, chi_square', () => {
  it('compara medias por grupo', () => {
    const r = runAnalysis('group_compare', { category: 'turno', value: 'real' }, ROWS);
    expect(r.kind).toBe('group_compare');
    if (r.kind === 'group_compare') expect(r.groups).toHaveLength(2);
  });
  it('anova devuelve F o descriptiva válida', () => {
    const r = runAnalysis('anova', { category: 'turno', value: 'real' }, ROWS);
    expect(r.kind).toBe('anova');
  });
  it('chi-cuadrada arma la contingencia', () => {
    const r = runAnalysis('chi_square', { x: 'turno', y: 'defecto' }, ROWS);
    expect(r.kind).toBe('chi_square');
    if (r.kind === 'chi_square') expect(r.contingency.n).toBe(6);
  });
});

describe('interpret · 3 niveles y prudencia', () => {
  it('toda interpretación tiene principal/detalle/siguiente paso', () => {
    for (const m of [
      'descriptive',
      'pareto',
      'trend',
      'correlation',
      'regression',
      'group_compare',
      'anova',
      'chi_square',
    ] as const) {
      const cfg = {
        variable: 'real',
        category: m === 'chi_square' ? 'turno' : 'defecto',
        value: 'real',
        date: 'fecha',
        period: 'monthly' as const,
        x: 'turno',
        y: 'defecto',
      };
      const result = runAnalysis(
        m,
        m === 'correlation' || m === 'regression' ? { x: 'nominal', y: 'real' } : cfg,
        ROWS,
      );
      const it = interpret(result);
      expect(it).not.toBeNull();
      expect(it!.principal.length).toBeGreaterThan(0);
      expect(it!.detail.length).toBeGreaterThan(0);
      expect(it!.nextStep.length).toBeGreaterThan(0);
    }
  });
  it('nunca afirma causalidad en correlación', () => {
    const rows: StudyRowValues[] = [
      { x: '1', y: '2' },
      { x: '2', y: '3.5' },
      { x: '3', y: '5' },
      { x: '4', y: '6' },
    ];
    const r = runAnalysis('correlation', { x: 'x', y: 'y' }, rows);
    const it = interpret(r)!;
    const text = `${it.principal} ${it.detail} ${it.nextStep}`.toLowerCase();
    expect(text).toContain('no implica causalidad');
    expect(text).not.toMatch(/\bcausa que\b|\bprovoca\b(?! )/);
  });
});
