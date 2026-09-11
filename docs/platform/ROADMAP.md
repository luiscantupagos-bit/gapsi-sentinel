# C3 Sentinel — Roadmap de plataforma y funcional (PLATFORM-001 §57-61)

Registro formal de bloques. Ninguno iniciado salvo PLATFORM-001 (esta fase).

## Roadmap PLATFORM (§59)

| ID                              | Nombre                                | Alcance                                                                                                                                                                                                                                     |
| ------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PLATFORM-001**                | Production Architecture               | Auditoría, arquitectura objetivo, contratos base, roadmap (esta fase).                                                                                                                                                                      |
| **PLATFORM-002** ✅ Fase 1 + 2B | File & Object Storage                 | stored_files/file_relations, proveedores local/S3(R2), subida/descarga segura, signed URLs, cuotas, SHA-256, idempotencia. **2B**: logo de organización + adjuntos de tarea + renderer + demo KPIs. Pendiente: migración de uploads legacy. |
| **PLATFORM-003**                | Production Authentication & Identity  | Auth.js, contraseñas, recuperación, invitaciones, sesiones, roles+capabilities.                                                                                                                                                             |
| **PLATFORM-004**                | PWA Foundation                        | manifest, service worker, instalación, caché, shell offline.                                                                                                                                                                                |
| **PLATFORM-005**                | Offline Records & Sync                | IndexedDB, cola, API de sync idempotente, conflictos.                                                                                                                                                                                       |
| **PLATFORM-006**                | Observability, Backups & Recovery     | Sentry, scheduler productivo (cron+`CRON_SECRET`), backups/PITR, audit trail.                                                                                                                                                               |
| **PLATFORM-007**                | Subscriptions, Quotas & Tenant Limits | Planes, cuotas de storage, límites por tenant.                                                                                                                                                                                              |
| **PLATFORM-008**                | Production Release                    | Staging→prod, `migrate deploy`, smoke, dominios.                                                                                                                                                                                            |

## Roadmap funcional adicional (§60)

| ID                 | Nombre                                              |
| ------------------ | --------------------------------------------------- |
| **CORE-UX-005**    | Semáforo global de cumplimiento                     |
| **UI-FIX**         | Gauge «Estado del sistema»                          |
| **DOC-004**        | Formatos y Registros digitales                      |
| **PROGRAM-UX-001** | Centro de Programas + Gantt                         |
| **PROJECT-002**    | Gestión de Proyectos + Hitos + Dependencias + Gantt |

## Orden recomendado (§61)

1. **CORE-UX-005** — Semáforo global (base puesta en PLATFORM-001).
2. **UI-FIX** — Gauge del Dashboard.
3. **PLATFORM-002** — File/Object Storage.
4. **DOC-004** — Formatos/Registros digitales.
5. **PLATFORM-004** — PWA Foundation.
6. **PLATFORM-005** — Offline Records & Sync.

`PROGRAM-UX-001` y `PROJECT-002` pueden ir después/en paralelo, **compartiendo el
componente Gantt**. `PLATFORM-003` debe ir **antes** de producción real.

---

## CORE-UX-005 — Semáforo global de cumplimiento (§42) — **Fase 1 implementada**

Fase 1 completa (ver `docs/tasks/CORE-UX-005-IMPLEMENTATION-NOTES.md`):

- **Persistencia tenant-scoped** `organization_compliance_policies` (migración aditiva
  `20260916000000_compliance_policy`, 0 DROP, RLS + CHECK), fallback default 90/80/70.
- **Configuración** `Administración → Configuración → Semáforo de cumplimiento` con
  colores por organización, validación servidor y **preview reactivo**.
- **Resolver central** (`resolveComplianceBand`) + servicio (`src/server/compliance.ts`).
- **Componentes migrados**: Dashboard (Estado del sistema, Cumplimiento por esquema),
  Ejecución de Programas. Etiqueta «Riesgo» y métricas «mayor = peor» sin cambios.

Pendiente (fases siguientes / follow-up):

- Etiquetas de nivel configurables por organización (hoy globales).
- Migrar KPIs/Indicadores con dirección `higher_is_better` declarada; Proyectos
  (PROJECT-002) cuando exista un % de avance/cumplimiento.
- **UI-FIX** del gauge (geometría) sigue separado.

**Semántica (§37)**: aplica **solo** a métricas «mayor = mejor» (cumplimiento,
conformidad, avance, efectividad, implementación, cumplimiento de programa). **No** a
riesgo, storage utilizado, % de errores, vencimientos, incidencias, capacidad — esas
tienen semántica propia.

## UI-FIX — Gauge «Estado del sistema» (§43)

Bug independiente: el arco del gauge del Dashboard Ejecutivo aparece **fragmentado /
desplazado**. Revisar geometría SVG, layout responsive, overflow, dimensiones, cálculo
de `stroke-dasharray`, `transform-origin`. **No** asumir problema de datos. No mezclar
con PLATFORM-001 salvo documentación del componente.

## DOC-004 — Formatos y Registros digitales (§26/§62)

**Registros** = evidencia de que algo se hizo (vs. Documentos = qué debe hacerse).

Sidebar (§26): en **CUMPLIMIENTO** se agrega **Registros**. Tendrá: Nuevo registro,
Mis registros, En proceso, Cerrados. «Nuevo registro» selecciona un **formato vigente**.
Abrible desde: (A) Registros → Nuevo registro, (B) Documento tipo Formato → Nuevo
registro, (C) QR futuro. Usará `clientGeneratedId` (offline, §22) y `stored_files` para
evidencias. Depende de PLATFORM-001/002/004/005.

## PROGRAM-UX-001 — Centro de Programas + Gantt (§44-47)

Sidebar: **CUMPLIMIENTO → Programas** con **dashboard propio**:

- KPIs (§45): Programas activos, Cumplimiento global, Actividades vencidas, próximas,
  para hoy.
- Tabla: Programa · Responsable · Periodo · Cumplimiento · Vencidas · Próxima actividad
  (cada programa clickeable).
- **Gantt general** de actividades de todos los Programas (§46) y **Gantt por Programa**
  (§47) basado en `program_activity_instances` (**no** crear un segundo motor de
  programación). Cada Programa: Resumen · Ejecución · Gantt · Documento.

Programa = documento/requisito recurrente; Proyecto = iniciativa temporal. No convertir
Programa en Proyecto.

## PROJECT-002 — Gestión de Proyectos (§48-56)

Modelo: Proyecto → Tareas → Subtareas → Hitos → Dependencias. **No** inicialmente:
Sprint, Story Points, Epic, Scrum, Portfolio, PERT, Critical Path, Baseline, RACI
complejo.

- **Proyecto (§49)**: Nombre, Organización, Responsable/Líder, Fecha inicio, Fecha
  objetivo, Estado, Prioridad, Avance automático, Descripción, Miembros. Estados:
  Planeado · En curso · En pausa · Terminado. Prioridad: Baja · Media · Alta · Crítica.
- **Tareas (§50)**: nombre, responsable, inicio, límite, estado, prioridad, avance,
  parent/subtask, dependency; relacionable con Documento, Hallazgo, CAPA, Auditoría,
  Diagnóstico, Programa, Registro, Proyecto. **Tasks sigue siendo el motor operativo
  común.**
- **Hitos (§51)**: no representan trabajo. Nombre, Fecha objetivo, Estado (Pendiente/
  Cumplido). Sin porcentaje. Visual: ◆ diamante en Gantt.
- **Dependencias (§52)**: UX simple «Depende de: [tarea]». Sin PM excesivamente complejo.
- **Pestañas (§53)**: Resumen · Tareas · Gantt · Archivos/Documentos · Actividad.
- **Resumen (§54)**: estado, avance, inicio, objetivo, total tareas, completadas, en
  curso, atrasadas, próximo hito, equipo, próximas tareas.

## Gantt reutilizable (§55)

Decisión arquitectónica: construir **un** componente Gantt reusable (Proyectos,
Programas, posiblemente auditorías, planes, CAPA complejas). Features futuras: barra por
tarea, ◆ por hito, dependencias, expandir subtareas, responsables, fechas, estado,
drag horizontal, zoom temporal. **No duplicar Gantt por módulo.**

## Dashboard general (§56)

Card Proyectos (activos, avance, atrasadas, próximo hito) y Card Mis tareas (pendientes,
hoy, vencidas). No se implementa aún.

## Conceptos de módulos (§58)

- **Documentos**: qué debe hacerse / información controlada.
- **Registros**: evidencia de que algo se hizo.
- **Programas**: actividades recurrentes que deben cumplirse.
- **Tasks**: trabajo individual ejecutable.
- **Projects**: conjunto temporal de trabajo orientado a un objetivo.

Mantener esta separación explícita.

## Barra lateral objetivo (§57)

```
PANEL
- Panel
CUMPLIMIENTO
- Diagnósticos
- Auditorías
- Documentos
- Registros
- Programas
MEJORA
- Acciones correctivas
- Análisis
TRABAJO
- Tareas
- Proyectos
DESEMPEÑO
- Indicadores
- Analítica
ADMINISTRACIÓN
- Configuración
```

(Hoy el sidebar no incluye **Registros** ni **Programas** como entradas de primer nivel;
se agregarán con DOC-004 y PROGRAM-UX-001 respectivamente.)
