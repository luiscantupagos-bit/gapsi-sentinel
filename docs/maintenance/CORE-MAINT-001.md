# CORE-MAINT-001 — Saneamiento de pruebas DB y normalización de EOL

Tarea de mantenimiento (sin cambios funcionales, sin migraciones). Deja los gates
técnicos deterministas: `test:db` estable e independiente del orden/concurrencia, y
`format:check` limpio en Windows y Linux.

## 1. Problema original

- **`test:db` flaky**: en algunas ejecuciones fallaba 145/146; el test que fallaba
  variaba (`capa-access`, `projects-access`, `audits-access`…); aislado siempre
  pasaba; `npm test` completo casi siempre pasaba. Fallos rápidos (~100–200 ms), no
  timeouts.
- **`format:check` en Windows**: podía fallar solo por CRLF/LF, sin cambios lógicos
  (`git diff -w` vacío). En Linux/CI pasaba.

## 2. Causa raíz

### 2.1 Pruebas DB

- **Dos clientes Prisma por worker.** La app usa un singleton `getPrisma()`
  (`src/server/db.ts`, sobre `globalThis`). El helper de pruebas creaba **otro**
  `PrismaClient` propio. Con la ejecución en paralelo (pool de forks de Vitest, hasta
  N = nº de CPU), el total de conexiones (2 clientes × N workers × pool por cliente)
  podía **acercarse o superar `max_connections`** de PostgreSQL, provocando fallos
  intermitentes.
- **`$disconnect()` prematuro por archivo.** Cada uno de los 17 archivos de
  `tests/db` tenía `afterAll(() => db().$disconnect())`. En modo serial (un solo
  proceso), desconectaba un cliente que otras suites aún podían usar.

Los datos NO eran la causa: cada prueba usa **organizaciones desechables** con ids
únicos (`crypto.randomUUID()`), y los folios son por organización/año, así que un
tenant nuevo empieza siempre en `#0001`.

### 2.2 EOL

- `core.autocrlf=true` y **sin `.gitattributes`**: al hacer checkout, el working
  tree se materializaba en **CRLF** en Windows. Prettier usa `endOfLine: lf` por
  defecto, así que marcaba esos archivos. Los **blobs del repositorio ya estaban en
  LF** (verificado leyendo los blobs en binario); el problema era solo el working
  tree local en Windows. (Nota: `grep -c $'\r'` bajo Git Bash da conteos de CR poco
  fiables; usar Node u otra lectura binaria para diagnosticar.)

## 3. Solución

### 3.1 Estrategia Prisma / ciclo de vida (`tests/db/_helpers.ts`, `vitest.config.ts`)

- `db()` ahora **reutiliza `getPrisma()`**: una sola instancia de Prisma por worker,
  compartida entre las pruebas y las funciones de servidor.
- Se **eliminó** `afterAll(() => db().$disconnect())` de los 17 archivos. La conexión
  se libera al salir el worker/proceso (Prisma cierra en `beforeExit`). No hay
  desconexión por archivo.
- Nuevo **setupFile** `tests/setup-db-env.ts` (una vez por worker, antes de importar
  los tests): garantiza `DATABASE_URL` (cargándola de `.env` si el runtime aún no la
  puso), fuerza **IPv4** (`127.0.0.1`) y añade **`connection_limit=5`** al URL.
- `vitest.config.ts`: registra el setupFile y acota `poolOptions.forks.maxForks=3`.
  **Se conserva la ejecución en paralelo** (no se serializa). El límite bajo de
  workers **no** es por `max_connections` (con 5 conexiones/worker el total es
  mínimo) sino para reducir la **ráfaga de establecimiento de conexiones**
  simultáneas contra el **port-proxy de Docker en Windows**, que bajo carga puede
  rechazar conexiones nuevas y producir fallos transitorios `Can't reach database
server at 127.0.0.1:5432`. Contraintuitivamente, **subir** `connection_limit`
  empeora el problema (ráfagas más grandes); por eso el pool se mantiene pequeño y
  se reducen los workers. En CI (Linux, sin port-proxy) el problema no aplica.

### 3.2 Aislamiento y limpieza de datos

- Cada test sigue creando su propia organización **desechable** con `randomUUID()`
  (ids únicos; folios por organización/año). No hay dependencia de orden.
- **Limpieza global** (`tests/db-global-teardown.ts`, registrado como
  `globalSetup`): al terminar toda la corrida se eliminan los datos de las
  organizaciones desechables (todas menos las del seed), recorriendo dinámicamente
  las tablas con `organization_id` y usando `SET LOCAL session_replication_role =
replica` (desactiva triggers y FK) en una sola transacción. Evita que el estado
  se **acumule** entre corridas locales (la acumulación bloatea la BD y ralentiza
  algunas consultas hasta provocar timeouts). El seed de desarrollo se conserva; no
  se usa TRUNCATE global. En CI, con BD efímera, la limpieza es un no-op inocuo.

### 3.2.1 Guarda de seguridad del cleanup (fail-closed)

**Brecha detectada antes del merge:** la limpieza global es destructiva y, en su
primera versión, se ejecutaba contra cualquiera que fuese `DATABASE_URL` sin
verificar que fuera una BD de pruebas local; forzaba `127.0.0.1` pero **no abortaba**
ante un host remoto/staging/prod.

**Guardas añadidas** (`tests/db-teardown-guard.ts`, función pura
`isSafeTestDatabase(url, env)` evaluada **antes de cualquier consulta destructiva**):

- **Host local obligatorio:** `localhost`, `127.0.0.1` o `::1` (misma política que
  `scripts/db-reset-local.mjs`). Cualquier otro host → se omite.
- **Contexto de test obligatorio:** `VITEST === 'true'` o `GAPSI_TEST_DB === 'true'`
  (el `globalSetup.setup()` fija `GAPSI_TEST_DB` solo cuando Vitest lo carga; no en
  runtime de la app). No se depende de `NODE_ENV`.
- **Se exigen AMBAS** (host local **y** contexto de test).
- **Validación de `DATABASE_URL` con `URL`** (fail-closed): si falta, no parsea, el
  protocolo no es `postgres(ql):` o el host no está permitido → **no** se ejecuta
  nada.
- Si la guarda no pasa, se emite `DB test cleanup skipped: DATABASE_URL is not a
local test database.` y se **omite sin borrar** (no rompe una corrida exitosa).

**Preservar el seed NO es una barrera de seguridad** (en una BD sin esos ids
equivaldría a borrar todo); la barrera es `isSafeTestDatabase`, ejecutada primero.

**`session_replication_role = replica`** se mantiene porque es necesario para borrar
datos con triggers append-only y FK Restrict en una transacción; **no** es un
mecanismo de seguridad y solo corre **después** de pasar las guardas. Requiere rol con
privilegios (el `DATABASE_URL` de desarrollo usa `gapsi`).

### 3.3 Transacciones

No se introdujeron transacciones de aislamiento por test. Con RLS + `withOrgContext`
(que ya usa `$transaction` para fijar `app.current_org`), envolver además cada test
en una transacción externa es frágil y no aporta: la estabilidad se logró con el
ciclo de vida del cliente y el límite de conexiones. Decisión: **no** añadir
transacciones por test.

### 3.4 Política EOL (`.gitattributes`)

```
* text=auto eol=lf
*.png binary
```

- `eol=lf` fuerza LF en el working tree en Windows y Linux, **sin** depender de
  `core.autocrlf` global del usuario.
- No hay scripts `.bat/.cmd/.ps1` que requieran CRLF; los `.png` (únicos binarios)
  quedan marcados como binarios.
- La renormalización no produjo cambios lógicos (`git diff -w` = solo
  `.gitattributes`), porque los blobs ya estaban en LF.

## 4. Comportamiento Windows / Linux

- **Windows:** con `.gitattributes`, el working tree queda en LF; `format:check`
  pasa. No se modifica la configuración global de git del usuario.
- **Linux/CI:** LF nativo; sin cambios.

## 5. Comandos de validación

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build

# Estabilidad de la suite de BD (debe pasar 10/10):
for i in $(seq 1 10); do npx vitest run tests/db || echo "FALLO en $i"; done

# Modo serial y archivos antes flaky, aislados:
npx vitest run tests/db --no-file-parallelism
npx vitest run tests/db/capa-access.test.ts
npx vitest run tests/db/projects-access.test.ts
npx vitest run tests/db/audits-access.test.ts

# Desde una BD limpia:
node scripts/db-reset-local.mjs   # requiere DATABASE_URL local
npm run test:db
```

## 6. Resultado

`test:db` estable: **146/146 en 10 corridas consecutivas** (0 fallas, 0 timeouts, 0
retries), en paralelo, serial y aislado. `format:check` limpio en Windows. Sin
migraciones ni cambios funcionales.
