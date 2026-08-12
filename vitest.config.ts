import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // CORE-MAINT-001: normaliza DATABASE_URL (IPv4 + connection_limit) por worker.
    setupFiles: ['./tests/setup-db-env.ts'],
    // Limpieza global (una vez): elimina los datos de organizaciones desechables
    // al terminar, para que el estado no se acumule entre corridas.
    globalSetup: ['./tests/db-global-teardown.ts'],
    // Se conserva la ejecución en paralelo (no se serializa). Se acota el número
    // de workers para que N_workers × connection_limit(5) no agote max_connections
    // de PostgreSQL. Cada worker comparte UN solo cliente Prisma (ver tests/db/_helpers).
    poolOptions: {
      forks: { maxForks: 6 },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
