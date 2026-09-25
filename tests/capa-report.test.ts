/**
 * CAPA-8D-OUTPUT — reporte formal 8D (función pura de render).
 */
import { describe, expect, it } from 'vitest';
import { renderCapaReportHtml } from '@/features/capa/capa-report';

const identity = {
  organizationName: 'Alimentos Demo A',
  organizationLogoUrl: null,
  name: (id: string | null | undefined) => (id ? `Usuario ${id}` : null),
  date: (d: unknown) => (d ? '01/01/2026' : '—'),
};

const base = {
  capa: {
    folio: 'CAPA-2026-0001',
    title: 'Producto no conforme en línea 2',
    status: 'in_progress',
    description: 'Se detecta material fuera de especificación.',
    sourceType: 'internal_audit',
    area: 'Calidad',
    process: 'Envasado',
    product: 'Producto X',
    severity: 'high',
    priority: 'high',
    detectedAt: '2026-01-01',
    targetDate: '2026-02-01',
    problemWhat: 'Etiqueta incorrecta',
    problemWhere: 'Línea 2',
    problemWhen: 'Turno matutino',
    problemWhoDetect: 'Inspector',
    problemWhoAffect: 'Cliente',
    problemHowMuch: '3 tarimas',
    problemHow: 'Detección visual',
    conditionObserved: 'Etiqueta con lote erróneo',
    requirementBreached: 'Especificación de etiquetado',
    closureSummary: null,
    closedAt: null,
    closedBy: null,
    responsibleUserId: 'u1',
    reportedBy: 'u2',
  },
  immediateActions: [
    {
      actionType: 'containment',
      description: 'Retener lote',
      responsibleUserId: 'u1',
      status: 'done',
      result: 'Retenido',
      committedAt: '2026-01-01',
      executedAt: '2026-01-01',
    },
    {
      actionType: 'correction',
      description: 'Reetiquetar',
      responsibleUserId: 'u1',
      status: 'done',
      result: 'OK',
    },
  ],
  rca: {
    method: 'five_whys',
    immediateCause: 'Rollo de etiquetas equivocado',
    contributingCause: 'Sin verificación al cambio',
    rootCause: 'Falta de poka-yoke en el cambio de etiqueta',
    justification: 'Verificado en piso',
    investigatorUserId: 'u3',
  },
  whySteps: [
    { level: 1, question: '¿Por qué?', answer: 'Etiqueta errónea' },
    { level: 2, question: '¿Por qué?', answer: 'Rollo equivocado' },
  ],
  actions: [
    {
      actionType: 'corrective',
      description: 'Instalar verificación',
      responsibleUserId: 'u1',
      status: 'in_progress',
      progress: 50,
      dueDate: '2026-02-01',
      result: '',
    },
    {
      actionType: 'preventive',
      description: 'Actualizar procedimiento',
      responsibleUserId: 'u2',
      status: 'open',
      progress: 0,
      result: '',
    },
  ],
  reviews: [
    {
      criterion: 'Sin recurrencia 30 días',
      method: 'Auditoría',
      conclusion: 'effective',
      observedResult: 'Sin hallazgos',
      executedAt: '2026-03-01',
      plannedAt: '2026-03-01',
    },
  ],
};

describe('renderCapaReportHtml — reporte 8D', () => {
  const html = renderCapaReportHtml(base as never, identity);

  it('incluye las secciones D1..D8', () => {
    for (const d of [
      'D1 — Equipo',
      'D2 — Descripción del problema',
      'D3 — Contención',
      'D4 — Análisis de causa raíz',
      'D5 — Acciones correctivas permanentes',
      'D6 — Implementación y validación',
      'D7 — Prevención de recurrencia',
      'D8 — Cierre',
    ]) {
      expect(html).toContain(d);
    }
  });

  it('D0 aparece cuando hay descripción/correcciones', () => {
    expect(html).toContain('D0 — Respuesta inmediata');
    expect(html).toContain('Reetiquetar');
  });

  it('mapea 5W2H y causa raíz', () => {
    expect(html).toContain('Etiqueta incorrecta'); // qué
    expect(html).toContain('poka-yoke'); // causa raíz
    expect(html).toContain('Análisis de 5 Porqués');
  });

  it('usa etiquetas en español (§K18) y NO el historial técnico (§K17)', () => {
    expect(html).toContain('Alta'); // severidad/prioridad high → Alta
    expect(html).not.toContain('hypothesis_created');
    expect(html).not.toContain('participant_added');
    expect(html).not.toContain('analysis_created');
  });

  it('empty states formales cuando falta información (§K20)', () => {
    const empty = renderCapaReportHtml(
      {
        capa: {
          folio: 'CAPA-2026-0002',
          title: 'Vacío',
          status: 'open',
          severity: 'low',
          priority: 'low',
        },
        immediateActions: [],
        rca: null,
        whySteps: [],
        actions: [],
        reviews: [],
      } as never,
      identity,
    );
    expect(empty).toContain('Sin información registrada.');
  });

  it('produce estructura .doc-render paginable', () => {
    expect(html.startsWith('<article class="doc-render')).toBe(true);
    expect(html).toContain('doc-render__header');
    expect(html).toContain('doc-render__footer');
  });

  it('§16: embebe el análisis de causas 6M en D4 (sin diagrama de pescado)', () => {
    const with6M = renderCapaReportHtml(
      {
        ...(base as Record<string, unknown>),
        ishikawa6MHtml: '<div class="ishi6m"><div class="ishi6m__card">X</div></div>',
      } as never,
      identity,
    );
    expect(with6M).toContain('Análisis de causas — 6M');
    expect(with6M).toContain('doc-report__figure--6m');
    expect(with6M).toContain('ishi6m__card');
    // No hay diagrama de pescado (SVG).
    expect(with6M).not.toContain('espina de pescado');
    // Va dentro de D4, antes del bloque de los 5 porqués.
    expect(with6M.indexOf('doc-report__figure--6m')).toBeLessThan(
      with6M.indexOf('<h3>Análisis de 5 Porqués</h3>'),
    );
  });

  it('§6: sin análisis de causas muestra el estado formal (no un hueco vacío)', () => {
    expect(html).toContain('Sin análisis de causas registrado.');
  });

  it('§2/§7: D4 muestra los ANÁLISIS antes de las conclusiones y sin campo «Método»', () => {
    const i6m = html.indexOf('Análisis de causas — 6M');
    const iWhys = html.indexOf('Análisis de 5 Porqués');
    const iConcl = html.indexOf('Conclusiones del análisis');
    const iRoot = html.indexOf('Causa raíz verificada');
    expect(i6m).toBeGreaterThanOrEqual(0);
    expect(iWhys).toBeGreaterThan(i6m);
    expect(iConcl).toBeGreaterThan(iWhys);
    // 6M y 5 Porqués aparecen antes de la causa raíz (conclusión).
    expect(iRoot).toBeGreaterThan(i6m);
    expect(iRoot).toBeGreaterThan(iWhys);
    // §7: «Método» ya no es un campo redundante.
    expect(html).not.toContain('<dt>Método</dt>');
  });

  it('§8-11: las conclusiones incluyen causa inmediata/contribuyente/raíz + justificación', () => {
    expect(html).toContain('Causa inmediata');
    expect(html).toContain('Causa contribuyente');
    expect(html).toContain('Causa raíz verificada');
    expect(html).toContain('Justificación / evidencia de verificación');
  });

  it('§12: sin causa raíz confirmada → «Causa raíz aún no verificada»', () => {
    const noRoot = renderCapaReportHtml(
      {
        ...(base as Record<string, unknown>),
        rca: { immediateCause: 'x', rootCause: '', justification: '' },
      } as never,
      identity,
    );
    expect(noRoot).toContain('Causa raíz aún no verificada.');
    expect(noRoot).not.toContain('Causa raíz verificada');
  });

  it('§5: lista otras herramientas de análisis solo si existen', () => {
    const withOthers = renderCapaReportHtml(
      {
        ...(base as Record<string, unknown>),
        otherAnalyses: [{ tool: 'Pareto', title: 'Defectos Q1', status: 'Concluido' }],
      } as never,
      identity,
    );
    expect(withOthers).toContain('Otros análisis aplicados');
    expect(withOthers).toContain('Pareto');
    // Sin otras herramientas: no se muestra el bloque.
    expect(html).not.toContain('Otros análisis aplicados');
  });

  it('§E4: conserva el follow-up de causa de ocurrencia/escape', () => {
    expect(html).toContain('CAPA-8D-ROOT-CAUSE-EXPANSION');
  });
});
