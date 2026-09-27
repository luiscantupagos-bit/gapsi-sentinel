# HACCP-CORE-DATA-GAPS — cierre de gaps de datos · diseño

Rama `feat/haccp-core-data-gaps` (desde `main` tras integrar HACCP-006 y la reorganización del
workspace = 38408d7). Cierra dos gaps de datos reales detectados durante la reorganización, para
dar contenido real a los pasos **3 Uso previsto** y **10 Acciones correctivas** antes de HACCP-007.
Sin ampliar alcance.

## Gap #1 — Uso previsto (paso 3)

Información propia del estudio HACCP, **version-owned** → vive en `HaccpPlanVersion` (no en una
tabla nueva, §F). Campos añadidos (todos opcionales, §D1): `intended_use`, `intended_consumer`,
`sensitive_groups`, `usage_conditions`, `distribution_conditions`, `preparation_or_handling`,
`misuse_considerations`, `other_intended_use_notes`.

- **Servidor**: `saveIntendedUse(orgId, userId, planVersionId, input)` (requiere borrador editable;
  publicado inmutable, §D4). `createHaccpVersion` clona los campos a la nueva versión.
  `getHaccpPlanDetail.active` los expone.
- **UI (paso 3)**: deja de ser placeholder — formulario real en borrador (8 campos con la
  terminología §D2) y vista de lectura en publicado.

## Gap #2 — Disposición (paso 10)

El plan de control tenía `correction` y `corrective_action` pero **no** `disposition`. Se agrega
`disposition` a `HaccpControlPlan` (texto controlado/descriptivo, §E3; sin enum rígido).

Semántica (§E1) — tres conceptos distintos:

- **Corrección inmediata**: acción inmediata sobre la desviación.
- **Disposición**: qué se hace con el producto/material afectado (retención, reproceso,
  segregación, devolución, destrucción, uso alterno, otra…).
- **Acción correctiva**: elimina la causa y previene la recurrencia.

- **Servidor**: `saveControlPlan` acepta `disposition`; `getControlMeasures` lo expone;
  `createHaccpVersion` lo clona.
- **UI**: el editor del plan de control (paso 7) captura la disposición entre corrección y acción
  correctiva; la vista del paso 10 (`HaccpCorrectiveActionsView`) muestra los tres conceptos
  separados. La vista reutilizable `HaccpControlMeasuresView` (HACCP-007) también lo incluye.

## Migración

`20261002000000_haccp_core_data_gaps` — **UNA migración ADITIVA (0 DROP TABLE / 0 DROP COLUMN)**:
`ALTER TABLE haccp_plan_versions ADD COLUMN …` (8 campos de uso previsto) y
`ALTER TABLE haccp_control_plans ADD COLUMN disposition`. Sin entidades nuevas → sin RLS/FKs
adicionales (los datos pertenecen a entidades existentes ya aisladas por organización).

## Seed

`PL-HACCP-001`: uso previsto DEMO razonable para huevo fresco (uso tras cocción, consumidor
general, cadena de frío) **sin inventar población vulnerable ni instrucciones regulatorias** (§D3);
disposición DEMO en el control PPRO de Salmonella («Segregar el lote afectado; retener para
evaluación…»). Idempotente.

## Fuera de alcance

HACCP-007. La conexión de la disposición/acción correctiva a Hallazgo/CAPA sigue como seguimiento
(no se crea flujo paralelo).
