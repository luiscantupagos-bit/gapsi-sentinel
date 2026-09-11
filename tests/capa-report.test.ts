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
      'D4 — Causa raíz',
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
    expect(html).toContain('5 porqués');
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
});
