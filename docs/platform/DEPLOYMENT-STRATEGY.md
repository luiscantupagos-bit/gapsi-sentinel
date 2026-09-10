# C3 Sentinel — Estrategia de despliegue (PLATFORM-001 §6/§29/§30/§35)

> Diseño y **recomendación**. No se contrata ni despliega en esta fase.

## 1. Recomendaciones (evaluadas)

| Capa               | Recomendación inicial                             | Por qué                                                                                                                                     | Alternativas                                                                     |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **App / Frontend** | **Vercel**                                        | Mejor DX para Next.js 15 (App Router, middleware edge, ISR), **Vercel Cron** para el scheduler, CDN global con buena latencia a México.     | Render / Railway (contenedores, más control, si se requiere worker persistente). |
| **PostgreSQL**     | **Neon**                                          | Serverless Postgres con **pooling + `DIRECT_URL`** (encaja con Prisma), **branching** para staging, **PITR**, buena integración con Vercel. | Supabase (si además se adopta su Auth/Storage), Railway/Render Postgres.         |
| **Object Storage** | **Cloudflare R2**                                 | S3-compatible, **egress $0**, costo bajo, cercanía vía Cloudflare.                                                                          | AWS S3, Supabase Storage, Backblaze B2.                                          |
| **Auth**           | **Auth.js (NextAuth v5)** self-hosted             | Sin lock-in, multi-tenant, credenciales + email + SSO futuro, costo.                                                                        | Clerk (rápido, pero lock-in/costo), Supabase Auth.                               |
| **Scheduler**      | **Vercel Cron** → Route Handler con `CRON_SECRET` | Sin `setInterval`; el processor sigue puro.                                                                                                 | Cron del hosting, worker + cola (evolución).                                     |
| **Monitoring**     | **Sentry** + logs del hosting                     | Errores + trazas; OpenTelemetry futuro.                                                                                                     | Logtail, Better Stack.                                                           |

**Región / México (§35)**: preferir la región de menor latencia disponible (típicamente
`us-east`), evaluando costo y disponibilidad. **No** se hacen afirmaciones legales de
residencia de datos sin verificación; si un cliente exige residencia en México se
evaluará por contrato. Recomendación concreta, **sin contratar** todavía.

## 2. Consideraciones evaluadas

Compatibilidad Next.js 15 · Prisma (`migrate deploy`, pooling + `DIRECT_URL`) · cron/jobs ·
regiones/latencia MX · backups/PITR · escalabilidad · costo · vendor lock-in · DX · soporte.

## 3. CI/CD (§29)

**Hoy**: un job `validate` (lint, typecheck, test, build) en PR y push a main. **Falta**
`format:check` y `test:db` (requiere servicio Postgres en CI), y no hay despliegue.

**Objetivo**:

- **PR**: `format:check` → `lint` → `typecheck` → `test` → **`test:db`** (con Postgres de
  servicio) → `build`.
- **main → staging**: deploy automático a staging.
- **staging → production**: **promoción controlada** (aprobación manual).

Pipeline de despliegue: `backup/check → prisma migrate deploy → deploy → smoke → monitor`.
No se activa el despliegue productivo en esta fase.

## 4. Migraciones productivas (§30)

- **Nunca** `prisma db push` en producción. Usar **`prisma migrate deploy`**.
- Estrategia **expand → deploy → migrar datos si aplica → contract después**.
- Evitar migraciones destructivas (mantener el estándar **0 DROP TABLE / 0 DROP COLUMN**
  seguido en DOC-001…003).
- Validar cada migración en **staging** antes de producción.

## 5. Backups y recuperación (§13)

- **PostgreSQL**: backups automáticos + **PITR** (retención inicial ~7 días);
  procedimiento de restauración probado.
- **Object Storage**: **versioning** + lifecycle + recuperación de objetos borrados +
  protección contra eliminación accidental.
- **RPO** objetivo inicial: ≤ 24 h (con PITR, minutos para la BD). **RTO** objetivo
  inicial: pocas horas. **Sin SLA comercial** prometido todavía.

## 6. Dominios (§5)

`www.c3sentinel.com.mx` → sitio comercial · `app.c3sentinel.com.mx` → aplicación ·
(futuro) `api.` / `developers.`. **No** se configuran dominios en esta fase.
