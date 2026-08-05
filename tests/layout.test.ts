/**
 * Pruebas estructurales del ajuste de layout (TASK-007, Bloque A).
 *
 * No renderizan el navegador: verifican sobre `globals.css` que el área privada
 * usa un contenedor amplio y fluido, que las tablas permiten scroll horizontal y
 * que el layout colapsa en móvil. La verificación visual (1920/1440/móvil) se
 * documenta en las notas de implementación.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cssPath = fileURLToPath(new URL('../src/app/globals.css', import.meta.url));
const css = readFileSync(cssPath, 'utf8');

/** Extrae el valor en `rem` de una variable CSS definida en `:root`. */
function remVar(name: string): number {
  const m = css.match(new RegExp(`${name}:\\s*([0-9.]+)rem`));
  if (!m) throw new Error(`Variable ${name} no encontrada en globals.css`);
  return Number(m[1]);
}

describe('layout amplio (TASK-007)', () => {
  it('define un contenedor amplio mayor que el ancho anterior', () => {
    const wide = remVar('--max-width-wide');
    const base = remVar('--max-width');
    expect(base).toBe(68); // ancho anterior
    expect(wide).toBeGreaterThan(base);
    expect(wide).toBeGreaterThanOrEqual(93.75); // ≥ 1500px
    expect(wide).toBeLessThanOrEqual(112.5); // ≤ 1800px
  });

  it('el contenido del dashboard usa el contenedor amplio', () => {
    expect(css).toMatch(
      /\.shell__content\s*>\s*\.container\s*\{[^}]*max-width:\s*var\(--max-width-wide\)/,
    );
  });

  it('las tablas permiten scroll horizontal', () => {
    expect(css).toMatch(/\.table-wrap\s*\{[^}]*overflow-x:\s*auto/);
  });

  it('colapsa a una columna en móvil sin desbordar', () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*720px\)/);
    // El shell pasa a columna y el sidebar ocupa el ancho completo.
    const mobile = css.slice(css.indexOf('@media (max-width: 720px)'));
    expect(mobile).toMatch(/\.shell\s*\{[^}]*flex-direction:\s*column/);
  });

  it('las rejillas de tarjetas son responsive (auto-fit)', () => {
    expect(css).toMatch(/\.stat-row\s*\{[^}]*repeat\(auto-fit/);
    expect(css).toMatch(/\.grid\s*\{[^}]*repeat\(auto-fit/);
  });
});
