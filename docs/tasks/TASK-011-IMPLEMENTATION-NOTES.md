# TASK-011 — Modelo común de eventos, KPI y análisis estadístico (notas)

## Principio

**Capturar el dato una sola vez y reutilizarlo.** Los registros operativos
(eventos, CAPA, hallazgos, tareas, proyectos, AMEF, análisis) alimentan
automáticamente KPI, Pareto, tendencias, tasas, comparativas, distribuciones,
recurrencia, correlación, estadística básica y alertas internas — sin recapturar
ni duplicar. **Sin IA, sin ML, sin predicción, sin causalidad automática, sin
análisis opacos.** Todo se calcula en servidor, es determinista y auditable.

## Estrategia de eventos: híbrido en vivo

`quality_events` es fuente de verdad **solo** para eventos:

- **manuales** creados directamente,
- **nativos** registrados en el módulo,
- **convertidos** explícitamente (conservan `source_type` / `source_id`).

Los datos de los módulos existentes **se agregan en vivo** desde su fuente
original (sin materializar, sin backfill, sin duplicar estados/responsables/
fechas). El servicio `loadUnifiedEvents` (`src/server/analytics.ts`) consulta
cada fuente bajo contexto RLS y `buildUnifiedDataset`
(`src/features/analytics/unified-events.ts`) los proyecta a un `UnifiedEvent`
común.

**Clasificación de fuentes** (documentada en `SOURCE_CLASSIFICATION`):

| Fuente                                                              | Tipo     |
| ------------------------------------------------------------------- | -------- |
| `quality_event`                                                     | nativa   |
| capa, capa_action, audit_finding, task, project, fmea_row, analysis | agregada |

**Deduplicación:** un evento nativo con `source_type`/`source_id` **suprime** el
registro agregado equivalente (el nativo es la representación canónica del hecho
convertido). Así el mismo hecho no se cuenta dos veces. Abrir un registro
agregado desde Analítica navega a su **módulo original** (`href`).

## Modelo de datos y migración

Migración `prisma/migrations/20260807000000_events_kpi_analytics` (13 tablas):
`quality_events` (+ `quality_event_folio_counters`, `quality_event_categories`,
`quality_event_subcategories`, `quality_catalog_values`,
`quality_event_relations`, `quality_event_history`), `kpi_definitions` (+
`kpi_folio_counters`, `kpi_results`), `quality_alert_rules`, `quality_alerts` y
`analytics_saved_views`.

Separación estricta **Evento ≠ Dimensión ≠ Métrica ≠ KPI ≠ Resultado ≠
Análisis**. JSONB solo para configuración/filtros estructurados/metadata (filtros,
dimensiones y metas de KPI). Dimensiones categoría/subcategoría con **FK**;
área/proceso/producto/máquina/turno/proveedor/lote son **campos textuales
provisionales** (admiten entidades futuras sin inventarlas hoy).

Generada con `prisma migrate diff --from-schema-datamodel <antes>
--to-schema-datamodel <después>` (**0 DROP heredado**). FK compuestas anti-cruce a
organización/sitio y categoría, FK de usuario `RESTRICT`, CHECK de enums,
historial **append-only**, **no-borrado físico**, RLS por organización y grants a
`gapsi_app`. No modifica migraciones previas.

## Motores (puros, en `src/features/analytics/`)

- **kpi-engine.ts** — medidas `count/sum/average/median/percentage/rate/
proportion/avg_duration/compliance/recurrence`; filtrado estructurado;
  agrupación por periodo `diario/semanal(ISO)/mensual/trimestral/anual`;
  evaluación de estado `on_target/warning/off_target/no_data` según meta,
  umbrales y dirección deseada.
- **pareto-trends.ts** — Pareto por dimensión con peso frecuencia/costo/cantidad/
  duración (reutiliza `computePareto` 80/20) + tendencia por mínimos cuadrados.
- **statistics.ts** — descriptiva, Pearson, Spearman, regresión lineal simple,
  contingencia + chi², ANOVA de una vía.
- **data-quality.ts** — faltantes, sin clasificar, posibles duplicados,
  completitud e inconsistencias (reporta, no corrige).
- **alerts.ts** — reglas deterministas con `dedupeKey` estable.

## Precisión (documentada y probada)

- **Redondeo:** half-up a `decimals` (2 por defecto en KPI; 4 en estadística).
- **División entre cero:** `null` (dato no disponible), nunca 0 ni NaN.
- **Nulos:** se ignoran en suma/promedio/mediana; si no queda valor → `null`.
- **Muestra insuficiente:** se marca y el estado es `no_data`; nunca resultado
  engañoso.
- **Fechas:** se agrupan por `eventDate` en **UTC** (YYYY-MM-DD) para evitar
  corrimientos de zona horaria.
- **Unidades:** el KPI declara `unit`; el costo usa `Decimal(16,2)`.

## Estadística interpretable

Pearson/Spearman informan `r`, fuerza por bandas y notabilidad **α=0.05** (t
tabulada); regresión reporta pendiente/intercepto/R²/n + recta + dispersión;
contingencia reporta χ², gl, esperadas y advierte cuando alguna esperada < 5;
ANOVA reporta F y gl solo cuando las condiciones son válidas (si no, descriptiva

- advertencia). **No se inventan valores-p**: se usan valores críticos α=0.05
  tabulados. Cada resultado incluye una interpretación prudente que **jamás afirma
  causa** ("los defectos presentan mayor frecuencia en registros asociados a X; se
  requiere investigación adicional antes de establecer causalidad").

## Privacidad

Las dimensiones estadísticas por defecto son turno/área/proceso/categoría, **no
nombres individuales**; no hay rankings personales. El análisis por responsable
queda disponible pero no se promueve por defecto.

## KPI y alertas (servidor)

- `src/server/kpis.ts` — alta de definiciones (código `KPI-####`), `buildKpiConfig`
  (mapea `source` → fuentes del dataset + filtros), cálculo en vivo y
  `recomputeKpiResults` (upsert de la **caché** `kpi_results` por kpi+periodo; no
  es una segunda fuente de verdad).
- `src/server/quality-alerts.ts` — deriva reglas de los KPI activos (fuera de meta
  - tendencia desfavorable), evalúa reglas persistidas y guarda alertas
    **deduplicadas** por organización+`dedupe_key` sin reabrir lo resuelto.

## UI

- `/dashboard/quality-events` (+ `/new`): registro/listado de eventos nativos.
- `/dashboard/kpis` (+ `/new`, `/[kpiId]`): constructor, listado con valor/estado/
  tendencia y detalle con serie por periodo (barras SVG) y recálculo.
- `/dashboard/analytics`: pestañas **Resumen / Pareto / Tendencias / Relaciones /
  Estadística / Calidad de datos**, con alertas internas (evaluar/resolver).

## Pruebas y reconstrucción

Pruebas de dominio (`tests/analytics-*.test.ts`, 57 casos) y BD
(`tests/db/analytics-unified.test.ts`: dataset unificado, dedup, RLS;
`schema-integrity` ampliada con FK/CHECK/append-only/no-borrado/RLS/grants de
TASK-011). Reconstrucción desde base vacía: `docker compose down -v` →
`db:up` → `db:generate` → `db:migrate` → `db:seed` ×2 → `test:db`, sin SQL manual.

## Limitaciones

Sin IA/ML/predicción/causalidad automática. El KPI `source = documents` queda
declarado pero sin adaptador en vivo (pendiente). El modelo queda preparado para
que una IA futura consuma el dataset unificado **sin campos de IA añadidos hoy**.
