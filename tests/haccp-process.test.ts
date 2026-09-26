/**
 * HACCP-PROCESS-EXPANSION — helpers PUROS de entradas/salidas/destinos y contexto de peligro,
 * y detección de cambio del modelo de proceso. §U.
 */
import { describe, expect, it } from 'vitest';
import {
  INPUT_TYPES,
  OUTPUT_TYPES,
  DESTINATION_TYPES,
  inputTypeLabel,
  outputTypeLabel,
  destinationTypeLabel,
  inputSourceLabel,
  inputSourceIsStep,
  destinationIsInternalStep,
  destinationIsExternal,
  isSecondaryOutput,
  hazardContextLabel,
  processModelChanged,
  type ProcessModelSnapshot,
} from '@/features/haccp/haccp-process';

describe('tipos y etiquetas (§C2/§D1/§D2)', () => {
  it('etiqueta española para cada tipo de entrada/salida/destino', () => {
    for (const t of INPUT_TYPES) expect(inputTypeLabel(t)).toBeTruthy();
    for (const t of OUTPUT_TYPES) expect(outputTypeLabel(t)).toBeTruthy();
    for (const t of DESTINATION_TYPES) expect(destinationTypeLabel(t)).toBeTruthy();
    expect(inputTypeLabel('raw_material')).toBe('Materia prima');
    expect(outputTypeLabel('byproduct')).toBe('Subproducto');
    expect(destinationTypeLabel('waste_disposal')).toBe('Disposición de residuos');
  });
  it('origen de entrada y contexto de peligro', () => {
    expect(inputSourceLabel('supplier')).toBe('Proveedor externo');
    expect(inputSourceIsStep('previous_step')).toBe(true);
    expect(inputSourceIsStep('supplier')).toBe(false);
    expect(hazardContextLabel('input')).toContain('entrada');
    expect(hazardContextLabel(null)).toContain('etapa'); // default step
  });
});

describe('resolvers de destino (§D3/§D4)', () => {
  it('destino interno usa etapa; externo usa texto', () => {
    expect(destinationIsInternalStep('next_process_step')).toBe(true);
    expect(destinationIsInternalStep('bulk_sale')).toBe(false);
    expect(destinationIsExternal('external_processing')).toBe(true);
    expect(destinationIsExternal('next_process_step')).toBe(false);
  });
  it('resalta salidas secundarias (subproducto/desecho/no conforme)', () => {
    expect(isSecondaryOutput('byproduct')).toBe(true);
    expect(isSecondaryOutput('waste')).toBe(true);
    expect(isSecondaryOutput('conforming_product')).toBe(false);
  });
});

describe('cambio del modelo de proceso (§Q4)', () => {
  const base: ProcessModelSnapshot = {
    steps: [{ processStepId: 's1', name: 'Recepción', stepType: 'process', sequence: 0 }],
    connections: [],
    inputs: [
      { inputLogicalId: 'i1', processStepId: 's1', name: 'Huevo', inputType: 'raw_material' },
    ],
    outputs: [],
    destinations: [],
  };
  it('sin cambios → false (orden irrelevante)', () => {
    const b = structuredClone(base);
    b.inputs.push({ inputLogicalId: 'i0', processStepId: 's1', name: 'Agua', inputType: 'water' });
    const a = structuredClone(base);
    a.inputs.unshift({
      inputLogicalId: 'i0',
      processStepId: 's1',
      name: 'Agua',
      inputType: 'water',
    });
    expect(processModelChanged(a, b)).toBe(false); // mismo conjunto, distinto orden
  });
  it('detecta cambio en entradas', () => {
    const changed = structuredClone(base);
    changed.inputs[0]!.name = 'Huevo fresco';
    expect(processModelChanged(base, changed)).toBe(true);
  });
  it('detecta cambio en salidas y destinos', () => {
    const withOut = structuredClone(base);
    withOut.outputs.push({
      outputLogicalId: 'o1',
      processStepId: 's1',
      name: 'Conforme',
      outputType: 'conforming_product',
    });
    expect(processModelChanged(base, withOut)).toBe(true);
    const withDest = structuredClone(withOut);
    withDest.destinations.push({
      outputLogicalId: 'o1',
      destinationType: 'next_process_step',
      destinationProcessStepId: 's2',
      destinationExternalText: null,
    });
    expect(processModelChanged(withOut, withDest)).toBe(true);
  });
});
