/**
 * HACCP-005 — UI de validación de medidas de control (aserciones de fuente). §45.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { HACCP_TABS, HACCP_FUTURE_TABS } from '@/features/haccp/haccp-state';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const base = '../src/app/dashboard/haccp/[planId]/_components';
const tab = read(`${base}/HaccpValidationTab.tsx`);
const view = read(`${base}/HaccpValidationView.tsx`);

describe('§25 tab habilitado', () => {
  it('«validacion» es un tab activo, ya no «Próximamente»', () => {
    expect(HACCP_TABS).toContain('validacion');
    expect(HACCP_FUTURE_TABS as readonly string[]).not.toContain('Validación');
  });
});

describe('§25/§26 sub-vistas y resumen', () => {
  it('Pendientes / En proceso / Satisfactorias / Revisión requerida / Todas + cards', () => {
    expect(tab).toContain('pendientes');
    expect(tab).toContain('Satisfactorias');
    expect(tab).toContain('Revisión requerida');
    expect(tab).toContain('completeness');
    expect(tab).toContain('Por validar');
  });
});

describe('§28/§29 formulario y contexto', () => {
  it('objetivo/método/fundamento/criterio/evidencia/conclusión/resultado/revisor/próxima', () => {
    expect(tab).toContain('saveValidationAction');
    expect(tab).toContain('objective');
    expect(tab).toContain('methodType');
    expect(tab).toContain('acceptanceCriteria');
    expect(tab).toContain('conclusion');
    expect(tab).toContain('reviewedByUserId');
    expect(tab).toContain('nextValidationAt');
    expect(tab).toContain('Resultado');
  });
  it('§23 validador externo y §30 documento de evidencia', () => {
    expect(tab).toContain('performedByExternalName');
    expect(tab).toContain('evidenceDocumentId');
  });
  it('§29 contexto del control visible (no editable aquí)', () => {
    expect(tab).toContain('control.hazardName');
    expect(tab).toContain('control.criticalLimit');
    expect(tab).toContain('control.actionCriterion');
  });
});

describe('§31/§32/§38 read-only y vista reutilizable', () => {
  it('gated por editable', () => {
    expect(tab).toContain('version.editable');
  });
  it('HaccpValidationView muestra estado, resultado y campos; distingue validación de verificación', () => {
    expect(view).toContain('Objetivo de validación');
    expect(view).toContain('badge--valstatus-');
    expect(tab).toContain('distinta de la');
  });
});
