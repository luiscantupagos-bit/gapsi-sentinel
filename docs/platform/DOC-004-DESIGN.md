# DOC-004 — Registros digitales · diseño

Rama `feat/doc-004-digital-records` (desde `main` tras integrar HACCP-005 = f352db8).
Convierte los **Formatos** de Sentinel en formularios operativos digitales que producen
**REGISTROS** trazables. Principio: el FORMATO es la definición controlada; el REGISTRO es una
instancia llenada usando una **versión exacta** de ese formato. Nunca se edita el documento
histórico para representar un registro capturado.

## Reutilización (§2/§3) — no se crea otro sistema documental

- El tipo `form` (Formato) y el vocabulario `record` (`file_relations.entity_type`) YA existen.
  El registro de plantillas decía literalmente que «el diseñador de campos llega en DOC-004».
- El **esquema de formulario** vive en una **columna nueva `form_schema` (JSONB) de
  `document_versions`** (aditiva; §55 «puede vivir en DocumentVersion»), no en una tabla aparte.
  Pertenece a la versión EXACTA; al publicar queda sellado (solo se edita el borrador).
- La evidencia (foto/archivo) reutiliza `stored_files` + `file_relations`
  (`entity_type='record'`); **no se crea storage nuevo** (§28).
- Folios con el idiom atómico `INSERT … ON CONFLICT … RETURNING` (como `nextPlanCode`/
  `reserveDocumentCodeSeq`). Auditoría en `audit_log` + marcas de tiempo por transición.

## Modelo

- **`record_instances`** (§6): `record_number` (folio humano REG-AAAA-######, §7),
  `document_id` + `document_version_id` (FK tenant-safe a la versión EXACTA, RESTRICT, §35),
  SNAPSHOT mínimo `form_code`/`form_title`/`form_version_label` (§41), `status`, `data` (JSONB
  validado, §9), `assigned_to_user_id`, `site_id`, `source_type`/`source_id` (origen, §32),
  `client_generated_id` (único por org, idempotencia offline, §40), y marcas de tiempo + actor
  por transición (created/started/submitted/reviewed/closed). `@@unique([id, organization_id])`.
- **`record_code_counters`** (org + año): consecutivo atómico de folios.
- **`document_versions.form_schema`** (nueva columna JSONB): esquema del formulario.

## Esquema de formulario (helpers PUROS)

`features/records/form-schema.ts` — sin BD. `FormSchema` = secciones (algunas repetibles =
tablas, §11) con campos tipados. Cada campo tiene un **id lógico estable** (§12; no se usa el
label como identidad). Tipos (§10): texto/textarea/número/decimal/fecha/fecha-hora/hora/Sí-No/
selección única/múltiple/casilla/firma/foto/archivo/usuario/lote. Propiedades: `required`,
opciones, min/max, decimales, min/maxLength, patrón acotado, unidad, **visibilidad condicional**
(`visibleWhen`, §15) y **calculados** (`calc`: sum/avg/min/max/percentage, arquitectura mínima,
§13). Funciones: `sanitizeFormSchema` (allowlist), `validateFormSchema` (diseño),
`sanitizeRecordData`/`validateRecordData` (obligatorios/tipos/rango/opciones/condicionales/filas,
§14/§44), `isFieldVisible`, `recordCompleteness`.

`features/records/record-state.ts` — estados del REGISTRO (draft/in_progress/submitted/reviewed/
closed/cancelled, §8) separados del resultado; transiciones (`canTransition`); origen; folio.

## Servidor

`server/records.ts` (`withOrgContext` + RLS): `saveFormSchema` (diseñador; solo versión
editable tipo `form`, §5/§20), `getFormDesigner`, `listAvailableForms` (formatos publicados con
formulario), `createRecord` (toma la versión PUBLICADA vigente, folio atómico, **idempotente por
client_generated_id**, §40), `getRecords`/`getRecord`, `saveRecordData` (autosave/borrador),
`submitRecord` (valida en servidor, §14/§26), `reviewRecord`/`closeRecord`/`cancelRecord`/
`reopenRecord` (workflow con permisos; revisar/cerrar = owner/admin). Validación de obligatorios
SIEMPRE en servidor (§14). Cerrado = inmutable (§36).

## UI

- **Diseñador** (`/dashboard/documents/[id]/form`, §17-19): agregar/editar/eliminar/reordenar/
  duplicar secciones y campos, propiedades por tipo, visibilidad condicional, tabla repetible y
  **vista previa**. Solo sobre la versión BORRADOR; publicado = solo lectura.
- **Registros** en el menú de Cumplimiento (§21). Índice `/dashboard/records` con filtros (Mis
  registros / En proceso / Enviados / Cerrados / Todos) y columnas folio/formato/versión/estado/
  fecha/responsable/origen/sitio (§22). Alta desde un formato vigente (§23).
- **Captura** `/dashboard/records/[id]` (§24-26): render por esquema, tablet-first, campos y
  targets grandes (§42), tablas repetibles con agregar/eliminar/duplicar fila (§44), visibilidad
  condicional, guardar borrador + enviar. `RecordReadOnlyView` reutilizable (print/PDF futuro,
  §43). Cerrado/enviado = solo lectura. Sin UUID visible (§38).

## Preparación de integración (sin implementar aún)

- `source_type`/`source_id` dejan lista la integración HACCP (PCC/PPRO monitoring), Programa y
  Tarea (§32/§33). El registro de monitoreo de un plan de control HACCP podrá seleccionar un
  Formato vigente (§34) en un follow-up; DOC-004 no lo conecta automáticamente.
- `client_generated_id` deja lista la idempotencia para PWA/offline (§39); el sync offline
  completo es futuro (PLATFORM-005).

## Migración

`20260929000000_doc_004_digital_records` (aditiva; **0 DROP TABLE / 0 DROP COLUMN**):
`ALTER TABLE document_versions ADD COLUMN form_schema`, `record_instances`, `record_code_counters`,
con índices, CHECK de estado, FKs tenant-safe (versión composite RESTRICT; sitio SET NULL; actores
→ users SET NULL), RLS `*_tenant_isolation` y grants a `gapsi_app`.

## Seed

`FR-CA-001` «Registro de inspección de recepción» (Formato publicado con formulario: campo
condicional Rechazado→Motivo (§49) y tabla repetible «Muestras inspeccionadas» (§50)) + 1
registro **en proceso** `REG-2026-000001` (datos parciales; sin dictamen inventado, §51).
Idempotente.

## Fuera de alcance

HACCP-006 (verificación), conexión automática de monitoreo HACCP↔Formato, firma gráfica dibujada
(se usa confirmación por usuario autenticado, §47), sync offline completo, carga de binario de
evidencia (el vocabulario `file_relations`/`record` queda listo — follow-up **RECORD-EVIDENCE-
UPLOAD**), y la corrección formal de un registro cerrado (follow-up **RECORD-AMENDMENT**, §38).
