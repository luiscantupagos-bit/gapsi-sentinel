import { describe, expect, it } from 'vitest';
import {
  isHexColor,
  sanitizeDocumentTheme,
  validateDocumentTheme,
  DEFAULT_DOCUMENT_THEME,
} from '@/features/documents/document-theme';
import { getTemplateDefinition } from '@/features/documents/template-registry';
import { sanitizeStructuredContent } from '@/features/documents/structured-content';
import { renderStructuredHtml } from '@/features/documents/structured-render';

const identity = {
  organizationName: 'Alimentos Demo',
  typeLabel: 'Procedimiento',
  code: 'PR-CA-001',
  versionLabel: 'v1.0',
  title: 'Control de PNC',
  areaLabel: 'Calidad',
};

describe('tema documental (§18-22)', () => {
  it('valida HEX', () => {
    expect(isHexColor('#005BAA')).toBe(true);
    expect(isHexColor('#abc')).toBe(true);
    expect(isHexColor('rojo')).toBe(false);
    expect(isHexColor('#12345')).toBe(false);
    expect(isHexColor('javascript:alert(1)')).toBe(false);
  });

  it('sanea a HEX en minúsculas y usa fallback ante inválidos', () => {
    const t = sanitizeDocumentTheme({ primary: '#00FF00', secondary: 'nope', accent: '#F00' });
    expect(t.primary).toBe('#00ff00');
    expect(t.secondary).toBe(DEFAULT_DOCUMENT_THEME.secondary);
    expect(t.accent).toBe('#f00');
  });

  it('validateDocumentTheme reporta colores inválidos', () => {
    expect(
      validateDocumentTheme({ primary: '#005BAA', secondary: '#E5E7EB', accent: '#F59E0B' }),
    ).toEqual([]);
    expect(validateDocumentTheme({ primary: 'x', secondary: 'y', accent: 'z' })).toHaveLength(3);
  });

  it('el renderer aplica solo HEX validado como variables CSS (sin inyección)', () => {
    const content = sanitizeStructuredContent('policy', {
      fields: { declaracion: 'X' },
      repeatables: {},
    });
    const html = renderStructuredHtml(
      'policy',
      content,
      { ...identity, typeLabel: 'Política' },
      {
        theme: { primary: '#005baa', secondary: '#e5e7eb', accent: '#f59e0b' },
      },
    );
    expect(html).toContain('--doc-primary:#005baa');
    // Un tema con CSS malicioso no se inyecta (safeHex → fallback).
    const evil = renderStructuredHtml(
      'policy',
      content,
      { ...identity, typeLabel: 'Política' },
      {
        theme: { primary: 'red;} body{display:none', secondary: '#fff', accent: '#000' },
      },
    );
    expect(evil).not.toContain('display:none');
    expect(evil).toContain('--doc-primary:#0f2440'); // fallback
  });
});

describe('procedimiento simplificado (§6)', () => {
  it('las actividades ya no incluyen Evidencia ni Observaciones', () => {
    const def = getTemplateDefinition('procedure')!;
    const activities = def.sections.find((s) => s.key === 'activities');
    const keys =
      activities?.kind === 'repeatable' ? activities.repeatable.fields.map((f) => f.key) : [];
    expect(keys).toEqual(['nombre', 'descripcion', 'responsable']);
    expect(keys).not.toContain('evidencia');
    expect(keys).not.toContain('observaciones');
  });

  it('el renderer no produce columnas Evidencia/Observaciones', () => {
    const content = sanitizeStructuredContent('procedure', {
      fields: { objetivo: 'O', alcance: 'A' },
      repeatables: { activities: [{ nombre: 'Uno', descripcion: 'd', responsable: 'Ana' }] },
    });
    const html = renderStructuredHtml('procedure', content, identity, {
      mode: 'published_document',
    });
    expect(html).not.toContain('Evidencia');
    expect(html).not.toContain('Observaciones');
    expect(html).toContain('Responsable');
  });
});

describe('presentación: header/footer/control de cambios (§11/§16/§41/§54)', () => {
  const content = sanitizeStructuredContent('procedure', {
    fields: { objetivo: 'O', alcance: 'A' },
    repeatables: { activities: [{ nombre: 'Uno', descripcion: 'd' }] },
  });

  it('el header muestra la organización (no C3 Sentinel como marca principal)', () => {
    const html = renderStructuredHtml('procedure', content, identity, {});
    expect(html).toContain('doc-render__org-brand');
    expect(html).toContain('Alimentos Demo');
    // C3 Sentinel solo en el pie de atribución.
    const footerIdx = html.indexOf('doc-render__footer');
    expect(html.indexOf('C3 Sentinel')).toBeGreaterThan(footerIdx);
  });

  it('el footer incluye la leyenda de confidencialidad con la organización escapada', () => {
    const html = renderStructuredHtml(
      'procedure',
      content,
      { ...identity, organizationName: '<b>Org</b>' },
      {},
    );
    expect(html).toContain('DOCUMENTO CONTROLADO Y CONFIDENCIAL');
    expect(html).toContain('www.c3digital.com.mx');
    expect(html).toContain('&lt;b&gt;Org&lt;/b&gt;'); // escapado
    expect(html).not.toContain('<b>Org</b>');
  });

  it('control de cambios: versión inicial muestra "Documento nuevo"', () => {
    const html = renderStructuredHtml('procedure', content, identity, {
      changeLog: [
        { version: '1.0', date: '2026-06-01', change: 'Documento nuevo', author: 'Ana' },
        { version: '1.1', date: '2026-11-15', change: 'Se ajusta responsabilidad', author: 'Juan' },
      ],
    });
    expect(html).toContain('Control de cambios');
    expect(html).toContain('Documento nuevo');
    expect(html).toContain('Se ajusta responsabilidad');
  });
});
