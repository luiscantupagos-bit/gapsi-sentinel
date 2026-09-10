# Document Engine de C3 Sentinel (DOC-001)

Motor de plantillas documentales **estructuradas por tipo**. Convierte el módulo
de documentos de un editor genérico en un motor donde cada tipo (Procedimiento,
Política, Programa, …) captura **datos** y una capa de presentación los
transforma en un documento normalizado.

## 1. Principio de dos capas

Un documento nativo tiene:

- **(A) Datos estructurados** — la fuente de verdad: objetivo, alcance,
  responsabilidades, actividades, etc., más la identificación (tipo, área,
  código, versión, nombre, fechas) que vive en la entidad.
- **(B) Presentación** — un _renderer_ determinista que transforma los datos en
  un documento visual estandarizado (HTML hoy; base para PDF/DOCX).

**Nunca** se guarda solo HTML como fuente de verdad de un documento estructurado.
El HTML se deriva de los datos (`contentHtml` es caché de presentación).

## 2. Piezas (todas puras salvo el servidor)

| Módulo                                          | Responsabilidad                                                                                                                                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/features/documents/template-registry.ts`   | Registro central por tipo: prefijo de código, periodo de revisión, portada y **esquema** de secciones (campos + repetibles). Fuente única; el editor, el renderer, el validador y el generador de código lo consumen.                                                          |
| `src/features/documents/structured-content.ts`  | Modelo `StructuredContent` (`schemaVersion`, `templateType`, `fields`, `repeatables`) + saneo _allowlist_ + validación de obligatorios. **Puro y seguro para cliente** (sin builtins de Node).                                                                                 |
| `src/features/documents/structured-checksum.ts` | `structuredChecksum` / `structuredByteSize` (usan `node:crypto`/`Buffer`). **Solo servidor.**                                                                                                                                                                                  |
| `src/features/documents/code.ts`                | Formato y validación del código `[TIPO]-[ÁREA]-[###]` (§5/§30).                                                                                                                                                                                                                |
| `src/features/documents/dates.ts`               | Cálculo de la próxima revisión = emisión + periodo (§8).                                                                                                                                                                                                                       |
| `src/features/documents/structured-render.ts`   | Renderer normalizado: encabezado con marca de la organización + identificación + cuerpo por secciones (§23), pie de confidencialidad con atribución C3, tema documental y control de cambios (DOC-UX-001, ver `DOCUMENT-PRESENTATION.md`). Seguro (escapa HTML), determinista. |
| `src/server/documents.ts` (DOC-001)             | `createStructuredDocument`, `getStructuredContent`, `saveStructuredContent`, `proposeDocumentCode`, `listDocumentAreas` + reserva atómica del consecutivo.                                                                                                                     |

## 3. Registro de plantillas

`DocumentTemplateDefinition { type, label, description, icon, codePrefix,
defaultReviewMonths, cover, supportsStructuredEditor, supportsRichText, sections }`.

Cada sección es de campos (`kind: 'fields'`) o un bloque **repetible**
(`kind: 'repeatable'`, con `autoNumber` opcional). Los campos declaran
`key/label/kind/required/placeholder/maxLength`. **No se hardcodea la lógica por
tipo en cada página**: un solo editor y un solo renderer guiados por el esquema.

Prefijos (§5): Procedimiento `PR`, Política `PO`, Manual `MA`, Instructivo `IN`,
Programa `PG`, Plan `PL`, Formato `FO`, Especificación `ES`, Matriz `MX`,
Documento libre `DO`. El "Documento libre" no es estructurado: conserva el editor
enriquecido (TASK-005).

## 4. Código automático `[TIPO]-[ÁREA]-[###]`

- El **prefijo** viene del registro; el **área** es un código corto (catálogo de
  calidad `quality_catalog_values kind='area'` o escrito por el usuario); el
  **consecutivo** lo reserva el servidor de forma atómica.
- `document_code_counters (organization_id, code_prefix, area_code, last_seq)` con
  `INSERT … ON CONFLICT DO UPDATE … RETURNING` — sin colisiones concurrentes.
- El sistema **propone** el código (vista previa no autoritativa); el usuario puede
  **personalizarlo** antes de publicar. La unicidad por organización la garantiza
  `documents_organization_id_code_key`.

## 5. Fechas de control (§8)

- Emisión: por defecto la fecha de publicación/aprobación; ajustable con permiso.
- Próxima revisión = emisión + periodo (6/12/24 meses, personalizado o sin fecha
  fija). El **valor por defecto por tipo** lo aporta el registro (no está
  hardcodeado): 12 meses salvo Manual (24) y Documento libre (sin fecha).

## 6. Versionado, workflow y control (reutilizados)

- Versión inicial **v1.0**; menor/mayor con `versioning.ts` (el usuario no escribe
  la etiqueta). `structured_content` se **arrastra** a cada versión nueva.
- Los documentos estructurados entran al **mismo** flujo de TASK-006
  (revisión→aprobación→publicación). Al enviar a revisión se validan los campos
  **obligatorios** del tipo en servidor.
- Una versión **publicada** sella su `structured_content` (trigger
  `trg_docversion_published` / `fn_guard_published_docversion`).

## 7. Modelo de datos

- `document_versions.structured_content JSONB` — fuente de verdad estructurada
  (además de `content_json` del editor libre). `content_schema_version`
  obligatorio (=1). `content_html` = render derivado (caché de presentación).
- `document_code_counters` — contador del consecutivo del código.
- Sin cambios destructivos: la migración `20260909000000_document_engine` solo
  agrega columna y tabla (0 DROP), con RLS y grants estándar.

## 8. Detección de tipo

- Estructurado: `origin='internal'` y `isStructuredType(documentType)` → editor y
  vista previa estructurados.
- Libre: `documentType='other'` → editor enriquecido (TASK-005).
- Externo: `origin='external'` → registro sin transcripción (tarjeta con acciones
  reales; conversión "Próximamente").
- Los documentos históricos siguen abriéndose sin migración de datos.

## 8b. Programa ejecutable (DOC-003)

El tipo **Programa** ya **no** es una tabla genérica de actividades: tiene un
**editor especializado** (`_editor/ProgramActivitiesEditor.tsx`) y un **modelo de
ejecución** propio.

- **Definición** en `structured_content.program` (actividades con `activityId`
  estable, programación única/rango/recurrente, evidencia, aviso).
- **Ejecución** materializada al publicar en `program_activity_instances` +
  **Tareas nativas** (no en el JSON); vista **Documento | Ejecución**.
- **Relación entre versiones**: la identidad estable `activityId` permite reconciliar
  la ejecución al publicar una versión nueva (continuidad / sustitución), conservando
  el histórico por versión.

Detalle en [`EXECUTABLE-PROGRAMS.md`](EXECUTABLE-PROGRAMS.md) y
[`../tasks/DOC-003-IMPLEMENTATION-NOTES.md`](../tasks/DOC-003-IMPLEMENTATION-NOTES.md).

## 9. Roadmap (§43)

| Tarea                        | Alcance                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOC-002 ✅ (implementado)    | Referencias `@` y formatos `//` — ver `SMART-REFERENCES.md`.                                                                                                  |
| DOC-UX-001 ✅ (implementado) | Presentación documental (header/pie/tema/control de cambios) y biblioteca por áreas — ver `DOCUMENT-PRESENTATION.md` y `DOCUMENT-LIBRARY.md`.                 |
| DOC-UX-002 ✅ (implementado) | Toolbar, copias controladas (impresión/PDF con folio + watermark), diseños documentales y entitlement de atribución C3 — ver `DOCUMENT-PRESENTATION.md` §6-9. |
| DOC-003 ✅ (implementado)    | Programas ejecutables: ocurrencias → tareas nativas, notificaciones internas y reconciliación entre versiones — ver `EXECUTABLE-PROGRAMS.md`.                 |
| DOC-004                      | Diseñador de formatos/registros.                                                                                                                              |
| DOC-005                      | Importación inteligente (transcripción de documentos externos).                                                                                               |
| DOC-006                      | Asistencia con IA.                                                                                                                                            |
| DOC-007                      | Integración con Microsoft 365 / Google.                                                                                                                       |

Estas capacidades **no** están implementadas en DOC-001; el motor deja la base
preparada (esquema versionado, renderer reutilizable, secciones futuras del
procedimiento como marcadores de solo lectura).
