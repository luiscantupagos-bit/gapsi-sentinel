# C3 Sentinel — Arquitectura de archivos y Object Storage (PLATFORM-001 §7-12/§34)

> Diseño. La implementación es **PLATFORM-002**. En esta fase solo se define el
> contrato `StorageProvider` (sin cablear) y el modelo de datos objetivo.

## 1. Contrato `StorageProvider` (§7)

`src/server/storage/provider.ts` (solo interfaz):

```
put(input) → StorageObjectRef
getSignedUrl(input) → string     // get | put, expiración corta
delete(ref)
head(ref) → StorageObjectMeta | null
copy(input) → StorageObjectRef
```

Los módulos de negocio **no** dependen de AWS/R2/S3 directamente. `getStorageProvider()`
lanza `StorageNotConfiguredError` hasta PLATFORM-002.

**Proveedor inicial recomendado: Cloudflare R2** (S3-compatible, **egress $0**, buen
costo, sencillo desde México vía Cloudflare). Alternativas: AWS S3 (madurez/lock-in),
Supabase Storage (si se adopta Supabase para auth+DB), Backblaze B2 (costo). Ver
[DEPLOYMENT-STRATEGY](DEPLOYMENT-STRATEGY.md).

## 2. PostgreSQL = fuente de verdad (§9)

El Object Storage **no** define la estructura funcional. Nunca inferir relaciones de
carpetas (`/empresa/calidad/documentos`). PostgreSQL sabe: qué es el archivo,
organización, entidad relacionada, versión, actor, fecha, hash, relación y estado.
`storageKey` es **solo un detalle técnico**.

## 3. Modelo transversal objetivo (§8)

Hoy los archivos están **fragmentados** en ~10 tablas por módulo (`DocumentFile`,
`CapaFile`, `QualityEvidence`, `ProjectFile`, `TaskFile`, `AuditFile`, `AuditEvidence`,
`AuditProgramFile`, `Evidence`, …), todas con `storage_key` local. El objetivo es
**unificar** (sin romper lo existente; se migra por fases, patrón expand→contract):

```
stored_files
  id, organizationId, storageProvider, bucket, storageKey,
  originalFilename, mimeType, sizeBytes, sha256,
  uploadedBy, createdAt, deletedAt

file_relations
  id, organizationId, fileId, entityType, entityId, relationType, createdAt
```

- `stored_files` = un binario físico (con hash → dedup y verificación).
- `file_relations` = a qué entidades pertenece (documento, versión, registro,
  evidencia, auditoría, hallazgo, CAPA, Task, Programa, Proyecto, logo de organización,
  anexos). Un archivo puede relacionarse con varias entidades.
- **No duplicar infraestructura** existente si puede evolucionar hacia este modelo.

## 4. Trazabilidad (§10)

Metadata por archivo/relación: actor, timestamp, MIME, size, hash, source, entity,
version. Preparado para: organización, logo, documento, versión documental, registro,
evidencia, auditoría, hallazgo, CAPA, Task, Programa, Proyecto y anexos.

## 5. Seguridad (§11)

- **Nunca** URLs públicas permanentes para binarios privados → **signed URLs**
  temporales.
- Antes de firmar una URL, validar **en servidor**: organización, membership, permiso
  y acceso a la entidad.
- **Nunca** confiar en un `storageKey` recibido del cliente; se resuelve desde la BD.

## 6. Límites de archivo (§34)

Defaults técnicos provisionales: tamaño máximo de subida; MIME permitidos; validación
de imagen; **validación por firma de archivo (magic bytes), no por extensión**; escaneo
antimalware futuro. No confiar en la extensión.

## 7. Cuotas de storage (§12)

Medición **tenant-scoped**: bytes usados, cantidad de archivos, cuota, % utilizado
(derivable de `stored_files` por organización). Base para planes futuros; sin precios
finales.

> **Importante (§37)**: el % de storage utilizado **NO** usa el semáforo global de
> cumplimiento (no es «mayor es mejor»). Su semántica es de utilización de capacidad.

## 8. Fotos y offline (§24)

Pipeline futuro (PLATFORM-005): `Camera → Blob → IndexedDB → Upload Queue → Object
Storage → stored_files → file_relations → record`. No se implementa aquí.
