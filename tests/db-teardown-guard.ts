/**
 * CORE-MAINT-001 — Guarda de seguridad (fail-closed) para la limpieza de datos de
 * las pruebas de BD (`tests/db-global-teardown.ts`).
 *
 * La limpieza es destructiva (borra datos por organización con
 * `session_replication_role=replica`). Esta guarda impide que se ejecute contra una
 * base de datos que no sea de pruebas locales. Debe evaluarse ANTES de cualquier
 * consulta destructiva. Función PURA (sin efectos) para poder probarla sin DB.
 */
export interface TeardownEnv {
  VITEST?: string;
  GAPSI_TEST_DB?: string;
  [key: string]: string | undefined;
}

/** Hosts donde se permite la limpieza destructiva (solo BD local). */
export const ALLOWED_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const ALLOWED_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

/**
 * Devuelve `true` solo si se cumplen AMBAS condiciones (fail-closed):
 *  1. Contexto de test explícito (`VITEST === 'true'` o `GAPSI_TEST_DB === 'true'`).
 *  2. `url` válida, protocolo PostgreSQL y hostname local permitido.
 * Cualquier otra situación (falta, no parseable, protocolo/host no permitido, sin
 * contexto de test) devuelve `false` y la limpieza se OMITE sin borrar nada.
 */
export function isSafeTestDatabase(url: string | undefined, env: TeardownEnv): boolean {
  // 1) Contexto de test permitido (no se depende de NODE_ENV).
  const inTestContext = env.VITEST === 'true' || env.GAPSI_TEST_DB === 'true';
  if (!inTestContext) return false;

  // 2) URL válida + protocolo Postgres + host local.
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;
  const host = parsed.hostname.replace(/^\[/, '').replace(/\]$/, ''); // normaliza IPv6 [::1]
  return ALLOWED_DB_HOSTS.has(host);
}
