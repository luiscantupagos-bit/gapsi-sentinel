# HACCP-PROCESS-EXPANSION — Expansión del mapa de proceso · diseño

Rama `feat/haccp-process-expansion` (desde `main` tras integrar DOC-004 = eac600a).
Enriquece el modelo de proceso HACCP para responder, por etapa: **qué entra, de dónde viene,
qué se hace, qué sale, en qué condición y a dónde va**. Los mismos datos alimentan el mapa de
proceso, la vista SIPOC, el flujo detallado, la descripción de etapas, el análisis de peligros y
(futuro) HACCP-007. NO implementa HACCP-006, scheduler, Tasks, Gantt, HACCP-007 final, trazabilidad
ni inventario.

## Principio de producto

**No sustituye** `HaccpProcessStep` ni `process_step_id` ni rehace HACCP-002. La arquitectura de
`HaccpProcessStep` + `HaccpProcessConnection` se conserva; este trabajo la **enriquece**. Se
conservan las columnas de texto `inputs`/`outputs` de la etapa (compatibilidad, §S1).

## Modelo (aditivo)

- **`haccp_process_inputs`** (version-owned): entrada de una etapa. `input_logical_id` = identidad
  LÓGICA estable (§C1). `input_type` (14 tipos, §C2); `source_type` (proveedor/etapa anterior/otro
  proceso/almacén/retrabajo/retorno/otro, §C3); `source_process_step_id` (etapa anterior),
  `source_reference_id` (relación con una fuente HACCP existente sin duplicar ficha, §C4).
- **`haccp_process_outputs`** (version-owned): salida de una etapa. `output_logical_id` estable;
  `output_type` (12 tipos, §D1); `condition_status`.
- **`haccp_process_output_destinations`** (version-owned, **normalizado** §E3): una salida puede
  tener múltiples rutas (subproducto, desecho, venta, devolución, procesamiento externo…).
  `destination_type` (13 tipos, §D2); interno (`next_process_step` → `destination_process_step_id`,
  §D3) o externo (`destination_external_text`, §D4). FK a la salida por
  `(plan_version_id, output_logical_id)` con CASCADE.
- **`haccp_hazards`** + columnas `context_type` (step|input|output, §M1), `input_logical_id`,
  `output_logical_id`. Backfill seguro: los peligros de etapa existentes → `context_type='step'`
  (§M5). Los peligros ligados a `process_step_id` siguen válidos.

## Sincronización salida ↔ conexión (§E)

Fuente de verdad: **la salida define el destino semántico; la conexión es la arista gráfica**
(§E1). Al agregar un destino interno (`next_process_step`), el servidor crea la conexión si no
existe (aditivo; no borra conexiones manuales). Así se evitan dos verdades divergentes.

## Vocabulario y helpers (puros)

`features/haccp/haccp-process.ts` — `INPUT_TYPES`/`OUTPUT_TYPES`/`DESTINATION_TYPES`/
`INPUT_SOURCE_TYPES`/`HAZARD_CONTEXT_TYPES` con etiquetas español; `destinationIsInternalStep`,
`destinationIsExternal`, `isSecondaryOutput`, `inputSourceIsStep`; **`processModelChanged`** (§Q4):
detecta cambios en etapas, conexiones, entradas, salidas y destinos (determinista, orden
irrelevante).

## Servidor

`server/haccp-process.ts` (withOrgContext + RLS): `getProcessModel` (etapas con entradas/salidas/
destinos, para las vistas), CRUD de entradas/salidas/destinos con `requireAdmin` +
`requireEditableVersion`. **Toda edición reinicia la verificación in situ** (§Q5). `haccp.ts`:
`createHaccpVersion` clona entradas/salidas/destinos preservando su identidad lógica y remapeando
`source_reference_id` (§Q1/§Q2/§Q3). `haccp-hazards.ts`: `addHazard` acepta `contextType` +
`inputLogicalId`/`outputLogicalId`; `getHazardAnalysis` agrupa las entradas por etapa con sus
peligros (§O).

## UI

Tab **«Proceso»** (renombrado desde «Diagrama de flujo», §B) con tres vistas (§I/§J/§K/§L):

1. **Mapa de proceso** (SIPOC en tabla + tarjetas por etapa: entradas → etapa → salidas → destinos;
   rutas externas marcadas) + editor de entradas/salidas/destinos por etapa (solo borrador).
2. **Flujo detallado** (el editor de etapas/conexiones de HACCP-002, sin saturar §K1).
3. **Descripción de etapas** (`HaccpProcessStageDescriptionView`, reutilizable para HACCP-007).
   Vistas read-only print-safe: `HaccpProcessMapView`, `HaccpProcessStageDescriptionView`,
   `HaccpSipocTableView`, `HaccpProcessFlowView`. En **Análisis de peligros → Proceso** se listan las
   entradas por etapa con «Agregar peligro» (contexto input), distinguiendo el peligro que entra con
   la entrada del generado en la etapa (§O/§O1); aviso suave si una entrada no tiene evaluación (§P).
   Responsive tablet-first (§X): SIPOC en columnas (desktop) → tarjetas apiladas (móvil). Publicado =
   read-only (§R). Sin UUID visible.

## Migración

`20260930000000_haccp_process_expansion` (aditiva; **0 DROP TABLE / 0 DROP COLUMN**): 3 columnas de
contexto en `haccp_hazards` + backfill, 3 tablas nuevas, índices, CHECK de contexto, FKs tenant-safe
(versión RESTRICT; salida CASCADE), RLS `*_tenant_isolation` + grants a `gapsi_app`.

## Seed

`PL-HACCP-001`: Recepción con 4 entradas (huevo, cono de pulpa, caja plástica, tarima plástica);
Selección con 4 salidas y sus destinos (huevo conforme → Clasificación; huevo chico → venta a
granel / devolución; huevo fisurado → procesamiento externo; huevo roto → disposición). No se
afirman peligros de entrada desde el seed (sin fichas). Idempotente.

## Fuera de alcance

HACCP-006 (verificación), scheduler, Tasks, Gantt, HACCP-007 final, trazabilidad, movimientos de
inventario, módulo de proveedores completo, catálogo global de procesos (el destino
`other_internal_process` queda como texto controlado, §F1). El contexto `output` de peligro queda
soportado en el modelo pero sin uso obligatorio (§M4).
