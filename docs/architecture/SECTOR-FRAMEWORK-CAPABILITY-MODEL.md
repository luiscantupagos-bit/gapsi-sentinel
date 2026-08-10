# Modelo Sector · Framework · Capability (ARCH-004)

Documento de arquitectura. **No implementa** módulos, migraciones ni UI. Detalla
cómo GAPSI Sentinel modela sectores, esquemas/marcos y capacidades reutilizables.
Hub: `COMPLIANCE-PLATFORM-ARCHITECTURE.md`. Catálogo maestro:
`MASTER-COMPLIANCE-CATALOG.md`. Vigilancia: `REGULATORY-INTELLIGENCE.md`.

## 1. Principio

```
Sector → esquema(s)/marco(s) → requisitos → capacidades del Core
```

El sector **no enciende módulos**. Sugiere esquemas; los esquemas exigen
requisitos; los requisitos se satisfacen con **capacidades transversales** ya
existentes (Documentos, Auditorías, CAPA, Tareas, Proyectos, Evidencias, Análisis,
Estudios de Datos…). Un vertical **orquesta** capacidades del Core; no las duplica.

## 2. Framework ≠ Capability (definición operativa)

- **Framework / esquema / marco:** cuerpo de requisitos con identidad y versión.
  Define **qué** cumplir. Puede ser certificable, legal, contractual o interno.
- **Capability / capacidad:** función operativa del Core que **satisface**
  requisitos. Define **cómo** se cumple. Es reutilizable entre esquemas y sectores.

Relación **M:N**: un esquema requiere varias capacidades; una capacidad sirve a
varios esquemas. Ejemplos:

| Es framework            | Es capability / disciplina                |
| ----------------------- | ----------------------------------------- |
| FSSC 22000, SQF, BRCGS  | HACCP, PRP, Food Defense, Trazabilidad    |
| ISO 9001                | CAPA, control documental, auditoría, KPI  |
| NOM-059                 | RAP, control de cambios, desviaciones     |
| ISO 45001, NOM-STPS     | Investigación de incidentes, riesgos      |
| ISO 14001, NOM-SEMARNAT | Aspectos ambientales, permisos, monitoreo |

`HACCP ≠ FSSC 22000`: HACCP es una disciplina que **varios** esquemas de alimentos
pueden exigir. Modelarlas por separado evita crear una app distinta por norma.

## 3. Sectores (configurables, no enum rígido)

Sectores iniciales previstos: **Calidad, Alimentos, Manufactura, Farmacéutica,
Seguridad y Salud (EHS), Medio Ambiente, Cumplimiento General**. Reglas:

- Una organización puede manejar **múltiples sectores**.
- Un **sitio** puede tener una combinación distinta a otro sitio de la misma
  organización (p. ej. planta industrial vs. sitio agrícola).
- El conjunto de sectores es **extensible por dato** (catálogo `compliance_sectors`
  propuesto), no un `enum` cerrado que limite el crecimiento.

## 4. Capacidades transversales del Core

Reutilizables por cualquier sector/esquema (ver hub §2 y CORE-ALIGN-003):

Documentos · Evidencias · Auditorías · Hallazgos · Diagnósticos · CAPA · Riesgos ·
Tareas · Proyectos · Proveedores · Capacitación · Indicadores · Analítica ·
**Estudios de Datos** · **Análisis transversal** (5 Porqués, FTA, Ishikawa, Árbol
de causas, AMEF/FMEA, Pareto, tendencias, correlación, regresión, ANOVA, chi²) ·
Interpretación determinista · Historial/trazabilidad · Notificaciones · (futuro)
**Activos/Mantenimiento**.

## 5. Quality

- **Framework inicial:** ISO 9001. **No** es una aplicación independiente: reutiliza
  documentos, riesgos, auditorías, CAPA, objetivos/KPI, proveedores, capacitación,
  proyectos, análisis y evidencia del Core.
- **Expansión futura:** otros esquemas de calidad y de cliente sobre la misma base.

## 6. Food

El vertical depende del **esquema activo**. Frameworks previstos: **BPM/GMP
alimentos, FSSC 22000, SQF, BRCGS, PrimusGFS, ISO 22000, HACCP como framework
independiente cuando aplique**, y otros futuros. Una organización puede activar
varios; los sitios pueden diferir (p. ej. Planta A: FSSC 22000 + requisitos de
cliente; sitio agrícola: PrimusGFS).

**Capacidades reutilizables (no todas las exige cada framework):** HACCP · PRP ·
Food Defense · Food Fraud · Alérgenos · Trazabilidad · Recall/retiro · Proveedores ·
Monitoreo ambiental · Limpieza y desinfección · Control de plagas · Mantenimiento ·
Capacitación · Auditorías · Documentos · CAPA · análisis de datos.

**Evidencia compartida:** una misma evidencia legítima puede satisfacer requisitos
de varios frameworks (no se duplica; ver §11).

## 7. Manufacturing

Vertical y capacidades futuras: **APQP, PPAP, AMEF/FMEA, Control Plan, Process
Flow, SPC, MSA, estudios de capacidad, ingeniería, gestión de cambios.**

Principio: **APQP orquesta capacidades del Core**, no las reimplementa.

```
APQP → Proyecto → Tareas/Hitos → Documentos → AMEF → Estudios de Datos → Control Plan → PPAP
```

No se duplican proyectos, tareas ni FMEA dentro de APQP: son capacidades del Core
que APQP coordina. SPC/MSA/capacidad son extensiones futuras de Estudios de Datos.

## 8. Pharma

- **Marco inicial (México):** NOM-059. **No** se afirma cumplimiento NOM-059
  automáticamente; la conformidad se determina por evaluación.
- **Capacidades previstas:** RAP · transferencia de tecnología · desviaciones ·
  CAPA · control de cambios · OOS/OOT · gestión de riesgos · validación ·
  calificación · estabilidad · mantenimiento · metrología · documentación técnica ·
  proveedores · capacitación · auditorías · quejas · retiro.

## 9. Activos / Mantenimiento / Ingeniería (capacidad transversal)

Diseñada como **capacidad transversal** (Pharma, Manufacturing, Food, EHS), no como
módulo de un vertical (ADR §12, decisión 14). Entidad conceptual futura **ACTIVO**:

- **Tipos:** área · equipo · máquina · instrumento · sistema · servicio crítico ·
  instalación.
- **Metadatos:** código · nombre · fabricante · modelo · número de serie · sitio ·
  ubicación · criticidad · responsable · estado.
- **Documentos vinculables:** ficha técnica · manual · layout · planos · P&ID ·
  diagramas eléctricos/neumáticos · certificados · SOP/PNO · especificaciones ·
  fotografías · reportes.
- **Historial vinculable:** mantenimiento preventivo/correctivo · calibración ·
  calificación · validación · modificación · falla · desviación · CAPA.

**Solo arquitectura**: ARCH-004 no implementa el módulo.

## 10. EHS — Seguridad y Salud / Medio Ambiente

- **Seguridad y salud:** ISO 45001, NOM-STPS y otras obligaciones. Cada requisito
  debe poder: versionarse, tener jurisdicción, aplicabilidad, sitio, responsable,
  evidencia, evaluación, periodicidad y vigencia. **No** modelar todas las NOM-STPS
  como un único objeto genérico sin estructura.
- **Medio ambiente:** ISO 14001, NOM-SEMARNAT, obligaciones ambientales, permisos,
  licencias, condicionantes, reportes y obligaciones estatales/municipales.
  Relación soportada: `requisito → aspecto/actividad → permiso → evidencia →
responsable → evaluación → acción`. No se implementa una matriz legal completa
  todavía.

## 11. Evidencia reutilizable

Una evidencia puede relacionarse con **varios requisitos** (M:N) sin duplicar el
archivo. Ejemplo: un «Procedimiento de auditorías internas» satisface requisitos de
ISO 9001, ISO 14001 e ISO 45001 a la vez. Se mantiene **una** copia física y
**relaciones** trazables (`requirement_evidence_links` propuesto).

## 12. Crosswalk (equivalencias entre requisitos)

`REQUIREMENT CROSSWALK`: relación editorial entre requisitos de distintos marcos.
Tipos: **equivalente · parcialmente equivalente · relacionado · complementario ·
depende de**. Ejemplos: ISO 9001 ↔ 14001 ↔ 45001; ISO 22000 ↔ FSSC 22000 ↔
requisito interno.

- La equivalencia **no** es jurídica ni automática: requiere **revisión editorial
  de GAPSI** antes de publicarse.
- Habilita el Sistema Integrado (§14) y la evaluación de impacto entre marcos.

## 13. Aplicabilidad y suscripción (resumen)

- **Suscripción** (`framework_subscriptions`): la organización/sitio **activa** un
  framework en una versión, con fecha de adopción, sitios, estado, transición,
  suspensión y retiro. Detalle en `MASTER-COMPLIANCE-CATALOG.md` §Suscripción.
- **Aplicabilidad** (`requirement_applicability`): por org/sitio, cada requisito es
  **aplicable / no aplicable / pendiente**, con justificación, responsable, fecha y
  próxima revisión. Distintos sitios pueden tener distintos requisitos aplicables.

## 14. Sistemas integrados de gestión (SIG)

Con crosswalk + evidencia reutilizable + aplicabilidad por sitio, una sola
auditoría, CAPA, evidencia, política, procedimiento o proyecto puede relacionarse
con requisitos de **varios** frameworks. Ejemplo canónico: ISO 9001 + 14001 + 45001
gestionados como un solo sistema, sin triplicar trabajo.

## 15. Periodicidad, jurisdicción y trazabilidad (por requisito)

- **Periodicidad:** continuo · mensual · trimestral · semestral · anual · por
  evento · por renovación · sin frecuencia fija. Alimenta (futuro) tareas, alertas,
  vencimientos y dashboards.
- **Jurisdicción** (para requisitos legales): país · estado/provincia ·
  municipio/localidad · autoridad · jurisdicción adicional. **México primero**, sin
  hardcodearlo como única posibilidad.
- **Fuente/trazabilidad:** título oficial · identificador · organismo emisor ·
  URL/fuente · documento fuente · fecha de publicación · fecha de vigencia ·
  versión. El origen regulatorio debe ser auditable.

## 16. Ejemplos obligatorios

### A. Sistema integrado

**Planta Monterrey**: ISO 9001 + ISO 14001 + ISO 45001. Un solo «Procedimiento de
auditorías internas» sirve a requisitos de los tres; una auditoría integrada los
evalúa; una CAPA cierra hallazgos relacionados.

### B. Food

**Planta de alimentos**: FSSC 22000 + requisitos de cliente. Capacidades: HACCP,
Food Defense, Food Fraud, Trazabilidad, Recall, etc. No se duplican módulos por
FSSC: el esquema exige capacidades que ya existen.

### C. Manufacturing

**Proyecto de lanzamiento de producto**: APQP → AMEF → Control Plan → Estudios de
Datos → PPAP, todos sobre Proyecto/Tareas/Documentos del Core.

### D. Pharma

**NOM-059**, activo **MX-01**: manual, ficha técnica, layout, calificación,
mantenimiento, calibración, desviaciones y CAPA vinculados al activo.

### E. Regulatory update

Framework versión A activa; se publica versión B. Sentinel registra la
actualización, notifica, muestra cambios, identifica objetos relacionados, el
responsable evalúa aplicabilidad, crea acciones, implementa, verifica, cierra y
**conserva la historia de A**. Detalle en `REGULATORY-INTELLIGENCE.md`.

## 17. Qué NO hace este documento

No crea sectores/frameworks productivos, tablas, migraciones ni pantallas. No
importa textos de normas ni afirma equivalencias/cumplimiento automáticos. Fija el
modelo conceptual reutilizando el Core existente.
