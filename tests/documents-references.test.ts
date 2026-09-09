import { describe, expect, it } from 'vitest';
import {
  sanitizeRichValue,
  richPlainText,
  richHasContent,
  richReferences,
  type RichValue,
} from '@/features/documents/references';
import { detectMentionQuery, detectFormCommand } from '@/features/documents/reference-commands';
import {
  sanitizeStructuredContent,
  extractReferences,
  validateStructuredContent,
} from '@/features/documents/structured-content';
import { renderStructuredHtml } from '@/features/documents/structured-render';

const DOC_A = '00000000-0000-4000-8000-00000000aaa1';
const DOC_B = '00000000-0000-4000-8000-00000000bbb2';

const ref = (target: string, relationType: 'reference' | 'issued_form' = 'reference') => ({
  type: 'ref' as const,
  relationType,
  targetDocumentId: target,
});

describe('detección de comandos @ y // (§34)', () => {
  it('@ dispara tras inicio o separador, no en un correo', () => {
    expect(detectMentionQuery('Ver @')).toBe('');
    expect(detectMentionQuery('Ver @PR')).toBe('PR');
    expect(detectMentionQuery('(@PO-DG')).toBe('PO-DG');
    expect(detectMentionQuery('correo usuario@dominio')).toBeNull();
    expect(detectMentionQuery('sin arroba')).toBeNull();
  });

  it('// dispara fuera de una URL', () => {
    expect(detectFormCommand('Completar //')).toBe(true);
    expect(detectFormCommand('//')).toBe(true);
    expect(detectFormCommand('https://')).toBe(false);
    expect(detectFormCommand('texto /')).toBe(false);
  });
});

describe('saneo de valores rich (§27/§28)', () => {
  it('un string permanece string', () => {
    expect(sanitizeRichValue('hola', 100)).toBe('hola');
  });

  it('colapsa a string si no quedan referencias', () => {
    const v = sanitizeRichValue({ segments: [{ type: 'text', text: 'solo texto' }] }, 100);
    expect(v).toBe('solo texto');
  });

  it('conserva referencias válidas y descarta inválidas', () => {
    const v = sanitizeRichValue(
      {
        segments: [
          { type: 'text', text: 'Ver ' },
          ref(DOC_A),
          { type: 'ref', relationType: 'reference', targetDocumentId: 'no-uuid' },
          { type: 'ref', relationType: 'otro', targetDocumentId: DOC_B },
        ],
      },
      1000,
    ) as { segments: unknown[] };
    const refs = richReferences(v as RichValue);
    expect(refs).toHaveLength(1);
    expect(refs[0]?.targetDocumentId).toBe(DOC_A);
  });

  it('richPlainText y richHasContent', () => {
    const v: RichValue = { segments: [{ type: 'text', text: 'A' }, ref(DOC_A, 'issued_form')] };
    expect(richPlainText(v)).toBe('A');
    expect(richHasContent(v)).toBe(true);
    expect(richHasContent('')).toBe(false);
    expect(richHasContent({ segments: [ref(DOC_A)] })).toBe(true); // solo una referencia
  });
});

describe('contenido estructurado con referencias', () => {
  it('los textarea admiten referencias; los text las aplanan', () => {
    const clean = sanitizeStructuredContent('procedure', {
      fields: {
        objetivo: { segments: [{ type: 'text', text: 'Cumplir ' }, ref(DOC_A)] }, // textarea
      },
      repeatables: {
        activities: [
          {
            nombre: { segments: [{ type: 'text', text: 'Paso' }, ref(DOC_B)] }, // text → aplanado
            descripcion: { segments: [{ type: 'text', text: 'Hace ' }, ref(DOC_B)] }, // textarea
          },
        ],
      },
    });
    expect(typeof clean.fields.objetivo).toBe('object'); // conserva referencia
    expect(typeof clean.repeatables.activities?.[0]?.nombre).toBe('string'); // aplanado
    expect(typeof clean.repeatables.activities?.[0]?.descripcion).toBe('object');
  });

  it('extractReferences deduplica en campos y repetibles', () => {
    const clean = sanitizeStructuredContent('procedure', {
      fields: {
        objetivo: { segments: [ref(DOC_A)] },
        alcance: { segments: [ref(DOC_A), ref(DOC_B, 'issued_form')] },
      },
      repeatables: {
        activities: [{ nombre: 'x', descripcion: { segments: [ref(DOC_A)] } }],
      },
    });
    const refs = extractReferences(clean);
    expect(refs).toHaveLength(2);
    expect(refs.map((r) => r.targetDocumentId).sort()).toEqual([DOC_A, DOC_B].sort());
  });

  it('quitar el token elimina la referencia (§23/§26)', () => {
    const withRef = sanitizeStructuredContent('procedure', {
      fields: { objetivo: { segments: [{ type: 'text', text: 'x ' }, ref(DOC_A)] } },
      repeatables: {},
    });
    expect(extractReferences(withRef)).toHaveLength(1);
    const withoutRef = sanitizeStructuredContent('procedure', {
      fields: { objetivo: 'x' },
      repeatables: {},
    });
    expect(extractReferences(withoutRef)).toHaveLength(0);
  });

  it('un campo obligatorio con solo una referencia cuenta como lleno', () => {
    const errors = validateStructuredContent('procedure', {
      fields: {
        objetivo: { segments: [ref(DOC_A)] },
        alcance: 'Planta',
      },
      repeatables: { activities: [{ nombre: 'A', descripcion: 'd' }] },
    });
    expect(errors.filter((e) => e.includes('Objetivo'))).toHaveLength(0);
  });
});

describe('renderer con referencias (§11/§12/§49)', () => {
  const identity = {
    typeLabel: 'Procedimiento',
    code: 'PR-CA-001',
    versionLabel: 'v1.0',
    title: 'Proc',
  };
  const resolved = {
    [DOC_A]: {
      documentId: DOC_A,
      code: 'PO-DG-001',
      title: 'Política de calidad',
      typeLabel: 'Política',
      versionLabel: 'v1.0',
      statusLabel: 'Vigente',
      available: true,
    },
    [DOC_B]: {
      documentId: DOC_B,
      code: 'FO-CA-001',
      title: 'Bitácora',
      typeLabel: 'Formato',
      versionLabel: 'v1.0',
      statusLabel: 'Borrador',
      available: true,
    },
  };

  it('renderiza chips como enlaces y puebla las secciones', () => {
    const content = sanitizeStructuredContent('procedure', {
      fields: {
        objetivo: { segments: [{ type: 'text', text: 'Cumplir ' }, ref(DOC_A)] },
        alcance: 'Planta',
      },
      repeatables: {
        activities: [
          { nombre: 'Registrar', descripcion: { segments: [ref(DOC_B, 'issued_form')] } },
        ],
      },
    });
    const html = renderStructuredHtml('procedure', content, identity, resolved);
    expect(html).toContain(`href="/dashboard/documents/${DOC_A}"`);
    expect(html).toContain('PO-DG-001');
    expect(html).toContain('Documentos referenciados');
    expect(html).toContain('Formatos y registros relacionados');
    expect(html).toContain('FO-CA-001');
  });

  it('una referencia no resuelta se muestra como no disponible (§13)', () => {
    const content = sanitizeStructuredContent('procedure', {
      fields: { objetivo: { segments: [ref(DOC_A)] }, alcance: 'x' },
      repeatables: {},
    });
    const html = renderStructuredHtml('procedure', content, identity, {}); // sin resolver
    expect(html).toContain('Referencia no disponible');
    expect(html).not.toContain(`href="/dashboard/documents/${DOC_A}"`);
  });

  it('escapa el snapshot del código de una referencia', () => {
    const content = sanitizeStructuredContent('policy', {
      fields: {
        declaracion: {
          segments: [
            { type: 'text', text: 'x' },
            { type: 'ref', relationType: 'reference', targetDocumentId: DOC_A, code: '<script>' },
          ],
        },
      },
      repeatables: {},
    });
    const html = renderStructuredHtml(
      'policy',
      content,
      { ...identity, typeLabel: 'Política' },
      {},
    );
    expect(html).not.toContain('<script>');
  });
});
