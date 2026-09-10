/**
 * Contrato de Object Storage (PLATFORM-001 §7, base de PLATFORM-002).
 *
 * Abstracción SOLO-CONTRATO: define la interfaz que los módulos de negocio usarán
 * para binarios, de forma que NO dependan de AWS/R2/S3/etc. directamente. En
 * PLATFORM-001 no hay implementación concreta ni cableado; `getStorageProvider()`
 * es un placeholder que falla explícitamente hasta PLATFORM-002.
 *
 * Reglas de diseño asociadas (ver docs/platform/STORAGE-ARCHITECTURE.md):
 * - PostgreSQL es la fuente de verdad (§9): `storageKey` es solo detalle técnico.
 * - Nunca URLs públicas permanentes para binarios privados; usar **signed URLs**
 *   temporales, previa autorización server-side (§11).
 * - Nunca confiar en un `storageKey` recibido del cliente (§11).
 */

/** Referencia técnica a un objeto en el almacenamiento (detalle, no identidad). */
export interface StorageObjectRef {
  bucket: string;
  /** Clave/ruta técnica dentro del bucket. NO codifica relaciones de negocio. */
  storageKey: string;
}

/** Metadatos de un objeto (resultado de `head`). */
export interface StorageObjectMeta {
  sizeBytes: number;
  mimeType: string | null;
  /** Hash de integridad si el proveedor lo expone. */
  sha256?: string | null;
  updatedAt?: Date | null;
}

export interface PutObjectInput {
  bucket: string;
  storageKey: string;
  body: Uint8Array | ArrayBuffer;
  mimeType: string;
  /** Metadatos opcionales a persistir junto al objeto (no sustituyen a PostgreSQL). */
  metadata?: Record<string, string>;
}

export interface SignedUrlInput {
  bucket: string;
  storageKey: string;
  /** Operación permitida por la URL firmada. */
  operation: 'get' | 'put';
  /** Vigencia en segundos (corta por diseño). */
  expiresInSeconds: number;
  /** Para `put`: tipo MIME exigido. */
  contentType?: string;
}

export interface CopyObjectInput {
  from: StorageObjectRef;
  to: StorageObjectRef;
}

/**
 * Operaciones mínimas del proveedor de almacenamiento (§7). Implementaciones
 * concretas (R2/S3/Supabase/B2/local) llegan en PLATFORM-002.
 */
export interface StorageProvider {
  readonly name: string;
  put(input: PutObjectInput): Promise<StorageObjectRef>;
  getSignedUrl(input: SignedUrlInput): Promise<string>;
  delete(ref: StorageObjectRef): Promise<void>;
  head(ref: StorageObjectRef): Promise<StorageObjectMeta | null>;
  copy(input: CopyObjectInput): Promise<StorageObjectRef>;
}

/** Se lanza cuando aún no hay un proveedor de almacenamiento configurado. */
export class StorageNotConfiguredError extends Error {
  constructor() {
    super('El proveedor de Object Storage se configura en PLATFORM-002; aún no disponible.');
    this.name = 'StorageNotConfiguredError';
  }
}

/**
 * Punto de obtención del proveedor activo. Placeholder de PLATFORM-001: no cablea
 * ningún proveedor y falla explícitamente. PLATFORM-002 devolverá aquí la
 * implementación seleccionada según variables de entorno.
 */
export function getStorageProvider(): StorageProvider {
  throw new StorageNotConfiguredError();
}
