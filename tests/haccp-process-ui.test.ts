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

describe('§B tab renombrado a Proceso', () => {
  it('la etiqueta del tab «flujo» es «Proceso»', () => {
    expect(HACCP_TAB_LABEL.flujo).toBe('Proceso');
  });
});

describe('§I/§J/§K/§L tres vistas', () => {
  it('mapa de proceso, SIPOC, flujo detallado y descripción de etapas', () => {
    expect(tab).toContain('Mapa de proceso');
    expect(tab).toContain('Flujo detallado');
    expect(tab).toContain('Descripción de etapas');
    expect(tab).toContain('HaccpProcessMapView');
    expect(tab).toContain('HaccpSipocTableView');
    expect(tab).toContain('HaccpFlowTab');
    expect(tab).toContain('HaccpProcessStageDescriptionView');
  });
  it('el mapa muestra entradas → salidas → destinos y marca rutas externas', () => {
    expect(mapView).toContain('Entradas');
    expect(mapView).toContain('Salidas → destinos');
    expect(mapView).toContain('destinationIsExternal');
  });
  it('SIPOC: proveedor/origen y cliente/destino desde el modelo', () => {
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
