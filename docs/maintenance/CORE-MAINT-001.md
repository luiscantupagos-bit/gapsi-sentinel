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
- `vitest.config.ts`: registra el setupFile y acota `poolOptions.forks.maxForks=6`.
  **Se conserva la ejecución en paralelo** (no se serializa): con ≤ 6 workers × 5
  conexiones el uso queda muy por debajo de `max_connections`.

### 3.2 Aislamiento de datos

No se cambió el patrón (ya era correcto): cada test crea su propia organización
desechable con `randomUUID()`. No se usa TRUNCATE global. No se toca el seed de
desarrollo.

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
