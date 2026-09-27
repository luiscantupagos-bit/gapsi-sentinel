# HACCP-006 — Verificación operacional · diseño

Rama `feat/haccp-006-verification` (desde `main` tras integrar HACCP-PROCESS-EXPANSION = 86b287b).
Implementa la **VERIFICACIÓN** del sistema HACCP: convierte una definición en
recurrencia → Task nativa → Record digital → resultado → evidencia → seguimiento.

## Principio

- **Validación** (HACCP-005): demuestra que una medida ES CAPAZ de controlar el peligro.
- **Verificación** (HACCP-006): demuestra que el sistema SE EJECUTA conforme a lo establecido.
  No se mezclan. HACCP-006 **NO** es monitoreo de PCC/PPRO (§42, follow-up
  HACCP-MONITORING-EXECUTION).

## Reutilización (§1/§2 — NO se crea un segundo scheduler)

| Necesidad                  | Se reutiliza                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------- |
| Recurrencia → ocurrencias  | `generateOccurrences` (features/documents/program-execution.ts)                     |
| Frecuencias                | `PROGRAM_FREQUENCIES` (semanal…anual) + `SCHEDULE_TYPES` single/recurring           |
| Idempotencia de ocurrencia | `occurrenceKey` + unique(org, verification_logical_id, occurrence_key)              |
| Task nativa                | `createTask({ sourceType:'haccp_verification', sourceId })`, idempotente por origen |
| Record                     | `createRecord({ documentVersionId?, sourceType, clientGeneratedId })` (DOC-004)     |
| Gantt                      | `GanttChart` (movido a dashboard/\_components, genérico)                            |
| Contexto PCC/PPRO          | `getControlMeasures` (.pcc/.ppro, criticalLimit, actionCriterion, needsReview)      |
| Clon por versión           | `createHaccpVersion` (child rows)                                                   |

Solo se agregan 2 tablas para el metadata HACCP: definiciones y ocurrencias.

## Modelo

- **`haccp_verification_definitions`** (version-owned): `verification_logical_id` estable (§5);
  `scope_type` (plan|pcc|ppro|hazard|control_measure, §4); enlaces a control/peligro/etapa;
  título/propósito/método; responsable; `frequency_type` + `frequency_config` (interval/endDate,
  mapea al motor de Programas); `record_strategy` (none|latest_published|pinned_version, §10) +
  formato requerido (+ versión fija); `evidence_required`; `status` (active|paused|archived, §23).
- **`haccp_verification_occurrences`** (histórico por identidad lógica, NO re-clonado por versión):
  `occurrence_key` idempotente; `due_at`; `task_id` (Task nativa); `record_id` +
  `record_document_version_id` (versión EXACTA usada, §11); `result` (conforme|no_conforme|
  no_concluyente, §16) + `conclusion`; `status` (scheduled|superseded|cancelled).

## Ejecución (§14-§21)

`materializeVerificationSchedule(orgId, userId, planId)` expande las definiciones ACTIVAS de la
versión VIGENTE con `generateOccurrences` (horizonte 12 meses si no hay endDate), hace upsert
idempotente de cada ocurrencia y crea la Task nativa. `createVerificationRecord` crea el Record
según la estrategia (latest_published = versión publicada al ejecutar; pinned_version = versión
fija; §10.1/§10.2), idempotente por `clientGeneratedId=occurrenceId`. `recordVerificationResult`
captura el resultado técnico y cierra: conclusión obligatoria para no conforme/no concluyente
(§17); no permite cerrar con el Record en borrador (§19). El estado de la Task es independiente
del resultado (§16).

## Versionado (§36-§41)

Las definiciones son version-owned; `createHaccpVersion` las clona preservando
`verification_logical_id` (§37). Las ocurrencias siguen la identidad lógica (no se re-clonan, son
histórico §38). Como solo se materializa la versión VIGENTE, al publicar v2 la v1 deja de generar
nuevas verificaciones (§40) y re-materializar es idempotente por `occurrence_key` (§41) — no
duplica ni toca el histórico (§Q). Publicado = inmutable (§36).

## UI

Tab **«Verificación»** (11.º; `HACCP_FUTURE_TABS` queda vacío). Cards (activas/próximas/vencidas/
completadas/no conformes). Sub-vistas Programa / Próximas / Vencidas / Completadas / Resultados
(§24/§25). Formulario de definición (actividad, propósito, relacionado con PCC/PPRO con contexto
read-only §27, método, responsable, frecuencia, inicio, formato + estrategia de versión, evidencia
§26). «Generar programa de verificación» materializa. Cada ocurrencia enlaza a su Task y Record;
ejecución con «Crear registro» + resultado. **Gantt** reutilizable (cronograma, hoy, click→Task,
§31-33). Aviso «Control en revisión» si el control tiene needs_review (§30). Vista reutilizable
read-only `HaccpVerificationView` (HACCP-007, print-safe, §48). Publicado read-only; sin UUID.

## Migración

`20261001000000_haccp_006_verification` (aditiva; **0 DROP TABLE / 0 DROP COLUMN**): 2 tablas con
CHECK (scope/status/strategy/result), RLS `*_tenant_isolation` + grants a `gapsi_app` + FKs
tenant-safe (versión RESTRICT; responsable SET NULL). Además: `document_versions.form_schema` NO se
toca; se extiende `createRecord` con `documentVersionId` opcional (pinned) y `RECORD_SOURCE_TYPES`
con `haccp_verification` (aditivo).

## Seed

`PL-HACCP-001`: 1 definición «Revisión de registros de control operacional» (mensual, activa, sin
formato configurado §47) + 1 ocurrencia PRÓXIMA con su Task nativa (`TSK-2026-HV01`). Sin
resultados inventados (§46). Idempotente.

## Fuera de alcance

HACCP-007 (PDF), HACCP-CONTROL-TREE-P1-P8, HACCP-MONITORING-EXECUTION (monitoreo de PCC/PPRO §42/
§43), integración no-conforme→Finding/CAPA (existe la infraestructura, no se conecta §20),
notificaciones dedicadas de verificación (el procesador actual es program-scoped §35, follow-up),
RECORD-AMENDMENT, RECORD-EVIDENCE-UPLOAD.
