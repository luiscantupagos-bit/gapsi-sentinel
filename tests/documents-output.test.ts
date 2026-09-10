import { describe, expect, it } from 'vitest';
import {
  computeEntitlements,
  resolveShowC3Attribution,
  type SubscriptionPlan,
} from '@/features/documents/entitlements';
import {
  DOCUMENT_DESIGNS,
  DEFAULT_DESIGN_ID,
  isValidDesignId,
  sanitizeDesignId,
  getDocumentDesign,
} from '@/features/documents/document-design';
import { sanitizeStructuredContent } from '@/features/documents/structured-content';
import { renderStructuredHtml, type CopyMark } from '@/features/documents/structured-render';

const identity = {
  organizationName: 'Alimentos Demo',
  typeLabel: 'Procedimiento',
  code: 'PR-CA-001',
  versionLabel: 'v1.0',
  title: 'Control de PNC',
  areaLabel: 'Calidad',
};

const proc = sanitizeStructuredContent('procedure', {
  fields: { objetivo: 'O', alcance: 'A' },
  repeatables: { activities: [{ nombre: 'Uno', descripcion: 'd', responsable: 'Ana' }] },
});

describe('entitlements comerciales (§85)', () => {
  const cases: Array<[SubscriptionPlan, 'monthly' | 'annual', boolean]> = [
    ['entrepreneur', 'monthly', false],
    ['basic', 'monthly', false],
    ['intermediate', 'monthly', true], // plan superior
    ['industrial', 'monthly', true], // plan superior
    ['entrepreneur', 'annual', true], // modalidad anual
    ['basic', 'annual', true],
    ['intermediate', 'annual', true],
    ['industrial', 'annual', true],
  ];
  it.each(cases)('plan %s / %s → canHide=%s', (plan, cadence, expected) => {
    expect(computeEntitlements({ plan, cadence }).canHideC3Attribution).toBe(expected);
  });

  it('sin suscripción → sin capacidad (§87)', () => {
    expect(computeEntitlements(null).canHideC3Attribution).toBe(false);
  });

  it('resolveShowC3Attribution: sin entitlement, siempre visible (guard §84/§110)', () => {
    // Aunque el cliente prefiera ocultarla (false), sin entitlement se fuerza true.
    expect(resolveShowC3Attribution(false, { canHideC3Attribution: false })).toBe(true);
    // Con entitlement, la preferencia manda.
    expect(resolveShowC3Attribution(false, { canHideC3Attribution: true })).toBe(false);
    expect(resolveShowC3Attribution(true, { canHideC3Attribution: true })).toBe(true);
  });
});

describe('registry de diseños (§92/§98)', () => {
  it('define 4 diseños distintos', () => {
    expect(DOCUMENT_DESIGNS).toHaveLength(4);
    expect(DOCUMENT_DESIGNS.map((d) => d.id)).toEqual([
      'c3-modern',
      'corporate',
      'technical',
      'minimal',
    ]);
  });

  it('valida ids y hace fallback seguro ante desconocidos', () => {
    expect(isValidDesignId('corporate')).toBe(true);
    expect(isValidDesignId('nope')).toBe(false);
    expect(sanitizeDesignId('technical')).toBe('technical');
    expect(sanitizeDesignId('inventado')).toBe(DEFAULT_DESIGN_ID);
    expect(getDocumentDesign('zzz').id).toBe(DEFAULT_DESIGN_ID);
  });
});

describe('composición tema + diseño (§95)', () => {
  it('aplica la clase de diseño y las variables de tema (5 colores)', () => {
    const html = renderStructuredHtml('procedure', proc, identity, {
      design: 'corporate',
      theme: {
        primary: '#005baa',
        secondary: '#e5e7eb',
        accent: '#f59e0b',
        text: '#111827',
        heading: '#0f2440',
      },
      mode: 'published_document',
    });
    expect(html).toContain('doc-render--design-corporate');
    expect(html).toContain('--doc-primary:#005baa');
    expect(html).toContain('--doc-text:#111827');
    expect(html).toContain('--doc-heading:#0f2440');
  });

  it('diseño desconocido → clase del diseño por defecto', () => {
    const html = renderStructuredHtml('procedure', proc, identity, { design: 'inventado' });
    expect(html).toContain(`doc-render--design-${DEFAULT_DESIGN_ID}`);
  });
});

describe('atribución C3 en el render (§90)', () => {
  it('showC3Attribution=false oculta la atribución pero NO la confidencialidad', () => {
    const html = renderStructuredHtml('procedure', proc, identity, { showC3Attribution: false });
    expect(html).not.toContain('c3digital.com.mx');
    expect(html).not.toContain('doc-render__attribution');
    expect(html).toContain('DOCUMENTO CONTROLADO Y CONFIDENCIAL');
  });

  it('por defecto la atribución se muestra', () => {
    const html = renderStructuredHtml('procedure', proc, identity, {});
    expect(html).toContain('c3digital.com.mx');
  });
});

describe('copia controlada: watermark + folio (§72/§77)', () => {
  it('modo controlled_copy con folio muestra COPIA CONTROLADA, folio y destino', () => {
    const copyMark: CopyMark = {
      kind: 'controlled',
      folio: 'CC-PR-CA-001-0001',
      destinationLabel: 'Producción',
      issuedByName: 'Ana',
      issuedAt: '2026-09-10',
    };
    const html = renderStructuredHtml('procedure', proc, identity, {
      mode: 'controlled_copy',
      copyMark,
    });
    expect(html).toContain('doc-render--controlled-copy');
    expect(html).toContain('doc-copy__watermark');
    expect(html).toContain('COPIA CONTROLADA');
    expect(html).toContain('CC-PR-CA-001-0001');
    expect(html).toContain('Producción');
  });

  it('borrador → BORRADOR · NO CONTROLADO, sin folio (§81)', () => {
    const html = renderStructuredHtml('procedure', proc, identity, {
      mode: 'controlled_copy',
      copyMark: { kind: 'draft' },
    });
    expect(html).toContain('BORRADOR · NO CONTROLADO');
    expect(html).not.toContain('CC-');
    expect(html).toContain('doc-copy__banner--draft');
  });

  it('obsoleto → DOCUMENTO OBSOLETO, copia no controlada (§82)', () => {
    const html = renderStructuredHtml('procedure', proc, identity, {
      mode: 'controlled_copy',
      copyMark: { kind: 'obsolete' },
    });
    expect(html).toContain('DOCUMENTO OBSOLETO');
    expect(html).toContain('doc-copy__banner--obsolete');
  });

  it('la marca de copia se escapa (sin inyección)', () => {
    const html = renderStructuredHtml('procedure', proc, identity, {
      mode: 'controlled_copy',
      copyMark: { kind: 'controlled', folio: '<b>x</b>', reason: '<script>1</script>' },
    });
    expect(html).not.toContain('<b>x</b>');
    expect(html).not.toContain('<script>1</script>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
