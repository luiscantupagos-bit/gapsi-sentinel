# Architecture Decision Records (ADR) — C3 Sentinel

Registro de decisiones arquitectónicas. Formato ligero: cada ADR tiene contexto,
decisión y consecuencias. Estado inicial de todas: **Aceptada** (PLATFORM-001).
Pueden dividirse en archivos individuales más adelante.

---

## ADR-0001 — SaaS multi-tenant, una sola base de código

**Contexto**: múltiples clientes con una sola aplicación y despliegue.
**Decisión**: una única codebase multi-tenant; aislamiento por `organizationId` con
**RLS** (`fn_current_org`, `withOrgContext`) como barrera de datos; runtime con rol
`gapsi_app`.
**Consecuencias**: toda tabla lleva `organizationId`; el owner de BD solo para
migraciones/seed; pruebas de aislamiento obligatorias.

## ADR-0002 — PostgreSQL como fuente de verdad

**Contexto**: coexistencia de datos estructurados y binarios.
**Decisión**: PostgreSQL es la **única** fuente de verdad funcional; el Object Storage
guarda binarios pero no define relaciones.
**Consecuencias**: `storageKey` es detalle técnico; las relaciones se modelan en BD
(`stored_files`/`file_relations`).

## ADR-0003 — Object Storage para binarios, con proveedor abstraído

**Contexto**: archivos/evidencias/fotos crecerán; el disco local no escala.
**Decisión**: binarios en Object Storage detrás del contrato `StorageProvider`
(proveedor inicial recomendado **Cloudflare R2**); los módulos no dependen del SDK.
**Consecuencias**: implementación en PLATFORM-002; migración de las ~10 tablas de
archivos actuales por fases (expand→contract).

## ADR-0004 — Signed URLs y autoridad del servidor

**Contexto**: los binarios privados no deben ser públicos.
**Decisión**: acceso a binarios vía **signed URLs** temporales, previa autorización
server-side (org + membership + permiso + entidad); nunca confiar en `storageKey` del
cliente.
**Consecuencias**: no hay URLs públicas permanentes; todo acceso pasa por validación.

## ADR-0005 — Autoridad del servidor para autorización

**Contexto**: la seguridad no puede depender del cliente.
**Decisión**: toda autorización se valida en servidor; RLS como segunda barrera.
**Consecuencias**: Server Actions/Route Handlers validan rol/capacidad y tenant.

## ADR-0006 — PWA-first

**Contexto**: uso en tablet/móvil en piso.
**Decisión**: la app se prepara como **PWA** instalable (PLATFORM-004).
**Consecuencias**: manifest, service worker y shell offline en su fase; arquitectura
compatible desde ya.

## ADR-0007 — Offline parcial

**Contexto**: conectividad intermitente en piso.
**Decisión**: offline **parcial**; primer objetivo, **capturar nuevos registros** sin
conexión (no administración/aprobaciones críticas).
**Consecuencias**: IndexedDB + cola + API de sync (PLATFORM-005); alcance acotado.

## ADR-0008 — Sync idempotente por `clientGeneratedId`

**Contexto**: reintentos de sync no deben duplicar.
**Decisión**: los registros offline generan `clientGeneratedId` (UUID) cliente-side; el
sync es idempotente (unicidad `(organizationId, clientGeneratedId)`).
**Consecuencias**: mismo id → un solo registro; conflictos con `revision`/`updatedAt`/
`deviceId`; nunca last-write-wins silencioso en datos críticos.

## ADR-0009 — Política central de cumplimiento (semáforo)

**Contexto**: umbrales de color duplicados/inconsistentes entre módulos.
**Decisión**: un resolver central `getComplianceBand(value, policy)` (default 90/80/70),
configurable por organización; aplica **solo** a métricas «mayor es mejor».
**Consecuencias**: base en PLATFORM-001; persistencia/config/migración de componentes en
CORE-UX-005; métricas de riesgo/almacenamiento/errores usan su propia semántica.

## ADR-0010 — Domain processor ≠ Scheduler

**Contexto**: los avisos requieren ejecución periódica.
**Decisión**: los processors permanecen puros/deterministas; el disparo lo hace un
**cron seguro** (`CRON_SECRET`) externo. **Nunca** `setInterval` en Next.js.
**Consecuencias**: scheduler productivo en PLATFORM-006; el processor es testeable con
`now` inyectable.

## ADR-0011 — Task como motor operativo transversal

**Contexto**: múltiples módulos generan trabajo ejecutable.
**Decisión**: **Tasks** es el motor operativo común (Programas, CAPA, Proyectos,
Registros… crean/relacionan Tasks nativas); no se duplica el motor.
**Consecuencias**: trazabilidad Task↔origen; estados derivados; una sola bandeja.

## ADR-0013 — Modelo transversal `stored_files` / `file_relations`

**Contexto**: los archivos estaban fragmentados en ~10 tablas por módulo.
**Decisión**: un modelo genérico `stored_files` (binario) + `file_relations` (relación
a entidades por `entity_type`/`entity_id`), reutilizable por todos los módulos.
**Consecuencias**: nuevos uploads usan el modelo transversal; el legacy convive y se
migra por fases; `entity_id` es genérico (sin FK), la integridad de tenant la da la FK
compuesta a `stored_files`.

## ADR-0014 — Metadata en PostgreSQL, binarios en Object Storage

**Contexto**: separar la verdad funcional del almacenamiento físico.
**Decisión**: PostgreSQL es la fuente de verdad; el binario vive en el Object Storage;
`storageKey` es solo detalle técnico y no codifica relaciones.
**Consecuencias**: cambiar de proveedor no altera la lógica; nunca se infieren
relaciones desde la ruta.

## ADR-0015 — Sin URLs públicas permanentes

**Contexto**: binarios privados por tenant.
**Decisión**: el acceso usa signed URLs cortas (S3/R2) o streaming autorizado (local),
previa validación server-side; nunca URLs públicas permanentes.
**Consecuencias**: toda descarga pasa por `/api/files/[id]`; TTL corto (10 min).

## ADR-0016 — `storageKey` generado en el servidor

**Contexto**: evitar traversal/colisión/fuga de nombres.
**Decisión**: el servidor genera `org/<orgId>/<yyyy>/<mm>/<uuid>.<ext>`; nunca acepta
rutas del cliente ni usa el nombre original como ruta.
**Consecuencias**: nombres opacos y seguros; el original se guarda como metadata.

## ADR-0017 — Objetos de archivo inmutables

**Contexto**: trazabilidad de documentos/evidencias/certificados.
**Decisión**: no se sobrescribe un `stored_file`; una versión nueva es un archivo nuevo.
**Consecuencias**: el versionado funcional de Sentinel no depende del versioning del
Object Storage (capa adicional).

## ADR-0018 — Idempotencia de subida por tenant (`client_upload_id`)

**Contexto**: reintentos y captura offline futura.
**Decisión**: `stored_files` lleva `client_upload_id` único por organización; el mismo
id no crea dos metadatas.
**Consecuencias**: base para sync offline idempotente (PLATFORM-005) sin duplicar.

## ADR-0012 — Gantt reutilizable

**Contexto**: Proyectos y Programas necesitan visualización temporal.
**Decisión**: un **único** componente Gantt reusable (Proyectos, Programas y otros),
alimentado por las fuentes de cada módulo (`program_activity_instances`, tareas de
proyecto).
**Consecuencias**: no duplicar Gantt por módulo; features (hitos ◆, dependencias, zoom)
se construyen una vez.
