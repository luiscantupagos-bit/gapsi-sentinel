# GAPSI Sentinel — Mapa de capacidades actual

Referencia única del estado real del producto (CORE-ALIGN-001). Distingue lo que
**existe hoy** de lo que es **roadmap**. Se actualiza antes de cada nueva tarea.

## Capacidades activas

| Área              | Capacidad                                                                                                                                                              | Estado | Ruta                                                   | Fuente de verdad                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------ | ------------------------------------------------------------------- |
| Diagnósticos      | Evaluación de cumplimiento por esquema, resultado y brechas                                                                                                            | Activo | `/dashboard/diagnostics`                               | `diagnostics` (+ plantillas congeladas)                             |
| Documentos        | Control documental (versión automática, flujo, distribución, copias)                                                                                                   | Activo | `/dashboard/documents`                                 | `documents` / `document_versions`                                   |
| CAPA              | Acciones correctivas por etapas (contención→eficacia→cierre)                                                                                                           | Activo | `/dashboard/capa`                                      | `capas` / `capa_actions`                                            |
| Análisis          | Herramientas de causa (5 Porqués formal, FTA, Ishikawa, Pareto, AMEF, recurrencia, comparativo); transversal a CAPA/proyecto/hallazgo/evento vía `analysis_relations`  | Activo | `/dashboard/capa/analysis`, `/dashboard/analysis/[id]` | `quality_analyses` / `analysis_relations` / `fta_nodes`             |
| Estudios de datos | Análisis estadístico ad hoc: importar CSV/XLSX/pegado, clasificar variables, calidad, variables calculadas, métodos reutilizando motores + interpretación determinista | Activo | `/dashboard/analytics/studies`                         | `data_studies` / `study_datasets` / `study_rows` / `study_analyses` |
| Tareas            | Gestor global (lista/kanban/calendario/gantt/carga)                                                                                                                    | Activo | `/dashboard/tasks`                                     | `tasks`                                                             |
| Proyectos         | Proyectos con hitos, dependencias y cronograma                                                                                                                         | Activo | `/dashboard/projects`                                  | `projects`                                                          |
| Auditorías        | Programa → auditoría → checklist → hallazgos → seguimiento; preparación                                                                                                | Activo | `/dashboard/audits`                                    | `audits` / `audit_findings`                                         |
| Indicadores       | KPI configurables calculados sobre el dato único                                                                                                                       | Activo | `/dashboard/kpis`                                      | `kpi_definitions` / `kpi_results`                                   |
| Analítica         | Pareto, tendencias, relaciones, estadística y calidad de datos; eventos + alertas                                                                                      | Activo | `/dashboard/analytics`                                 | `quality_events` + agregación en vivo                               |

Fundación transversal: autenticación de desarrollo (sesión fija), organización/
sitio por contexto, aislamiento por organización (RLS), historiales append-only.

## Aún no implementado (roadmap)

- Autenticación productiva (registro, SSO, recuperación).
- Notificaciones reales (centro de notificaciones).
- Cambio de organización/sitio desde la barra superior.
- Sentinel Score (definición de salud del sistema).
- Módulos de negocio nuevos: Riesgos, Proveedores, Capacitación, HACCP, Fraude
  alimentario, Food Defense, Recall/Trazabilidad, Producción.
- SPC avanzado en Estudios de datos (Cp/Cpk, cartas de control Xbar-R/S · I-MR ·
  p/np/c/u, normalidad, DOE, multivariante, ML) — diferido; base preparada en el
  adaptador de análisis.
- Editor transversal para AMEF/Pareto/Ishikawa fuera de una CAPA (hoy 5 Porqués y
  FTA se editan en `/dashboard/analysis/[id]`; el resto sigue CAPA-scoped).
- IA / RAG / búsqueda web / ML.
- Exportación PDF/DOCX avanzada, firma electrónica avanzada.
- Integraciones externas, facturación, infraestructura productiva.

Estos elementos **no** se muestran como "Próximamente" en la interfaz: aparecerán
cuando exista una capacidad real.

## Arquitectura futura (solo diseño, ARCH-004)

La evolución hacia **plataforma multisectorial de cumplimiento** (sectores,
frameworks vs capacidades, catálogo maestro versionado, crosswalk, aplicabilidad,
vigilancia normativa) está **documentada como arquitectura**, sin módulos, tablas ni
pantallas nuevas: `docs/architecture/COMPLIANCE-PLATFORM-ARCHITECTURE.md`,
`docs/architecture/SECTOR-FRAMEWORK-CAPABILITY-MODEL.md`,
`docs/architecture/MASTER-COMPLIANCE-CATALOG.md`,
`docs/architecture/REGULATORY-INTELLIGENCE.md` y `docs/roadmap/SECTOR-ROADMAP.md`.
