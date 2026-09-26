/**
 * HACCP-PROCESS-EXPANSION — vocabulario PURO del modelo de proceso enriquecido: entradas,
 * salidas, destinos y contexto de peligro. Sin BD. Enriquece (no sustituye) HaccpProcessStep /
 * HaccpProcessConnection. Los mismos datos alimentan el mapa de proceso, la vista SIPOC, el flujo
 * detallado, la descripción de etapas, el análisis de peligros y (futuro) HACCP-007.
 */

// --- Tipos de ENTRADA (§C2) --------------------------------------------------
export const INPUT_TYPES = [
  'raw_material',
  'ingredient',
  'packaging_material',
  'contact_material',
  'reusable_material',
  'utility',
  'water',
  'air',
  'chemical',
  'intermediate_product',
  'rework',
  'returned_material',
  'equipment_or_utensil_related',
  'other',
] as const;
export type InputType = (typeof INPUT_TYPES)[number];
export const INPUT_TYPE_LABEL: Record<InputType, string> = {
  raw_material: 'Materia prima',
  ingredient: 'Ingrediente',
  packaging_material: 'Material de empaque',
  contact_material: 'Material de contacto',
  reusable_material: 'Material reutilizable',
  utility: 'Servicio / utilidad',
  water: 'Agua',
  air: 'Aire',
  chemical: 'Químico',
  intermediate_product: 'Producto intermedio',
  rework: 'Retrabajo',
  returned_material: 'Material retornable',
  equipment_or_utensil_related: 'Equipo / utensilio',
  other: 'Otro',
};
export const inputTypeLabel = (t: string): string => INPUT_TYPE_LABEL[t as InputType] ?? t;

// --- Origen de la ENTRADA (§C3) ----------------------------------------------
export const INPUT_SOURCE_TYPES = [
  'supplier',
  'previous_step',
  'internal_process',
  'storage',
  'rework',
  'return',
  'other',
] as const;
export type InputSourceType = (typeof INPUT_SOURCE_TYPES)[number];
export const INPUT_SOURCE_LABEL: Record<InputSourceType, string> = {
  supplier: 'Proveedor externo',
  previous_step: 'Etapa anterior',
  internal_process: 'Otro proceso interno',
  storage: 'Almacén',
  rework: 'Retrabajo',
  return: 'Retorno',
  other: 'Otro origen',
};
export const inputSourceLabel = (t: string | null | undefined): string =>
  (t && INPUT_SOURCE_LABEL[t as InputSourceType]) || '—';

/** El origen referencia una etapa anterior (usa source_process_step_id). */
export const inputSourceIsStep = (t: string | null | undefined): boolean => t === 'previous_step';

// --- Tipos de SALIDA (§D1) ---------------------------------------------------
export const OUTPUT_TYPES = [
  'conforming_product',
  'nonconforming_product',
  'intermediate_product',
  'finished_product',
  'byproduct',
  'rework',
  'return',
  'waste',
  'residue',
  'packaging_material',
  'reusable_material',
  'other',
] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];
export const OUTPUT_TYPE_LABEL: Record<OutputType, string> = {
  conforming_product: 'Producto conforme',
  nonconforming_product: 'Producto no conforme',
  intermediate_product: 'Producto intermedio',
  finished_product: 'Producto terminado',
  byproduct: 'Subproducto',
  rework: 'Retrabajo',
  return: 'Devolución',
  waste: 'Desecho',
  residue: 'Residuo',
  packaging_material: 'Material de empaque',
  reusable_material: 'Material reutilizable',
  other: 'Otro',
};
export const outputTypeLabel = (t: string): string => OUTPUT_TYPE_LABEL[t as OutputType] ?? t;

/** Salidas que representan una ruta secundaria/subproducto/desecho (para resaltar en el mapa). */
export const SECONDARY_OUTPUT_TYPES: ReadonlySet<OutputType> = new Set([
  'nonconforming_product',
  'byproduct',
  'rework',
  'return',
  'waste',
  'residue',
]);
export const isSecondaryOutput = (t: string): boolean =>
  SECONDARY_OUTPUT_TYPES.has(t as OutputType);

// --- Tipos de DESTINO (§D2) --------------------------------------------------
export const DESTINATION_TYPES = [
  'next_process_step',
  'other_internal_process',
  'storage',
  'finished_goods',
  'rework',
  'external_sale',
  'bulk_sale',
  'supplier_return',
  'external_processing',
  'waste_disposal',
  'nonconforming_area',
  'customer',
  'other',
] as const;
export type DestinationType = (typeof DESTINATION_TYPES)[number];
export const DESTINATION_TYPE_LABEL: Record<DestinationType, string> = {
  next_process_step: 'Siguiente etapa',
  other_internal_process: 'Otro proceso interno',
  storage: 'Almacén',
  finished_goods: 'Producto terminado',
  rework: 'Retrabajo',
  external_sale: 'Venta externa',
  bulk_sale: 'Venta a granel',
  supplier_return: 'Devolución a proveedor',
  external_processing: 'Procesamiento externo',
  waste_disposal: 'Disposición de residuos',
  nonconforming_area: 'Área de no conformes',
  customer: 'Cliente',
  other: 'Otro',
};
export const destinationTypeLabel = (t: string): string =>
  DESTINATION_TYPE_LABEL[t as DestinationType] ?? t;

/** El destino apunta a una etapa interna concreta (usa destination_process_step_id, §D3). */
export const destinationIsInternalStep = (t: string): boolean => t === 'next_process_step';

/** Destinos que SALEN del alcance del flujo (usan texto/ref externo, §D4/§F2). */
export const EXTERNAL_DESTINATION_TYPES: ReadonlySet<DestinationType> = new Set([
  'external_sale',
  'bulk_sale',
  'supplier_return',
  'external_processing',
  'waste_disposal',
  'customer',
  'other',
]);
export const destinationIsExternal = (t: string): boolean =>
  EXTERNAL_DESTINATION_TYPES.has(t as DestinationType);

// --- Contexto del PELIGRO (§M1) ----------------------------------------------
export const HAZARD_CONTEXT_TYPES = ['step', 'input', 'output'] as const;
export type HazardContextType = (typeof HAZARD_CONTEXT_TYPES)[number];
export const HAZARD_CONTEXT_LABEL: Record<HazardContextType, string> = {
  step: 'Generado/intensificado en la etapa',
  input: 'Introducido con una entrada',
  output: 'Asociado a una salida',
};
export const hazardContextLabel = (t: string | null | undefined): string =>
  (t && HAZARD_CONTEXT_LABEL[t as HazardContextType]) || HAZARD_CONTEXT_LABEL.step;

// --- Detección de cambio del modelo de proceso (§Q4) -------------------------
export interface ProcessModelSnapshot {
  steps: Array<{ processStepId: string; name: string; stepType: string; sequence: number }>;
  connections: Array<{ fromStepId: string; toStepId: string; connectionType: string }>;
  inputs: Array<{ inputLogicalId: string; processStepId: string; name: string; inputType: string }>;
  outputs: Array<{
    outputLogicalId: string;
    processStepId: string;
    name: string;
    outputType: string;
  }>;
  destinations: Array<{
    outputLogicalId: string;
    destinationType: string;
    destinationProcessStepId: string | null;
    destinationExternalText: string | null;
  }>;
}

const norm = (rows: Array<Record<string, unknown>>): string =>
  JSON.stringify(rows.map((r) => JSON.stringify(r, Object.keys(r).sort())).sort());

/**
 * ¿Cambió el modelo de proceso (etapas, conexiones, entradas, salidas o destinos)? Reemplaza a
 * `flowChanged` para el reset de verificación in situ y avisos de impacto. Puro y determinista.
 */
export function processModelChanged(a: ProcessModelSnapshot, b: ProcessModelSnapshot): boolean {
  return (
    norm(a.steps) !== norm(b.steps) ||
    norm(a.connections) !== norm(b.connections) ||
    norm(a.inputs) !== norm(b.inputs) ||
    norm(a.outputs) !== norm(b.outputs) ||
    norm(a.destinations) !== norm(b.destinations)
  );
}
