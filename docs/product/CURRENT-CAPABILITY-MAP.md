# GAPSI Sentinel — Mapa de capacidades actual

Referencia única del estado real del producto (CORE-ALIGN-001). Distingue lo que
**existe hoy** de lo que es **roadmap**. Se actualiza antes de cada nueva tarea.

## Capacidades activas

| Área         | Capacidad                                                                           | Estado | Ruta                       | Fuente de verdad                        |
| ------------ | ----------------------------------------------------------------------------------- | ------ | -------------------------- | --------------------------------------- |
| Diagnósticos | Evaluación de cumplimiento por esquema, resultado y brechas                         | Activo | `/dashboard/diagnostics`   | `diagnostics` (+ plantillas congeladas) |
| Documentos   | Control documental (versión automática, flujo, distribución, copias)                | Activo | `/dashboard/documents`     | `documents` / `document_versions`       |
| CAPA         | Acciones correctivas por etapas (contención→eficacia→cierre)                        | Activo | `/dashboard/capa`          | `capas` / `capa_actions`                |
| Análisis     | Herramientas de causa (5 porqués, Ishikawa, Pareto, AMEF, recurrencia, comparativo) | Activo | `/dashboard/capa/analysis` | `quality_analyses`                      |
| Tareas       | Gestor global (lista/kanban/calendario/gantt/carga)                                 | Activo | `/dashboard/tasks`         | `tasks`                                 |
| Proyectos    | Proyectos con hitos, dependencias y cronograma                                      | Activo | `/dashboard/projects`      | `projects`                              |
| Auditorías   | Programa → auditoría → checklist → hallazgos → seguimiento; preparación             | Activo | `/dashboard/audits`        | `audits` / `audit_findings`             |
| Indicadores  | KPI configurables calculados sobre el dato único                                    | Activo | `/dashboard/kpis`          | `kpi_definitions` / `kpi_results`       |
| Analítica    | Pareto, tendencias, relaciones, estadística y calidad de datos; eventos + alertas   | Activo | `/dashboard/analytics`     | `quality_events` + agregación en vivo   |

Fundación transversal: autenticación de desarrollo (sesión fija), organización/
sitio por contexto, aislamiento por organización (RLS), historiales append-only.

## Aún no implementado (roadmap)

- Autenticación productiva (registro, SSO, recuperación).
- Notificaciones reales (centro de notificaciones).
- Cambio de organización/sitio desde la barra superior.
- Sentinel Score (definición de salud del sistema).
- Módulos de negocio nuevos: Riesgos, Proveedores, Capacitación, HACCP, Fraude
  alimentario, Food Defense, Recall/Trazabilidad, Producción.
- IA / RAG / búsqueda web / ML.
- Exportación PDF/DOCX avanzada, firma electrónica avanzada.
- Integraciones externas, facturación, infraestructura productiva.

Estos elementos **no** se muestran como "Próximamente" en la interfaz: aparecerán
cuando exista una capacidad real.
