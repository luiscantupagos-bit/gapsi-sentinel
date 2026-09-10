# Programas ejecutables (DOC-003) — nota parcial

> Documento en construcción (DOC-003 por sub-fases). La versión final llega en la
> fase 4. Aquí el estado hasta la sub-fase 3.

## Principio

**Documento = definición aprobada. Ejecución = estado operativo real.** No se
mezclan. El Programa formal (render documental) solo muestra lo aprobado; la
ejecución (tareas, completadas, vencidas) vive aparte.

## Motor (puro)

`src/features/documents/program-execution.ts`: actividades con `activityId`
estable, programación única/rango/recurrente (semanal…anual), generación de
ocurrencias con fin de mes/bisiesto/horizonte por periodo, `occurrenceKey`
determinista, validación para publicar, `scheduleLabel`, `ensureActivityIds`.

## Activación (al publicar)

`src/server/programs.ts` · `activateProgram`: cada actividad `executionEnabled`
genera ocurrencias materializadas en `program_activity_instances`, cada una
enlazada a una **Tarea nativa** (`sourceType='program_activity'`,
`sourceId=<instance.id>`). Idempotente (unique versión+actividad+ocurrencia); la
tarea se crea tras la instancia (sin huérfanas). Se valida antes de publicar
(`validateProgramForActivation`, incluye responsable miembro del tenant). Borrador
no activa. El `activityId` se acuña server-side al guardar.

## Notificaciones

Infraestructura transversal (`docs/architecture/NOTIFICATIONS.md`):
`notification_deliveries` + `processProgramNotifications(org, now)` genera
due_soon/due_today/overdue con dedup a nivel DB y anticipación `notifyBeforeDays`.

## Vista de Ejecución (§4-16)

Ruta `/dashboard/documents/[documentId]/execution`. Tabs **Documento | Ejecución**.
`getProgramExecution` devuelve las ocurrencias de la versión vigente con **estado
derivado de la Tarea** (`program-status.ts`: Programada/En curso/Completada/
Vencida/Cancelada/Sustituida), responsable (nombre; «Usuario inactivo» si ya no es
miembro), evidencia requerida y enlace **Ver tarea**. Resumen (total/completadas/
pendientes/vencidas/próximas 30 días) + **progreso** (completadas/total, excluye
cancelled/superseded). Filtros MVP (estado/responsable/actividad/rango) y orden por
fecha RAW. Fechas con el formato de la organización. Responsive a tarjetas en
tablet/móvil.

## Navegación Programa ↔ Tarea

- **Programa → Tarea:** «Ver tarea» → `/dashboard/tasks/[taskId]`.
- **Tarea → Programa:** en el detalle de la Tarea (`sourceType='program_activity'`)
  aparece el bloque **Origen** con Programa (enlace al documento), Actividad,
  Ocurrencia y **Ver ejecución** (`getTaskProgramOrigin`). No se muestran UUIDs.

## Editor especializado

`_editor/ProgramActivitiesEditor.tsx` (integrado en `StructuredEditor` para el tipo
Programa): periodo del Programa arriba; por actividad, **Generar seguimiento**
(UI progresiva) → responsable, tipo de programación (Fecha única/Rango/Semanal…
Anual), fechas/recurrencia, evidencia requerida, avisar antes (0/1/3/7/15/30).
`activityId` estable e invisible; subir/bajar/eliminar. El servidor valida al
publicar.

## Pendiente (fase 4)

Reconciliación de versiones (§17 de la fase 4), seed demo, cobertura ampliada,
documentación final, pruebas manuales end-to-end y gates finales.
