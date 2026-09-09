import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_DEFINITIONS,
  getTemplateDefinition,
  isStructuredType,
  codePrefixFor,
  defaultReviewMonthsFor,
} from '@/features/documents/template-registry';
import {
  STRUCTURED_SCHEMA_VERSION,
  emptyStructuredContent,
  sanitizeStructuredContent,
  validateStructuredContent,
  MAX_REPEATABLE_ITEMS,
} from '@/features/documents/structured-content';
import { structuredChecksum } from '@/features/documents/structured-checksum';
import {
  formatDocumentCode,
  normalizeAreaCode,
  isValidCustomCode,
  codeFormatError,
  CODE_MAX_LENGTH,
} from '@/features/documents/code';
import { addMonthsIso, computeNextReviewAt, reviewMonthsOf } from '@/features/documents/dates';
import { renderStructuredHtml } from '@/features/documents/structured-render';
import { documentContentMode } from '@/features/documents/content-mode';

describe('modo de contenido (histórico rich_text vs estructurado)', () => {
  it('el modo NO depende del documentType, sino de la versión vigente', () => {
    // Documento rich_text histórico con documentType estructurado → rich_text.
    expect(documentContentMode({ origin: 'internal', hasStructuredContent: false })).toBe(
      'rich_text',
    );
    // Documento estructurado nuevo → structured.
    expect(documentContentMode({ origin: 'internal', hasStructuredContent: true })).toBe(
      'structured',
    );
    // Externo → external (sin importar structured_content).
    expect(documentContentMode({ origin: 'external', hasStructuredContent: false })).toBe(
      'external',
    );
    expect(documentContentMode({ origin: 'external', hasStructuredContent: true })).toBe(
      'external',
    );
  });
});

describe('registro de plantillas', () => {
  it('define los 10 tipos con prefijos correctos (§5)', () => {
    const expected: Record<string, string> = {
      procedure: 'PR',
      policy: 'PO',
      manual: 'MA',
      instruction: 'IN',
      program: 'PG',
      plan: 'PL',
      form: 'FO',
      specification: 'ES',
      matrix: 'MX',
      other: 'DO',
    };
    expect(TEMPLATE_DEFINITIONS).toHaveLength(10);
    for (const [type, prefix] of Object.entries(expected)) {
      expect(getTemplateDefinition(type)?.codePrefix).toBe(prefix);
      expect(codePrefixFor(type)).toBe(prefix);
    }
  });

  it('distingue tipos estructurados de documento libre', () => {
    expect(isStructuredType('procedure')).toBe(true);
    expect(isStructuredType('program')).toBe(true);
    expect(isStructuredType('other')).toBe(false); // documento libre → editor enriquecido
    expect(getTemplateDefinition('other')?.supportsRichText).toBe(true);
  });

  it('el procedimiento tiene contenido, responsabilidades y actividades (§9)', () => {
    const def = getTemplateDefinition('procedure')!;
    const keys = def.sections.map((s) => s.key);
    expect(keys).toEqual(['content', 'responsibilities', 'activities']);
    const activities = def.sections.find((s) => s.key === 'activities');
    expect(activities?.kind).toBe('repeatable');
    if (activities?.kind === 'repeatable') expect(activities.repeatable.autoNumber).toBe(true);
  });

  it('el periodo de revisión por defecto es configurable, no fijo', () => {
    expect(defaultReviewMonthsFor('procedure')).toBe(12);
    expect(defaultReviewMonthsFor('manual')).toBe(24);
    expect(defaultReviewMonthsFor('other')).toBeNull();
  });

  it('un prefijo desconocido cae a DO', () => {
    expect(codePrefixFor('inexistente')).toBe('DO');
  });
});

describe('código automático (§5/§30)', () => {
  it('formatea [TIPO]-[ÁREA]-[###]', () => {
    expect(formatDocumentCode('PR', 'CA', 1)).toBe('PR-CA-001');
    expect(formatDocumentCode('PG', 'CA', 12)).toBe('PG-CA-012');
    expect(formatDocumentCode('PO', 'DG', 234)).toBe('PO-DG-234');
  });

  it('sin área colapsa a [TIPO]-[###]', () => {
    expect(formatDocumentCode('DO', '', 3)).toBe('DO-003');
    expect(formatDocumentCode('DO', null, 3)).toBe('DO-003');
  });

  it('normaliza el código de área (mayúsculas, alfanumérico, 4 máx)', () => {
    expect(normalizeAreaCode('ca')).toBe('CA');
    expect(normalizeAreaCode('R-H!')).toBe('RH');
    expect(normalizeAreaCode('produccion')).toBe('PROD');
  });

  it('valida forma de códigos personalizados', () => {
    expect(isValidCustomCode('PR-CA-001')).toBe(true);
    expect(isValidCustomCode('DOC/2026.01')).toBe(true);
    expect(isValidCustomCode('')).toBe(false);
    expect(isValidCustomCode('pr con espacios')).toBe(false);
    expect(isValidCustomCode('A'.repeat(CODE_MAX_LENGTH + 1))).toBe(false);
    expect(codeFormatError('')).toMatch(/obligatorio/);
    expect(codeFormatError('PR-CA-001')).toBeNull();
  });
});

describe('fechas de control (§8)', () => {
  it('próxima revisión = emisión + periodo', () => {
    expect(computeNextReviewAt('2026-06-01', 12)).toBe('2027-06-01');
    expect(computeNextReviewAt('2026-01-15', 6)).toBe('2026-07-15');
  });

  it('ajusta el día al fin de mes más corto', () => {
    expect(addMonthsIso('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsIso('2024-01-31', 1)).toBe('2024-02-29'); // bisiesto
  });

  it('sin emisión o sin periodo fijo devuelve null', () => {
    expect(computeNextReviewAt(null, 12)).toBeNull();
    expect(computeNextReviewAt('2026-06-01', null)).toBeNull();
  });

  it('resuelve meses de un valor de periodo', () => {
    expect(reviewMonthsOf('6', 12)).toBe(6);
    expect(reviewMonthsOf('none', 12)).toBeNull();
    expect(reviewMonthsOf('18', 12)).toBe(18);
    expect(reviewMonthsOf('xxx', 12)).toBe(12);
  });
});

describe('contenido estructurado — saneo (§25/§26)', () => {
  it('vacío tiene el schemaVersion obligatorio (§27)', () => {
    const empty = emptyStructuredContent('procedure');
    expect(empty.schemaVersion).toBe(STRUCTURED_SCHEMA_VERSION);
    expect(STRUCTURED_SCHEMA_VERSION).toBe(1);
    expect(empty.fields).toEqual({});
    expect(empty.repeatables).toEqual({});
  });

  it('descarta claves desconocidas y conserva las del esquema', () => {
    const clean = sanitizeStructuredContent('procedure', {
      fields: { objetivo: 'Controlar', hacker: '<script>', alcance: 'Planta' },
      repeatables: { activities: [], desconocido: [{ x: 1 }] },
    });
    expect(clean.fields).toEqual({ objetivo: 'Controlar', alcance: 'Planta' });
    expect(clean.fields).not.toHaveProperty('hacker');
    expect(clean.repeatables).not.toHaveProperty('desconocido');
  });

  it('elimina ítems repetibles vacíos y conserva los completos', () => {
    const clean = sanitizeStructuredContent('procedure', {
      fields: {},
      repeatables: {
        responsibilities: [
          { responsable: 'Calidad', responsabilidad: 'Autorizar' },
          { responsable: '', responsabilidad: '' }, // vacío → se descarta
        ],
      },
    });
    expect(clean.repeatables.responsibilities).toHaveLength(1);
    expect(clean.repeatables.responsibilities?.[0]?.responsable).toBe('Calidad');
  });

  it('acota el número de ítems al máximo', () => {
    const many = Array.from({ length: MAX_REPEATABLE_ITEMS + 20 }, (_, i) => ({
      nombre: `A${i}`,
      descripcion: 'x',
    }));
    const clean = sanitizeStructuredContent('procedure', {
      fields: {},
      repeatables: { activities: many },
    });
    expect(clean.repeatables.activities?.length).toBe(MAX_REPEATABLE_ITEMS);
  });

  it('sanea también programa y especificación', () => {
    const program = sanitizeStructuredContent('program', {
      fields: { objetivo: 'O', alcance: 'A' },
      repeatables: { activities: [{ actividad: 'Auditar', responsable: 'Líder' }] },
    });
    expect(program.repeatables.activities?.[0]?.actividad).toBe('Auditar');

    const spec = sanitizeStructuredContent('specification', {
      fields: { objeto: 'Materia prima' },
      repeatables: { parameters: [{ parametro: 'pH', especificacion: '6-7' }] },
    });
    expect(spec.fields.objeto).toBe('Materia prima');
    expect(spec.repeatables.parameters?.[0]?.parametro).toBe('pH');
  });
});

describe('contenido estructurado — validación de obligatorios (§26)', () => {
  it('reporta faltantes y aprueba cuando está completo', () => {
    const incomplete = validateStructuredContent('procedure', {
      fields: { objetivo: '' },
      repeatables: {},
    });
    expect(incomplete.length).toBeGreaterThan(0);
    expect(incomplete.some((e) => e.includes('Objetivo'))).toBe(true);

    const complete = validateStructuredContent('procedure', {
      fields: { objetivo: 'Controlar el PNC', alcance: 'Planta' },
      repeatables: { activities: [{ nombre: 'Identificar', descripcion: 'Etiquetar' }] },
    });
    expect(complete).toEqual([]);
  });

  it('exige subcampos obligatorios en ítems presentes', () => {
    const errors = validateStructuredContent('procedure', {
      fields: { objetivo: 'O', alcance: 'A' },
      repeatables: { activities: [{ nombre: '', descripcion: 'x' }] },
    });
    expect(errors.some((e) => e.includes('Actividad'))).toBe(true);
  });

  it('el documento libre no valida estructura', () => {
    expect(validateStructuredContent('other', {})).toEqual([]);
  });
});

describe('checksum estructurado', () => {
  it('es determinista y cambia con el contenido', () => {
    const a = sanitizeStructuredContent('policy', {
      fields: { declaracion: 'X' },
      repeatables: {},
    });
    const b = sanitizeStructuredContent('policy', {
      fields: { declaracion: 'X' },
      repeatables: {},
    });
    const c = sanitizeStructuredContent('policy', {
      fields: { declaracion: 'Y' },
      repeatables: {},
    });
    expect(structuredChecksum(a)).toBe(structuredChecksum(b));
    expect(structuredChecksum(a)).not.toBe(structuredChecksum(c));
  });
});

describe('renderer normalizado (§23/§10)', () => {
  const identity = {
    organizationName: 'Org Demo',
    typeLabel: 'Procedimiento',
    code: 'PR-CA-001',
    versionLabel: 'v1.0',
    title: 'Control de PNC',
    areaLabel: 'Calidad',
    issuedAt: '2026-06-01',
    nextReviewAt: '2027-06-01',
  };

  it('incluye la marca C3 Sentinel y la identificación', () => {
    const content = sanitizeStructuredContent('procedure', {
      fields: { objetivo: 'Controlar', alcance: 'Planta' },
      repeatables: {
        activities: [{ nombre: 'Identificar', descripcion: 'Etiquetar el producto' }],
      },
    });
    const html = renderStructuredHtml('procedure', content, identity);
    expect(html).toContain('C3 Sentinel');
    expect(html).toContain('PR-CA-001');
    expect(html).toContain('Control de PNC');
    expect(html).toContain('Identificar');
  });

  it('numera las actividades y muestra secciones futuras del procedimiento (§10)', () => {
    const content = sanitizeStructuredContent('procedure', {
      fields: { objetivo: 'O', alcance: 'A' },
      repeatables: {
        activities: [
          { nombre: 'Uno', descripcion: 'a' },
          { nombre: 'Dos', descripcion: 'b' },
        ],
      },
    });
    const html = renderStructuredHtml('procedure', content, identity);
    expect(html).toContain('Diagrama de flujo');
    expect(html).toContain('No generado todavía.');
    expect(html).toContain('Documentos referenciados');
  });

  it('escapa el HTML del contenido (sin inyección)', () => {
    const content = sanitizeStructuredContent('policy', {
      fields: { declaracion: '<img src=x onerror=alert(1)>' },
      repeatables: {},
    });
    const html = renderStructuredHtml('policy', content, {
      ...identity,
      typeLabel: 'Política',
    });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('muestra un estado vacío para repetibles sin ítems', () => {
    const content = emptyStructuredContent('procedure');
    const html = renderStructuredHtml('procedure', content, identity);
    expect(html).toMatch(/Sin\s+.*registradas|Sin\s+actividades/i);
  });
});
