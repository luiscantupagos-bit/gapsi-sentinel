/**
 * FLOW-SIMPLIFICATION — simplificación del diagrama de flujo (aserciones de fuente). §18.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, '..', rel), 'utf8');
const base = 'src/app/dashboard/haccp/[planId]/_components';
const workspace = read(`${base}/HaccpWorkspace.tsx`);
const processTab = read(`${base}/HaccpProcessTab.tsx`);
const onsite = read(`${base}/HaccpOnsiteConfirmationTab.tsx`);
const flowServer = read('src/server/haccp-flow.ts');

describe('§4/§5 confirmación in situ dentro del diagrama de flujo', () => {
  it('el bloque de confirmación está en «Flujo detallado» con acción y estado', () => {
    expect(processTab).toContain('HaccpOnsiteConfirmationTab');
    expect(onsite).toContain('verifyFlowAction'); // acción de confirmar
    expect(onsite).toContain('Confirmado en planta');
    expect(onsite).toContain('No confirmado en planta');
    expect(onsite).toContain('Confirmar diagrama en planta'); // CTA en borrador
  });
  it('la vista por defecto del diagrama es «Flujo detallado»', () => {
    expect(processTab).toContain("useState<Sub>('flujo')");
  });
});

describe('§8 reset de la confirmación al cambiar el proceso', () => {
  it('editar etapas/conexiones/entradas/salidas/destinos reinicia la verificación in situ', () => {
    expect(flowServer).toContain('resetFlowVerification');
    expect(flowServer).toContain('flowVerifiedOnSite: false');
  });
});

describe('§16/§17 readiness — paso 4 y paso 5 por separado en el resumen', () => {
  it('el resumen muestra el estado del diagrama y de la confirmación por separado', () => {
    expect(workspace).toContain('Diagrama de flujo (paso 4)');
    expect(workspace).toContain('Confirmación in situ (paso 5)');
    expect(workspace).toContain('flowComplete');
    expect(workspace).toContain('onsiteConfirmed');
  });
});
