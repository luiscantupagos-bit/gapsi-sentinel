# TASK-009 — Proyectos y gestor global de tareas (notas de implementación)

## Alcance

Módulo transversal de **gestor global de tareas** y **proyectos** con hitos,
dependencias, seguimiento de avance y vistas Lista / Kanban / Calendario / Gantt /
Carga de trabajo, integrado con el dashboard y con trazabilidad al módulo de
origen de cada tarea. Fuera de alcance (documentado): IA, auditorías, HACCP, KPI
estadísticos, calendarios externos, correo/WhatsApp/push, timesheets, CPM,
asignación automática y TASK-010.

## Arquitectura — estrategia de tareas globales (híbrido A-céntrico)

Se eligió y documentó un **modelo híbrido**:

- **Nativas (fuente de verdad en `tasks`):** tareas manuales, de proyecto y las
  **convertidas** explícitamente desde otro módulo. Se crean y editan en el gestor.
- **Agregadas (en vivo, solo lectura):** las tareas que ya pertenecen a otro
  módulo se muestran leyéndolas de su origen, **sin copiarlas**:
  - Acciones CAPA (`CapaAction`),
  - Pasos de flujo documental pendientes (revisión/aprobación),
  - Lecturas documentales pendientes del usuario,
  - Acciones AMEF (`FmeaRow`).
    Cada ítem agregado abre su módulo de origen (deep link) y conserva su
    `source_type`/`source_id`.
- **Anti-duplicado:** `tasks` tiene índice único `(organization_id, source_type,
source_id)`. El agregador oculta un ítem agregado si ya existe una tarea nativa
  enlazada a esa fuente. **No hay backfill masivo**: solo se crea una fila en
  `tasks` ante una conversión/relación explícita.

Tipos de tarea por naturaleza:

- **Nativos:** `manual`, `project`, `follow_up`, `other`.
- **Convertidos:** cualquier nativo con `source_type`/`source_id` (p. ej. una
  acción CAPA adoptada como tarea gestionada).
- **Agregados (no persistidos):** `capa_action`, `doc_review`, `doc_approval`,
  `doc_read`, `fmea_action`.

`listGlobalTasks(org, userId, filtros)` une nativas + agregadas, deduplica,
aplica filtros (ámbito, estado, rápidos, búsqueda) y ordena (vencidas primero).

## Modelo de datos y migración

Migración nueva `prisma/migrations/20260805120000_projects_tasks` (no se
modificaron migraciones anteriores). 16 tablas:

- **Proyectos:** `projects`, `project_folio_counters`, `project_members`,
  `project_milestones`, `project_relations`, `project_comments`, `project_files`,
  `project_status_history`.
- **Tareas:** `tasks`, `task_folio_counters`, `task_assignments`,
  `task_relations`, `task_dependencies`, `task_comments`, `task_files`,
  `task_status_history`.

Reglas comunes: UUID, `organization_id`, timestamps, actor, índices; **CHECK** de
enums (text + CHECK); **RLS** por organización (`fn_current_org`); **append-only**
en los historiales (`fn_block_update_delete`); **no borrado físico**
(`fn_block_delete`); grants a `gapsi_app` (+ secuencias BIGSERIAL). JSONB solo
para `tags`/`metadata`.

**FK compuestas anti-cruce** para relaciones intra-módulo (proyecto/tarea/hito) y
sitio. Los punteros a otros módulos son **genéricos** (`source_type`/`source_id`,
`relation_type`/`target_id`) validados por alcance en servidor + RLS, porque no
todos los destinos exponen `@@unique([id, organization_id])` (p. ej.
`capa_actions`). Decisión documentada: el aislamiento se garantiza por RLS +
validación en servidor.

## Backfill

**No se realiza backfill.** Las tareas de otros módulos se agregan en vivo; no se
copian filas. Esto evita duplicación, tareas fantasma y estados contradictorios.
La conversión a tarea nativa es siempre explícita e idempotente (índice único de
origen). Rollback: eliminar la migración nueva revierte el módulo sin afectar a
otros (no hay datos migrados).

## Folios

`TSK-AAAA-####` y `PRJ-AAAA-####`, contador atómico por organización y año
(`INSERT … ON CONFLICT`), independiente entre organizaciones y con reinicio anual
(mismo patrón que CAPA). Índice único `(organization_id, folio)`.

## Estados y permisos

- **Tarea:** `draft · pending · in_progress · blocked · under_review · completed ·
cancelled`. Bloquear/cancelar exigen motivo; completar exige resultado/evidencia
  para tareas no manuales; una dependencia obligatoria no completada impide
  iniciar; completada/cancelada quedan en solo lectura; reapertura solo owner/admin.
- **Proyecto:** `draft · planned · active · on_hold · under_review · completed ·
cancelled`. Activar exige responsable y fechas; completar con tareas
  obligatorias abiertas exige justificación; cancelar exige motivo; completado en
  solo lectura; reapertura solo owner/admin.
- **Hito:** `pendiente · en riesgo · alcanzado · vencido · cancelado`.
- **Permisos (validados en servidor):** owner/admin gestión total; evaluator crea
  y actúa donde es responsable/participante y actualiza avance; viewer solo
  lectura. Reaperturas y dependencias: owner/admin. Máquinas de estado puras en
  `src/features/tasks/task-state.ts`, `src/features/projects/project-state.ts` y
  `src/features/tasks/dependencies.ts` (anti-ciclo).

## Dependencias

Finish-to-start inicial, obligatoria o informativa, con `lag_days`. Se evita la
auto-dependencia (CHECK) y los ciclos (validación de alcanzabilidad en servidor).
Pendiente documentado: start-to-start, finish-to-finish, start-to-finish,
adelantos y calendarios laborales.

## Vistas

- **Lista** (`/dashboard/tasks`): KPIs clickeables, pestañas (Mis tareas / Todas /
  Pendientes / En progreso / Próximas / Vencidas / Bloqueadas / Completadas),
  búsqueda y tabla con código y título clickeables.
- **Kanban** (`/dashboard/tasks/board`): columnas por estado; mover con selector
  accesible **validado en servidor** (sin depender de drag-and-drop, dejado como
  mejora futura); tarjetas clickeables; agregadas de solo lectura.
- **Calendario** (`/dashboard/tasks/calendar`): rejilla mensual con tareas e
  hitos por fecha, clic a detalle, navegación de mes; color + texto (no solo color).
- **Gantt** (`/dashboard/projects/[id]/gantt`): implementación propia HTML/CSS
  (sin librería externa por licencia/peso/SSR/React 19), columna fija de nombres,
  scroll horizontal interno, barras y hitos clickeables, marcador de hoy, tareas
  vencidas y avance. Escala mensual.
- **Carga de trabajo** (`/dashboard/tasks/workload`): por responsable —
  abiertas, en progreso, vencidas, próximas, esfuerzo estimado y proyectos
  activos; semáforo por **volumen** (no se inventa capacidad).

## Dashboard

Sección "Tareas y proyectos" con métricas reales (tareas abiertas/vencidas/
próximas, proyectos activos/en riesgo) en tarjetas clickeables a listados
filtrados, y alertas de tareas vencidas e hitos próximos enlazadas a su detalle.

## Enlaces clickeables

Regla global aplicada: tarjetas, códigos, folios y títulos son enlaces reales a su
detalle (nativa → `/dashboard/tasks/[id]`; agregada → módulo de origen; proyecto →
`/dashboard/projects/[id]`; relaciones → CAPA/documento). Hover/focus visibles,
navegable por teclado, sin enlaces falsos; los botones internos no disparan la
navegación de la fila.

## Historial y archivos

Historial append-only por tarea y proyecto con eventos en lenguaje comprensible.
Archivos/evidencia con metadatos (checksum, MIME, tamaño, tipo) reutilizando
`document-storage`; binarios fuera de PostgreSQL.

## RLS

Todas las tablas nuevas con RLS por organización y grants a `gapsi_app`. Pruebas
de aislamiento y RLS cruda incluidas.

## Seed

`seedProjectsAndTasks()` idempotente (early-return + `skipDuplicates` + UUIDs
deterministas): 5 proyectos (activo, planeado, borrador, en pausa/riesgo,
completado), hitos, 7 tareas (pendiente, en progreso, bloqueada, vencida,
completada, manual, en revisión), dependencias, comentario, relación a CAPA,
historial; contadores de folio ajustados para que la creación por UI continúe la
numeración. Sin datos personales reales.

## Pruebas

- Dominio (puras): `tests/task-state.test.ts`, `tests/project-state.test.ts`,
  `tests/dependencies.test.ts`.
- BD: `tests/db/tasks-access.test.ts`, `tests/db/projects-access.test.ts` (folios,
  estados, dependencias/ciclos, permisos por rol, agregación + dedup, RLS,
  aislamiento, FK compuesta).
- UI (estructurales): `tests/tasks-ui.test.ts` (español, sin UUID, clickeables,
  pestañas, Kanban, calendario, Gantt, integración de dashboard).

## Decisiones y limitaciones

- Punteros cruzados genéricos (no FK a `capa_actions` por falta del único
  compuesto); aislamiento por RLS + validación en servidor.
- Kanban sin drag-and-drop nativo (selector accesible + validación de servidor);
  DnD como mejora futura.
- Gantt propio (sin librería) con escala mensual; escala semanal y dependencias
  visuales avanzadas, pendientes.
- Lecturas documentales pendientes se agregan para el usuario actual (personales).

## Pendientes

Tipos de dependencia avanzados, DnD en Kanban, escala semanal en Gantt, capacidad
configurable para carga de trabajo, y adopción masiva (backfill opcional) de
acciones CAPA como tareas gestionadas si se decide en el futuro.

## Corrección de reproducibilidad de migraciones (follow-up)

Durante la validación se detectó que la migración `20260805120000_projects_tasks`
—generada con `prisma migrate diff --from-schema-datasource`— incluía un bloque
de `DROP` (139 FK + 1 índice único) sobre restricciones **SQL crudo** de
documentos y CAPA que no están declaradas en `schema.prisma` (FK compuestas
anti-cruce, de organización y de usuario). En una reconstrucción desde cero, esto
dejaba esas tablas sin FK y obligaba a ejecutar SQL manual por `psql`.

**Corregido** con una migración **nueva** `20260805130000_repair_legacy_constraints`
que re-crea de forma idempotente (guardas `IF NOT EXISTS` por nombre y tabla, sin
`try/catch`) exactamente los objetos eliminados, restaurando el índice único antes
de las FK que lo requieren. No se modificó ninguna migración anterior ni la de
TASK-009. La secuencia completa (`down -v` → `db:up` → `db:migrate` → `db:seed`×2
→ `test:db`) se aplica **solo con comandos del proyecto, sin SQL manual**. Guardia
de regresión: `tests/db/schema-integrity.test.ts`. Procedimiento en
`docs/operations/DATABASE-REBUILD.md`.
