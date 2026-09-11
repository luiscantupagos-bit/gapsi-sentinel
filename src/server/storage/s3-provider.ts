/**
 * Proveedor S3-compatible (PLATFORM-002 §10) para Cloudflare R2 / AWS S3 / Backblaze.
 *
 * Configurable por entorno; **sin secretos en el repo**. Los SDK
 * (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) se importan de forma
 * PEREZOSA y solo se usan cuando el proveedor está activo (staging/producción), por
 * lo que no son dependencias de los gates locales ni de las pruebas (que usan el
 * proveedor local). Se instalan en el despliegue de PLATFORM-002. La lógica de
 * configuración/clave es pura y sí se prueba.
 */
import type {
  PutObjectInput,
  StorageObjectMeta,
  StorageObjectRef,
  StorageProvider,
} from './provider';
import { StorageNotConfiguredError, StorageObjectNotFoundError } from './provider';

export interface S3Config {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  defaultBucket: string;
}

/** Lee la configuración S3 del entorno. Lanza si falta algo (solo se llama si activo). */
export function readS3Config(env: Record<string, string | undefined> = process.env): S3Config {
  const cfg = {
    endpoint: env.STORAGE_ENDPOINT ?? '',
    region: env.STORAGE_REGION ?? 'auto',
    accessKeyId: env.STORAGE_ACCESS_KEY_ID ?? '',
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY ?? '',
    defaultBucket: env.STORAGE_BUCKET ?? '',
  };
  if (!cfg.endpoint || !cfg.accessKeyId || !cfg.secretAccessKey || !cfg.defaultBucket) {
    throw new StorageNotConfiguredError('Faltan variables STORAGE_* para el proveedor S3/R2.');
  }
  return cfg;
}

// Import perezoso que el bundler NO resuelve (webpackIgnore): el SDK solo se necesita
// en staging/producción y no es dependencia de dev/tests/gates.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyImport(spec: string): Promise<any> {
  return import(/* webpackIgnore: true */ spec);
}

async function loadS3Sdk(): Promise<{ client: unknown; commands: Record<string, unknown> }> {
  try {
    const mod = (await lazyImport('@aws-sdk/client-s3')) as Record<string, unknown>;
    return { client: mod.S3Client, commands: mod };
  } catch {
    throw new StorageNotConfiguredError(
      'Instala @aws-sdk/client-s3 y @aws-sdk/s3-request-presigner para usar el proveedor S3/R2.',
    );
  }
}

export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  readonly supportsSignedUrls = true;
  private cfg: S3Config;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private clientPromise: Promise<any> | null = null;

  constructor(config?: S3Config) {
    this.cfg = config ?? readS3Config();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async client(): Promise<any> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const { client } = await loadS3Sdk();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const S3Client = client as any;
        return new S3Client({
          endpoint: this.cfg.endpoint,
          region: this.cfg.region,
          forcePathStyle: true,
          credentials: {
            accessKeyId: this.cfg.accessKeyId,
            secretAccessKey: this.cfg.secretAccessKey,
          },
        });
      })();
    }
    return this.clientPromise;
  }

  async putObject(input: PutObjectInput): Promise<void> {
    const [{ commands }, c] = await Promise.all([loadS3Sdk(), this.client()]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PutObjectCommand = commands.PutObjectCommand as any;
    await c.send(
      new PutObjectCommand({
        Bucket: input.bucket,
        Key: input.storageKey,
        Body: input.body,
        ContentType: input.mimeType,
      }),
    );
  }

  async readObject(ref: StorageObjectRef): Promise<Buffer> {
    const [{ commands }, c] = await Promise.all([loadS3Sdk(), this.client()]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const GetObjectCommand = commands.GetObjectCommand as any;
    try {
      const res = await c.send(new GetObjectCommand({ Bucket: ref.bucket, Key: ref.storageKey }));
      const bytes = await res.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch {
      throw new StorageObjectNotFoundError();
    }
  }

  async headObject(ref: StorageObjectRef): Promise<StorageObjectMeta | null> {
    const [{ commands }, c] = await Promise.all([loadS3Sdk(), this.client()]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const HeadObjectCommand = commands.HeadObjectCommand as any;
    try {
      const res = await c.send(new HeadObjectCommand({ Bucket: ref.bucket, Key: ref.storageKey }));
      return {
        sizeBytes: Number(res.ContentLength ?? 0),
        mimeType: res.ContentType ?? null,
        updatedAt: res.LastModified ?? null,
      };
    } catch {
      return null;
    }
  }

  async deleteObject(ref: StorageObjectRef): Promise<void> {
    const [{ commands }, c] = await Promise.all([loadS3Sdk(), this.client()]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DeleteObjectCommand = commands.DeleteObjectCommand as any;
    await c.send(new DeleteObjectCommand({ Bucket: ref.bucket, Key: ref.storageKey }));
  }

  async copyObject(from: StorageObjectRef, to: StorageObjectRef): Promise<void> {
    const [{ commands }, c] = await Promise.all([loadS3Sdk(), this.client()]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const CopyObjectCommand = commands.CopyObjectCommand as any;
    await c.send(
      new CopyObjectCommand({
        Bucket: to.bucket,
        Key: to.storageKey,
        CopySource: `${from.bucket}/${from.storageKey}`,
      }),
    );
  }

  async getSignedReadUrl(ref: StorageObjectRef, ttlSeconds: number): Promise<string> {
    const [{ commands }, c] = await Promise.all([loadS3Sdk(), this.client()]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const GetObjectCommand = commands.GetObjectCommand as any;
    const presigner = await lazyImport('@aws-sdk/s3-request-presigner');
    return presigner.getSignedUrl(
      c,
      new GetObjectCommand({ Bucket: ref.bucket, Key: ref.storageKey }),
      {
        expiresIn: ttlSeconds,
      },
    );
  }
}
