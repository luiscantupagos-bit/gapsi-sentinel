/**
 * CAPA-8D §D — la página del reporte embebe el Ishikawa REUTILIZANDO el mismo
 * componente SVG del análisis (renderToStaticMarkup), sin implementar un segundo
 * Ishikawa. Aserción de fuente.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(
  resolve(here, '../src/app/dashboard/capa/[capaId]/report/page.tsx'),
  'utf8',
);

describe('CAPA report page — análisis de causas 6M embebido (§16)', () => {
  it('reutiliza el ÚNICO constructor de markup 6M (sin segundo modelo)', () => {
    expect(page).toContain('buildIshikawa6MHtml');
    expect(page).toContain("from '@/features/capa/ishikawa-6m'");
  });
  it('construye el 6M y lo pasa al reporte (sin react-dom/server, sin pescado)', () => {
    expect(page).not.toContain('react-dom/server');
    expect(page).not.toContain('buildIshikawaSvg');
    expect(page).toContain('ishikawa6MHtml');
  });
  it('toma el análisis Ishikawa vinculado a la CAPA y lista otros análisis (§5)', () => {
    expect(page).toContain('listAnalyses');
    expect(page).toContain("a.type === 'ishikawa'");
    expect(page).toContain('getAnalysisDetail');
    expect(page).toContain('otherAnalyses');
  });
  it('sigue paginando con el motor de hojas físicas', () => {
    expect(page).toContain('PaginatedDocument');
  });
});
