# Roadmap sectorial de GAPSI Sentinel (ARCH-004)

Organización por **familias** de la evolución de Sentinel de plataforma Core a
plataforma multisectorial de gestión y cumplimiento. **ARCH-004 no implementa
ninguna de estas tareas**: solo fija arquitectura y las ordena.

Arquitectura de referencia: `../architecture/COMPLIANCE-PLATFORM-ARCHITECTURE.md`,
`../architecture/SECTOR-FRAMEWORK-CAPABILITY-MODEL.md`,
`../architecture/MASTER-COMPLIANCE-CATALOG.md`,
`../architecture/REGULATORY-INTELLIGENCE.md`.

## Principio de secuencia

Los verticales **reutilizan el Core** (ADR §12, decisión 10). Antes de un vertical
conviene tener el Core y el catálogo/versionado que ese vertical orquesta. Regulatory
Intelligence habilita la vigilancia normativa que todos los verticales aprovechan.

## CORE

- **CORE-ALIGN-003** — Herramientas transversales de análisis y Estudios de Datos.
  **Cerrado** (5 Porqués formal, FTA, análisis transversal vía `analysis_relations`,
  biblioteca global, Estudios de Datos con interpretación determinista).
- **Deuda Core pendiente** — ver §Deuda técnica conocida.

## QUALITY

- **QMS-001** — ISO 9001 sobre el Core (documentos, riesgos, auditorías, CAPA,
  KPI, proveedores, capacitación, proyectos, análisis, evidencia).

## FOOD

- **FOOD-001** — Arquitectura Food (sector, capacidades, evidencia compartida).
- **FOOD-002** — BPM / GMP alimentos.
- **FOOD-003** — FSSC 22000.
- **FOOD-004** — SQF.
- **FOOD-005** — BRCGS.
- **FOOD-006** — PrimusGFS.

## MANUFACTURING

- **MAN-001** — APQP (orquesta Proyecto/Tareas/Documentos/AMEF/Estudios/PPAP).
- **MAN-002** — PPAP.
- **MAN-003** — SPC / capacidad (extiende Estudios de Datos).
- **MAN-004** — MSA.
- **MAN-005** — Control Plan.

## PHARMA

- **PHARMA-001** — NOM-059.
- **PHARMA-002** — Activos / Mantenimiento / Metrología (capacidad transversal).
- **PHARMA-003** — Transferencia tecnológica.
- **PHARMA-004** — RAP.
- **PHARMA-005** — Calificación / Validación.
- **PHARMA-006** — OOS / OOT.
- **PHARMA-007** — Control de cambios.

## EHS

- **EHS-001** — ISO 45001.
- **EHS-002** — NOM-STPS.
- **EHS-003** — ISO 14001.
- **EHS-004** — Cumplimiento ambiental.

## REGULATORY

- **REG-001** — Catálogo maestro.
- **REG-002** — Aplicabilidad.
- **REG-003** — Versionado y Crosswalk.
- **REG-004** — Vigilancia normativa.
- **REG-005** — Impact Assessment.
- **REG-006** — Notificaciones regulatorias.

## Familias de licenciamiento (solo conceptual)

Sin precios ni billing (ADR/hub §8): Sentinel Core · Quality · Food · Manufacturing
· Pharma · EHS · Regulatory Intelligence.

## Deuda técnica conocida

Documentada explícitamente; **no** se resuelve en ARCH-004:

1. **AMEF / Pareto / Ishikawa legacy** siguen parcialmente **CAPA-scoped**: se editan
   en la ruta de la CAPA, no en el workspace transversal `/dashboard/analysis/[id]`
   (que hoy edita 5 Porqués y FTA).
2. Algunas operaciones de **versionado/aprobación** de análisis legacy todavía
   requieren `capaId` (`createNewVersion`, snapshot de aprobación).
3. La **nueva versión de análisis** aún no copia automáticamente los **nodos FTA** ni
   la **cadena de 5 Porqués**.
4. **SPC avanzado pendiente:** Cp/Cpk · Pp/Ppk · cartas de control · normalidad ·
   MSA · Gage R&R · DOE (futuro). Ver
   `../analytics/DATA-STUDIES-ARCHITECTURE.md` §FUTURE.
5. **No existe** todavía catálogo regulatorio productivo.
6. **No existe** vigilancia automática de fuentes oficiales.
7. **No existe** motor productivo de notificaciones regulatorias.

## Qué NO hace este documento

No implementa ninguna tarea, no crea tablas ni migraciones, no altera el sidebar ni
inicia TASK-012. Ordena el trabajo futuro.
