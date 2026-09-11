/**
 * DOC-UX-PANEL-001 — asserts de fuente sobre el Panel del documento por tabs
 * (patrón *-ui: leer el archivo y verificar substrings), como tests/dashboard-ui.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const panel = read(
  '../src/app/dashboard/documents/[documentId]/panel/_components/DocumentPanel.tsx',
);
const page = read('../src/app/dashboard/documents/[documentId]/panel/page.tsx');

describe('DocumentPanel — tabs accesibles (D + A11y)', () => {
  it('tiene tablist/tab/tabpanel con ARIA', () => {
    expect(panel).toContain('role="tablist"');
    expect(panel).toContain('role="tab"');
    expect(panel).toContain('role="tabpanel"');
    expect(panel).toContain('aria-selected');
    expect(panel).toContain('aria-controls');
    expect(panel).toContain('aria-labelledby');
  });
  it('navegación por teclado (flechas/Home/End) y roving tabindex', () => {
    expect(panel).toContain('ArrowRight');
    expect(panel).toContain('ArrowLeft');
    expect(panel).toContain('Home');
    expect(panel).toContain('End');
    expect(panel).toContain('tabIndex={selected ? 0 : -1}');
  });
  it('persiste el tab en ?tab= sin recargar (history.replaceState)', () => {
    expect(panel).toContain('history.replaceState');
    expect(panel).toContain("searchParams.set('tab'");
  });
  it('renderiza los 8 tabs del panel', () => {
    for (const label of [
      'Resumen',
      'Flujo',
      'Versiones',
      'Distribución',
      'Copias',
      'Relaciones',
      'Archivos',
      'Historial',
    ]) {
      expect(panel).toContain(label);
    }
  });
});

describe('DocumentPanel — contenido de tabs', () => {
  it('A. Resumen distingue vigente vs borrador en curso', () => {
    expect(panel).toContain('Versión vigente');
    expect(panel).toContain('Borrador en curso');
    expect(panel).toContain('en preparación');
  });
  it('E. empty states compactos', () => {
    expect(panel).toContain('empty-state--compact');
    expect(panel).toContain('Sin revisores ni aprobadores asignados.');
    expect(panel).toContain('Sin distribuciones registradas.');
    expect(panel).toContain('Sin copias registradas.');
    expect(panel).toContain('Sin archivos adjuntos.');
  });
  it('F. relaciones clickeables (código + nombre → documento)', () => {
    expect(panel).toContain('/dashboard/documents/${documentId}');
    expect(panel).toContain('Emitido desde');
    expect(panel).toContain('Documentos referenciados');
    expect(panel).toContain('Formatos y registros relacionados');
  });
  it('L. versiones clickeables a preview?version= y editar draft', () => {
    expect(panel).toContain('preview?version=');
    expect(panel).toContain('editor?version=');
    expect(panel).toContain('Realizado por');
  });
  it('H. copias: registro + salidas + recuperación', () => {
    expect(panel).toContain('recoverCopyForm');
    expect(panel).toContain('Copias controladas (registro)');
    expect(panel).toContain('Copias generadas (salidas)');
  });
  it('I. distribución distinta de copia controlada', () => {
    expect(panel).toContain('distribución');
    expect(panel).toContain('copia controlada');
  });
  it('G. archivos con descarga', () => {
    expect(panel).toContain('/files/');
    expect(panel).toContain('Descargar');
  });
});

describe('Panel page — server, tenant-scoped y breadcrumb', () => {
  it('J. todas las consultas usan session.organizationId (tenant isolation)', () => {
    expect(page).toContain('getDocumentDetail(session.organizationId');
    expect(page).toContain('getDocumentControl(session.organizationId');
    expect(page).toContain('getEditorContent(session.organizationId');
    expect(page).not.toContain('getDocumentDetail(documentId');
  });
  it('categoriza versiones y separa vigente/borrador', () => {
    expect(page).toContain('categorizeVersions');
    expect(page).toContain('groups.vigente');
    expect(page).toContain('groups.enCurso');
  });
  it('breadcrumb Documentos › código › Panel (§19)', () => {
    expect(page).toContain('Ruta de navegación');
    expect(page).toContain('>Documentos<');
    expect(page).toContain('aria-current="page"');
  });
  it('el panel es un componente cliente montado por la página server', () => {
    expect(page).toContain('<DocumentPanel data={data} initialTab={initialTab} />');
    expect(panel.startsWith("'use client'")).toBe(true);
  });
  it('tab inicial resuelto server-side (hidratación sin desajuste)', () => {
    expect(page).toContain('resolveTab((await searchParams).tab)');
    expect(panel).toContain('useState<PanelTab>(initialTab)');
  });
});
