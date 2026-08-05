/**
 * Almacenamiento LOCAL de desarrollo para archivos documentales (TASK-004).
 *
 * - Carpeta NO versionada (`storage/documents/`, configurable por env).
 * - Nombre almacenado seguro (UUID + extensión), independiente del original.
 * - Valida extensión, MIME y tamaño antes de escribir.
 * - Los binarios NO se guardan en PostgreSQL, solo su metadata.
 * - Nunca ejecuta el contenido: solo lee/escribe buffers.
 * - Aislamiento por organización: cada archivo vive bajo `<baseDir>/<org>/`.
 *
 * No configura S3/Supabase/Azure/GCP ni servicios de pago.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extensionOf, validateUpload } from '@/features/documents/catalog';

function baseDir(): string {
  return process.env.DOCUMENTS_STORAGE_DIR ?? path.join(process.cwd(), 'storage', 'documents');
}

export class UnsupportedFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFileError';
  }
}

export interface SavedFile {
  originalName: string;
  storedName: string;
  storageKey: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  checksum: string;
}

/** Guarda un archivo validado bajo la carpeta de la organización. */
export async function saveDocumentFile(input: {
  organizationId: string;
  originalName: string;
  mimeType: string;
  data: Buffer;
}): Promise<SavedFile> {
  const check = validateUpload({
    filename: input.originalName,
    mimeType: input.mimeType,
    size: input.data.byteLength,
  });
  if (!check.ok || !check.extension) {
    throw new UnsupportedFileError(check.error ?? 'Archivo no permitido.');
  }

  const storedName = `${randomUUID()}.${check.extension}`;
  const storageKey = `${input.organizationId}/${storedName}`;
  const dir = path.join(baseDir(), input.organizationId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), input.data);

  return {
    originalName: input.originalName,
    storedName,
    storageKey,
    mimeType: input.mimeType,
    extension: check.extension,
    sizeBytes: input.data.byteLength,
    checksum: createHash('sha256').update(input.data).digest('hex'),
  };
}

/**
 * Lee un archivo por su `storageKey`, verificando que pertenezca a la carpeta de
 * la organización (defensa contra path traversal y cruce entre organizaciones).
 * El llamador DEBE haber resuelto la metadata con scoping por organización.
 */
export async function readDocumentFile(
  organizationId: string,
  storageKey: string,
): Promise<Buffer> {
  const orgRoot = path.resolve(baseDir(), organizationId);
  const resolved = path.resolve(baseDir(), storageKey);
  const rel = path.relative(orgRoot, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Ruta de archivo fuera del alcance de la organización.');
  }
  return readFile(resolved);
}

/** Extensión segura para un nombre (reexport util para el llamador). */
export { extensionOf };
