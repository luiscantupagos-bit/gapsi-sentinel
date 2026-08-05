import { describe, expect, it } from 'vitest';
import {
  isDueSoon,
  isOverdue,
  validateDocumentMetadata,
  validateUpload,
  type DocumentMetadataInput,
} from '@/features/documents/catalog';

function base(overrides: Partial<DocumentMetadataInput> = {}): DocumentMetadataInput {
  return {
    code: 'DOC-1',
    title: 'Título',
    documentType: 'procedure',
    versionLabel: 'v1',
    origin: 'internal',
    status: 'draft',
    confidentiality: 'internal',
    ...overrides,
  };
}

describe('validateDocumentMetadata', () => {
  it('acepta metadatos válidos', () => {
    expect(validateDocumentMetadata(base())).toEqual([]);
  });

  it('exige código, título, tipo y versión', () => {
    const errors = validateDocumentMetadata(
      base({ code: '', title: '', documentType: '', versionLabel: '' }),
    );
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });

  it('rechaza un tipo documental inválido', () => {
    expect(validateDocumentMetadata(base({ documentType: 'inexistente' }))).toContain(
      'El tipo documental es obligatorio y debe ser válido.',
    );
  });

  it('rechaza próxima revisión anterior a la emisión', () => {
    const errors = validateDocumentMetadata(
      base({ issuedAt: '2026-03-01', nextReviewAt: '2026-01-01' }),
    );
    expect(errors.some((e) => e.includes('próxima revisión'))).toBe(true);
  });
});

describe('validateUpload', () => {
  it('acepta un PDF dentro del límite', () => {
    expect(validateUpload({ filename: 'a.pdf', mimeType: 'application/pdf', size: 1000 }).ok).toBe(
      true,
    );
  });

  it('rechaza una extensión no permitida', () => {
    const r = validateUpload({ filename: 'a.exe', mimeType: 'application/x-msdownload', size: 10 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no permitida/i);
  });

  it('rechaza un MIME que no coincide con la extensión', () => {
    const r = validateUpload({ filename: 'a.pdf', mimeType: 'image/png', size: 10 });
    expect(r.ok).toBe(false);
  });

  it('rechaza archivos que superan el tamaño máximo', () => {
    const r = validateUpload({ filename: 'a.pdf', mimeType: 'application/pdf', size: 5000 }, 1000);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/tamaño máximo/i);
  });
});

describe('vencimiento', () => {
  it('detecta próximo a revisión dentro de 30 días', () => {
    expect(isDueSoon('2026-08-20', '2026-08-04')).toBe(true);
    expect(isDueSoon('2026-12-01', '2026-08-04')).toBe(false);
    expect(isDueSoon(null, '2026-08-04')).toBe(false);
  });

  it('detecta vencido', () => {
    expect(isOverdue('2026-07-01', '2026-08-04')).toBe(true);
    expect(isOverdue('2026-09-01', '2026-08-04')).toBe(false);
  });
});
