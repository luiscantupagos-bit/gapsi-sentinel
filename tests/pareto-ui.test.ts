/**
 * Pruebas estructurales de la pantalla de detalle del Pareto (reorganización UX).
 *
 * No renderizan el navegador: siguen el patrón de `layout.test.ts` y verifican
 * sobre el código fuente y `globals.css` los contratos de orden, interacción y
 * accesibilidad. La verificación visual (hover/tooltip/resaltado, responsive) se
 * documenta en las notas de implementación de la TASK-008.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const page = read('../src/app/dashboard/capa/[capaId]/analysis/[analysisId]/page.tsx');
const chart = read(
  '../src/app/dashboard/capa/[capaId]/analysis/_components/InteractiveParetoChart.tsx',
);
const results = read('../src/app/dashboard/capa/[capaId]/analysis/_components/ParetoResults.tsx');
const css = read('../src/app/globals.css');

/** Índice de la primera aparición; falla la prueba si el marcador no existe. */
function at(hay: string, needle: string): number {
  const i = hay.indexOf(needle);
  expect(i, `No se encontró el marcador: ${needle}`).toBeGreaterThanOrEqual(0);
  return i;
}

describe('Pareto — orden funcional de la pantalla', () => {
  it('la rama del layout aplica solo al tipo pareto (no cambia otros análisis)', () => {
    expect(page).toMatch(/if \(type === 'pareto' && detail\.pareto\)/);
  });

  it('el flujo es: captura → resultado (gráfico+tabla) → interpretación → conclusión', () => {
    // Anclamos al cuerpo de la rama Pareto (los imports mencionan los mismos nombres).
    const branch = page.slice(at(page, "if (type === 'pareto' && detail.pareto)"));
    const capture = at(branch, 'Captura de datos');
    const results_ = at(branch, '<ParetoResults');
    const insights = at(branch, '<ParetoInsights');
    const conclusion = at(branch, '<ConclusionForm');
    expect(capture).toBeLessThan(results_);
    expect(results_).toBeLessThan(insights);
    expect(insights).toBeLessThan(conclusion);
  });

  it('el gráfico/tabla aparece antes que la conclusión y que las acciones CAPA', () => {
    const branch = page.slice(at(page, "if (type === 'pareto' && detail.pareto)"));
    expect(at(branch, '<ParetoResults')).toBeLessThan(at(branch, '<CapaActionForm'));
    expect(at(branch, '<ParetoResults')).toBeLessThan(at(branch, 'Convertir en acción CAPA'));
  });

  it('el folio de la CAPA es un enlace explícito (regla de clickeables)', () => {
    expect(page).toMatch(/href=\{`\/dashboard\/capa\/\$\{capaId\}`\}>\{capaDetail\.capa\.folio\}/);
  });

  it('no reemplaza datos dinámicos por estáticos: usa las filas calculadas', () => {
    expect(page).toMatch(/detail\.pareto\.rows\.map/);
    expect(page).toMatch(/paretoInsights\(detail\.pareto\)/);
  });
});

describe('Pareto — gráfico interactivo', () => {
  it('resalta la barra activa y atenúa el resto (no depende solo del color)', () => {
    expect(chart).toMatch(/const active = hovered === i/);
    expect(chart).toMatch(/opacity=\{hovered == null \|\| active \? 1 : 0\.55\}/);
    expect(chart).toMatch(/stroke=\{active \? '#0f2440' : 'transparent'\}/);
  });

  it('resalta el punto de la línea acumulada activo', () => {
    expect(chart).toMatch(/r=\{hovered === i \? 6 : 3\.5\}/);
  });

  it('muestra tooltip con nombre, cantidad, %, % acumulado, grupo vital y ranking', () => {
    const tip = chart.slice(at(chart, 'pareto-tip'));
    expect(tip).toMatch(/\{tip\.category\}/);
    expect(tip).toMatch(/Cantidad: \{tip\.value\}/);
    expect(tip).toMatch(/Porcentaje: \{tip\.percentage\}/);
    expect(tip).toMatch(/Acumulado: \{tip\.cumulativePercentage\}/);
    expect(tip).toMatch(/Grupo vital/);
    expect(tip).toMatch(/Ranking:/);
  });

  it('la línea del 80% es discontinua y está etiquetada, distinta de la acumulada', () => {
    expect(chart).toMatch(/strokeDasharray="6 5"/);
    expect(chart).toMatch(/\{cutoff\}%/);
    // la acumulada es continua (ámbar), sin dasharray
    expect(chart).toMatch(/stroke="#d97706"/);
  });

  it('las barras son accesibles por teclado (foco, rol y etiqueta)', () => {
    expect(chart).toMatch(/tabIndex=\{0\}/);
    expect(chart).toMatch(/role="button"/);
    expect(chart).toMatch(/aria-label=\{`\$\{r\.category\}/);
    expect(chart).toMatch(/onFocus=\{\(\) => onHover\(i\)\}/);
  });

  it('distingue grupo vital (verde) de no vital (azul-gris)', () => {
    expect(chart).toMatch(/r\.vitalFew \? '#16a34a' : '#93b4d8'/);
  });
});

describe('Pareto — tabla como alternativa accesible con hover compartido', () => {
  it('comparte el estado de hover entre gráfico y tabla', () => {
    expect(results).toMatch(/useState<number \| null>\(null\)/);
    expect(results).toMatch(/hovered === i \? 'is-hover' : undefined/);
    expect(results).toMatch(/onFocus=\{\(\) => setHovered\(i\)\}/);
  });

  it('la tabla expone #, categoría, cantidad, % y % acumulado y marca lo vital', () => {
    expect(results).toMatch(/% Acum/);
    expect(results).toMatch(/r\.cumulativePercentage/);
    expect(results).toMatch(/r\.vitalFew \?/);
  });
});

describe('Pareto — layout y acabado (CSS)', () => {
  it('el resultado usa gráfico ~60% + tabla ~40% y colapsa a una columna', () => {
    expect(css).toMatch(/\.pareto-results\s*\{[^}]*grid-template-columns:\s*minmax\(0, 3fr\)/);
    const mq = css.slice(css.indexOf('@media (max-width: 1024px)'));
    expect(mq).toMatch(/\.pareto-results\s*\{[^}]*grid-template-columns:\s*1fr/);
  });

  it('respeta prefers-reduced-motion', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm).toMatch(/\.pareto-chart svg/);
  });

  it('la captura se dispone en rejilla responsive', () => {
    expect(css).toMatch(/\.pareto-capture__grid\s*\{[^}]*repeat\(auto-fill/);
  });
});
