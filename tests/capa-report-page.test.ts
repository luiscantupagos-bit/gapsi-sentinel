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

describe('CAPA report page — Ishikawa embebido (§D)', () => {
  it('reutiliza el ÚNICO constructor de SVG del Ishikawa (sin segundo diagrama)', () => {
    expect(page).toContain('buildIshikawaSvg');
    expect(page).toContain("from '@/features/capa/ishikawa-svg'");
  });
  it('construye el SVG y lo pasa al reporte (sin react-dom/server)', () => {
    expect(page).not.toContain('react-dom/server');
    expect(page).toContain('ishikawaSvg');
  });
  it('toma el análisis Ishikawa vinculado a la CAPA', () => {
    expect(page).toContain('listAnalyses');
    expect(page).toContain("type: 'ishikawa'");
    expect(page).toContain('getAnalysisDetail');
  });
  it('sigue paginando con el motor de hojas físicas', () => {
    expect(page).toContain('PaginatedDocument');
  });
});
