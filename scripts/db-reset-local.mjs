#!/usr/bin/env node
/**
 * Reinicia ÚNICAMENTE la base local de desarrollo.
 *
 * Guarda de seguridad: aborta si `DATABASE_URL` no apunta a localhost/127.0.0.1.
 * Nunca ejecutar contra una base remota o de producción. Envuelve
 * `prisma migrate reset --force` (que recrea el esquema y vuelve a aplicar
 * migraciones + seed) tras confirmar que el host es local.
 */
import { spawnSync } from 'node:child_process';

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('✖ DATABASE_URL no está definida. Aborta.');
  process.exit(1);
}

let host;
try {
  host = new URL(url).hostname;
} catch {
  console.error('✖ DATABASE_URL no es una URL válida. Aborta.');
  process.exit(1);
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
if (!LOCAL_HOSTS.has(host)) {
  console.error(
    `✖ Guarda de seguridad: el host de DATABASE_URL es "${host}", no es local. ` +
      'Este comando solo puede reiniciar bases locales (localhost/127.0.0.1). Aborta.',
  );
  process.exit(1);
}

console.log(`⚠ Reiniciando la base LOCAL en "${host}" (prisma migrate reset --force)...`);
const result = spawnSync('npx', ['prisma', 'migrate', 'reset', '--force'], {
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
