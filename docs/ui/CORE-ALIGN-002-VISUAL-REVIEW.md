# CORE-ALIGN-002 — Revisión visual (Dashboard Ejecutivo)

Acercamiento visual al mockup ejecutivo aprobado conservando la estructura de
CORE-ALIGN-001 y usando **datos exclusivamente reales**. Verificado con la app
corriendo (`next dev`, sesión demo) por extracción de DOM/texto.

**Nota de entorno:** el panel del navegador no compone frames en esta sesión, por
lo que **no fue posible generar las capturas PNG**. La verificación se hizo por
DOM/texto y build/tests. Queda pendiente capturar 1920/1440/390 en un entorno con
panel visible (guardar en `docs/ui/screenshots/core-align-002/`).

## Qué se tomó del mockup ejecutivo

- Estructura de "centro de control": franja de contexto + fila de KPIs + grid de
  tarjetas (3 columnas en desktop grande).
- Sidebar azul marino sólido con branding; topbar clara y compacta.
- Densidad ejecutiva (tarjetas compactas, tipografía más ajustada).
- Gauge de estado, barras de cumplimiento, mini-Gantt y línea de tendencia.

## Qué NO se replicó del mockup y por qué

- **Tema oscuro:** se mantiene el tema claro de Sentinel (regla del producto);
  solo se adopta la arquitectura visual del mockup, no su paleta oscura.
- **Sentinel Score:** no se implementa (no existe definición real). En su lugar,
  "Estado del sistema" muestra el resultado real de la evaluación vigente.
- **Certificación "saludable" / inferencias:** omitidas (implican una inferencia
  inexistente).
- **IA Insights:** omitido (no hay IA real).
- Cifras "Hace 2 min", porcentajes y tendencias de ejemplo del mockup: sustituidas
  por datos reales del sistema.

## Datos reales utilizados (verificado en vivo)

| Sección                | Fuente real                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| Esquemas activos       | `assessment_frameworks` (p. ej. "Diagnóstico interno HACCP")                               |
| Último movimiento      | `MAX(updated_at/created_at)` entre tareas/CAPA/documentos/auditorías/eventos → "Hace 15 h" |
| Próxima auditoría      | `audits` planeadas (AUD-2026-0002 · 2026-11-30)                                            |
| Tiempo restante        | días hasta la próxima auditoría ("En 114 días")                                            |
| 6 KPI                  | resúmenes reales de diagnósticos/tareas/CAPA/hallazgos/documentos/auditorías               |
| Estado del sistema     | `getPreviewResult` de la evaluación más reciente (gauge)                                   |
| Cumplimiento esquema   | resultado por esquema                                                                      |
| Centro de alertas      | CAPA vencidas/próximas, revisión documental, auditorías, hallazgos mayores                 |
| Estado auditorías      | `getAuditSummary` (programadas/seguimiento/hallazgos)                                      |
| Mini-Gantt             | proyectos activos con fechas + hitos (PRJ-2026-\*)                                         |
| Tendencia 12 meses     | dataset unificado (eventos de calidad / CAPA / hallazgos)                                  |
| Próximas acciones      | tareas vencidas/próximas + hitos                                                           |
| Documentos y proyectos | `getDocSummary` / `getProjectSummary`                                                      |

**Honestidad de datos:** cuando la evaluación más reciente aún está en captura
(borrador/en progreso), el gauge muestra el porcentaje real pero lo etiqueta
**"Evaluación en progreso"** (sin veredicto final de riesgo) y la barra por
esquema añade "· en progreso"; el número es el mismo que muestra la página del
diagnóstico. Si no hubiera ninguna evaluación, se muestra "Sin evaluación
vigente" con CTA. No hay porcentajes inventados.

## Sin duplicación

Los hallazgos aparecen en el Centro de alertas (mayores) y **no** se re-listan en
"Estado de auditorías" (solo contadores). Las tareas se listan en "Próximas
acciones"; el Centro de alertas se centra en CAPA/documentos/auditorías.

## Responsive

- KPIs: 6 → 3 (≤1439) → 2 (≤768) → 1 (≤480).
- Grid ejecutivo: 3 columnas (≥1440) → 2 (≤1439) → 1 (≤768).
- Franja de contexto: 4 → 2 → 1.
- Sidebar: solución de CORE-ALIGN-001 (franja horizontal en móvil, ~216 px en
  escritorio).

## Pendientes

- Generar capturas PNG (bloqueadas por el entorno).
- Cuando exista una evaluación enviada/revisada en el seed, el gauge y las barras
  mostrarán el veredicto de riesgo final (hoy la demo tiene la evaluación en
  borrador, por eso se etiquetan "en progreso").
