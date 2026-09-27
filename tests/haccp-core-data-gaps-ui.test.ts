/**
 * HACCP-CORE-DATA-GAPS — UI de uso previsto (paso 3) y disposición (paso 10). §16.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, '..', rel), 'utf8');
const base = 'src/app/dashboard/haccp/[planId]/_components';
const workspace = read(`${base}/HaccpWorkspace.tsx`);
const controlTab = read(`${base}/HaccpControlTab.tsx`);
const facets = read(`${base}/HaccpControlFacets.tsx`);

describe('§D Paso 3 — Uso previsto es un formulario/lectura real', () => {
  it('deja de ser placeholder: usa saveIntendedUseAction y los campos de dominio', () => {
    expect(workspace).toContain('saveIntendedUseAction');
    expect(workspace).toContain('intendedUse');
    expect(workspace).toContain('Consumidor previsto');
    expect(workspace).toContain('Grupos sensibles');
    expect(workspace).toContain('Uso incorrecto razonablemente previsible');
    // ya no muestra el mensaje de gap "no captura campos específicos"
    expect(workspace).not.toContain('no captura campos específicos de uso previsto');
  });
  it('editable solo en borrador (gated por editable)', () => {
    expect(workspace).toContain('active?.editable');
  });
});

describe('§E Paso 10 — Disposición distinta de corrección y acción correctiva', () => {
  it('el editor del plan de control captura la disposición', () => {
    expect(controlTab).toContain('name="disposition"');
    expect(controlTab).toContain('Disposición del producto/material');
    expect(controlTab).toContain('Corrección inmediata');
  });
  it('la vista de acciones correctivas distingue los tres conceptos', () => {
    expect(facets).toContain('Corrección inmediata');
    expect(facets).toContain('Disposición del producto/material');
    expect(facets).toContain('Acción correctiva');
    expect(facets).toContain('a.plan?.disposition');
  });
});
