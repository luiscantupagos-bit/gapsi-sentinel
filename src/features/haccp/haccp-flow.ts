/**
 * HACCP-002 — helpers PUROS del diagrama de flujo (tipos de etapa/conexión, orden,
 * detección de cambio de flujo). Sin dependencia de Prisma/servidor.
 *
 * Cada etapa tiene una identidad LÓGICA estable (`processStepId`) que sobrevive al clon de
 * versión; la fila (`id`) cambia. Las conexiones referencian la identidad lógica.
 */

// --- Tipos de etapa ----------------------------------------------------------
export const HACCP_STEP_TYPES = [
  'process',
  'inspection',
  'storage',
  'transport',
  'decision',
  'rework',
  'output',
] as const;
export type HaccpStepType = (typeof HACCP_STEP_TYPES)[number];

export const HACCP_STEP_TYPE_LABEL: Record<HaccpStepType, string> = {
  process: 'Proceso',
  inspection: 'Inspección',
  storage: 'Almacenamiento',
  transport: 'Transporte',
  decision: 'Decisión',
  rework: 'Retrabajo',
  output: 'Salida / Rechazo',
};

// --- Tipos de conexión -------------------------------------------------------
export const HACCP_CONNECTION_TYPES = ['sequence', 'conditional', 'rework', 'reject'] as const;
export type HaccpConnectionType = (typeof HACCP_CONNECTION_TYPES)[number];

export const HACCP_CONNECTION_TYPE_LABEL: Record<HaccpConnectionType, string> = {
  sequence: 'Secuencia',
  conditional: 'Condicional',
  rework: 'Retrabajo',
  reject: 'Rechazo',
};

// --- Modelo de vista (para el render reutilizable) ---------------------------
export interface FlowStep {
  id: string;
  processStepId: string;
  stepType: string;
  name: string;
  description?: string | null;
  sequence: number;
  area?: string | null;
  responsibleName?: string | null;
  responsibleRole?: string | null;
  equipment?: string | null;
  inputs?: string | null;
  outputs?: string | null;
  parameters?: string | null;
  notes?: string | null;
}
export interface FlowConnection {
  id: string;
  fromStepId: string;
  toStepId: string;
  connectionType: string;
  label?: string | null;
  sequence: number;
}

export const stepTypeLabel = (t: string): string => HACCP_STEP_TYPE_LABEL[t as HaccpStepType] ?? t;
export const connectionTypeLabel = (t: string): string =>
  HACCP_CONNECTION_TYPE_LABEL[t as HaccpConnectionType] ?? t;

/** Ordena las etapas por `sequence` (estable; no depende del orden de inserción). */
export function orderSteps<T extends { sequence: number }>(steps: T[]): T[] {
  return [...steps].sort((a, b) => a.sequence - b.sequence);
}

/** Número visible de la etapa (01, 02, …) según su posición ordenada. */
export function stepNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/**
 * §E25 — ¿cambió el flujo respecto a otra versión? Compara por identidad LÓGICA
 * (`processStepId`) y por las conexiones (from→to·tipo). Puro; base para futuro impact
 * assessment / reevaluación. NO ejecuta automatismos.
 */
export interface FlowSnapshot {
  steps: { processStepId: string; name: string; stepType: string; sequence: number }[];
  connections: { fromStepId: string; toStepId: string; connectionType: string }[];
}

export function flowChanged(a: FlowSnapshot, b: FlowSnapshot): boolean {
  const stepKey = (s: FlowSnapshot['steps'][number]) =>
    `${s.processStepId}|${s.name}|${s.stepType}|${s.sequence}`;
  const connKey = (c: FlowSnapshot['connections'][number]) =>
    `${c.fromStepId}->${c.toStepId}:${c.connectionType}`;
  const setA = new Set(a.steps.map(stepKey));
  const setB = new Set(b.steps.map(stepKey));
  if (setA.size !== setB.size || [...setA].some((k) => !setB.has(k))) return true;
  const cA = new Set(a.connections.map(connKey));
  const cB = new Set(b.connections.map(connKey));
  if (cA.size !== cB.size || [...cA].some((k) => !cB.has(k))) return true;
  return false;
}
