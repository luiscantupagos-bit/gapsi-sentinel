# PLATFORM-002 — File & Object Storage · notas de implementación (Fase 1)

Infraestructura transversal de archivos: modelo `stored_files` + `file_relations`,
proveedores de almacenamiento (local + S3/R2), subida/descarga segura y cuota.
**Aditivo** — no se migran ni tocan las tablas de archivos existentes.

## Auditoría de archivos legacy

9 tablas por módulo con `storage_key` + almacenamiento local en disco:
`document_files`, `evidences`, `capa_files`, `quality_evidence`, `project_files`,
`task_files`, `audit_program_files`, `audit_evidences`, `audit_files`.

Clasificación: **(C) mantener por compatibilidad** (DOC-001/002/003 dependen de
`document_files`); **(B) migrar después** hacia `stored_files` para nuevos uploads;
ninguna **(D) redundante** eliminada ahora. Estrategia: sistema nuevo **conviviendo**
con el legacy; los nuevos módulos (DOC-004, etc.) usan `stored_files`. Migration path
documentado; **no** se migran históricos automáticamente en esta fase.

## Modelo (migración `20260911004709_file_storage`, 0 DROP)

- `stored_files` — binario transversal: `organization_id`, `storage_provider`,
  `bucket`, `storage_key`, `original_filename`, `mime_type`, `size_bytes`, `sha256`,
  `client_upload_id?`, `uploaded_by?`, `created_at`, `deleted_at?`. Únicos:
  `(id, organization_id)`, `(storage_provider, bucket, storage_key)`,
  `(organization_id, client_upload_id)`. Índices por org y por `(org, sha256)`.
  CHECK: `size_bytes >= 0`, `sha256 ~ '^[0-9a-f]{64}$'`, `storage_key`/`filename` no vacíos.
- `file_relations` — relación archivo↔entidad: `entity_type`, `entity_id` (genérico,
  sin FK), `relation_type`. **FK compuesta** `(file_id, organization_id)` →
  `stored_files(id, organization_id)`: garantiza que el archivo pertenezca a la MISMA
  organización (integridad de tenant §40). CHECK de `entity_type`/`relation_type`.
- **RLS** `_tenant_isolation` (`fn_current_org`) en ambas; grants a `gapsi_app`
  (stored_files: SELECT/INSERT/UPDATE — soft delete; file_relations: + DELETE — unlink).

## Proveedores (§8-11)

- Contrato `StorageProvider` (`src/server/storage/provider.ts`): `putObject`,
  `readObject`, `headObject`, `deleteObject`, `copyObject`, `getSignedReadUrl` +
  `supportsSignedUrls`.
- `LocalStorageProvider` (dev/tests): escribe fuera del árbol de código
  (`/storage/objects`, ignorado por git); anti-traversal; sin signed URLs (streaming).
- `S3StorageProvider` (R2/S3): SDK importado **perezosamente** (`@aws-sdk/client-s3`,
  `@aws-sdk/s3-request-presigner`), no requerido en dev/tests; se instala en el
  despliegue. Su configuración/clave es pura y se prueba; las llamadas se mockean.
- Factory `getStorageProvider()` según `STORAGE_PROVIDER` (default `local`). Los
  módulos **no** conocen el proveedor concreto (sin vendor lock-in, §69).

## Servicio (`src/server/files.ts`, §43)

`uploadFile`, `getFile`, `getDownloadTarget`, `deleteFile` (soft), `linkFile`,
`unlinkFile`, `listFilesForEntity`, `getOrganizationStorageUsage`.

- **storageKey** server-side `org/<orgId>/<yyyy>/<mm>/<uuid>.<ext>` (§12); nunca el
  nombre original ni rutas del cliente.
- **MIME allowlist** + **magic bytes** (§14/§15); **tamaño** `MAX_UPLOAD_MB` (25).
- **SHA-256** server-side (§17); dedup lógico dentro del tenant, **no** físico ni
  cross-tenant (§18).
- **Idempotencia** por `client_upload_id` (§29): mismo id → misma metadata (offline).
- **Cuota** tenant-scoped (§33/§35): Fase 1 ilimitada (planes en PLATFORM-007); el %
  de storage **no** usa el semáforo de cumplimiento (§34).

## Descarga autorizada (§21/§23)

Ruta `GET /api/files/[fileId]`: valida sesión/organización; local → streaming
autorizado; S3/R2 → **redirect a URL firmada corta** (TTL 600 s, §22). Nunca expone
`storageKey`, bucket ni proveedor. «No existe» y «sin acceso» → 404 (no filtra
existencia §53). Autorización Fase 1 = pertenencia a la organización; la autorización
**granular por entidad** llega en fases posteriores (documentado).

## Decisiones

- **Two-phase upload (§20)**: el flujo es server-mediated y suficientemente atómico
  (objeto → metadata) → **sin** campo `status`. Fallo tras escribir el objeto:
  compensación borrando el objeto; reintento idempotente por `client_upload_id`.
- **Inmutabilidad (§32)**: no se sobrescribe un `stored_file`; una versión nueva es un
  archivo nuevo.
- **Malware (§38)**: sin motor antivirus; `scanStatus` **no** se añade al esquema en
  esta fase (documentado como futuro).
- **Logo de organización (§24/§47)**: la plomería existe (entity_type=`organization`,
  relation_type=`logo`, ruta autorizada). La UI de subida en Configuración y el switch
  del renderer (logoFileId con fallback a `logo_url` legacy) se **difieren a
  PLATFORM-002B** para acotar el alcance; `logo_url` no se elimina.

## Compatibilidad futura

- **DOC-004**: `record → evidence → stored_file` y `document/version → attachment`.
- **DOC-003**: `task → evidence → stored_file`.
- **Offline/PWA (§28/§57)**: `client_upload_id` habilita reintentos idempotentes;
  IndexedDB Blob → upload queue → uploadFile. Chunking futuro.
- **TRACE/OPS, MEET-001, PROJECT-002**: soportados por el vocabulario `entity_type`
  (meeting, project, …) sin cambios de esquema.

## Tests

- Unit: `storage-policy` (MIME, magic bytes, storageKey, tamaño, cuota, factory,
  config S3), `storage-local-provider` (put/read/head/delete/copy/traversal).
- DB: `db/file-storage` (A-P: upload, relación, listado, aislamiento, cross-tenant,
  soft delete, descarga negada, uso, idempotencia, mismo hash, tipos inválidos, unlink).

## Pendiente / follow-ups

- PLATFORM-002B: UI de logo + switch del renderer; UI mínima de adjuntos por entidad.
- Migración de uploads legacy a `stored_files` (bridge por módulo).
- Instalar `@aws-sdk/*` y probar R2 real en staging; malware scanning; chunking/offline.
- CI: agregar `format:check` + `test:db` (follow-up de PLATFORM-001).
