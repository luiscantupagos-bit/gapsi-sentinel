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

- PostgreSQL 14+ **local** para desarrollo.
- Copia `.env.example` a `.env` y ajusta `DATABASE_URL` (no es un secreto real).

### Preparar la base local

```bash
# 1. Crea la base local (ejemplo)
createdb gapsi_sentinel_dev

# 2. Genera el cliente Prisma
npm run db:generate

# 3. Aplica las migraciones (base + constraints/RLS/triggers)
npm run db:migrate

# 4. Carga datos semilla de desarrollo
npm run db:seed
```

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
plantilla publicada con secciones/requisitos/preguntas/opciones, y 1 diagnóstico
de ejemplo con respuestas e historial de estado.
