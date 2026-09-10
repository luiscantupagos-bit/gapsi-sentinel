# Programas ejecutables (DOC-003)

Los **Programas** (auditorías, mantenimientos, calibraciones, capacitaciones…) no
son solo un documento con una tabla: son un documento **aprobado** cuyas
actividades, al publicarse, se convierten en **ejecución operativa real** (tareas
con responsable, vencimiento y evidencia) y en **avisos** internos.

## Principio: definición vs. ejecución

**Documento = definición aprobada. Ejecución = estado operativo real.** No se
mezclan.

- El **Programa formal** (render documental, copias controladas, versiones) muestra
  únicamente lo aprobado.
- La **Ejecución** (tareas, completadas, vencidas, progreso) vive aparte, en
  `program_activity_instances` + Tareas nativas, y se consulta en la pestaña
  **Ejecución**.

## Modelo

### Actividad (`activityId` estable)

Cada actividad vive en `structured_content.program.activities` con un `activityId`
**estable e invisible**. El servidor lo acuña al guardar (`ensureActivityIds`) y lo
**conserva** al reordenar, editar o crear una versión nueva. Es la clave de
identidad para la reconciliación entre versiones: reordenar o cambiar el texto no
crea una actividad nueva; **eliminarla y volver a crearla sí** (nuevo `activityId`,
sin matching por nombre).

### Programación (`schedule`) y recurrencia

- `single` — una fecha (`dueDate`).
- `range` — inicio + fin (una ocurrencia que abarca el rango).
- `recurring` — frecuencia `weekly | monthly | bimonthly | quarterly | semiannual |
annual` con `interval` e `endDate` opcional.

### Periodo del Programa

`periodStart`/`periodEnd` acotan la generación. Una recurrencia sin `endDate` usa el
`periodEnd`. Fin de mes y años bisiestos se ajustan **sin drift** (cada ocurrencia se
ancla en la fecha de inicio, no en la anterior). Tope duro `MAX_OCCURRENCES = 366`.

### Ocurrencias (`occurrenceKey` determinista)

`generateOccurrences` (motor **puro**, `src/features/documents/program-execution.ts`)
produce ocurrencias con `occurrenceKey` determinista:
`single:<fecha>`, `range:<inicio>`, `monthly:<AAAA-MM>` (familia mensual),
`weekly:<AAAA-Www>` (semana ISO-8601). La clave es estable frente a re-publicaciones.

## Activación (al publicar)

`src/server/programs.ts · activateProgram` (invocado por `publishVersion` tras el
commit): cada actividad `executionEnabled` genera ocurrencias materializadas en
`program_activity_instances`, cada una enlazada a una **Tarea nativa**
(`sourceType='program_activity'`, `sourceId=<instance.id>`; no se duplica el motor de
tareas).

- **Validación antes de publicar** (`validateProgramForActivation`): horizonte,
  fechas dentro del periodo, responsable presente y **miembro del tenant** (rechazo
  cross-tenant). Si falla, no se publica.
- **Borrador no activa** (§ borrador): la ejecución aparece vacía hasta publicar una
  versión vigente.
- **Idempotencia**: clave única `(documentVersionId, activityId, occurrenceKey)` para
  la instancia y `(organizationId, sourceType, sourceId)` para la tarea. Reintentar
  la publicación **no duplica** ocurrencias ni tareas.
- **Sin huérfanas**: la tarea se crea **después** de la instancia.
- Actividades `executionEnabled=false` son **documentales**: no generan ocurrencias
  ni tareas.

## Integración con Tareas y evidencia

La ejecución se apoya en el gestor global de tareas (nativas): estado, responsable,
comentarios, evidencia y dependencias son los de una Tarea normal. La **evidencia
requerida** de la actividad se guarda en la instancia y se muestra en la vista de
Ejecución; la evidencia real se adjunta en la Tarea.

## Estado derivado (nunca duplicado)

`program-status.ts · deriveExecutionStatus` interpreta el estado visible desde la
Tarea + la fecha + el estado de la instancia. Prioridad:

1. instancia `superseded`/`cancelled`;
2. tarea `completed`/`cancelled`;
3. tarea en curso (`in_progress`/`blocked`/`under_review`) → **En curso**;
4. `dueAt < hoy` y tarea no terminal → **Vencida**;
5. **Programada**.

Etiquetas: Programada · En curso · Completada · Vencida · Cancelada · **Sustituida**.
Una ocurrencia completada **no** vuelve a Vencida.

## Notificaciones

Infraestructura transversal (`docs/architecture/NOTIFICATIONS.md`):
`notification_deliveries` + `processProgramNotifications(org, now)` genera
`program_due_soon` / `program_due_today` / `program_overdue` con anticipación
`notifyBeforeDays`, **dedup a nivel DB** y `now` inyectable (determinista). Solo
procesa instancias `scheduled` con tarea no terminal: las `superseded`/`cancelled` y
las de tareas completadas **no** generan avisos nuevos; los avisos históricos ya
emitidos se conservan.

## Reconciliación entre versiones (§2-13)

Al publicar una **versión nueva** de un Programa, la ejecución se reconcilia por
`activityId` estable. **Regla exacta**, aplicada solo a las ocurrencias **futuras no
iniciadas** de la(s) versión(es) anterior(es) — el histórico nunca se toca:

| Caso          | Condición                                                              | Resultado                                                                                                                                            |
| ------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Continúa**  | mismo `activityId` + `occurrenceKey`, **misma** fecha/plan/responsable | la **Tarea se adopta** en la versión nueva (continuidad); la instancia previa queda `superseded` como traza (sin tarea). **No se duplica** la tarea. |
| **Cambia**    | mismo `activityId`, pero cambia fecha/plan/responsable (o la clave)    | la instancia previa → `superseded` y su **Tarea → `cancelled`** (terminal); la versión nueva materializa la ocurrencia cambiada.                     |
| **Eliminada** | `activityId` ya no existe en la versión nueva                          | instancia futura → `superseded`, Tarea → `cancelled`. Preferimos **Sustituida** (la causa es una nueva versión documental).                          |
| **Nueva**     | `activityId` nuevo                                                     | genera ocurrencias/tareas nuevas normalmente.                                                                                                        |
| **Recreada**  | se elimina una actividad y se crea otra con el mismo texto             | **nuevo `activityId`** → definición nueva (no hay matching por nombre).                                                                              |

- **Histórico**: ocurrencias completadas, vencidas, iniciadas o pasadas **se
  conservan** en su versión. Nunca se duplica ni se borra historia; **ninguna Tarea
  histórica se elimina**.
- **Tarea sustituida** (§7): como el modelo de Tareas no tiene estado `superseded`,
  se usa el terminal más cercano, **`cancelled`**, con un evento de historial
  `task.superseded`; la instancia refleja `superseded`. Documentado como decisión.
- **Idempotencia** (§12): reconciliar dos veces produce el mismo resultado (las
  instancias previas ya no son `scheduled`; la activación de la versión nueva es
  idempotente).
- **Transaccionalidad / retry** (§13): la instancia se materializa antes que la
  tarea (sin huérfanas) y la activación es idempotente; ese es el mecanismo de
  compensación ante un fallo parcial. `createTask` usa su propia transacción con
  contexto RLS, por lo que no comparte la transacción de la instancia; el reintento
  idempotente cubre el caso.

## Comportamiento por versión (histórico y vigente)

- **Consulta por `versionId`** (§8): `getProgramExecution(org, doc, { versionId })`
  muestra las ocurrencias **de esa versión** (no recalcula con el `structured_content`
  actual). v1.0 permanece inmutable en su histórico.
- **Vista vigente** (§9): sin `versionId` usa la versión **publicada vigente**, nunca
  un borrador más nuevo.

## Obsoleto (§10/§21)

Al obsoletar un Programa vigente (`obsoleteVersion` →
`supersedeFutureOccurrences`): las ocurrencias futuras no iniciadas se marcan
`superseded` y sus Tareas se cancelan; el histórico permanece; no se generan nuevas
ocurrencias ni avisos futuros. No se borra nada histórico.

## UI: Documento / Ejecución

- Pestañas **Documento | Ejecución** en documentos tipo Programa.
- **Documento**: render canónico (hoja centrada), toolbar, copias controladas,
  formato de fecha de la organización, referencias `@`//.
- **Ejecución**: KPIs (total ejecutable / completadas / pendientes / vencidas /
  próximas 30 días), **progreso** (completadas/total, excluye cancelled/superseded),
  tabla de ocurrencias con estado derivado, responsable (`Usuario inactivo` si ya no
  es miembro), evidencia requerida y **Ver tarea**. Filtros (estado / responsable /
  actividad / rango). Responsive a tarjetas en tablet/móvil.
- **Editor especializado** (`_editor/ProgramActivitiesEditor.tsx`): periodo arriba;
  por actividad, **Generar seguimiento** (UI progresiva) → responsable, tipo de
  programación, fechas/recurrencia, evidencia requerida, avisar antes (0/1/3/7/15/30);
  subir/bajar/eliminar. `activityId` invisible.

## Navegación Programa ↔ Tarea

- **Programa → Tarea**: «Ver tarea» → `/dashboard/tasks/[taskId]`.
- **Tarea → Programa**: bloque **Origen y trazabilidad** con Programa (enlace),
  Actividad, Ocurrencia y **Ver ejecución** (`getTaskProgramOrigin`). Sin UUIDs.

## Seed oficial

`PG-CA-001 — Programa anual de auditorías internas` se siembra **publicado y
activado** como ejemplo realista: auditoría trimestral (BPM Planta Monterrey),
seguimiento mensual de acciones y revisión anual (fecha única), con responsables
demo, evidencia y avisos. Genera 9 ocurrencias + 9 tareas. El seed es idempotente
(no duplica al re-sembrar).

## Limitaciones (aún NO existe)

- Scheduler externo productivo (el processor de avisos se ejecuta manualmente / cron
  futuro; sin worker).
- Canales externos: email / SMS / WhatsApp / push.
- Notificaciones en tiempo real y **centro de notificaciones** completo (backend
  listo; UI pendiente).
- Exportación PDF nativa; modo offline; DOC-004 (registros).
