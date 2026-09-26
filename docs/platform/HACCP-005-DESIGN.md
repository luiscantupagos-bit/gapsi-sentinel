# HACCP-005 — Validación de medidas de control · diseño

Rama `feat/haccp-005-validation` (desde `main` tras integrar HACCP-004 = 8015c86).
Registra la **VALIDACIÓN** de las medidas de control de peligros significativos: la evidencia de
que la medida **ES CAPAZ** de controlar el peligro al nivel requerido (antes de operar / al
establecer el control). Es **distinta de la verificación** (HACCP-006), que confirma que el
control se ejecuta según lo planeado. NO implementa verificación periódica, calendarios, Tasks,
Gantt, registros de monitoreo ni DOC-004.

## Modelo

- **`haccp_control_validations`** (version-owned): validación de una medida de control.
  - `validation_logical_id` = identidad LÓGICA estable entre versiones; el `id` de fila cambia al
    clonar una versión, la identidad lógica persiste (patrón `activityId`).
  - `control_measure_logical_id` + `hazard_logical_id` = medida/peligro validado (contexto tomado
    de `haccp_control_assessments`).
  - **Status del workflow** separado del **resultado técnico** (§6):
    `status` ∈ pending / in_progress / satisfactory / unsatisfactory / expired / needs_review;
    `result` ∈ satisfactory / unsatisfactory / inconclusive (nullable).
  - Contenido técnico: `objective`, `scope`, `method_type` + `method_description`,
    `evidence_summary`, `technical_basis`, `acceptance_criteria`, `conclusion`.
  - Evidencia documental (referencia EXACTA a versión): `evidence_document_id` +
    `evidence_document_version_id` (reutiliza el motor documental; **NO crea otro storage** — el
    archivo adjunto se enlaza vía `file_relations` con `entity_type='haccp_control_validation'`).
  - Actor y revisión: `performed_by_user_id` **o** `performed_by_external_name` (laboratorio /
    consultor externo, §23), `performed_at`, `reviewed_by_user_id`, `reviewed_at`,
    `next_validation_at` (fecha de próxima validación / revalidación).
  - Único por `(plan_version_id, control_measure_logical_id)` — una validación vigente por medida
    dentro de una versión. `@@unique([id, organization_id])` para FKs tenant-safe.

## Metodología (helpers puros)

`features/haccp/haccp-validation.ts` — resolvers PUROS y CENTRALIZADOS, sin Prisma:

- `HACCP_VALIDATION_STATUSES` / `_RESULTS` / `_METHODS` con sus etiquetas en español.
- `validateSatisfactory(check)` (§13): marcar **Satisfactoria** exige objetivo, método,
  evidencia **o** fundamento técnico, criterio de aceptación, conclusión, fecha y actor
  (interno o externo). Devuelve la lista de errores (vacía = puede marcarse satisfactoria).
- `deriveValidationStatus(result, check)`: `satisfactory` solo si el resultado es satisfactorio
  **y** cumple los requisitos; `unsatisfactory` → `unsatisfactory`; `inconclusive` →
  `needs_review`; en otro caso `in_progress`. El status **no** se captura a mano: se deriva en el
  servidor.
- `validationCompleteness` (§34): requeridas / satisfactorias / pendientes / revisión.

## Reglas

- **Solo medidas de peligros significativos clasificados PCC/PPRO** requieren validación
  (`VALIDATABLE = {pcc, ppro}`); los PPR generales se consultan pero no se obligan.
- **Pendientes** = controles PCC/PPRO sin validación satisfactoria vigente.
- **needs_review** (§H/§I/§27): resultado no satisfactorio o no concluyente, validación vencida,
  o la evaluación de control subyacente desapareció/cambió → «Revisión requerida» (NO se borra).
- **Requisitos de Satisfactoria validados en SERVIDOR** (`saveValidation`), no solo en cliente
  (AGENTS §2); intento de marcar satisfactoria sin requisitos → `HaccpValidationError`.
- **Versionado** (§M/§N/§P): una nueva versión clona las validaciones preservando
  `validation_logical_id`; publicado inmutable; el histórico de la versión previa queda intacto.
- **No inventar** evidencia, reducciones logarítmicas, resultados microbiológicos ni fundamentos
  técnicos sin fuente (§46). Lo no disponible queda **pendiente / placeholder**.

## UI

- Tab **«Validación»** (10.º tab, sustituye a «Próximamente»). Cards de completitud (Por validar
  / Satisfactorias / Pendientes / Revisión requerida). Nota que aclara validación ≠ verificación.
- Sub-vistas: **Pendientes** (medidas sin validación satisfactoria, con formulario inline) /
  **En proceso** / **Satisfactorias** / **Revisión requerida** / **Todas**.
- Formulario con **contexto del control visible pero no editable** (peligro, clasificación,
  medida, límite crítico / criterio de acción), método (select), documento de evidencia Sentinel
  (select), resultado (select) y próxima validación.
- Vista reutilizable read-only `HaccpValidationView` (workspace + futuro PDF HACCP-007,
  print-safe): estado, resultado, needs_review y todos los campos, con enlace al documento de
  evidencia. Publicado o sin permiso → read-only (gate `canEdit && version.editable`).

## Migración

`20260928000000_haccp_control_validation` (aditiva; **0 DROP TABLE / 0 DROP COLUMN**): 1 tabla con
índices, CHECKs de `status`/`result`, FKs tenant-safe (versión composite RESTRICT; actor/revisor
→ `users` SET NULL), política RLS `haccp_control_validations_tenant_isolation` y grants a
`gapsi_app`. Verificada aplicada (tabla + RLS = 1).

## Seed

`PL-HACCP-001`: la medida **PPRO de Salmonella** aparece **pendiente de validación** de forma
natural (no se inyecta evidencia falsa, §46). El seed permanece idempotente.

## Fuera de alcance

Verificación periódica y calendarios (HACCP-006), registros de monitoreo, Tasks, Gantt, DOC-004
(Records) y la salida documental del plan (HACCP-007). El follow-up
`HACCP-CONTROL-TREE-P1-P8` (del árbol de decisión) es independiente.
