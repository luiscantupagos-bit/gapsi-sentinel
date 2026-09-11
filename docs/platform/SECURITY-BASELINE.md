# C3 Sentinel — Línea base de seguridad (PLATFORM-001 §11/§14/§15/§28/§31/§33/§34)

> Diseño. La sustitución de auth es **PLATFORM-003**; aquí solo se define el objetivo
> y la preparación mínima indispensable.

## 1. Autenticación (§14)

**Actual**: adaptador **dev** (sesión simulada por cookie), no apto para producción.

**Objetivo (PLATFORM-003)**: login, contraseña segura (hash Argon2/bcrypt),
recuperación, invitaciones, verificación de correo, expiración de sesión, revocación
de sesiones, **MFA futuro**, **SSO futuro**. Multi-tenant, administración de usuarios,
compatibilidad Next.js.

**Recomendación**: **Auth.js (NextAuth v5)** self-hosted (control, sin lock-in, costo).
Alternativa Clerk (rápido, con lock-in/costo). El adaptador `dev` permanece detrás de
`AUTH_PROVIDER` para desarrollo. No se reemplaza auth en PLATFORM-001.

## 2. Roles y permisos (§15)

Diseñar para: Owner, Administrador, Coordinador, Auditor, Responsable, Operador,
Solo lectura. **No basar la seguridad solo en el nombre del rol**: modelo
`Role + Capabilities/Permissions` (el rol agrupa capacidades; la autorización evalúa
capacidades). Hoy ya hay verificación server-side por rol/asignación; se evolucionará
hacia capacidades explícitas.

## 3. Autoridad del servidor

Toda autorización se valida **en servidor** (nunca en el cliente). Los IDs y estados
sensibles no se confían del cliente. RLS por organización como segunda barrera.

## 4. Archivos (§11/§34) — PLATFORM-002 implementado

- **Signed URLs** temporales (TTL 10 min) o streaming autorizado; nunca URLs públicas
  permanentes para binarios privados. Ruta única `/api/files/[fileId]`.
- Autorización server-side por organización/tenant (granular por entidad = futuro).
- `storageKey` generado en servidor; nunca del cliente (anti-traversal).
- Validación por **firma de archivo** (magic bytes) + MIME allowlist + tamaño
  (`MAX_UPLOAD_MB`); SHA-256 por integridad; escaneo antimalware futuro (sin campo aún).
- RLS tenant-scoped en `stored_files`/`file_relations`; FK compuesta impide relacionar
  un archivo con una entidad de otra organización. Ver
  [`../tasks/PLATFORM-002-IMPLEMENTATION-NOTES.md`](../tasks/PLATFORM-002-IMPLEMENTATION-NOTES.md).

## 5. Secrets (§31)

Nunca secretos productivos en git. Catálogo en `src/server/env.ts`; `.env.example`
solo placeholders. Rotación documentada por fase. Runtime con rol `gapsi_app` (RLS).

## 6. Rate limiting (§33)

Necesario a futuro en: login, reset password, uploads, sync API, endpoints públicos y
de IA. No se implementa infraestructura pesada en esta fase.

## 7. Health check (§32)

`GET /api/health` seguro: `app: alive`, `db` (SELECT 1), `env` (presencia, sin
valores). No expone stack traces, credenciales, versiones sensibles ni datos de tenant.

## 8. Retención de datos (§28)

Ciclo conceptual: `ACTIVE → SUSPENDED → RETENTION → EXPORT WINDOW → DELETION`. **Nunca**
borrar de inmediato al cancelar una suscripción. La política final se alineará con
contrato/legal futuro. Relacionado: **exportar organización** (§27) — Documents,
Records, Audits, CAPA, Projects, Programs, Evidence, archivos, CSV/JSON/PDF cuando
corresponda (no se implementa aún).
