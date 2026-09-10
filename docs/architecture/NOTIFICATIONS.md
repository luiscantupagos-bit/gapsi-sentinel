# Notificaciones internas de C3 Sentinel (transversal)

Infraestructura mínima y reutilizable de avisos **dentro del sistema** (sin
email/SMS/push). Introducida por DOC-003 para Programas ejecutables, pero **no
acoplada** a Programas: el modelo sirve a cualquier origen.

## Modelo

`notification_deliveries` (tabla `NotificationDelivery`), tenant-scoped (RLS por
`fn_current_org`):

- `organizationId`, `userId` — destinatario.
- `sourceType` / `sourceId` — origen del aviso. Hoy `program_activity` →
  `program_activity_instances.id`; el diseño admite `task`, `document_review`,
  `audit`, `capa`, … a futuro sin cambiar el esquema.
- `notificationType` — p. ej. `program_due_soon` / `program_due_today` /
  `program_overdue` (UI en español: «Próxima a vencer» / «Vence hoy» / «Vencida»).
- `scheduledFor` (DATE) — momento lógico del aviso; parte de la clave de dedup.
- `title`, `message`, `payload` (JSON acotado, generado en servidor).
- `createdAt`, `deliveredAt`, `readAt` — el estado se **deriva** de estos campos
  (sin columna `status` extra). Sin canal externo, `deliveredAt` se marca al crear.

**Dedup a nivel DB** (§3): índice único
`(organizationId, userId, sourceType, sourceId, notificationType, scheduledFor)`.
Un rerun del processor no crea duplicados. Índices adicionales para el listado por
usuario/no leídas y por origen.

## Producer / processor

`src/server/notifications.ts`:

- `processProgramNotifications(organizationId, now)` — **determinista** (recibe
  `now` ISO), idempotente, por organización (RLS). Pensado para ejecución manual o
  **cron/job futuro** (no usa `setInterval`). Batch (evita N+1): carga ocurrencias
  vigentes (`status='scheduled'`, con destinatario/tarea/fecha), sus tareas y los
  avisos existentes, y crea los faltantes con `createMany({ skipDuplicates })`.
  Devuelve `{ scanned, created, skippedCompleted, skippedExisting }`.
- **Fuente de verdad del estado** (§8): si la Tarea vinculada está en estado
  **terminal** (`completed` | `cancelled`) no se generan avisos. Una ocurrencia
  `superseded`/`cancelled` tampoco (§18). No se borran avisos históricos.
- `listNotificationsForUser(org, user, {limit, unreadOnly})` — solo del usuario,
  no leídas primero. `countUnreadNotifications` para el badge (futuro).
- `markNotificationRead(org, user, id)` — marca una notificación **propia** como
  leída (valida organización + usuario).

## Programación de avisos (motor puro)

`src/features/notifications/schedule.ts` — `planProgramNotifications(dueAt,
notifyBeforeDays, now)`:

- `program_due_soon`: si `notifyBeforeDays > 0` y `now ∈ [dueAt−N, dueAt)`
  (scheduledFor = fecha de anticipación).
- `program_due_today`: `now === dueAt`.
- `program_overdue`: `now > dueAt`, `scheduledFor = dueAt` → **un único overdue**
  por ocurrencia gracias al dedup (§25).
- `notifyBeforeDays = 0` → solo `due_today` (sin `due_soon`, §26).
- Cada ocurrencia recurrente tiene su propio `sourceId` → avisos independientes.

`notifyBeforeDays` (0/1/3/7/15/30, default 7) se valida en el motor de Programas y
se copia a cada `program_activity_instance` al activar. Las fechas visibles usan el
**formato de fecha de la organización** (`formatIsoDate`, DOC-UX-003).

## Fuera de alcance (hoy)

Email/SMS/WhatsApp/push, scheduler externo, centro de notificaciones visual y
websockets. La UI (campana/dropdown) se integrará en una sub-fase posterior sobre
`listNotificationsForUser` / `markNotificationRead`.
