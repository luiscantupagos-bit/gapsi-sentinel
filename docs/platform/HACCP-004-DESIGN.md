# HACCP-004 — Selección de medidas de control (PCC/PPRO/PPR) · diseño

Rama `feat/haccp-004-control-measures` (desde `main` tras integrar HACCP-003 = 730adda).
Evalúa las MEDIDAS DE CONTROL de los peligros SIGNIFICATIVOS mediante un árbol de decisión y
las clasifica en PPR / PPRO / PCC, definiendo el Plan de Control. NO implementa monitoreo
operativo, Tasks, Gantt, DOC-004 ni validación (HACCP-005).

## Modelo

- **`haccp_control_assessments`** (version-owned): evaluación de un peligro. `control_measure_
logical_id` = identidad LÓGICA estable entre versiones; `hazard_logical_id` = peligro
  evaluado. `method_key`/`method_version` + `answers` (camino recorrido) son **SNAPSHOT** de la
  metodología (§32). `classification` (ppr/ppro/pcc/other/review_required),
  `classification_source` (calculated/override), justification/override_reason. Único por
  `(plan_version_id, hazard_logical_id)`.
- **`haccp_control_plans`** (version-owned): plan de control de una evaluación
  (`control_measure_logical_id`). Campos según clasificación (§12): PCC → `critical_limit` +
  monitoreo; PPRO → `action_criterion` + monitoreo; PPR → medida/registro. No se fuerzan todos.

## Metodología (árbol de decisión)

`features/haccp/haccp-control.ts` — resolver PURO y CENTRALIZADO. Árbol por defecto (ISO 22000 /
Codex-flavored, DEFENDIBLE, reemplazable por el P1..P8 real de la organización sin tocar el
resolver): P1 (¿medida específica vs PPR general?) → P2 (¿límite crítico medible?) → P3 (¿etapa
posterior controla?). Respuestas Sí/No/N.A. (§6). Resultado: PPR/PPRO/PCC/revisión requerida.
El camino de respuestas se guarda para **explicabilidad/auditoría** (§21). Override manual con
justificación (§9).

## Reglas

- **Solo peligros significativos** entran a pendientes (§1); los no significativos se consultan
  pero no se obligan.
- **needs_review** (§27/§28): si el peligro dejó de ser significativo o desapareció, su
  evaluación se marca «Revisión requerida» (NO se borra). Un nuevo peligro significativo aparece
  como Pendiente (§29).
- **Completitud del plan** distinta de «evaluado» (§23): un peligro puede estar clasificado con
  plan incompleto. `isControlPlanComplete` valida por clasificación.
- **Versionado** (§30/§31): nueva versión clona evaluaciones + planes preservando
  `control_measure_logical_id`/`hazard_logical_id`; la MP se remapea. Publicado inmutable;
  histórico intacto.
- **No inventar** límites críticos ni criterios técnicos sin fuente (§33/§34). Registro de
  monitoreo operativo: placeholder «No configurado» (DOC-004 futuro, §35/§36).

## UI

- Tab **«Medidas de control»** con sub-vistas Pendientes / Evaluados / PCC / PPRO / PPR y cards
  de completitud (§24). Wizard paso a paso (solo las preguntas del camino, progreso, resultado
  explicable) → guarda la evaluación. Editor del plan de control con los campos según
  clasificación. Vista reutilizable read-only `HaccpControlMeasuresView` (workspace + futuro
  PDF HACCP-007, print-safe). Publicado read-only; fuentes/etapas clickeables.

## Migración

`20260927000000_haccp_control_measures` (aditiva; 0 DROP): 2 tablas con RLS + políticas tenant +
grants a `gapsi_app` + FKs tenant-safe.

## Seed

`PL-HACCP-001`: 1 evaluación completa (Salmonella en recepción → **PPRO** con su plan) y el
resto de peligros significativos **pendientes** (§43/§44). Sin límites críticos inventados.

## Fuera de alcance

HACCP-005 (validación de medidas), verificación periódica, monitoreo operativo, Tasks, Gantt.
DOC-004 (Records) vinculará luego formatos/RecordDefinition a cada PCC/PPRO. La salida documental
del plan de control (HaccpControlMeasuresView en PDF) es HACCP-007.
