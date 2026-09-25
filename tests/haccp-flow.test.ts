/**
 * HACCP-002 — helpers PUROS del diagrama de flujo. §E35.
 */
import { describe, expect, it } from 'vitest';
import {
  HACCP_STEP_TYPE_LABEL,
  HACCP_CONNECTION_TYPE_LABEL,
  orderSteps,
  stepNumber,
  stepTypeLabel,
  connectionTypeLabel,
  flowChanged,
  type FlowSnapshot,
} from '@/features/haccp/haccp-flow';

describe('tipos y etiquetas', () => {
  it('tipos de etapa en español', () => {
    expect(HACCP_STEP_TYPE_LABEL.process).toBe('Proceso');
    expect(HACCP_STEP_TYPE_LABEL.decision).toBe('Decisión');
    expect(HACCP_STEP_TYPE_LABEL.output).toBe('Salida / Rechazo');
    expect(stepTypeLabel('inspection')).toBe('Inspección');
    expect(stepTypeLabel('desconocido')).toBe('desconocido');
  });
  it('tipos de conexión en español', () => {
    expect(HACCP_CONNECTION_TYPE_LABEL.reject).toBe('Rechazo');
    expect(connectionTypeLabel('conditional')).toBe('Condicional');
  });
});

describe('orden y numeración', () => {
  it('ordena por sequence, no por inserción', () => {
    const out = orderSteps([
      { id: 'c', sequence: 2 },
      { id: 'a', sequence: 0 },
      { id: 'b', sequence: 1 },
    ]);
    expect(out.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
  it('numeración 01, 02, …', () => {
    expect(stepNumber(0)).toBe('01');
    expect(stepNumber(9)).toBe('10');
  });
});

describe('flowChanged (§E25)', () => {
  const base: FlowSnapshot = {
    steps: [
      { processStepId: 'p1', name: 'Recepción', stepType: 'process', sequence: 0 },
      { processStepId: 'p2', name: 'Inspección', stepType: 'inspection', sequence: 1 },
    ],
    connections: [{ fromStepId: 'p1', toStepId: 'p2', connectionType: 'sequence' }],
  };
  it('sin cambios → false', () => {
    expect(flowChanged(base, structuredClone(base))).toBe(false);
  });
  it('renombrar una etapa → true', () => {
    const b = structuredClone(base);
    b.steps[1]!.name = 'Ovoscopía';
    expect(flowChanged(base, b)).toBe(true);
  });
  it('agregar/quitar conexión → true', () => {
    const b = structuredClone(base);
    b.connections.push({ fromStepId: 'p2', toStepId: 'p1', connectionType: 'rework' });
    expect(flowChanged(base, b)).toBe(true);
  });
  it('reordenar (cambia sequence) → true', () => {
    const b = structuredClone(base);
    b.steps[0]!.sequence = 5;
    expect(flowChanged(base, b)).toBe(true);
  });
});
