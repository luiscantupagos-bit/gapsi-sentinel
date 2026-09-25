/**
 * HACCP-002 — UI del diagrama de flujo (aserciones de fuente). §E37.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { HACCP_TABS, HACCP_FUTURE_TABS } from '@/features/haccp/haccp-state';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const view = read('../src/app/dashboard/haccp/[planId]/_components/HaccpProcessFlowView.tsx');
const tab = read('../src/app/dashboard/haccp/[planId]/_components/HaccpFlowTab.tsx');

describe('§E11 tab habilitado', () => {
  it('«flujo» es un tab activo, ya no «Próximamente»', () => {
    expect(HACCP_TABS).toContain('flujo');
    expect(HACCP_FUTURE_TABS as readonly string[]).not.toContain('Diagrama de flujo');
  });
});

describe('§E30 render reutilizable', () => {
  it('lista vertical con número, nombre, tipo y conexiones etiquetadas', () => {
    expect(view).toContain('haccp-flow');
    expect(view).toContain('stepNumber');
    expect(view).toContain('stepTypeLabel');
    expect(view).toContain('connectionTypeLabel');
    expect(view).toContain('role="list"');
  });
  it('§E36 estado vacío', () => {
    expect(view).toContain('Sin etapas registradas.');
  });
});

describe('§E12/§E37 editor', () => {
  it('agregar/editar/eliminar/reordenar/conectar/desconectar (sin depender de drag)', () => {
    expect(tab).toContain('addStepAction');
    expect(tab).toContain('updateStepAction');
    expect(tab).toContain('removeStepAction');
    expect(tab).toContain('moveStepAction'); // mover arriba/abajo
    expect(tab).toContain('addConnectionAction');
    expect(tab).toContain('removeConnectionAction');
  });
  it('§E16 tipos de etapa y §E17 ramas etiquetadas', () => {
    expect(tab).toContain('HACCP_STEP_TYPES');
    expect(tab).toContain('Conforme');
    expect(tab).toContain('HACCP_CONNECTION_TYPES');
  });
  it('§E18/§E19 verificación in situ', () => {
    expect(tab).toContain('verifyFlowAction');
    expect(tab).toContain('Verificado en planta');
    expect(tab).toContain('No verificado en planta');
  });
  it('§E21 publicado read-only (editor gated por editable)', () => {
    expect(tab).toContain('version?.editable');
  });
  it('§E37 no expone UUID crudo (usa números/nombres)', () => {
    expect(tab).toContain('stepNumber');
  });
});
