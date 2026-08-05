# TASK-006 — Notas de implementación (control documental avanzado)

Ciclo formal de elaboración → revisión → aprobación → publicación → distribución →
lectura → obsolescencia, con trazabilidad. Fuera de alcance: firma electrónica
legal, PDF definitivo, DOCX, comparación visual, colaboración en tiempo real,
correo/notificaciones externas, CAPA, auditorías, TASK-007.

## Alcance

Máquina de estados de versión, flujo secuencial configurable (revisores/
aprobadores), permisos por rol y asignación, publicación con una sola versión
vigente, distribución interna, acuse de lectura, copias controladas, comentarios,
historial de estados y alertas internas.

## Máquina de estados (versión)

`draft → in_review → changes_requested → in_approval → approved → published →
obsolete → archived` (`src/features/documents/workflow-state.ts`, con pruebas).
Solo `draft`/`changes_requested` son editables. Sin saltos arbitrarios.

## Modelo (8 tablas nuevas)

`document_workflows`, `document_workflow_steps`, `document_approvals`
(append-only), `document_comments`, `document_distributions`,
`document_read_acknowledgements` (append-only, único por versión+usuario),
`document_controlled_copies` (número único por versión), `document_status_history`
(append-only). Todas con `organization_id`, UUID, timestamps y actor.

## Migraciones

- `20260805042303_document_control`: amplía el CHECK de estado de versión y crea
  las 8 tablas con FK compuestas anti-cruce, CHECK, RLS, append-only y no-borrado
  (se omitieron los `DROP` que `migrate dev` propuso sobre constraints de tareas
  previas). No se modificaron migraciones anteriores.

## Roles y permisos (validados en servidor)

- `owner`/`admin`: configurar flujo, publicar, obsoletar, distribuir, copias.
- `evaluator`: elabora/revisa/aprueba solo cuando está asignado.
- `viewer`: consulta.
- El autor no aprueba su propio documento si hay otro aprobador asignado.
- Nadie actúa sobre documentos de otra organización (scoping + RLS + FK compuestas).

## Flujo de revisión y aprobación

`assignWorkflow` (revisores + aprobadores, secuencial) → `submitForReview`
(valida código/título/versión/contenido/responsable/nota/asignaciones; bloquea
edición) → `reviewDecision` (aprobar / solicitar cambios con comentario) →
`approvalDecision` (aprobar / rechazar con motivo; registra checksum). Solicitar
cambios/rechazar devuelve a `changes_requested` (editable).

## Publicación

`publishVersion` (owner/admin): `approved → published`, única vigente, obsoleta la
anterior (y marca sus distribuciones `superseded` y copias `pending_recovery`),
registra fecha de vigencia y checksum, historial.

## Distribución y lectura

`distributeDocument` (a usuario/rol/organización; sitio se trata como
organización — limitación documentada). `pendingReads` calcula lo pendiente por
usuario. `acknowledgeRead` exige que la versión coincida con la distribuida
(checksum), es única por usuario+versión y registra la declaración de lectura.

## Copias controladas

`registerControlledCopy` (número único por versión), `updateControlledCopy`
(recuperada/destruida/reemplazada). Al publicar una nueva versión, las copias de
la anterior quedan `pending_recovery`.

## Alertas internas

`getWorkflowAlerts` (contadores en el dashboard) y `getTasksInbox`
(`/dashboard/documents/tasks`): revisiones, aprobaciones, cambios solicitados y
lecturas pendientes. Sin correo ni push.

## Seguridad y RLS

Organización desde la sesión; nunca se confía en ids del cliente. RLS por
organización en las 8 tablas (política `organization_id = fn_current_org()`);
escrituras en `withOrgContext`. Registros de aprobación/lectura/estado append-only
y prohibición de borrado físico por triggers.

## Rutas

- `/dashboard/documents/tasks` — bandeja / Mis documentos.
- `/dashboard/documents/[id]` — detalle con panel de acciones contextuales y
  secciones Flujo/Aprobaciones/Distribución/Lecturas/Copias/Historial de estados.
- `/dashboard/documents/[id]/preview` — confirmación de lectura.
- Dashboard — alertas de control.

## Pruebas

- Unitarias: máquina de estados (`tests/workflow-state.test.ts`).
- Integración (`tests/db/document-workflow.test.ts`): envío/bloqueo, revisor
  asignado vs. no asignado, cambios solicitados, aprobación, rechazo con motivo,
  autor no aprueba con otro aprobador, publicación (única vigente + checksum +
  append-only), distribución/lectura (pendiente, destinatario, checksum, única),
  copias (número único, pendiente de recuperación), viewer no envía, aislamiento.

## Umbral de próxima revisión

`DOCUMENTS_REVIEW_SOON_DAYS` (30 días por defecto).

## Limitaciones

- "Áreas" no modeladas; se usa sitio/usuario/rol/organización.
- Aprobación/lectura son acuses internos del sistema, no firma electrónica legal.
- Vista previa no genera PDF; flujo secuencial (sin etapas paralelas complejas).
- La app conecta como owner de la BD; RLS se prueba con `SET ROLE gapsi_app`.

## Prueba manual

Ver README. Resumen: abrir borrador → asignar revisor/aprobador → enviar a
revisión (edición bloqueada) → solicitar cambios / editar / reenviar → aprobar
revisión → aprobar → publicar (una sola vigente) → distribuir → confirmar lectura
→ registrar copia → publicar nueva versión (anterior obsoleta, copia pendiente de
recuperación) → alertas e historial.

## Pendientes para TASK-007

- Firma electrónica y validez legal; PDF/DOCX; comparación visual de versiones;
  flujos paralelos; comentarios en el texto; correo/notificaciones; CAPA;
  auditorías; distribución por áreas.
