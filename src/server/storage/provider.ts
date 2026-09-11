/**
 * Contrato de Object Storage (PLATFORM-002). Abstracción que aísla a los módulos de
 * negocio del proveedor concreto (local / R2 / S3). PostgreSQL es la fuente de verdad
 * (§7); `storageKey` es solo detalle técnico. El acceso a binarios privados usa
 * signed URLs cortas o streaming autorizado (§11/§21).
 */

/** Referencia técnica a un objeto (detalle, no identidad de negocio). */
export interface StorageObjectRef {
  bucket: string;
  storageKey: string;
}

export interface StorageObjectMeta {
  sizeBytes: number;
  mimeType: string | null;
  sha256?: string | null;
  updatedAt?: Date | null;
}

export interface PutObjectInput {
  bucket: string;
  storageKey: string;
  body: Buffer;
  mimeType: string;
}

/**
 * Operaciones mínimas del proveedor (§8). Implementaciones: local (dev/tests) y
 * S3-compatible (R2/S3, staging/prod). `supportsSignedUrls` decide la estrategia de
 * descarga: URL firmada (redirect) vs. streaming autorizado.
 */
export interface StorageProvider {
  readonly name: string;
  readonly supportsSignedUrls: boolean;
  putObject(input: PutObjectInput): Promise<void>;
  readObject(ref: StorageObjectRef): Promise<Buffer>;
  headObject(ref: StorageObjectRef): Promise<StorageObjectMeta | null>;
  deleteObject(ref: StorageObjectRef): Promise<void>;
  copyObject(from: StorageObjectRef, to: StorageObjectRef): Promise<void>;
  /** URL firmada de lectura (solo si `supportsSignedUrls`); si no, lanza. */
  getSignedReadUrl(ref: StorageObjectRef, ttlSeconds: number): Promise<string>;
}

export class StorageNotConfiguredError extends Error {
  constructor(message = 'El proveedor de Object Storage no está configurado.') {
    super(message);
    this.name = 'StorageNotConfiguredError';
  }
}

export class StorageObjectNotFoundError extends Error {
  constructor() {
    super('El objeto no existe en el almacenamiento.');
    this.name = 'StorageObjectNotFoundError';
  }
}
