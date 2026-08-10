# Product Brief — GAPSI Sentinel

## Problema

Muchas empresas de alimentos administran calidad e inocuidad con hojas de cálculo, carpetas, correos y mensajes dispersos. Esto dificulta conocer su cumplimiento real, priorizar brechas y prepararse para auditorías.

## Usuario principal

Responsable, coordinador, gerente o consultor de calidad e inocuidad de una empresa de alimentos.

## Propuesta de valor

Sistema **SaaS B2B** para gestionar, evaluar y mejorar sistemas de gestión y
cumplimiento: **conocer el estado del sistema, identificar brechas, decidir qué
hacer y dar seguimiento hasta el cierre**, con datos reales y trazabilidad.

Sentinel **nació** como diagnóstico digital para **alimentos** y evoluciona hacia
una **plataforma multisectorial** (calidad, alimentos, manufactura, farmacéutica,
seguridad y salud, medio ambiente, cumplimiento general). El principio es
**Sector → esquema(s) → requisitos → capacidades del Core**: los verticales
reutilizan un mismo Core (documentos, auditorías, CAPA, tareas, proyectos, análisis,
Estudios de Datos, evidencia) en vez de duplicar módulos por norma. La arquitectura
de esa evolución (catálogo maestro, versionado, crosswalk, vigilancia normativa)
está en `docs/architecture/COMPLIANCE-PLATFORM-ARCHITECTURE.md` (ARCH-004) y el orden
del trabajo en `docs/roadmap/SECTOR-ROADMAP.md`. **Es arquitectura, no módulos
implementados todavía.**

## Sentinel hoy (capacidades actuales)

- **Diagnósticos** — evaluación de cumplimiento por esquema, resultado y brechas.
- **Documentos** — control documental con versionado automático, flujo,
  distribución y copias controladas.
- **CAPA** — acciones correctivas guiadas por etapas hasta el cierre.
- **Análisis** — herramientas de causa (5 Porqués formal, FTA, Ishikawa, Árbol de
  causas, AMEF, Pareto, recurrencia, comparativo), transversales a CAPA, proyectos,
  hallazgos y eventos.
- **Estudios de Datos** — análisis estadístico ad hoc (importar CSV/XLSX/pegado,
  clasificar variables, calidad, tendencias/correlación/regresión/ANOVA/chi²) con
  interpretación determinista y reproducible.
- **Tareas y Proyectos** — gestión transversal del trabajo.
- **Auditorías** — del programa al seguimiento, con preparación.
- **Indicadores y Analítica** — KPI, Pareto, tendencias, estadística y calidad de
  datos sobre el dato capturado una sola vez.

Ver `docs/product/CURRENT-CAPABILITY-MAP.md` para el mapa detallado.

## Roadmap (no implementado aún)

Deuda Core (autenticación productiva, notificaciones, Riesgos, Proveedores,
Capacitación, Activos/Mantenimiento) y la **evolución multisectorial** por familias
(Quality, Food, Manufacturing, Pharma, EHS, Regulatory Intelligence). Detalle y orden
en `docs/roadmap/SECTOR-ROADMAP.md`. No se muestran en la interfaz hasta ser reales.

---

_El resto de este documento conserva el alcance original del MVP de diagnóstico
(historia del producto)._

## Alcance del MVP

### Organización y acceso

- Una organización puede tener usuarios.
- Roles iniciales: `owner`, `admin`, `evaluator`, `viewer`.
- Todo dato operativo pertenece a una organización.

### Diagnóstico

- Crear diagnóstico con nombre, marco de evaluación, planta o sitio, responsable y fecha objetivo.
- Estados: `draft`, `in_progress`, `submitted`, `reviewed`, `archived`.
- El diagnóstico usa una versión congelada de una plantilla.

### Cuestionario

- Estructura: marco > sección > requisito > pregunta.
- Tipos iniciales:
  - sí/no;
  - selección única;
  - texto;
  - no aplica.
- Cada pregunta define peso y criterio de puntuación.

### Evidencia

- Nota o referencia de evidencia.
- Carga de archivo privado cuando la infraestructura esté configurada.
- Estado: `not_provided`, `provided`, `accepted`, `rejected`.

### Resultados

- Cumplimiento total.
- Cumplimiento por sección.
- Requisitos críticos incumplidos.
- Clasificación de riesgo.
- Lista priorizada de brechas.
- Resumen ejecutivo imprimible.

### Seguimiento comercial

- Nombre y datos básicos de la organización.
- Contacto principal.
- Estado comercial básico del diagnóstico.
- Notas internas.

## Fuera de alcance

- Certificar oficialmente a una empresa.
- Sustituir a un organismo certificador.
- Declarar cumplimiento legal definitivo.
- Interpretar automáticamente documentos con IA.
- Emitir recomendaciones legales.
- Construir todos los módulos futuros de Sentinel.

## Principios de producto

1. Trazabilidad.
2. Explicabilidad de la puntuación.
3. Seguridad por organización.
4. Simplicidad operativa.
5. Configuración sin código en fases posteriores.
6. Resultados orientados a acciones.

## Métrica inicial de éxito

- Completar un diagnóstico real sin intervención técnica.
- Obtener reporte entendible en menos de dos minutos.
- Identificar claramente las cinco brechas prioritarias.
- Conseguir al menos un cliente piloto dispuesto a pagar.
