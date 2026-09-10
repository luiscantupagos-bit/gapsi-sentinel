# DOC-003 — Programas ejecutables · notas de implementación

Convierte los **Programas** documentales en ejecución operativa (ocurrencias →
tareas nativas), con notificaciones internas transversales y reconciliación entre
versiones. Ver la guía funcional en
[`docs/documents/EXECUTABLE-PROGRAMS.md`](../documents/EXECUTABLE-PROGRAMS.md) y las
notificaciones en [`docs/architecture/NOTIFICATIONS.md`](../architecture/NOTIFICATIONS.md).

## Migraciones

- `20260914000000_program_execution` — tabla `program_activity_instances`
  (ocurrencia materializada: versión, `activityId`, `occurrenceKey`, fechas,
  responsable, evidencia, `notifyBeforeDays`, `status`, `taskId`). Únicos:
  `(documentVersionId, activityId, occurrenceKey)`. Índices por `documentId` y
  `organizationId`. FK de organización `ON DELETE RESTRICT`; RLS
  (`_tenant_isolation`); grants a `gapsi_app`.
- `20260915000000_notifications` — tabla `notification_deliveries` (transversal:
  `source_type`/`source_id` genéricos, `notification_type`, `scheduled_for`,
  `delivered_at`, `read_at`, `payload`). Único de dedup
  `(organizationId, userId, sourceType, sourceId, notificationType, scheduledFor)`;
  índices `(org,user,readAt)` y `(sourceType,sourceId)`. FK org RESTRICT; RLS; grants.

Ambas migraciones: **0 DROP TABLE / 0 DROP COLUMN**. Rebuild-from-empty + seed +
seed 2× verificado.

## Decisiones

- **Documento ≠ ejecución**: la ejecución NO vive en `structured_content`; se
  materializa en `program_activity_instances`. El JSON es la definición aprobada.
- **`activityId` estable** como identidad para reordenar/versionar/reconciliar. El
  saneo es determinista (no acuña); el servidor acuña con `ensureActivityIds`.
- **Tarea nativa como fuente de verdad operativa**: no se duplica el motor de tareas;
  el estado visible se **deriva** (`deriveExecutionStatus`).
- **Reconciliación por continuidad**: la versión nueva es dueña de la ejecución
  futura; las ocurrencias equivalentes **adoptan** la tarea previa (sin duplicar);
  las cambiadas/eliminadas se **sustituyen** (`superseded` + tarea `cancelled`). El
  histórico es inmutable por versión. Ver la tabla de reglas en la guía funcional.
- **Estado `superseded` de la Tarea**: el modelo de Tareas no lo tiene; se usa el
  terminal `cancelled` con evento `task.superseded`, mientras la instancia refleja
  `superseded`.
- **Notificaciones internas MVP**: sin canal externo; `delivered_at` al crearse;
  `now` inyectable; dedup en DB con `createMany({ skipDuplicates })`.

## Constraints / integridad

- Únicos de idempotencia (instancia y tarea) → activación y reconciliación
  idempotentes; concurrencia protegida por la BD.
- RLS y aislamiento por organización en ambas tablas nuevas.
- Tarea creada **después** de la instancia (sin huérfanas).

## Servicios (servidor)

- `src/server/programs.ts` — `validateProgramForActivation`, `activateProgram`
  (con `carryTaskByKey`), `planProgramReconciliation`, `applyProgramReconciliation`,
  `activateProgramWithReconciliation`, `supersedeFutureOccurrences`,
  `getProgramInstances`, `getProgramExecution`, `getTaskProgramOrigin`.
- `src/server/notifications.ts` — `processProgramNotifications`,
  `listNotificationsForUser`, `countUnreadNotifications`, `markNotificationRead`.
- `src/server/document-workflow.ts` — `publishVersion` valida + activa + reconcilia;
  `obsoleteVersion` sustituye futuras.
- Motor puro: `program-execution.ts` (ocurrencias, `planReconciliation`),
  `program-status.ts` (derivación/resumen/progreso), `notifications/schedule.ts`
  (planificación de avisos).

## Rutas / UI

- `/dashboard/documents/[documentId]` — vista canónica con pestañas
  **Documento | Ejecución** (`ProgramTabs`).
- `/dashboard/documents/[documentId]/execution` — KPIs, progreso, tabla, filtros.
- `_editor/ProgramActivitiesEditor.tsx` — editor especializado (integrado en
  `StructuredEditor`).
- `/dashboard/tasks/[taskId]` — bloque **Origen y trazabilidad** (Task→Programa).

## Tests

- Unitarios: `documents-program-execution` (ocurrencias/recurrencia/EOM/bisiesto/
  clave/validación), `documents-program-status` (derivación/resumen/progreso),
  `documents-program-reconciliation` (carry/supersede/histórico),
  `notifications-schedule` (planificación/anticipación).
- DB: `db/program-execution` (activación/idempotencia/tenant), `db/program-execution-view`
  (vista/estado/origen), `db/program-reconciliation` (H-U, concurrencia, obsoleto,
  histórico por versión, supresión de avisos), `db/notifications` (dedup/RLS).

## Limitaciones / futuro

- Scheduler productivo (cron/worker) para el processor de avisos: pendiente. Hoy es
  manual/determinista.
- Canales externos (email/SMS/WhatsApp/push), tiempo real, centro de notificaciones
  UI: pendientes (backend listo).
- Exportación PDF nativa, offline, DOC-004 (registros): fuera de alcance.
