# GAPSI Sentinel

SaaS B2B para diagnóstico, seguimiento y mejora de sistemas de calidad e inocuidad alimentaria.

## Estado actual

El proyecto inicia con un producto mínimo comercial:

**Diagnóstico Digital GAPSI Sentinel**

La primera versión NO intenta construir toda la plataforma. Su objetivo es permitir:

1. Registrar una organización.
2. Crear un diagnóstico.
3. Responder un cuestionario.
4. Adjuntar o referenciar evidencias.
5. Calcular cumplimiento y riesgo.
6. Mostrar resultados por requisito.
7. Generar un reporte ejecutivo.
8. Registrar oportunidades de seguimiento comercial.

## Principio rector

Cada incremento debe poder demostrarse, probarse y potencialmente venderse.

## Documentación

- `AGENTS.md`: reglas obligatorias para cualquier agente.
- `docs/product/PRODUCT_BRIEF.md`: alcance y reglas del producto.
- `docs/product/DOMAIN_GLOSSARY.md`: términos del dominio.
- `docs/architecture/ARCHITECTURE_DECISIONS.md`: decisiones técnicas iniciales.
- `docs/tasks/TASK-001.md`: primera tarea ejecutable.
- `docs/DEFINITION_OF_DONE.md`: criterio obligatorio de terminación.

## Flujo de trabajo

1. Leer `AGENTS.md`.
2. Leer el documento de tarea correspondiente.
3. Inspeccionar el repositorio antes de modificarlo.
4. Proponer un plan breve.
5. Implementar solamente el alcance autorizado.
6. Ejecutar validaciones y pruebas.
7. Resumir cambios, riesgos y pendientes.

## Desarrollo local (TASK-001)

Esta es la **fundación técnica** del MVP. Aún no incluye cuestionario, motor de
puntuación ni producción (ver `docs/tasks/TASK-001.md`).

### Requisitos

- Node.js 20 o superior.
- npm 10 o superior.

### Instalación

```bash
npm install
cp .env.example .env.local   # en Windows PowerShell: Copy-Item .env.example .env.local
```

El archivo `.env.example` no contiene secretos reales.

### Comandos

| Acción     | Comando             | Descripción                                |
| ---------- | ------------------- | ------------------------------------------ |
| Desarrollo | `npm run dev`       | Levanta la app en `http://localhost:3000`. |
| Lint       | `npm run lint`      | ESLint (config de Next) + Prettier.        |
| Typecheck  | `npm run typecheck` | `tsc --noEmit` con TypeScript estricto.    |
| Pruebas    | `npm test`          | Vitest (unitarias e integración).          |
| Build      | `npm run build`     | Compilación de producción de Next.js.      |
| Formato    | `npm run format`    | Aplica Prettier al repositorio.            |

### Rutas

- `/` — pública, carga sin autenticación.
- `/login` — inicia una sesión **de desarrollo** (simulada, no es un proveedor real).
- `/dashboard` — privada; un usuario anónimo es redirigido a `/login`.

### Autenticación

La autenticación está desacoplada tras la interfaz `AuthProvider`
(`src/features/auth`). En TASK-001 solo existe el adaptador `dev`, que simula una
sesión mediante una cookie **codificada en base64 (sin firmar ni cifrar)**. Ese
token es fácilmente falsificable, por lo que se usa **únicamente en desarrollo** y
nunca como mecanismo seguro. El proveedor real se añadirá en una tarea futura sin
tocar el dominio.

### Estructura

```text
src/
  app/            # rutas (pública, login, dashboard)
  features/
    auth/         # adaptador de autenticación desacoplado
    organizations/# tipos y scoping por organización (multi-tenant)
  server/         # acceso a sesión en servidor
  middleware.ts   # guard de rutas privadas (en servidor)
tests/            # pruebas unitarias e integración
```

### Integración continua

`.github/workflows/ci.yml` ejecuta lint, typecheck, pruebas y build en cada
push a `main` y en cada pull request.

## Base de datos y modelo de dominio (TASK-002)

Modelo de dominio en **PostgreSQL + Prisma** (UUID, multi-tenant compartido). El
diseño está en `docs/architecture/TASK-002-DATA-MODEL-PROPOSAL.md` y las notas de
implementación (D5, límites de Prisma, RLS) en
`docs/architecture/TASK-002-IMPLEMENTATION-NOTES.md`.

> **Aún no hay motor de puntuación ni cuestionario visible ni autenticación real
> conectada a la BD.** Esta tarea entrega solo el modelo, migraciones, seed y
> pruebas.

### Requisitos de base de datos

- PostgreSQL 16 **local** para desarrollo (recomendado vía Docker Compose).
- Copia `.env.example` a `.env` (no contiene secretos reales).

### Opción A (recomendada): PostgreSQL con Docker Compose

Requiere **Docker Desktop** en Windows. `compose.yml` levanta PostgreSQL 16 con
base y credenciales solo de desarrollo, volumen persistente y healthcheck.

```bash
cp .env.example .env       # PowerShell: Copy-Item .env.example .env
npm run db:up              # docker compose up -d  (Postgres en localhost:5432)
npm run db:generate        # genera el cliente Prisma
npm run db:migrate         # aplica migraciones (base + constraints/RLS/triggers)
npm run db:seed            # carga datos semilla de desarrollo
npm run test:db            # pruebas de integración y RLS

npm run db:status          # docker compose ps
npm run db:down            # detiene (conserva datos); `docker compose down -v` los borra
```

Instalar Docker Desktop (PowerShell, como administrador):

```powershell
winget install -e --id Docker.DockerDesktop
```

Tras instalar, abre Docker Desktop una vez para iniciar el motor y reabre la terminal.

### Opción B: PostgreSQL nativo en Windows

```powershell
winget install -e --id PostgreSQL.PostgreSQL.16
```

Crea la base y ajusta `DATABASE_URL` en `.env`; luego `npm run db:migrate`,
`npm run db:seed` y `npm run test:db`.

### Reiniciar / recargar la base local

- `npm run db:reset:local` recrea el esquema y recarga el seed (aborta si
  `DATABASE_URL` no es localhost).

### Scripts de base de datos

| Acción                        | Comando                  | Notas                                                    |
| ----------------------------- | ------------------------ | -------------------------------------------------------- |
| Generar cliente               | `npm run db:generate`    | `prisma generate`.                                       |
| Validar schema                | `npm run db:validate`    | `prisma validate`.                                       |
| Migrar (reproducible)         | `npm run db:migrate`     | `prisma migrate deploy` sobre BD vacía o existente.      |
| Migrar en desarrollo          | `npm run db:migrate:dev` | `prisma migrate dev` (crea/renombra migraciones).        |
| Cargar semilla                | `npm run db:seed`        | Idempotente; no re-siembra si ya existe la org demo.     |
| Reiniciar **solo** base local | `npm run db:reset:local` | Aborta si `DATABASE_URL` no es localhost. Recrea + seed. |
| Pruebas de integración de BD  | `npm run test:db`        | Requiere `DATABASE_URL`; se omiten si no está.           |

### Aislamiento por organización (RLS)

- Toda tabla de negocio lleva `organization_id`; las consultas se filtran por la
  organización de la sesión (nunca por un id enviado por el cliente).
- **FK compuestas anti-cruce** impiden relacionar datos de organizaciones
  distintas a nivel de base de datos.
- **RLS de PostgreSQL** como defensa adicional: la app se conecta con el rol
  `gapsi_app` y fija el contexto por transacción con
  `withOrgContext(orgId, fn)` (`src/server/db.ts`), que ejecuta
  `set_config('app.current_org', …, true)`. Ver IMPLEMENTATION-NOTES.

### Datos semilla

`npm run db:seed` crea: 2 organizaciones, 2 usuarios, membresías, 1 sitio por
organización, 1 marco **maestro** (GAPSI) publicado, 1 **copia privada** de
plantilla publicada con 2 secciones / 9 preguntas, y 1 diagnóstico de ejemplo con
respuestas parciales.

## Demo del diagnóstico (TASK-003)

Flujo visible sobre los datos del seed (ver
`docs/tasks/TASK-003-IMPLEMENTATION-NOTES.md`):

```bash
npm run db:up && npm run db:migrate && npm run db:seed
npm run dev            # http://localhost:3000
```

1. En `/login`, pulsa **Entrar como usuario de demostración** (sesión dev → ORG_A).
2. En el panel, **Abrir** el diagnóstico de ejemplo.
3. Responde preguntas y **Guardar avance** (el progreso de captura cambia).
4. **Enviar diagnóstico** (queda en solo lectura).
5. **Ver resultado preliminar** (cálculo provisional, no el motor definitivo).

## Módulo documental (TASK-004)

Gestión documental básica conectada a PostgreSQL (ver
`docs/tasks/TASK-004-IMPLEMENTATION-NOTES.md`). No incluye editor tipo Word.

En el menú lateral del panel → **Documentos**:

1. **Listado maestro** con búsqueda y filtros (tipo, estado, sitio, origen).
2. **Nuevo documento** (código único por organización; puede adjuntar un archivo).
3. **Detalle**: descargar archivos, agregar anexos, crear versión, ver historial,
   archivar, editar metadatos.

Almacenamiento local de desarrollo en `storage/documents/` (no versionada).
Formatos permitidos: PDF, DOC(X), XLS(X), PNG, JPG/JPEG. Variables opcionales:

```bash
# Tamaño máximo de subida (bytes; por defecto 10 MB)
DOCUMENTS_MAX_UPLOAD_BYTES=10485760
# Carpeta de almacenamiento local (por defecto ./storage/documents)
DOCUMENTS_STORAGE_DIR=./storage/documents
```

## Editor documental enriquecido (TASK-005)

Crea documentos internos con un editor tipo procesador de textos (TipTap). Ver
`docs/tasks/TASK-005-IMPLEMENTATION-NOTES.md`.

En **Documentos** → **Crear dentro de Sentinel**:

1. Elige una plantilla (Procedimiento, Política, Formato, etc.).
2. Edita con títulos, fuentes/tamaños/colores, listas, tablas, imágenes, salto de
   página, etc. El contenido se guarda como JSON estructurado y se sanea en
   servidor (sin scripts).
3. **Guardar** (o autoguardado), **Vista previa** (hoja carta con encabezado/pie/
   portada), **Crear nueva versión** (la anterior queda en solo lectura).

Variable opcional: `DOCUMENTS_MAX_CONTENT_BYTES` (tamaño máximo de contenido; 512
KB por defecto).

## Control documental avanzado (TASK-006)

Ciclo formal de revisión, aprobación, publicación, distribución y lectura (ver
`docs/tasks/TASK-006-IMPLEMENTATION-NOTES.md`). Estados de versión: Borrador → En
revisión → Cambios solicitados → En aprobación → Aprobado → Vigente → Obsoleto →
Archivado.

Flujo de prueba manual:

1. En un documento borrador, **Asignar flujo** (revisor + aprobador) y **Enviar a
   revisión** (la edición se bloquea).
2. Como revisor asignado: **Solicitar cambios** (comentario) o **Aprobar
   revisión**. Con cambios, se edita y se reenvía.
3. Como aprobador: **Aprobar** o **Rechazar** (motivo).
4. Como owner/admin: **Publicar** (queda una sola versión vigente).
5. **Distribuir** a un usuario; en **Tareas** (o `/dashboard/documents/tasks`) el
   destinatario abre la vista previa y **Confirma lectura**.
6. **Registrar copia controlada**; al publicar una nueva versión, la anterior
   queda obsoleta y su copia **pendiente de recuperación**.
7. **Bandeja de tareas** y **alertas** del dashboard muestran lo pendiente.

Variable opcional: `DOCUMENTS_REVIEW_SOON_DAYS` (umbral de próxima revisión; 30
días por defecto).

## No conformidades y acciones correctivas CAPA (TASK-007)

Módulo formal para registrar, investigar, corregir y cerrar no conformidades,
desviaciones, hallazgos, quejas, incidentes y oportunidades de mejora (ver
`docs/tasks/TASK-007-IMPLEMENTATION-NOTES.md`). Estados: Borrador → Reportada →
En contención → En investigación → Plan de acciones → En implementación →
Verificación de eficacia → Cerrada (o Cancelada). Folio automático
`CAPA-AAAA-####` único por organización y año.

Esta tarea también incluye un **ajuste transversal de layout**: el área privada
usa un contenedor amplio y fluido (~1760px) con sidebar fijo en escritorio,
tarjetas responsive y tablas con scroll horizontal, sin afectar tabletas ni
móviles.

Flujo de prueba manual:

1. Abrir `/dashboard/capa`, buscar y filtrar; **Registrar CAPA**.
2. Asignar responsable y fecha objetivo; **Avanzar** a reportada y contención;
   registrar una **acción inmediata**.
3. Avanzar a investigación; capturar **5 porqués** y **causa raíz**.
4. Avanzar al **plan de acciones**; crear acciones con responsable y fecha;
   completarlas; adjuntar **evidencia**.
5. Avanzar a **verificación de eficacia**; con "no eficaz" el cierre se bloquea;
   con "eficaz" **Cerrar CAPA** (queda en solo lectura).
6. **Reabrir** (owner/admin) con motivo, nuevo responsable y fecha.
7. Revisar **historial**, **bandeja** (`/dashboard/capa/tasks`) y resumen del
   dashboard.

Variable opcional: `CAPA_ACTION_SOON_DAYS` (umbral de acción próxima; 15 días por
defecto).

## Herramientas de calidad y análisis de causa (TASK-008)

Amplía CAPA con herramientas formales y visuales de investigación (ver
`docs/tasks/TASK-008-IMPLEMENTATION-NOTES.md`): **Ishikawa, árbol de causas,
Pareto, AMEF, recurrencia y comparación de casos**, con hipótesis, conclusiones,
versionado y conversión a acciones CAPA. Las herramientas ayudan a investigar; no
deciden la causa raíz.

Estados del análisis: Borrador → En desarrollo → En revisión → (Aprobado /
Cambios solicitados), con Cancelado. Aprobado queda en solo lectura; para cambiar
se crea una nueva versión. Cada herramienta ofrece una visualización SVG y una
**vista de tabla accesible**.

Flujo de prueba manual: abrir una CAPA → **Análisis** → **Nuevo análisis**; elegir
herramienta; capturar datos (causas/nodos/ítems/filas AMEF); crear acción CAPA
desde un elemento; escribir conclusión; **enviar a revisión** → **aprobar** (solo
lectura) → **nueva versión**. Listado global en `/dashboard/capa/analysis`.

Fuera de alcance: IA, análisis semántico, búsqueda web, auditorías, proyectos,
Gantt y HACCP.
