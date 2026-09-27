/**
 * HACCP-PROCESS-EXPANSION — UI del proceso (aserciones de fuente). §W.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { HACCP_TAB_LABEL } from '@/features/haccp/haccp-state';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, '..', rel), 'utf8');
const base = 'src/app/dashboard/haccp/[planId]/_components';
const tab = read(`${base}/HaccpProcessTab.tsx`);
const mapView = read(`${base}/HaccpProcessMapView.tsx`);
const stageView = read(`${base}/HaccpProcessStageDescriptionView.tsx`);
const hazards = read(`${base}/HaccpHazardsTab.tsx`);

describe('§B pestaña de flujo (WORKSPACE-REORG: «Diagrama de flujo», paso 4)', () => {
  it('la etiqueta del tab «flow» es «Diagrama de flujo»', () => {
    expect(HACCP_TAB_LABEL.flow).toBe('Diagrama de flujo');
  });
});

describe('FLOW-SIMPLIFICATION — dos sub-vistas (sin «Mapa de proceso»)', () => {
  it('solo Flujo detallado y Descripción de etapas; el Mapa se quitó de la UI', () => {
    expect(tab).toContain('Flujo detallado');
    expect(tab).toContain('Descripción de etapas');
    expect(tab).toContain('HaccpFlowTab');
    expect(tab).toContain('HaccpProcessStageDescriptionView');
    expect(tab).not.toContain('Mapa de proceso');
    expect(tab).not.toContain('HaccpProcessMapView');
    expect(tab).not.toContain('HaccpSipocTableView');
  });
  it('la confirmación in situ vive dentro del diagrama de flujo (paso 5 integrado)', () => {
    expect(tab).toContain('HaccpOnsiteConfirmationTab');
    expect(tab).toContain('Paso preliminar 5 · Confirmación in situ');
    expect(tab).toContain('Paso preliminar 4');
  });
  it('los componentes de mapa/SIPOC se conservan para HACCP-007 (print-safe)', () => {
    expect(mapView).toContain('Salidas → destinos');
    expect(stageView).toContain('Proveedor / Origen');
    expect(stageView).toContain('Cliente / Destino');
  });
});

describe('§C/§D edición de entradas/salidas/destinos', () => {
  it('agregar/quitar entrada, salida y destino', () => {
    expect(tab).toContain('addInputAction');
    expect(tab).toContain('removeInputAction');
    expect(tab).toContain('addOutputAction');
    expect(tab).toContain('removeOutputAction');
    expect(tab).toContain('addDestinationAction');
    expect(tab).toContain('removeDestinationAction');
  });
  it('destino interno usa etapa; externo usa texto (§D3/§D4)', () => {
    expect(tab).toContain('destinationIsInternalStep');
    expect(tab).toContain('Etapa siguiente');
    expect(tab).toContain('Destino externo');
  });
  it('§30 publicado read-only (gated por editable)', () => {
    expect(tab).toContain('version.editable');
  });
});

describe('§O análisis de peligros por entrada', () => {
  it('lista entradas por etapa con «Agregar peligro» y contexto input', () => {
    expect(hazards).toContain('Peligros por entrada');
    expect(hazards).toContain("contextType: 'input'");
    expect(hazards).toContain('inputLogicalId: inp.inputLogicalId');
    expect(hazards).toContain('aún no tiene evaluación de peligros');
  });
});
