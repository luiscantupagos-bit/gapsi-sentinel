/**
 * Servicio transversal de archivos (PLATFORM-002 §43). Sube/lee/relaciona binarios
 * de forma segura y tenant-scoped. PostgreSQL es la fuente de verdad
 * (`stored_files` + `file_relations`); el binario vive en el `StorageProvider` activo.
 *
 * Decisión de subida (§20): el flujo es SERVER-MEDIATED y suficientemente atómico
 * (el servidor escribe el objeto y luego la metadata), por lo que NO se añade un
 * campo `status`/two-phase. Un fallo tras escribir el objeto deja un binario
 * huérfano (sin metadata) que un job de limpieza futuro puede recolectar; el
 * reintento con el mismo `clientUploadId` es idempotente y no duplica metadata.
 */
import { randomUUID } from 'node:crypto';
import { getPrisma, withOrgContext } from './db';
import {
  getStorageProvider,
  defaultBucket,
  activeProviderName,
  signedUrlTtlSeconds,
} from './storage';
import { sha256Hex } from './storage/hash';
import {
  validateUploadMeta,
  magicBytesMatch,
  isEntityType,
  isRelationType,
  extForMime,
  sanitizeFilename,
  storageKeyFor,
  computeStorageQuota,
  fitsInQuota,
  resolveMaxUploadBytes,
  type EntityType,
  type RelationType,
  type StorageQuota,
} from '@/features/storage/file-policy';

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileValidationError';
  }
}
export class FileNotFoundError extends Error {
  constructor() {
    super('Archivo no encontrado.');
    this.name = 'FileNotFoundError';
  }
}
export class FileAccessError extends Error {
  constructor(message = 'No tienes acceso a este archivo.') {
    super(message);
    this.name = 'FileAccessError';
  }
}
export class StorageQuotaError extends Error {
  constructor(message = 'No hay espacio disponible.') {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

export interface UploadFileInput {
  filename: string;
  mimeType: string;
  data: Buffer;
  /** Idempotencia (offline/reintentos): mismo id → misma metadata (§29). */
  clientUploadId?: string | null;
  /** Relación opcional a una entidad de negocio. */
  relation?: { entityType: EntityType; entityId: string; relationType: RelationType };
}

export interface StoredFileMeta {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string | null;
  createdAt: string;
}

/** Cuota de la organización (Fase 1: sin límite → ilimitado, §35). */
async function organizationQuotaLimit(): Promise<number | null> {
  return null; // los planes/PLATFORM-007 definirán el límite real
}

/**
 * Sube un archivo: valida MIME/tamaño/firma/cuota, calcula SHA-256, guarda el objeto
 * y persiste la metadata. Idempotente por `clientUploadId`. Devuelve la metadata.
 */
export async function uploadFile(
  organizationId: string,
  actorId: string,
  input: UploadFileInput,
): Promise<StoredFileMeta> {
  const prisma = getPrisma();
  const size = input.data.byteLength;
  const maxBytes = resolveMaxUploadBytes();

  const meta = validateUploadMeta({
    filename: input.filename,
    mimeType: input.mimeType,
    sizeBytes: size,
    maxBytes,
  });
  if (!meta.ok) throw new FileValidationError(meta.error ?? 'Archivo no permitido.');

  // Firma binaria (magic bytes) coherente con el MIME declarado (§15).
  if (!magicBytesMatch(input.mimeType, input.data.subarray(0, 16))) {
    throw new FileValidationError('El contenido no coincide con el tipo declarado.');
  }

  // Idempotencia (§29): si ya existe un upload con este clientUploadId, devolverlo.
  if (input.clientUploadId) {
    const existing = await prisma.storedFile.findFirst({
      where: { organizationId, clientUploadId: input.clientUploadId, deletedAt: null },
    });
    if (existing) {
      if (input.relation) {
        await linkFile(organizationId, actorId, existing.id, input.relation);
      }
      return toMeta(existing);
    }
  }

  // Cuota (§35).
  const [usage, limit] = await Promise.all([
    getOrganizationStorageUsage(organizationId),
    organizationQuotaLimit(),
  ]);
  if (!fitsInQuota(usage.usedBytes, size, limit)) throw new StorageQuotaError();

  const sha256 = sha256Hex(input.data);
  const provider = getStorageProvider();
  const bucket = defaultBucket();
  const ext = extForMime(input.mimeType);
  const storageKey = storageKeyFor(organizationId, ext, randomUUID());

  // 1) Escribe el objeto (si falla, no se persiste metadata).
  await provider.putObject({ bucket, storageKey, body: input.data, mimeType: input.mimeType });

  // 2) Persiste la metadata (y la relación si viene) dentro del contexto RLS.
  const id = randomUUID();
  try {
    await withOrgContext(organizationId, async (tx) => {
      await tx.storedFile.create({
        data: {
          id,
          organizationId,
          storageProvider: activeProviderName(),
          bucket,
          storageKey,
          originalFilename: sanitizeFilename(input.filename),
          mimeType: input.mimeType,
          sizeBytes: size,
          sha256,
          clientUploadId: input.clientUploadId ?? null,
          uploadedBy: actorId,
        },
      });
      if (input.relation) {
        await createRelation(tx, organizationId, actorId, id, input.relation);
      }
    });
  } catch (error) {
    // Compensación: si la metadata falla, elimina el objeto para no dejar basura.
    await provider.deleteObject({ bucket, storageKey }).catch(() => {});
    throw error;
  }

  const row = await prisma.storedFile.findUniqueOrThrow({ where: { id } });
  return toMeta(row);
}

function toMeta(row: {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string | null;
  createdAt: Date;
}): StoredFileMeta {
  return {
    id: row.id,
    filename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

async function createRelation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  organizationId: string,
  actorId: string,
  fileId: string,
  relation: { entityType: EntityType; entityId: string; relationType: RelationType },
): Promise<void> {
  if (!isEntityType(relation.entityType))
    throw new FileValidationError('Tipo de entidad no válido.');
  if (!isRelationType(relation.relationType))
    throw new FileValidationError('Tipo de relación no válido.');
  await tx.fileRelation.upsert({
    where: {
      organizationId_fileId_entityType_entityId_relationType: {
        organizationId,
        fileId,
        entityType: relation.entityType,
        entityId: relation.entityId,
        relationType: relation.relationType,
      },
    },
    update: {},
    create: {
      organizationId,
      fileId,
      entityType: relation.entityType,
      entityId: relation.entityId,
      relationType: relation.relationType,
      createdBy: actorId,
    },
  });
}

/** Relaciona un archivo existente con una entidad (§43). Idempotente. */
export async function linkFile(
  organizationId: string,
  actorId: string,
  fileId: string,
  relation: { entityType: EntityType; entityId: string; relationType: RelationType },
): Promise<void> {
  const file = await getPrisma().storedFile.findFirst({
    where: { id: fileId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!file) throw new FileNotFoundError();
  await withOrgContext(organizationId, async (tx) => {
    await createRelation(tx, organizationId, actorId, fileId, relation);
  });
}

/** Elimina una relación archivo↔entidad (no borra el archivo). */
export async function unlinkFile(
  organizationId: string,
  fileId: string,
  relation: { entityType: EntityType; entityId: string; relationType: RelationType },
): Promise<void> {
  await withOrgContext(organizationId, async (tx) => {
    await tx.fileRelation.deleteMany({
      where: {
        organizationId,
        fileId,
        entityType: relation.entityType,
        entityId: relation.entityId,
        relationType: relation.relationType,
      },
    });
  });
}

/** Archivos (no borrados) relacionados con una entidad (§45). Metadata, sin credenciales. */
export async function listFilesForEntity(
  organizationId: string,
  entityType: EntityType,
  entityId: string,
): Promise<Array<StoredFileMeta & { relationType: string }>> {
  const rows = await getPrisma().fileRelation.findMany({
    where: { organizationId, entityType, entityId, file: { deletedAt: null } },
    orderBy: { createdAt: 'desc' },
    include: { file: true },
  });
  return rows.map((r) => ({ ...toMeta(r.file), relationType: r.relationType }));
}

/** Número de relaciones activas de un archivo (para borrado seguro §16). */
export async function activeRelationCount(organizationId: string, fileId: string): Promise<number> {
  return getPrisma().fileRelation.count({ where: { organizationId, fileId } });
}

/**
 * Desvincula una relación y, si el archivo queda **sin otras relaciones**, lo marca
 * como borrado (soft delete §15/§16). Si sigue compartido, solo desvincula. Nunca
 * destruye un archivo referenciado por otra entidad.
 */
export async function unlinkAndCleanup(
  organizationId: string,
  fileId: string,
  relation: { entityType: EntityType; entityId: string; relationType: RelationType },
): Promise<{ deleted: boolean }> {
  await unlinkFile(organizationId, fileId, relation);
  const remaining = await activeRelationCount(organizationId, fileId);
  if (remaining === 0) {
    await deleteFile(organizationId, fileId);
    return { deleted: true };
  }
  return { deleted: false };
}

/** Metadata de un archivo vigente (o error). */
export async function getFile(organizationId: string, fileId: string): Promise<StoredFileMeta> {
  const row = await getPrisma().storedFile.findFirst({
    where: { id: fileId, organizationId, deletedAt: null },
  });
  if (!row) throw new FileNotFoundError();
  return toMeta(row);
}

export type DownloadTarget =
  | { kind: 'stream'; bytes: Buffer; mimeType: string; filename: string }
  | { kind: 'redirect'; url: string; filename: string };

/**
 * Prepara la descarga autorizada (§21/§23): valida tenant, y según el proveedor
 * devuelve el binario para streaming (local) o una URL firmada corta (S3/R2).
 * Fase 1: autorización = pertenencia a la organización (control por tenant/módulo);
 * la autorización granular por entidad llega en fases posteriores (documentado).
 */
export async function getDownloadTarget(
  organizationId: string,
  fileId: string,
): Promise<DownloadTarget> {
  const row = await getPrisma().storedFile.findFirst({
    where: { id: fileId, organizationId, deletedAt: null },
  });
  if (!row) throw new FileNotFoundError();
  const provider = getStorageProvider();
  const ref = { bucket: row.bucket, storageKey: row.storageKey };
  if (provider.supportsSignedUrls) {
    const url = await provider.getSignedReadUrl(ref, signedUrlTtlSeconds());
    return { kind: 'redirect', url, filename: row.originalFilename };
  }
  const bytes = await provider.readObject(ref);
  return { kind: 'stream', bytes, mimeType: row.mimeType, filename: row.originalFilename };
}

/** Marca un archivo como borrado (soft delete §31); niega descargas futuras. */
export async function deleteFile(organizationId: string, fileId: string): Promise<void> {
  const row = await getPrisma().storedFile.findFirst({
    where: { id: fileId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!row) throw new FileNotFoundError();
  await withOrgContext(organizationId, async (tx) => {
    await tx.storedFile.update({ where: { id: fileId }, data: { deletedAt: new Date() } });
  });
}

export interface StorageUsage extends StorageQuota {
  fileCount: number;
}

/** Uso de almacenamiento de la organización (bytes + cantidad), tenant-scoped (§33). */
export async function getOrganizationStorageUsage(
  organizationId: string,
  limitBytes: number | null = null,
): Promise<StorageUsage> {
  const agg = await getPrisma().storedFile.aggregate({
    where: { organizationId, deletedAt: null },
    _sum: { sizeBytes: true },
    _count: { _all: true },
  });
  const used = agg._sum.sizeBytes ?? 0;
  return { ...computeStorageQuota(used, limitBytes), fileCount: agg._count._all };
}
