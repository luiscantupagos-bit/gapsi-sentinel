# GAPSI Sentinel — Arquitectura de plataforma de cumplimiento (ARCH-004)

Documento de arquitectura. **No implementa** módulos, migraciones ni UI: fija la
arquitectura futura para que GAPSI Sentinel sea una **plataforma configurable**
de sistemas de gestión y cumplimiento, multisectorial, sin crear un módulo
incompatible por cada norma.

> Estado: propuesta arquitectónica. Ver `MASTER-COMPLIANCE-CATALOG.md`,
> `REGULATORY-INTELLIGENCE.md`, `SECTOR-FRAMEWORK-CAPABILITY-MODEL.md` y
> `docs/roadmap/SECTOR-ROADMAP.md`.

## 1. Visión

Sentinel deja de conceptualizarse **solo** como software para alimentos. Se
modela como capas reutilizables:

```
CORE TRANSVERSAL
  + SECTOR(es)
  + ESQUEMA(s) / MARCO(s)
  + REQUISITOS
  + CAPACIDADES
  + EVIDENCIA
  + EVALUACIÓN
  + ACCIONES
  + ACTUALIZACIONES NORMATIVAS
```

Principio rector:

```
Sector → esquema(s) → requisitos → capacidades Sentinel
```

**No:** `Sector → lista rígida de módulos`. El sector no "enciende módulos"; el
sector sugiere esquemas, los esquemas exigen requisitos, y los requisitos se
satisfacen con **capacidades** transversales del Core (documentos, auditorías,
CAPA, tareas, evidencias, etc.).

## 2. Core Sentinel (transversal, ya existente en su mayoría)

El Core es único y reutilizable; **ningún esquema duplica** estas capacidades:

- **Gestión:** Organizaciones · Sitios · Usuarios/roles · Documentos · Evidencias ·
  Auditorías · Hallazgos · Diagnósticos/evaluaciones · CAPA · Riesgos · Tareas ·
  Proyectos · Proveedores · Capacitación · Indicadores · Historial/trazabilidad ·
  Notificaciones.
- **Análisis (transversal, CORE-ALIGN-003):** herramientas de causa (5 Porqués
  formal, FTA, Ishikawa, Árbol de causas, AMEF/FMEA), Pareto, y **Estudios de
  Datos** con tendencias, correlación, regresión, ANOVA y chi-cuadrada +
  **interpretación determinista** de resultados. Se inician desde CAPA, proyecto,
  hallazgo, evento o de forma independiente (vía `analysis_relations`).

Estado actual (ver `docs/product/CURRENT-CAPABILITY-MAP.md`): Documentos, CAPA,
Análisis (incluidos 5 Porqués, FTA y Estudios de Datos), Tareas, Proyectos,
Auditorías, Diagnósticos, Indicadores y Analítica ya existen. Riesgos, Proveedores,
Capacitación, Activos/Mantenimiento y Notificaciones son Core futuro.

Que el análisis estadístico, los Estudios de Datos y (a futuro) Activos/
Mantenimiento sean **Core transversal** — no propiedad de un vertical — es una
decisión explícita (ADR §12, decisiones 12–14).

## 3. Reutilización de lo existente (NO reinventar)

El modelo actual ya aporta la **columna vertebral del catálogo**:

| Concepto de cumplimiento       | Tabla actual reutilizable                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| Marco / esquema                | `assessment_frameworks` (`scope` master/organization)                                        |
| Versión de marco (congelada)   | `template_versions` (`version_number`, `status`, `content_hash`, `source_master_version_id`) |
| Capítulo / sección             | `template_sections`                                                                          |
| Requisito                      | `template_requirements` (`is_critical`)                                                      |
| Pregunta / criterio evaluable  | `template_questions` (+ `template_answer_options`)                                           |
| Evaluación histórica inmutable | `diagnostics` + `diagnostic_answers` + snapshots de auditoría                                |
| Certificación                  | `organization_certifications`                                                                |

Ya está resuelto: **catálogo maestro vs copia de organización** (`scope`),
**múltiples versiones**, **congelado inmutable** (`content_hash`, snapshots de
auditoría). La evolución **añade columnas y tablas nuevas**, no reemplaza esta
base. Ver la propuesta de datos (§10) y `MASTER-COMPLIANCE-CATALOG.md`.

## 4. Framework ≠ Capability

- **Framework/esquema:** un cuerpo de requisitos (ISO 9001, FSSC 22000, NOM-059,
  requisito de cliente, política interna). Define **qué** hay que cumplir.
- **Capability/capacidad:** una función operativa del Core que **satisface**
  requisitos (HACCP, Food Defense, Trazabilidad, Documentos, Auditorías, CAPA,
  Activos/Mantenimiento…). Define **cómo** se cumple.

Relación **muchos-a-muchos**: un esquema requiere varias capacidades; una
capacidad sirve a varios esquemas. **No se acopla** `HACCP = FSSC`. Detalle y
catálogos por sector en `SECTOR-FRAMEWORK-CAPABILITY-MODEL.md`.

## 5. Tipos de requisito (cumplimiento general)

El mismo núcleo de cumplimiento sirve a los cuatro tipos:

- **A. Voluntario / certificable** — ISO 9001/14001/45001, FSSC, SQF, BRCGS.
- **B. Legal / regulatorio** — NOM, leyes, reglamentos, permisos, licencias.
- **C. Contractual** — requisito de cliente, corporativo, proveedor, exportación.
- **D. Interno** — política corporativa, estándar interno, especificación propia.

Todos comparten: catálogo → versión → requisito → aplicabilidad → evidencia →
evaluación → acción → historial.

## 6. Sistemas integrados de gestión (SIG)

La arquitectura permite un **Sistema Integrado**: ISO 9001 + 14001 + 45001 con un
solo procedimiento documental, una auditoría integrada, una CAPA, un riesgo, un
proyecto y una evidencia — con **trazabilidad por requisito** vía relaciones
requisito↔evidencia y **crosswalk** (`SECTOR-FRAMEWORK-CAPABILITY-MODEL.md` §
Crosswalk). Ejemplo desarrollado en §9.

## 7. Multitenencia y seguridad

- **Catálogo maestro:** global, administrado por GAPSI. Objetos con
  `scope = master` y `organization_id = NULL`.
- **Adopción / datos de organización:** aislados por tenant (RLS por
  `organization_id = fn_current_org()`, como hoy).
- Un tenant **no puede**: editar el catálogo maestro; ver evaluaciones/
  actualizaciones de otro tenant; alterar una actualización de otro tenant.
- **Regla de RLS con objetos globales:** las tablas maestras son de solo lectura
  para `gapsi_app` (SELECT), escritura reservada al rol editorial de GAPSI; las
  tablas de negocio conservan su RLS por organización. Un objeto global **no
  relaja** la RLS del negocio: la adopción se materializa siempre en filas de
  la organización (copia/suscripción), nunca leyendo directamente el maestro con
  contexto de otro tenant.

## 8. Licenciamiento futuro (solo arquitectura)

Preparar la habilitación por **paquetes**, sin implementar billing ni precios:
Sentinel Core · Quality · Food · Manufacturing · Pharma · EHS · Regulatory
Intelligence. La UI **no muestra** sectores/módulos sin licencia/capacidad real
(ver navegación §11). Mecanismo conceptual: un registro de **entitlements** por
organización (qué sectores/frameworks/capacidades están habilitados) que la
navegación y la suscripción a marcos consultan. No se fija esquema de precios.

## 9. Ejemplos (casos de referencia)

### 9.1 Industrial (SIG multiesquema)

`ORG INDUSTRIAL DEMO`, Planta Monterrey: ISO 9001 + ISO 14001 + ISO 45001 +
NOM-STPS aplicables + requisitos de cliente. Un documento **"Procedimiento de
auditoría interna"** se relaciona con requisitos de los tres ISO (evidencia
reutilizable, no triplicada). Una **auditoría integrada** evalúa requisitos de
los tres marcos; una **CAPA** cierra hallazgos relacionados.

### 9.2 Alimentos

Planta de alimentos: FSSC 22000 + requisitos de cliente. Capacidades: HACCP,
Food Defense, Food Fraud, Proveedores, Trazabilidad, Recall, CAPA, Documentos,
Auditorías. **No se duplican módulos por FSSC** — FSSC exige capacidades que ya
existen. Ver `SECTOR-FRAMEWORK-CAPABILITY-MODEL.md` § Food.

### 9.3 Farmacéutica

Planta pharma: NOM-059 (+ ISO 9001 si aplica). Activo **Mezclador MX-01** se
relaciona con manual, ficha técnica, layout, calificación, mantenimiento,
calibración, desviaciones y CAPA. La **transferencia tecnológica** vincula
documentos, equipos, validaciones, capacitación, lotes y desviaciones. Ver
`SECTOR-FRAMEWORK-CAPABILITY-MODEL.md` § Pharma y § Activos/Ingeniería.

### 9.4 Actualización normativa (extremo a extremo)

Marco versión A activo → GAPSI publica versión B → Sentinel: (1) crea
actualización, (2) notifica, (3) muestra diferencias, (4) identifica objetos
relacionados, (5) el responsable evalúa aplicabilidad, (6) crea tareas/proyecto/
CAPA si corresponde, (7) implementa, (8) verifica, (9) cierra, (10) conserva el
historial de la versión A. Flujo detallado en `REGULATORY-INTELLIGENCE.md`.

## 10. Modelo de datos — PROPUESTA (sin migración)

**ARCH-004 no crea migración.** Se documenta la evolución; los nombres no son
definitivos y se reutilizan tablas actuales cuando es razonable.

### 10.1 Reutilizar / extender (tablas existentes)

- `assessment_frameworks` → añadir (futuro): `sector_id`, `family`,
  `framework_type` (voluntary/legal/contractual/internal), `issuer`,
  `jurisdiction`, `source_url`, `mandatory`, `effective_date`,
  `expiration_date`. (Hoy ya tiene `scope`, `code`, `name`.)
- `template_versions` → añadir estados de marco (§16 de la tarea) y fechas de
  vigencia/transición; conserva `content_hash`, `source_master_version_id`.
- `template_sections` / `template_requirements` / `template_questions` /
  `template_answer_options` → siguen siendo la estructura del cuerpo normativo.
- `diagnostics` + snapshots de auditoría → siguen siendo la evaluación histórica
  inmutable. **No se recalculan** al publicar una versión nueva.

### 10.2 Entidades conceptuales NUEVAS (a evaluar en tareas REG-\*)

`compliance_sectors` · `compliance_capabilities` ·
`framework_capabilities` (M:N esquema↔capacidad) · `requirement_versions`
(linaje de un requisito entre versiones) · `requirement_relationships` /
`requirement_crosswalks` (equivalencias) · `framework_subscriptions`
(activar/suspender/migrar/retirar por org/sitio) · `requirement_applicability`
(matriz de aplicabilidad) · `requirement_evidence_links` (evidencia reutilizable
M:N) · `regulatory_changes` + `regulatory_change_items` · `requirement_changes`
(tipo de cambio: nuevo/modificado/eliminado/renumerado/sustituido/aclaración/
editorial/alcance) · `organization_regulatory_updates` ·
`regulatory_impact_assessments` · `regulatory_update_actions`.

Detalle campo por campo en `MASTER-COMPLIANCE-CATALOG.md` y
`REGULATORY-INTELLIGENCE.md`. **Ninguna** se implementa en ARCH-004.

## 11. Navegación futura (no se modifica ahora)

El sidebar actual **no cambia**. Evolución documentada (solo si hay
licencia/capacidad real):

```
PANEL
CUMPLIMIENTO   Diagnósticos · Auditorías · Documentos · Esquemas
MEJORA         CAPA · Análisis
TRABAJO        Tareas · Proyectos
DESEMPEÑO      Indicadores · Analítica
--- solo si habilitado ---
SEGURIDAD · MEDIO AMBIENTE · MANUFACTURA · FARMACÉUTICA · …
VIGILANCIA NORMATIVA (Regulatory Intelligence)
```

Nuevas pantallas futuras (solo especificación): `/dashboard/compliance/frameworks`
("Esquemas") y `/dashboard/compliance/updates` ("Vigilancia normativa") — ver
`REGULATORY-INTELLIGENCE.md`.

## 12. Decisiones (ADR-like)

Registro de decisiones de arquitectura de ARCH-004 (numeración estable para
auditoría):

1. **Framework ≠ capability.** El esquema define requisitos (qué); la capacidad
   los satisface (cómo). Se modelan por separado.
2. **Una capability sirve a múltiples frameworks** (relación M:N); no se acopla
   una disciplina a un solo esquema.
3. **Una organización puede activar múltiples frameworks** (y combinaciones
   distintas por sitio); la suscripción es por org/sitio, no global.
4. **Los frameworks son versionados.** Cada versión se publica y congela; conviven
   `A:2015` y `A:2026`.
5. **Las evaluaciones históricas son inmutables.** Nunca se sobrescribe un
   requisito publicado ni una evaluación/diagnóstico/auditoría pasada.
6. **Una actualización normativa no modifica el pasado.** Genera una
   actualización/impacto; el historial de la versión anterior se conserva.
7. **Una evidencia puede servir a múltiples requisitos** (M:N; no se duplica el
   archivo, se relaciona) — y un requisito puede relacionarse con varias
   evidencias.
8. **La aplicabilidad es una decisión controlada** (humana), con justificación,
   responsable y fecha; no se infiere automáticamente.
9. **El catálogo maestro ≠ adopción del cliente.** GAPSI administra el maestro
   global; la organización conserva su copia/suscripción/historial (tenant-scoped).
10. **Los verticales reutilizan el Core.** No se duplican Documentos/CAPA/
    Auditorías/Proyectos/AMEF/etc. por sector o esquema.
11. **Incorporar solo contenido (un esquema o regulación nueva) no requiere
    despliegue del Core.** El catálogo es dato, no código React.
12. **El análisis estadístico y de calidad es una capacidad transversal**
    (Pareto, tendencias, correlación, regresión, ANOVA, chi², interpretación
    determinista): pertenece al Core y sirve a cualquier sector.
13. **Los Estudios de Datos son Core, no exclusivos de manufactura.** Cualquier
    sector puede importar datos y analizarlos (CORE-ALIGN-003).
14. **Activos/Mantenimiento/Ingeniería es una capacidad transversal** (Pharma,
    Manufacturing, Food, EHS), no un módulo de un solo vertical.
15. **Regulatory Intelligence no equivale automáticamente a IA.** Es catálogo +
    versionado + detección + revisión editorial + aplicabilidad + impacto +
    notificación; la IA es un asistente futuro opcional con revisión humana
    obligatoria.

## 13. Anti-sobreingeniería

ARCH-004 **no**: crea tablas vacías para 40 módulos; agrega módulos futuros al
sidebar; crea mocks/notificaciones falsas; importa normas completas; hace
scraping/DOF; construye IA; ni altera la UX actual. Fija arquitectura.

## 14. IA futura (no ahora)

La arquitectura queda preparada para que, **más adelante**, la IA pueda comparar
versiones, resumir cambios, proponer relaciones/crosswalks, sugerir impacto,
buscar evidencias y explicar requisitos — **siempre con revisión humana**. La IA
**no** determina por sí sola aplicabilidad legal, conformidad, causa raíz ni
cierre regulatorio. No se implementa IA en ARCH-004.
