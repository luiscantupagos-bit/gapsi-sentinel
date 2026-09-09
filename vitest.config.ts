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
    // Se conserva la ejecución en paralelo (no se serializa), pero se acota a pocos
    // workers para reducir la RÁFAGA de conexiones simultáneas contra el port-proxy
    // de Docker en Windows, causa de fallos transitorios "Can't reach database
    // server". maxForks(3) × connection_limit(5) = 15 conexiones máx, muy por debajo
    // de max_connections. Cada worker comparte UN solo cliente Prisma (ver
    // tests/db/_helpers).
    poolOptions: {
      forks: { maxForks: 3 },
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
