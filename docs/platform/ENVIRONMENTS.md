# C3 Sentinel — Entornos y configuración (PLATFORM-001 §4/§31)

## Entornos

| Entorno        | Propósito               | Datos                                             |
| -------------- | ----------------------- | ------------------------------------------------- |
| **LOCAL**      | Desarrollo.             | Semilla demo; Postgres en Docker (`compose.yml`). |
| **STAGING**    | Entorno real de prueba. | **Sin datos productivos**; datos sintéticos.      |
| **PRODUCTION** | Clientes reales.        | Datos reales; acceso restringido.                 |

## Flujo de promoción

```
feature → PR → main → staging → smoke test → validación de migración → production
```

**Nunca** `feature → production` directa. Toda migración se valida en staging antes
de producción (ver [DEPLOYMENT-STRATEGY](DEPLOYMENT-STRATEGY.md)).

## Variables por entorno

El catálogo tipado vive en `src/server/env.ts` (`ENV_CATALOG`); `envReport()` reporta
**presencia** (nunca valores). `.env.example` contiene solo placeholders.

| Variable                     | Secreto | Requerida en  | Uso hoy | Notas                                                   |
| ---------------------------- | ------- | ------------- | ------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_APP_NAME`       | no      | —             | sí      | Nombre visible.                                         |
| `APP_URL`                    | no      | staging, prod | no      | `https://app.c3sentinel.com.mx`.                        |
| `APP_ENV`                    | no      | staging, prod | no      | `local`/`staging`/`production`.                         |
| `DATABASE_URL`               | **sí**  | todos         | sí      | Rol de app con **RLS** en prod (`gapsi_app`).           |
| `DIRECT_URL`                 | **sí**  | staging, prod | no      | Conexión directa para migraciones (cuando hay pooling). |
| `AUTH_PROVIDER`              | no      | —             | sí      | `dev` en local; real en PLATFORM-003.                   |
| `AUTH_SESSION_COOKIE`        | no      | —             | sí      | Nombre de cookie de sesión.                             |
| `AUTH_SECRET`                | **sí**  | staging, prod | no      | Firma de sesión/tokens (PLATFORM-003).                  |
| `STORAGE_ENDPOINT`           | no      | prod          | no      | Endpoint S3-compatible (PLATFORM-002).                  |
| `STORAGE_BUCKET`             | no      | prod          | no      | Bucket de binarios.                                     |
| `STORAGE_ACCESS_KEY`         | **sí**  | prod          | no      | Access key storage.                                     |
| `STORAGE_SECRET_KEY`         | **sí**  | prod          | no      | Secret key storage.                                     |
| `CRON_SECRET`                | **sí**  | prod          | no      | Autentica el disparador del scheduler.                  |
| `SENTRY_DSN`                 | **sí**  | —             | no      | Monitoreo de errores.                                   |
| `EMAIL_API_KEY`              | **sí**  | —             | no      | Correo transaccional.                                   |
| `DOCUMENTS_STORAGE_DIR`      | no      | —             | sí      | Carpeta local (dev).                                    |
| `DOCUMENTS_MAX_UPLOAD_BYTES` | no      | —             | sí      | Límite de subida.                                       |

## Secretos (§31)

- **Nunca** secretos productivos en git. `.env.example` solo placeholders.
- Los secretos viven en el gestor del hosting (Vercel/Render env, o un secret store).
- Rotación de `AUTH_SECRET`, storage keys y `CRON_SECRET` documentada en su fase.
- La conexión de **runtime** usa `gapsi_app` (RLS); `DIRECT_URL`/owner solo migración.

## Estado actual

`.env.example` se amplía en esta fase con placeholders para las variables futuras
(auth/storage/cron/monitoring/app URL). No se añade ningún secreto real ni se cambia
el comportamiento: el runtime sigue leyendo `process.env` como hoy.
