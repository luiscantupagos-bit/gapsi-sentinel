# TASK-002 — Notas de implementación

Complementa `docs/architecture/TASK-002-DATA-MODEL-PROPOSAL.md` con las decisiones
tomadas al implementar el modelo en Prisma + PostgreSQL.

## Estado del entorno

En el entorno donde se implementó **no había PostgreSQL disponible** (sin `psql`,
sin Docker, sin `DATABASE_URL`). Por lo tanto:

- Se generó y validó todo lo que **no** requiere una BD viva.
- Las validaciones que requieren BD (aplicar migración, seed, pruebas de
  integración/RLS) quedaron **preparadas pero no ejecutadas**. No se simularon
  resultados. Ver "Validaciones" al final y el README.

## D5 — Representación de enums (elección para el MVP)

**Elección: `text` + `CHECK`** (no enums nativos de PostgreSQL, no tablas
catálogo). En `schema.prisma` los campos son `String`; los valores permitidos se
imponen con `CHECK` en la migración complementaria y se tipan en TypeScript con
uniones `as const` (p. ej. `DIAGNOSTIC_STATUSES`, `EVIDENCE_STORAGE_BACKENDS`).

**Por qué:** es la opción **más simple y reversible** para un modelo aún bajo
revisión:

- Agregar/quitar un valor = editar un `CHECK` en una migración (barato y
  reversible), sin el dolor de `ALTER TYPE ... ADD VALUE` / recreación de tipos.
- Portable y fácil de leer en la BD.

**Cómo migrarlo después** (si se cierra D5 hacia otra opción):

- A **enum nativo**: `CREATE TYPE ..._enum AS ENUM (...)`, `ALTER TABLE ... ALTER
COLUMN ... TYPE ..._enum USING col::..._enum`, y quitar el `CHECK`.
- A **tabla catálogo**: crear la tabla de valores + FK; migrar datos; quitar el
  `CHECK`.

D5 sigue formalmente **pendiente**; esta es la elección MVP documentada.

## Qué expresa Prisma y qué requiere SQL complementario

**Prisma (schema.prisma) sí expresa:**

- Tablas, columnas, tipos, PK UUID, `@default`, `@updatedAt`, índices y únicos.
- **FK compuestas anti-cruce** `(x_id, organization_id) → parent(id, organization_id)`
  en toda la cadena de ejecución del diagnóstico (relaciones multi-campo).

**SQL complementario** (`prisma/migrations/20260804000100_constraints_rls_triggers/`)
porque Prisma no lo expresa en el schema:

1. **FKs a `organizations` y `users`** para columnas UUID escalares (actores y
   `organization_id`) que se dejaron fuera de las relaciones Prisma para no
   inflar el modelo con back-relations.
2. **CHECK** de enums (D5) y de reglas de consistencia (p. ej. "No aplica" sin
   opción/valor y con justificación; `scope`/`organization_id` coherentes).
3. **Índices únicos parciales**: código de sitio por org, código de marco
   (privado por org / maestro global), y **un único resultado vigente** por
   diagnóstico (`WHERE invalidated_at IS NULL`).
4. **Triggers de inmutabilidad**: el contenido de una versión solo se puede
   insertar/editar/borrar mientras la versión está en `draft`; una versión
   `published` solo puede archivarse y no altera su contenido sellado.
5. **Triggers append-only**: `audit_log` y `diagnostic_state_history` rechazan
   `UPDATE`/`DELETE`.
6. **Bloqueo de borrado físico**: `diagnostics`, `diagnostic_answers`,
   `evidences`, `diagnostic_results`, `diagnostic_section_results`,
   `diagnostic_findings` rechazan `DELETE` (usar borrado lógico / invalidación).
7. **RLS** (ver abajo).

### Limitación conocida: FK compuesta y filas maestras

Las FK compuestas usan semántica `MATCH SIMPLE`: si alguna columna del par es
`NULL`, la FK **no se fuerza**. El catálogo maestro tiene `organization_id NULL`,
por lo que las relaciones internas del contenido maestro no quedan forzadas a
nivel de FK compuesta. **No** afecta el aislamiento crítico: un diagnóstico es de
una organización (`organization_id NOT NULL`), así que su FK compuesta a
`sites`/`template_versions` **sí** se fuerza y **no** puede apuntar a datos de
otra organización ni a una versión maestra. El contenido maestro lo administra
GAPSI mediante seed controlado.

## RLS — cómo se establece el contexto por transacción

- Se habilita `ROW LEVEL SECURITY` en las tablas de tenant y de contenido, con
  políticas basadas en `fn_current_org()` que lee `current_setting('app.current_org', true)`.
- El **contexto se fija por transacción** con:
  `SELECT set_config('app.current_org', '<org-uuid>', true);` (el `true` = LOCAL,
  válido solo dentro de la transacción). El helper `withOrgContext(orgId, fn)` en
  `src/server/db.ts` lo hace de forma parametrizada.
- La aplicación **debe conectarse con el rol NO propietario `gapsi_app`** (creado
  por la migración, `NOLOGIN`; asigna login/clave fuera del control de versiones
  vía `DATABASE_APP_URL`). El **propietario del esquema OMITE RLS**, por eso las
  migraciones y el `seed` funcionan como propietario.
- Sin contexto establecido, un cliente `gapsi_app` ve **cero** filas de tenant y
  solo el catálogo maestro (defecto seguro).
- La prueba de RLS (`tests/db/organization-isolation.test.ts`) fuerza RLS también
  al propietario con `SET LOCAL ROLE gapsi_app` dentro de la transacción.

## Decisiones pendientes (no cerradas aquí)

D5 (elección MVP documentada arriba, formalmente pendiente), D7 (pesos por
sección), D9 (proveedor de almacenamiento), D10 (seguimiento comercial) y D13
(reglas definitivas del motor de evaluación). **No** se implementó el motor de
puntuación ni obligatoriedad de evidencias.

## Validaciones ejecutadas / bloqueadas

Ver el detalle en el resumen de entrega y en el README. Bloqueadas por ausencia
de PostgreSQL local: `prisma migrate deploy` en BD vacía, `db:seed`, y las
pruebas de `tests/db/**` (se auto-omiten sin `DATABASE_URL`).
