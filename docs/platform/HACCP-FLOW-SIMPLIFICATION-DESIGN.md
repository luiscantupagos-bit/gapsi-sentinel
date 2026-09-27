# HACCP-FLOW-SIMPLIFICATION — simplificación UX del diagrama de flujo · diseño

Rama `feat/haccp-flow-simplification` (desde la rama de gaps de datos = d1fb18c, sobre
`main` = 38408d7). Simplifica el workspace HACCP. **Sin cambios de modelo de datos, 0 migraciones.**

## Cambios

1. **Se elimina la sub-vista «Mapa de proceso»** del workspace. Los componentes
   `HaccpProcessMapView` y `HaccpSipocTableView` se **conservan** (reutilizables para HACCP-007 y
   otras salidas documentales); solo se retiró su uso en el workspace.
2. **Se elimina «Confirmación in situ» como pestaña principal** (paso 5). La funcionalidad
   (`verified_on_site/at/by/notes`) se **integra dentro de «Diagrama de flujo»** (paso 4), como un
   bloque compacto en la parte superior de «Flujo detallado».
3. El apartado «Diagrama de flujo» conserva **dos sub-vistas**: **Flujo detallado** (por defecto) y
   **Descripción de etapas**. La edición de entradas/salidas/destinos (antes en el mapa) se movió a
   «Descripción de etapas» (los datos siguen alimentando la descripción, el análisis de peligros y
   HACCP-007).

## Navegación y numeración

- Quedan **11 pestañas visibles**, pero la **numeración metodológica se conserva** (1-4 + 6-12):
  los principios **NO** se renumeran. El paso 5 sigue existiendo conceptualmente, integrado en el
  paso 4. Dentro de «Diagrama de flujo» hay leyendas explícitas: «Paso preliminar 4 · Elaboración
  del diagrama de flujo» y «Paso preliminar 5 · Confirmación in situ».
- Grupos: preliminares `[team, product, intended-use, flow]` (4) + principios `[hazards … records]`
  (7).

## Deep links (§12)

`?tab=onsite-confirmation` **redirige** a `?tab=flow` (alias en `HACCP_TAB_ALIASES`). Las demás
URLs antiguas se conservan.

## Confirmación in situ (§6/§7/§8)

Bloque compacto tipo status card con el estado (Confirmado/No confirmado en planta) + meta
(fecha/responsable/observaciones) y, en borrador, el CTA «Confirmar diagrama en planta». **Regla de
reset conservada**: al cambiar etapa/conexión/entrada/salida/destino, `verified_on_site` vuelve a
`false` (`resetFlowVerification` en `haccp-flow.ts` y `haccp-process.ts`), y la UI muestra
«Pendiente».

## Readiness / Resumen (§16/§17)

El **diagrama de flujo (paso 4)** y la **confirmación in situ (paso 5)** se evalúan **por separado**
en el «Resumen del plan» (encabezado): «Diagrama de flujo: Completo/Pendiente» (hay etapas) y
«Confirmación in situ: Confirmado/Pendiente» (`flowVerifiedOnSite`). No se fusionan sus estados
aunque compartan pestaña.

## HACCP-007 (§15)

Retirar el mapa del workspace **no** implica quitarlo del Plan HACCP formal: la fuente de datos
(inputs/outputs/destinations/SIPOC) permanece disponible y los componentes print-safe se conservan.
En HACCP-007 se evaluará si el SIPOC aporta valor documental o resulta redundante.

## Migración

**0 migraciones.** Cambio puramente de navegación/presentación.

## Fuera de alcance

HACCP-007; rediseño del «Flujo detallado» (se mantiene, §13).
