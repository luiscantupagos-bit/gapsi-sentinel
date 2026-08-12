/**
 * CORE-MAINT-001 — Entorno determinista para las pruebas.
 *
 * Se ejecuta como `setupFile` de Vitest (una vez por worker, antes de importar
 * los tests) para:
 *  1. Garantizar `DATABASE_URL` (cargándola de `.env` si el runtime aún no la
 *     puso en `process.env`), de forma que las pruebas de BD no se salten.
 *  2. Forzar IPv4 (`127.0.0.1`): en Windows `localhost` puede resolver a `::1`,
 *     que el contenedor no publica.
 *  3. Acotar el pool de conexiones de Prisma (`connection_limit`) para no agotar
 *     `max_connections` de PostgreSQL cuando varios workers corren en paralelo.
 *
 * No modifica configuración global de git ni del sistema; solo `process.env` del
 * proceso de pruebas. Idempotente.
 */
import { readFileSync } from 'node:fs';

const CONNECTION_LIMIT = 5;

function loadDatabaseUrlFromEnvFile(): void {
  if (process.env.DATABASE_URL) return;
  try {
    const contents = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    const match = contents.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
    if (match) process.env.DATABASE_URL = match[1];
  } catch {
    // Sin .env: las pruebas de BD se saltan (hasDb === false).
  }
}

function normalizeDatabaseUrl(): void {
  const raw = process.env.DATABASE_URL;
  if (!raw) return;
  let url = raw.replace('://localhost', '://127.0.0.1');
  if (!/[?&]connection_limit=/.test(url)) {
    url += (url.includes('?') ? '&' : '?') + `connection_limit=${CONNECTION_LIMIT}`;
  }
  process.env.DATABASE_URL = url;
}

loadDatabaseUrlFromEnvFile();
normalizeDatabaseUrl();
