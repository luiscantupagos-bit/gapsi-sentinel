/**
 * DOC-OUTPUT-FOLLOWUP — asserts de fuente del motor de páginas y la salida de copia.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const paginator = read(
  '../src/app/dashboard/documents/[documentId]/_components/PaginatedDocument.tsx',
);
const copyPage = read('../src/app/dashboard/documents/[documentId]/copy/page.tsx');
const css = read('../src/app/globals.css');

describe('PaginatedDocument — motor de páginas', () => {
  it('clona header y footer por hoja y numera «Página X de Y»', () => {
    expect(paginator).toContain('doc-render__header');
    expect(paginator).toContain('doc-render__footer');
    expect(paginator).toContain('doc-render__pageno');
    expect(paginator).toContain('Página ${idx + 1} de ${total}');
  });
  it('repite la marca de agua por hoja', () => {
    expect(paginator).toContain('doc-copy__watermark');
    expect(paginator).toContain('watermark.cloneNode(true)');
  });
  it('parte tablas largas por filas repitiendo el encabezado', () => {
    expect(paginator).toContain('thead');
    expect(paginator).toContain('(continuación)');
    expect(paginator).toContain('buildContinuation');
  });
  it('soporta Carta y A4 y repagina antes de imprimir', () => {
    expect(paginator).toContain('doc-page--');
    expect(paginator).toContain("size:${pageSize === 'a4' ? 'A4' : 'letter'}");
    expect(paginator).toContain('beforeprint');
  });
});

describe('salida de copia y CSS de hojas', () => {
  it('la ruta /copy usa el motor de páginas', () => {
    expect(copyPage).toContain('PaginatedDocument');
    expect(copyPage).toContain('pageSize="letter"');
  });
  it('CSS: hojas físicas tamaño Carta/A4, fondo neutro y salto de página en impresión', () => {
    expect(css).toContain('.doc-page--letter');
    expect(css).toContain('8.5in');
    expect(css).toContain('.doc-page--a4');
    expect(css).toContain('break-after: page');
    expect(css).toContain('.doc-render__pageno');
  });
});
