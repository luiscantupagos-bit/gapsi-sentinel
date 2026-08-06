# Reconstrucción reproducible de PostgreSQL

Este documento describe cómo reconstruir la base de datos **desde cero**
utilizando **únicamente las migraciones del repositorio**, sin ejecutar SQL
manual. Es el procedimiento válido para instalaciones nuevas, staging,
recuperación y verificación local.

## Contexto: defecto corregido

La migración de TASK-009 (`20260805120000_projects_tasks`) se generó con
`prisma migrate diff --from-schema-datasource` (introspección de la base viva).
Como las **FK compuestas anti-cruce, de organización y de usuario** de documentos
y CAPA son **SQL crudo** que no se declara en `schema.prisma`, el diff las
consideró _drift_ y emitió sentencias `DROP` para ellas (139 FK + 1 índice
único). En una reconstrucción desde cero, esa migración eliminaba restricciones
heredadas, y antes se "reparaba" ejecutando SQL manual por `psql`.

**Corrección:** la migración `20260805130000_repair_legacy_constraints`
**re-crea de forma idempotente** (guardas `IF NOT EXISTS` por nombre y tabla, sin
`try/catch`) exactamente los objetos que TASK-009 eliminó. Con ella, la secuencia
completa se aplica solo con Prisma. **No se modificó ninguna migración anterior ni
la de TASK-009.**

## Procedimiento (entorno local)

> Operación destructiva: **solo** en la base local de desarrollo y tras confirmar
> que no contiene datos que deban conservarse.

Comandos exactos:

```bash
# 1) Detener y eliminar el volumen local (base completamente vacía)
docker compose down -v

# 2) Levantar PostgreSQL vacío
npm run db:up

# 3) Generar el cliente Prisma
npm run db:generate

# 4) Aplicar TODAS las migraciones desde cero (solo comandos del proyecto)
npm run db:migrate

# 5) Sembrar datos demo (idempotente) — dos veces para verificar idempotencia
npm run db:seed
npm run db:seed

# 6) Validaciones
npm run test:db
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

**No se ejecuta SQL manual después de las migraciones.**

## Objetos verificados

La prueba `tests/db/schema-integrity.test.ts` falla si, tras aplicar solo las
migraciones, faltara alguno de estos objetos (detecta la regresión del defecto):

- **FK compuestas anti-cruce de CAPA:** `capa_site_fkey`, `cac_capa_fkey`
  (referencia compuesta `(id, organization_id)`).
- **FK compuestas anti-cruce de documentos:**
  `documents_site_id_organization_id_fkey` y el índice único
  `assessment_frameworks_id_organization_id_key` (requerido por FK compuestas).
- **Triggers append-only:** `trg_csh_append`, `trg_dsh_append`, `trg_tsh_append`,
  `trg_psh_append` (historiales inmutables de CAPA, documentos, tareas y
  proyectos).
- **RLS activada** en `capas`, `documents`, `tasks`, `projects`, `capa_actions`.
- **Políticas por organización** en `capas`, `documents`, `tasks`, `projects`.
- **Grants** `SELECT/INSERT/UPDATE` al rol de aplicación `gapsi_app`.
- **Todas las tablas de negocio conservan FK** (`capas`, `capa_actions`,
  `documents`, `document_versions`, `quality_analyses`).

## Comportamiento del seed

`prisma/seed.ts` es **idempotente**: cada bloque hace _early-return_ si ya existe
su registro base (UUIDs deterministas + `createMany({ skipDuplicates: true })`).
Ejecutarlo dos veces no duplica datos ni viola restricciones. Ajusta además los
contadores de folio para que la creación por UI continúe la numeración.

## Validación de RLS

La RLS se aplica cuando la aplicación conecta con el rol **no propietario**
`gapsi_app` y fija `app.current_org` por transacción (`withOrgContext`). Las
pruebas de BD verifican el aislamiento por organización, incluyendo consultas
crudas bajo `SET LOCAL ROLE gapsi_app` que solo devuelven filas de la
organización activa.

## Limitaciones y prohibiciones

- **Prohibido** reparar el esquema con SQL manual no versionado. Cualquier
  corrección de esquema debe ir en una **migración nueva** (nunca modificando las
  existentes).
- Al generar migraciones que dependan de SQL crudo (FK compuestas, RLS, triggers,
  CHECK), **evita** `prisma migrate diff --from-schema-datasource`: introspecta la
  base y puede emitir `DROP` de objetos no representados en `schema.prisma`.
  Prefiere una migración aditiva escrita a mano o `migrate dev` sobre un shadow
  DB, y revisa el `migration.sql` en busca de `DROP` inesperados antes de
  confirmar.
- Las operaciones destructivas (`docker compose down -v`) son **solo** para el
  entorno local.
