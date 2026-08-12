# Estudios de Datos — Arquitectura (CORE-ALIGN-003)

Los **Estudios de Datos** permiten análisis estadístico ad hoc sobre información
importada (CSV/XLSX/pegado), independiente o vinculada a otros orígenes. Reutilizan
los motores deterministas existentes; **no** reimplementan matemática, **no** usan
IA y **no** afirman causalidad.

Ruta: `/dashboard/analytics/studies` · Folio: `EST-AAAA-NNNN` (por organización y año).

## Modelo de datos

| Tabla                       | Rol                                                                               |
| --------------------------- | --------------------------------------------------------------------------------- |
| `data_studies`              | El estudio: folio, objetivo, pregunta, estado, `conclusion` (humana), origen.     |
| `data_study_folio_counters` | Contador atómico por organización/año (`EST-AAAA-NNNN`).                          |
| `study_datasets`            | Una **versión** de datos importada (`@@unique([studyId, version])`) + checksum.   |
| `study_variables`           | Columna: tipo (`numeric\|categorical\|temporal\|text`), `calculated`, `formula`.  |
| `study_rows`                | Una fila = una observación; `values` JSONB por `columnKey`. FK compuesta por SQL. |
| `study_analyses`            | Análisis **congelado**: método, `config`, `result`, `interpretation`.             |
| `data_study_history`        | Historial append-only.                                                            |

### Reimportar = nueva versión

Reimportar no muta datos previos: crea `study_datasets.version + 1` con sus filas.
Los `study_analyses` guardan `datasetId` + `config.datasetVersion`, así que **un
análisis histórico nunca cambia** aunque el dataset se reimporte o se editen tipos.

### Variables calculadas (sin `eval`)

`formula` es un AST seguro (`col | const | op(+,-,*,/)`), evaluado por
`evalFormula` (`src/features/studies/formula.ts`). **No se almacenan**: se computan
al leer (`getDatasetPage`, `loadResolvedRows`) para no romper la reproducibilidad.
División entre cero → `null` + bandera `divisionByZero`. Ejemplo sembrado:
`Desviación % = ((medida_real − medida_nominal) / medida_nominal) × 100`.

## Importación → preview → clasificación → calidad → confirmación

- **Parser** (`src/features/studies/dataset.ts`): CSV/TSV propio (comillas, comillas
  escapadas `""`, saltos internos, autodetección de delimitador `, ; \t`). XLSX vía
  `exceljs` (solo lectura, **sin macros**; se rechazan `.xlsm`/`.xls`). Pegado = TSV.
- **Límites** (`DATASET_LIMITS`): 20 000 filas, 100 columnas, 10 MB.
- **Clasificación** (`classifyColumn`): numérica ≥ 0.8, temporal ≥ 0.8, si no
  categórica/texto por cardinalidad.
- **Calidad** (`data-quality.ts`): faltantes, duplicados exactos, no numéricos,
  distintos, min/max y atípicos por `1.5·IQR`. Se reporta sin corregir.

## Adaptador de análisis (reutiliza motores)

`src/features/studies/analysis-adapter.ts` extrae series de las filas y delega en:

- `src/features/analytics/statistics.ts` (TASK-011): `describe`, `pearson`,
  `spearman`, `linearRegression`, `oneWayAnova`, `contingencyChiSquare`.
- `computePareto` (`src/features/capa/analysis-state.ts`).

Métodos: descriptivos, Pareto, tendencia, correlación, regresión, comparación de
grupos, ANOVA y chi-cuadrada. Cada uno devuelve un resultado serializable.

## Interpretación determinista (3 niveles)

`src/features/studies/interpretation.ts` produce **RESULTADO PRINCIPAL /
INTERPRETACIÓN / SIGUIENTE PASO** por método. Reglas:

- Nunca afirma causalidad: usa «asociación», «diferencia», «tendencia»,
  «concentración», «requiere investigación».
- Nunca inventa valores‑p; si el motor no calcula significancia, no la afirma.
- Honesta ante muestra insuficiente.

La **conclusión del responsable** (`data_studies.conclusion`) es humana y se guarda
**separada** de la interpretación automática. Desde un resultado se pueden crear
acciones contextuales (CAPA/tarea/proyecto).

## Seed demo

`EST-2026-0001` (org demo A): 40 observaciones ene–mar 2026 con
`fecha/pieza/medida_nominal/medida_real/turno/operador/maquina/proveedor/lote_material/temperatura`
y la variable calculada `Desviación %`. Deterministas (sin aleatoriedad), aptas para
Pareto (por defecto/turno/máquina), tendencia (mensual) y comparación de grupos.

## Reglas duras

Sin `eval`, sin macros, sin IA, sin modificar datasets históricos. Reconstrucción
desde cero mediante `db:reset:local` (migración `20260808000000_analysis_studies`).

## FUTURE — SPC avanzado (diferido)

Deliberadamente **fuera de alcance** de CORE-ALIGN-003 y a implementar en una tarea
posterior sobre esta misma base (nuevos métodos en el adaptador + interpretación):

- Capacidad de proceso: Cp/Cpk, Pp/Ppk.
- Cartas de control: Xbar‑R/S, I‑MR, p/np/c/u.
- Pruebas de normalidad, DOE, análisis multivariante y ML.

El `study_analyses.method` es un texto abierto: agregar un método SPC significa
sumar un caso al adaptador, su interpretación prudente y su render, sin cambios de
esquema.
