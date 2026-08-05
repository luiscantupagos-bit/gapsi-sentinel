# TASK-007 — Notas de implementación (No conformidades y acciones correctivas CAPA + layout amplio)

Esta tarea añade el módulo formal de **CAPA** (no conformidades, desviaciones,
hallazgos, quejas con impacto en calidad, incidentes y oportunidades de mejora)
y un **ajuste transversal de layout** para aprovechar pantallas amplias.

**Fuera de alcance (para TASK-008):** herramientas visuales de causa (Ishikawa,
Pareto, AMEF, árbol de causas), IA, búsqueda web, proyectos, Gantt, auditorías
completas, HACCP Builder, correos/WhatsApp/push y servicios externos.

## Bloque A — Ajuste de layout

- Nueva variable `--max-width-wide: 110rem` (~1760px). El contenido del área
  privada (`.shell__content > .container`) usa el máximo amplio y crece de forma
  fluida; en pantallas ≥1400px el padding lateral sube a 2rem (equilibrado, sin
  pegar el contenido a los bordes).
- El **sidebar** queda fijo (`position: sticky`) en escritorio (≥721px) y colapsa
  a una fila a ancho completo en móvil (breakpoint 720px, sin cambios de
  comportamiento previos).
- Las rejillas de tarjetas (`.grid`, `.stat-row`, `.doc-actions`, `.props-grid`)
  ya usan `repeat(auto-fit, minmax(...))`: se expanden a 4–6 columnas cuando hay
  espacio y bajan a 1–2 en pantallas pequeñas. Las tablas conservan
  `.table-wrap { overflow-x: auto }`. Las hojas del editor/preview (`.sheet`,
  `.page`) mantienen su ancho tipo carta (816px) centrado.
- Se aplica de forma consistente a dashboard, diagnósticos, documentos, tareas,
  editor, vista previa y el nuevo módulo CAPA (todas usan `.container` dentro del
  shell). No se alteró la lógica de tareas anteriores.
- Verificación: prueba estructural `tests/layout.test.ts` (contenedor amplio,
  tablas responsive, colapso móvil, rejillas auto-fit) + verificación manual en
  1920×1080, 1440×900 y móvil.

## Bloque B — Módulo CAPA

### Rutas (`/dashboard/capa`)

- `/dashboard/capa` — listado maestro con búsqueda, filtros (estado, severidad,
  prioridad, tipo, sitio, responsable, vencidas), badges, avance y estado vacío.
- `/dashboard/capa/new` — alta con folio automático.
- `/dashboard/capa/[capaId]` — detalle con panel contextual de acciones +
  secciones (problema, contención, causa raíz, plan, eficacia, cierre,
  evidencias, historial, comentarios).
- `/dashboard/capa/[capaId]/edit` — edición de campos (solo si la CAPA está
  abierta y el usuario es editor).
- `/dashboard/capa/tasks` — bandeja de tareas del usuario.

### Modelo de datos (migración `20260805073433_capa`, nueva; no se modificaron migraciones anteriores)

11 tablas nuevas: `capa_folio_counters` (contador seguro), `capas`,
`capa_immediate_actions`, `capa_root_cause_analyses`, `capa_why_steps`,
`capa_actions`, `capa_effectiveness_reviews`, `capa_files`, `capa_relations`,
`capa_status_history` (append-only) y `capa_comments`.

Convenciones (idénticas a TASK-002/006): UUID, `organization_id`, timestamps,
usuario actor, **FK compuestas anti-cruce** `(x_id, organization_id)` hacia
`capas`, `sites`, `diagnostics`, `documents`, `document_versions` y
`template_requirements`; enums `text` + `CHECK`; índices; RLS por organización;
prohibición de borrado físico; historial append-only.

Como en TASK-005/006, `prisma migrate dev --create-only` propuso `DROP` de
objetos SQL de TASK-004/006 (FKs de documentos y el índice
`assessment_frameworks_id_organization_id_key` que respalda una FK compuesta):
**se omitieron todos** y se conservó únicamente el bloque `CREATE TABLE/INDEX` +
el **SQL complementario** (FKs a organizations/users, FKs compuestas, CHECK, RLS,
triggers de append-only/no-borrado reutilizando `fn_current_org`,
`fn_block_update_delete` y `fn_block_delete` de TASK-002).

Los impactos se guardan como `text[]` con CHECK `impacts <@ ARRAY[...]` (todos los
elementos deben pertenecer al conjunto permitido).

### Folios

Folio legible `CAPA-AAAA-####`, **único por organización y año**. Se genera con un
contador dedicado (`capa_folio_counters`) mediante
`INSERT ... ON CONFLICT (organization_id, year) DO UPDATE SET last_seq = last_seq + 1 RETURNING last_seq`,
atómico bajo bloqueo de fila (sin duplicados en concurrencia). El año se toma de
la fecha de detección (o de la fecha actual). Un índice único
`capas(organization_id, folio)` es la última barrera. El consecutivo es
independiente entre organizaciones y reinicia por año.

### Máquina de estados (`src/features/capa/capa-state.ts`, pura + `tests/capa-state.test.ts`)

`draft → reported → containment → under_investigation → action_plan →
in_implementation → effectiveness_review → closed`, con `cancelled` desde estados
tempranos y retorno `effectiveness_review → action_plan` cuando la eficacia no es
satisfactoria. No se permiten saltos arbitrarios. La **reapertura** (`closed →
under_investigation | action_plan`) es una operación privilegiada aparte.

Reglas validadas en servidor (`src/server/capa.ts`):

- `reported` exige responsable y fecha objetivo.
- Avanzar desde `containment` exige ≥1 acción inmediata o justificación.
- `action_plan` exige descripción del problema, evidencia y causa raíz concluida.
- `in_implementation` exige responsable y fecha por cada acción.
- `effectiveness_review` exige todas las acciones completadas/canceladas.
- El cierre exige causa raíz, verificación **eficaz** y conclusión; una CAPA
  cerrada queda en **solo lectura**.
- La reapertura exige owner/admin, motivo, nuevo responsable y nueva fecha; el
  cierre anterior se conserva y se registra en el historial (`reopen_count`).

### Roles y permisos (validados en servidor)

- **owner/admin**: crear, asignar, modificar, cambiar estados, cerrar, reabrir,
  cancelar y consultar todo dentro de la organización.
- **evaluator**: crear; editar/investigar/ejecutar/verificar donde sea
  responsable, creador o reportante; no reabre ni cancela arbitrariamente.
- **viewer**: solo lectura; no crea ni modifica.

No se confía en botones ocultos: cada acción revalida rol y asignación en la capa
de datos. La organización siempre proviene de la sesión.

### Contención, causa raíz, plan, eficacia, cierre

- **Contención/corrección inmediata**: tipo (contención/corrección), responsable,
  fechas, estado, resultado y costo estimado. La interfaz explica la diferencia
  entre corrección (efecto) y acción correctiva (causa).
- **Causa raíz básica**: causa inmediata/contribuyente/raíz, método (5 porqués,
  análisis libre, revisión de proceso/documental, otro), justificación,
  investigador y fecha; **5 porqués** hasta 5 niveles con conclusión obligatoria.
- **Plan de acciones**: 11 tipos, responsable, fechas, prioridad, estado, avance
  (0–100), resultado y vínculo opcional a un documento (cambio documental; no se
  publica nada automáticamente, el documento sigue su flujo de TASK-006).
- **Verificación de eficacia**: criterio, método, fechas, verificador, periodo de
  seguimiento, resultado y conclusión (eficaz / parcial / no eficaz). "No eficaz"
  bloquea el cierre; "parcial" exige acción adicional o justificación. El
  verificador no puede ser el único ejecutor de las acciones cuando hay otro
  usuario disponible (segregación básica; ver limitaciones del entorno demo).
- **Cierre**: registra usuario, timestamp, resumen, **checksum/snapshot** de datos
  relevantes e historial. Es un **acuse interno, no una firma legal**.

### Evidencias y archivos

Se reutiliza el almacenamiento local protegido de TASK-004
(`saveDocumentFile`/`readDocumentFile`, validación de extensión/MIME/tamaño,
checksum SHA-256, sin binarios en PostgreSQL). Cada evidencia pertenece a la
organización y la CAPA (y opcionalmente a una acción o etapa) con un tipo:
hallazgo, contención, investigación, causa raíz, implementación, eficacia,
cierre.

### Dashboard y bandeja

- Panel principal: tarjetas de CAPA (abiertas, críticas, vencidas, acciones
  pendientes, verificaciones pendientes, cerradas) + enlace al módulo.
- Bandeja `/dashboard/capa/tasks`: asignadas, contenciones/investigaciones
  pendientes, acciones vencidas/próximas, verificaciones y cierres pendientes.

### Seguridad y RLS

Organización desde la sesión; escrituras en `withOrgContext` (RLS por
transacción); FK compuestas anti-cruce; historial append-only; sin borrado
físico. La app conecta como propietario de la BD; **RLS se prueba forzando el rol
con `SET LOCAL ROLE gapsi_app`** (ver `tests/db/capa-access.test.ts`).

### Variables de entorno

- `CAPA_ACTION_SOON_DAYS` (por defecto 15): umbral de "acción próxima a vencer"
  en la bandeja.

### Pruebas

- Unitarias: `tests/capa-state.test.ts` (9) — transiciones válidas/ inválidas,
  cancelación, terminales, reapertura, borrado lógico. `tests/layout.test.ts` (5).
- Integración (DB): `tests/db/capa-lifecycle.test.ts` (11) — folio, reglas por
  etapa, ciclo completo con cierre y checksum, "no eficaz" bloquea cierre,
  segregación verificador/ejecutor, reapertura, 5 porqués, append-only.
  `tests/db/capa-access.test.ts` (8) — permisos por rol, folio único por org/año,
  reinicio por año, aislamiento entre organizaciones, RLS (`SET ROLE`) y rechazo
  de FK compuesta cruzada.

### Datos seed (idempotente)

8 CAPA demo en ORG_A cubriendo borrador, reportada, en contención, en
investigación, plan de acciones (crítica y vencida), verificación de eficacia,
cerrada y una oportunidad de mejora vencida; con acciones inmediatas, causa raíz
(5 porqués), acciones con distintos responsables/estados, verificación eficaz,
cierre con checksum y evidencia (solo metadata). Sin datos personales reales. El
contador de folios se ajusta para que las CAPA creadas por la app continúen la
numeración.

### Pasos de prueba manual

Con Docker y PostgreSQL activos:

```bash
npm run db:up && npm run db:migrate && npm run db:seed
npm run dev
```

1. Comprobar el ancho del sistema en escritorio (1920×1080) y en 1440×900.
2. Comprobar móvil (una columna, tablas desplazables, navegación colapsable).
3. Abrir `/dashboard/capa` (listado) y aplicar búsqueda/filtros.
4. Registrar una CAPA y agregar contención.
5. Avanzar a investigación, completar 5 porqués y registrar causa raíz.
6. Crear acciones, asignar responsables y completarlas.
7. Adjuntar evidencia.
8. Ejecutar verificación de eficacia; intentar cerrar con "no eficaz" (bloqueado)
   y cerrar con "eficaz".
9. Comprobar el bloqueo de solo lectura; reabrir con motivo (owner/admin).
10. Comprobar historial, aislamiento entre organizaciones, dashboard y bandeja.

## Limitaciones y pendientes

- No existen entidades formales de **producto/proceso/proveedor/cliente**: se usan
  campos de texto provisionales (`product`, `process`, `area`) y una referencia
  externa. Migración futura cuando se aprueben esas entidades.
- El vínculo con `diagnostic_findings` se guarda como `finding_id` sin FK
  compuesta (esa tabla no declara `UNIQUE(id, organization_id)`); se validará por
  aplicación o se añadirá el índice en una tarea futura.
- La segregación verificador≠ejecutor se relaja cuando la organización tiene un
  solo usuario disponible (entorno demo).
- RLS efectiva solo cuando la app conecta con `gapsi_app` (no propietario);
  en desarrollo se conecta como propietario y las pruebas fuerzan el rol.
- **Pendientes para TASK-008:** Ishikawa/Pareto/AMEF/árbol de causas, análisis con
  IA, proyectos, Gantt y auditorías completas.
