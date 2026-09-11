# DOC-OUTPUT-FOLLOWUP + CAPA-8D — diseño e implementación

Estado de la rama `feat/doc-output-capa-8d`. Parte implementado; parte diseñado y
pendiente de autorización (migración) o de un PR posterior (reporte 8D).

## Implementado

### Motor de páginas físicas (PART A/B) — 0 migraciones

- `src/app/dashboard/documents/[documentId]/_components/PaginatedDocument.tsx`: componente
  cliente que reparte el HTML de `.doc-render` en HOJAS físicas (`.doc-page`) tamaño
  Carta/A4. Cada hoja lleva **encabezado, cuerpo, pie con «Página X de Y» y marca de agua**
  propios. Las tablas largas (responsabilidades, actividades, control de cambios) se
  parten por filas repitiendo el `thead` («… (continuación)»). Repagina en `resize` y
  `beforeprint`; fallback en flujo continuo mientras hidrata (SSR/accesible).
- CSS en `globals.css` (`.doc-pages`, `.doc-page--letter/--a4`, `.doc-render__pageno`,
  watermark por hoja, `@media print { break-after: page; @page { size; margin:0 } }`).
- `/copy` usa `PaginatedDocument` → hojas centradas sobre fondo neutro (§B).
- **Decisión (§A7):** el renderer de contenido (`structured-render`) es único y compartido;
  la salida FORMAL (`/copy`, impresión, PDF) se pagina en hojas físicas. La vista canónica
  «Ver documento» se mantiene en flujo continuo para lectura (mismo contenido, sin renderer
  divergente).

### Candado de recuperación al publicar (PART C-a) — 0 migraciones

- `publishVersion` bloquea hacer VIGENTE una versión sustituta si la versión anterior tiene
  copias **físicas (impresas)** en estado `active`/`pending_recovery` (§C1/§C2/§C7). Las
  copias digitales/PDF no bloquean (no retornables) y quedan «Reemplazadas» al superar la
  versión. Desbloqueo: registrar la recuperación (botón existente).

## Diseñado — pendiente de autorización

### PART C-b/c — recuperación completa + excepción (requiere UNA migración aditiva)

Columnas aditivas en `document_controlled_copies` (0 DROP; NULLables; RLS/CHECK/FK por SQL
complementario, como el resto del esquema):

- `recovered_at TIMESTAMPTZ NULL`
- `recovered_by UUID NULL` (FK a users)
- `confirmed_by UUID NULL` (recibida/confirmada por)
- `disposition TEXT NULL` (`destroyed | archived_obsolete | replaced | returned | other`)
- `replaced_by_copy_id UUID NULL` (auto-FK a la copia sustituta, §C5)
- `recovery_notes TEXT NULL`

Para la EXCEPCIÓN con permiso elevado (§C6): tabla nueva `document_publish_exceptions`
(`id, organization_id, document_id, version_id, actor_user_id, justification, waived_copies
JSONB, created_at`) + un permiso/capacidad por encima de `isAdmin` (hoy no existe sistema de
capacidades). `publishVersion` aceptaría un parámetro de excepción que registra el evento y
omite el candado sólo con justificación y permiso.

Formulario de recuperación (§C4): Folio · Fecha · Recuperada por · Confirmada por ·
Disposición · Observaciones; extiende `updateControlledCopy`/`updateCopyAction` para
persistir actor/fecha/disposición/confirmación/reemplazo (hoy solo cambian `status`,
`closedAt`, `notes`). Etiquetas de estado ya existen (`COPY_STATUS_LABEL`).

### PART D — reporte formal CAPA 8D (0 migraciones si es presentación)

Nueva ruta `capa/[capaId]/report` que consume `getCapaDetail` (+ `QualityAnalysis` ligado)
y renderiza D0-D8 con el motor de páginas (`PaginatedDocument`):

- **D0** origen/apertura · **D1** equipo (mapeo: responsable + reportó + creado por; equipo
  formal requiere modelo nuevo `CapaTeamMember` si se exige roster estricto) · **D2** 5W2H
  (`problemWhat/Where/When/...`) · **D3** contención (`CapaImmediateAction`) · **D4** causa
  raíz (`CapaRootCauseAnalysis` + `CapaWhyStep` + Ishikawa ligado; ocurrencia-vs-escape
  requiere campo nuevo) · **D5** correctivas (`CapaAction` corrective) · **D6** implementación
  - validación (`CapaAction` + `CapaEffectivenessReview`) · **D7** prevención (acciones
    preventivas/`document_change`) · **D8** cierre (`closureSummary`, `closedAt`, `closedBy`).
- **Traducciones (§D13)**: faltan mapas ES para `CAPA_HISTORY_EVENTS` y
  `ANALYSIS_HISTORY_EVENTS` (hoy se imprimen crudos), aplicar `QUAL_PROBABILITY_LABEL`
  (`undetermined→Sin determinar`) y un `IMMEDIATE_ACTION_STATUS_LABEL`.
- **§D12**: excluir el historial técnico (`hypothesis_created`, `participant_added`, …) del
  PDF formal; permanece en Panel/auditoría.
- **§D15**: CAPA es expediente por folio (sin versionado v1/v2); no se le fuerza versionado
  documental.
- Requiere schema SOLO si se exige D1 roster o el split ocurrencia/escape en D4; de lo
  contrario es presentación pura.
