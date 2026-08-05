# TASK-008 — Notas de implementación (Herramientas de calidad y análisis avanzado de causa)

Amplía el módulo CAPA (TASK-007) con herramientas formales, visuales y auditables
para investigar problemas y analizar causas: **Ishikawa, árbol de causas, Pareto,
AMEF, recurrencia, comparación de casos**, más un registro común de hipótesis,
conclusiones, versionado y conversión a acciones CAPA. Las herramientas AYUDAN a
investigar; **no deciden automáticamente la causa raíz**.

**Fuera de alcance (documentado):** IA / análisis semántico, automatización de la
causa raíz, búsqueda web, auditorías completas, proyectos, Gantt y HACCP Builder.

## Alcance

- Cada análisis pertenece a una **CAPA** y a una organización. No es un módulo
  desconectado: se accede desde la pestaña **Análisis** de la CAPA y desde un
  listado global.
- 7 tipos: `ishikawa`, `cause_tree`, `pareto`, `fmea`, `recurrence`,
  `comparative`, `freeform`.

## Arquitectura y modelo de datos (migración `20260805085444_quality_analysis`, nueva)

16 tablas nuevas (modelo consolidado; ninguna migración anterior se modificó y
compatible con los datos de TASK-007):

`quality_analyses` (encabezado, config/snapshot en JSONB), `quality_analysis_participants`,
`quality_hypotheses` (registro común de causas, reutilizado por Ishikawa y libre),
`ishikawa_categories`, `cause_tree_nodes`, `cause_tree_edges`, `pareto_items`,
`fmea_rows`, `recurrence_matches`, `comparative_cases`,
`quality_analysis_conclusions` (1:1), `quality_analysis_action_links` (vínculo
bidireccional con `capa_actions`), `quality_evidence`, `quality_analysis_comments`,
`quality_analysis_versions` (snapshot inmutable, append-only) y
`quality_analysis_history` (append-only).

Convenciones (idénticas a TASK-002/006/007): UUID, `organization_id`, timestamps,
actor, **FKs compuestas anti-cruce** `(x_id, organization_id)` hacia
`quality_analyses`, `capas`, `sites`, `document_versions`, etc.; enums `text` +
`CHECK`; índices; RLS por organización; append-only en historial/versiones. JSONB
solo para: configuración de escala AMEF, corte de Pareto, snapshot de versión y
posiciones visuales.

Como en TASK-006/007, `migrate dev --create-only` propuso `DROP` de los FKs
SQL-only de CAPA: **se omitieron todos** y se conservó el bloque `CREATE
TABLE/INDEX` + el SQL complementario (FKs, CHECK, RLS, triggers).

**Política de borrado:** las tablas de trabajo de grano fino (categorías, nodos,
aristas, ítems Pareto, filas AMEF, participantes, coincidencias, casos) pueden
borrarse físicamente **mientras el análisis es editable** (el servidor lo valida);
al aprobar se conserva un snapshot inmutable. Las tablas de agregado/auditoría
(análisis, hipótesis, conclusión, vínculos, evidencia, comentarios, historial,
versiones) no admiten borrado físico.

## Máquina de estados (`src/features/capa/analysis-state.ts`, pura + pruebas)

`draft → in_progress → under_review → (approved | changes_requested)`, con
`cancelled` desde estados no terminales y retorno `changes_requested → in_progress`.
Reglas: editable en draft/in_progress/changes_requested; **aprobado = solo
lectura**; solo owner/admin o el revisor asignado aprueba o solicita cambios;
enviar a revisión exige conclusión con resumen y causa raíz propuesta; aprobar
genera **snapshot + fila de versión**; modificar un aprobado exige **nueva
versión** (duplica la estructura en un borrador `version+1`).

El módulo puro también expone `computeNpr`, `computePareto` y `wouldCreateCycle`.

## Permisos (validados en servidor)

- **owner/admin:** crear, editar, asignar, revisar, aprobar, cancelar, nuevas
  versiones, enviar causa raíz a la CAPA y convertir en acciones.
- **evaluator:** crear; editar cuando es responsable/participante; registrar
  hipótesis y evidencia; preparar conclusiones; revisar cuando está asignado; no
  aprueba arbitrariamente ni modifica análisis aprobados.
- **viewer:** solo lectura.

Aislamiento por organización + RLS (probado forzando `SET LOCAL ROLE gapsi_app`).

## Herramientas

- **Ishikawa:** 6 categorías por defecto (6M) + personalizadas (renombrar,
  desactivar); causas como hipótesis con estado (pendiente…causa raíz confirmada,
  confirmar exige justificación). Espina de pescado SVG + tabla accesible.
- **Árbol de causas:** nodos tipados y relaciones dirigidas; **rechaza ciclos y
  auto-referencia**; marca de causa raíz propuesta con justificación. Layout
  jerárquico SVG + tabla.
- **Pareto:** captura manual o **generación desde CAPA** (por tipo/severidad/
  prioridad/área/proceso); cálculo en servidor (%, acumulado, grupo vital, corte
  80 % configurable). Barras + línea acumulada SVG + tabla.
- **AMEF:** filas con S/O/D, **NPR = S×O×D calculado en servidor**, prioridad de
  acción explícita, valores posteriores y **NPR posterior recalculado**; valida
  rangos según la escala configurada; grilla con scroll horizontal interno.
- **Recurrencia:** candidatas por **coincidencias estructuradas** (tipo, sitio,
  área, proceso, requisito) sin IA; confirmación (recurrente/posible/no/insuf.)
  con justificación obligatoria.
- **Comparación:** entre 2 y 5 CAPA de la organización; tabla comparativa por
  aspecto (tipo, área, severidad, causa raíz…).

## Conversión a acciones CAPA

Desde cualquier elemento (hipótesis, nodo, fila AMEF, conclusión…) se crea una
acción CAPA reutilizando `addAction` (respeta la CAPA cerrada), con **vínculo
bidireccional** (`quality_analysis_action_links`) y **anti-duplicado** por
elemento de origen. La causa raíz confirmada de un análisis aprobado puede
enviarse a la CAPA (actualiza `capa_root_cause_analyses` y deja historial en
ambos lados).

## Archivos y evidencia

Reutiliza el almacenamiento local protegido de TASK-004 (validación
extensión/MIME/tamaño, checksum, sin binarios en PostgreSQL). La evidencia se
asocia al análisis y opcionalmente a una entidad (categoría, hipótesis, nodo,
fila AMEF, conclusión) con un tipo.

## Historial y auditoría

`quality_analysis_history` (append-only) registra creación, tipo, participantes,
hipótesis, causas, nodos/aristas, filas AMEF, recálculo de NPR, Pareto,
recurrencia, envío a revisión, cambios, aprobación, causa raíz a CAPA, acción
creada, nueva versión y cancelación.

## Rutas

- `/dashboard/capa/analysis` — listado global (tarjetas de herramienta + filtros).
- `/dashboard/capa/[capaId]/analysis` — análisis de la CAPA.
- `/dashboard/capa/[capaId]/analysis/new` — alta (selección de herramienta).
- `/dashboard/capa/[capaId]/analysis/[analysisId]` — detalle: visual + tablas
  accesibles + panel de edición contextual + conclusión + acciones + evidencia +
  historial + comentarios.

## Experiencia y responsive

Cada herramienta muestra una ayuda breve y una **vista de tabla accesible** además
del SVG (no depende solo del color). Se conserva el ancho amplio de TASK-007; las
tablas extensas (AMEF) usan scroll interno; el editor documental no se modificó.

## Variables de entorno

Ninguna nueva. (AMEF usa la escala 1–10 por defecto, configurable por análisis en
`config`.)

## Pruebas

- Unitarias `tests/analysis-state.test.ts` (12): estados, NPR, escala, Pareto
  (orden/acumulado/corte/vacío/costo), ciclos.
- Integración `tests/db/quality-analysis.test.ts` (14): creación, permisos
  (viewer/no-relacionado/participante), revisión→aprobación con snapshot/versión y
  solo lectura, nueva versión, árbol sin ciclos, Pareto, AMEF (NPR/recálculo/
  rangos), recurrencia, comparación 2–5, conversión a acción (vínculo/duplicado/
  CAPA cerrada), aislamiento y RLS (`SET ROLE`).

## Datos seed (idempotente)

7 análisis en ORG_A: Ishikawa **aprobado** (con hipótesis confirmada, descartada y
contribuyente; conclusión; versión; evidencia; acción creada desde el análisis),
árbol de causas, Pareto, AMEF, recurrencia, comparación de **3 CAPA** y libre con
**cambios solicitados**; historial representativo. Sin datos personales reales.

## Pasos de prueba manual

Con Docker y PostgreSQL activos: `npm run db:up && npm run db:migrate && npm run
db:seed && npm run dev`. Luego: abrir una CAPA → **Análisis**; crear Ishikawa;
categorías/causas; descartar/confirmar; adjuntar evidencia; crear árbol y probar
un ciclo (rechazado); Pareto manual y % ; AMEF con NPR y acción posterior; crear
acción CAPA desde AMEF; recurrencia; comparar 3 CAPA; conclusión; enviar a
revisión; solicitar cambios; aprobar; verificar solo lectura; nueva versión;
historial; permisos; aislamiento entre organizaciones; escritorio/laptop/móvil.

## Limitaciones y pendientes

- Las visualizaciones SVG son de apoyo (sin zoom/pan interactivo); la tabla es la
  fuente accesible completa. Exportación PDF/visual avanzada: pendiente.
- La escala AMEF personalizada se guarda en `config` (JSONB) y se conserva en el
  snapshot; el CHECK de BD solo garantiza ≥ 1 (el máximo lo valida el servidor).
- La recurrencia usa coincidencias estructuradas y de texto simples (sin IA).
- RLS efectiva solo con el rol `gapsi_app`; en desarrollo la app conecta como
  propietario y las pruebas fuerzan el rol.
- **Pendientes para futuras tareas:** IA/semántica, auditorías, proyectos, Gantt,
  HACCP, exportación avanzada.
