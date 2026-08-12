/**
 * CORE-MAINT-001 — Limpieza global de datos de prueba de BD.
 *
 * `globalSetup` de Vitest: corre UNA vez por invocación de `vitest run`, en el
 * proceso principal. Al terminar TODAS las suites, elimina los datos de las
 * organizaciones DESECHABLES (las que crean las pruebas con ids aleatorios),
 * conservando las organizaciones del seed de desarrollo. Así el estado no se
 * acumula entre corridas y `test:db` es determinista también en local.
 *
 * Estrategia: se recorren dinámicamente todas las tablas con columna
 * `organization_id` y se borra lo que no pertenezca al seed, con
 * `session_replication_role = replica` (desactiva triggers y verificación de FK)
 * en una sola transacción. Requiere rol con privilegios (el `DATABASE_URL` de
 * desarrollo usa `gapsi`, superusuario). No toca el seed ni migraciones.
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

// Organizaciones del seed de desarrollo (prisma/seed.ts): NO se borran.
const SEED_ORG_IDS = [
  '00000000-0000-4000-8000-0000000000a0',
  '00000000-0000-4000-8000-0000000000b0',
];

/**
 * Garantiza `DATABASE_URL` (cargándola de `.env`) y fuerza IPv4, igual que el
 * setupFile de los workers. El teardown corre en el PROCESO PRINCIPAL, que no pasa
 * por ese setupFile.
 */
function ensureDatabaseUrl(): string | undefined {
  if (!process.env.DATABASE_URL) {
    try {
      const contents = readFileSync(new URL('../.env', import.meta.url), 'utf8');
      const match = contents.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
      if (match) process.env.DATABASE_URL = match[1];
    } catch {
      /* sin .env */
    }
  }
  if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = process.env.DATABASE_URL.replace('://localhost', '://127.0.0.1');
  }
  return process.env.DATABASE_URL;
}

export async function setup(): Promise<void> {
  // Nada que preparar; toda la lógica está en el teardown.
}

export async function teardown(): Promise<void> {
  if (!ensureDatabaseUrl()) return; // sin BD: las pruebas se saltan.
  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'organization_id'`,
    );
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`);
      for (const { table_name } of tables) {
        await tx.$executeRawUnsafe(
          `DELETE FROM "${table_name}" WHERE organization_id NOT IN ($1::uuid, $2::uuid)`,
          SEED_ORG_IDS[0],
          SEED_ORG_IDS[1],
        );
      }
      await tx.$executeRawUnsafe(
        `DELETE FROM organizations WHERE id NOT IN ($1::uuid, $2::uuid)`,
        SEED_ORG_IDS[0],
        SEED_ORG_IDS[1],
      );
      // Usuarios de prueba (sin organization_id) creados por los helpers.
      await tx.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'u-%@x.test'`);
      await tx.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'u-%@example.test'`);
    });
  } catch {
    // La limpieza es best-effort: nunca debe hacer fallar la corrida de pruebas.
  } finally {
    await prisma.$disconnect();
  }
}
