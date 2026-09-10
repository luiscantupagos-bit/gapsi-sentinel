# PLATFORM-001 — Notas de implementación

Fase de **auditoría + diseño + contratos base**. Mayormente documentación; el código
es preparatorio y **no cambia el comportamiento** existente. **0 migraciones.**

## Documentación creada

- `docs/platform/PRODUCTION-ARCHITECTURE.md` — auditoría, riesgos, arquitectura
  objetivo, diagrama Mermaid, multi-tenancy/RLS, jobs, observabilidad, health.
- `docs/platform/ENVIRONMENTS.md` — local/staging/production, variables por entorno,
  secretos.
- `docs/platform/STORAGE-ARCHITECTURE.md` — `StorageProvider`, `stored_files`/
  `file_relations`, signed URLs, cuotas, límites de archivo.
- `docs/platform/PWA-OFFLINE-STRATEGY.md` — PWA-ready, offline parcial, IndexedDB,
  sync idempotente, conflictos, fotos, QR.
- `docs/platform/DEPLOYMENT-STRATEGY.md` — hosting/DB/storage/auth recomendados, CI/CD,
  migraciones, backups/RPO/RTO, regiones MX.
- `docs/platform/SECURITY-BASELINE.md` — auth objetivo, roles+capabilities, secrets,
  archivos, rate limiting, retención.
- `docs/platform/ROADMAP.md` — PLATFORM-001…008 + CORE-UX-005, UI-FIX, DOC-004,
  PROGRAM-UX-001, PROJECT-002, sidebar objetivo, Gantt reusable, conceptos de módulos.
- `docs/architecture/adr/README.md` — 12 ADRs fundacionales.

## Código preparatorio (seguro)

- `src/server/env.ts` — catálogo tipado de variables + `envReport()` (presencia, sin
  valores) + `resolveEnvScope()`. No cablea nada del runtime actual.
- `src/server/storage/provider.ts` — contrato `StorageProvider` (put/getSignedUrl/
  delete/head/copy) + tipos; `getStorageProvider()` lanza `StorageNotConfiguredError`
  (implementación en PLATFORM-002).
- `src/features/compliance/compliance-band.ts` — semáforo central puro
  (`getComplianceBand`, `validateCompliancePolicy`, defaults 90/80/70). **Sin cablear**
  a componentes (eso es CORE-UX-005).
- `src/app/api/health/route.ts` — health check seguro (`app`, `db`, `env`).
- `.env.example` — placeholders de variables futuras (auth/storage/cron/monitoring/app).

## Tests agregados

- `tests/compliance-band.test.ts` — límites 100/90/89.99/80/79.99/70/69.99/0, rangos,
  política válida/inválida, validación.
- `tests/platform-env.test.ts` — catálogo (sin duplicados, secretos marcados), scope,
  reporte de faltantes en producción (sin exponer valores).

## Decisiones y límites

- **0 migraciones**: `stored_files`/`file_relations`, persistencia del semáforo,
  entidades de proyecto y offline se **diseñan**, no se migran (llegan en sus fases).
- El resolver del semáforo se implementa puro pero **no** se conecta a gauge/cards/
  charts todavía (CORE-UX-005), para no cambiar comportamiento.
- `getStorageProvider()` falla explícitamente hasta PLATFORM-002 (no hay disco/cloud
  nuevo).
- Auth **no** se reemplaza; solo se cataloga `AUTH_SECRET` como requerida en prod.

## Pendiente (fases siguientes)

Ver `docs/platform/ROADMAP.md`. Orden recomendado: CORE-UX-005 → UI-FIX → PLATFORM-002
→ DOC-004 → PLATFORM-004 → PLATFORM-005; PLATFORM-003 antes de producción real.
