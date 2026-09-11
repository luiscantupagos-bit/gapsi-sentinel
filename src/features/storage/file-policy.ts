/**
 * Política transversal de archivos (PLATFORM-002). PURO y determinista: vocabulario
 * de entidades/relaciones, MIME permitidos, validación de tamaño/firma, generación
 * de `storageKey` server-side, saneo de nombre y cálculo de cuota. Sin BD ni E/S.
 */

// --- Vocabulario controlado (§5/§6) ------------------------------------------

export const ENTITY_TYPES = [
  'organization',
  'document',
  'document_version',
  'record',
  'audit',
  'finding',
  'capa',
  'task',
  'program',
  'project',
  'meeting',
  'user_profile',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const RELATION_TYPES = [
  'attachment',
  'evidence',
  'source',
  'generated_output',
  'logo',
  'photo',
  'signature',
  'certificate',
  'report',
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export function isEntityType(v: unknown): v is EntityType {
  return typeof v === 'string' && (ENTITY_TYPES as readonly string[]).includes(v);
}
export function isRelationType(v: unknown): v is RelationType {
  return typeof v === 'string' && (RELATION_TYPES as readonly string[]).includes(v);
}

// --- MIME permitidos (§14) ---------------------------------------------------

/** MIME → extensión de referencia (para display; el MIME es la autoridad). */
export const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'text/plain': 'txt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

export function isAllowedMime(mime: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOWED_MIME, mime);
}
export function extForMime(mime: string): string {
  return ALLOWED_MIME[mime] ?? 'bin';
}

// --- Firma de archivo / magic bytes (§15) ------------------------------------

/**
 * Verifica la firma binaria contra el MIME declarado. `text/plain` no tiene firma
 * (se acepta). DOCX/XLSX son ZIP (`PK\x03\x04`). Header = primeros bytes del archivo.
 */
export function magicBytesMatch(mime: string, header: Uint8Array): boolean {
  const startsWith = (sig: number[]) => sig.every((b, i) => header[i] === b);
  switch (mime) {
    case 'application/pdf':
      return startsWith([0x25, 0x50, 0x44, 0x46]); // %PDF
    case 'image/jpeg':
      return startsWith([0xff, 0xd8, 0xff]);
    case 'image/png':
      return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/webp':
      return (
        startsWith([0x52, 0x49, 0x46, 0x46]) && // RIFF
        header[8] === 0x57 &&
        header[9] === 0x45 &&
        header[10] === 0x42 &&
        header[11] === 0x50
      ); // WEBP
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return startsWith([0x50, 0x4b, 0x03, 0x04]); // PK.. (ZIP)
    case 'text/plain':
      return true; // sin firma
    default:
      return false;
  }
}

// --- Tamaño (§16) ------------------------------------------------------------

export const DEFAULT_MAX_UPLOAD_MB = 25;

/** Límite de subida en bytes desde `MAX_UPLOAD_MB` (default 25). */
export function resolveMaxUploadBytes(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = Number(env.MAX_UPLOAD_MB);
  const mb = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_UPLOAD_MB;
  return Math.floor(mb) * 1024 * 1024;
}

// --- Saneo de nombre (§13) ---------------------------------------------------

/** Sanea el nombre original para display/metadata (no es autoridad de MIME). */
export function sanitizeFilename(name: string): string {
  let out = '';
  for (const ch of String(name ?? '')) {
    if (ch === '/' || ch === '\\') {
      out += '_'; // sin separadores de ruta (anti-traversal)
      continue;
    }
    if (ch.charCodeAt(0) < 32) continue; // sin caracteres de control
    out += ch;
  }
  out = out
    .replace(/\.{2,}/g, '.') // sin '..'
    .trim()
    .slice(0, 200);
  return out || 'archivo';
}

// --- storageKey server-side (§12) --------------------------------------------

const SAFE_EXT = /^[a-z0-9]{1,8}$/;

/**
 * Genera la clave técnica del objeto: `org/<orgId>/<yyyy>/<mm>/<uuid>.<ext>`.
 * NUNCA usa el nombre original ni acepta rutas del cliente (anti-traversal/colisión).
 */
export function storageKeyFor(
  organizationId: string,
  ext: string,
  uuid: string,
  now: Date = new Date(),
): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safeExt = SAFE_EXT.test(ext) ? ext : 'bin';
  return `org/${organizationId}/${yyyy}/${mm}/${uuid}.${safeExt}`;
}

// --- Validación de metadatos de subida ---------------------------------------

export interface UploadMetaInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  maxBytes?: number;
}

/** Valida MIME permitido y tamaño (no magic bytes; eso requiere el buffer). */
export function validateUploadMeta(input: UploadMetaInput): { ok: boolean; error?: string } {
  if (!input.filename?.trim()) return { ok: false, error: 'Falta el nombre del archivo.' };
  if (!isAllowedMime(input.mimeType)) return { ok: false, error: 'Tipo de archivo no permitido.' };
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes < 0) {
    return { ok: false, error: 'Tamaño de archivo inválido.' };
  }
  const max = input.maxBytes ?? resolveMaxUploadBytes();
  if (input.sizeBytes > max) return { ok: false, error: 'Archivo demasiado grande.' };
  return { ok: true };
}

// --- Cuota de almacenamiento (§33/§34) ---------------------------------------

export interface StorageQuota {
  usedBytes: number;
  /** `null` = sin límite (provisional hasta planes/PLATFORM-007). */
  limitBytes: number | null;
  remainingBytes: number | null;
  /** 0..100 (semántica propia; NO usa el semáforo de cumplimiento, §34). */
  percentage: number | null;
}

export function computeStorageQuota(usedBytes: number, limitBytes: number | null): StorageQuota {
  if (limitBytes == null || limitBytes <= 0) {
    return { usedBytes, limitBytes: null, remainingBytes: null, percentage: null };
  }
  const remaining = Math.max(0, limitBytes - usedBytes);
  const pct = Math.min(100, Math.round((usedBytes / limitBytes) * 1000) / 10);
  return { usedBytes, limitBytes, remainingBytes: remaining, percentage: pct };
}

/** ¿Cabe una subida de `uploadBytes` dentro de la cuota? (§35; sin cuota → permitido). */
export function fitsInQuota(
  usedBytes: number,
  uploadBytes: number,
  limitBytes: number | null,
): boolean {
  if (limitBytes == null || limitBytes <= 0) return true;
  return usedBytes + uploadBytes <= limitBytes;
}
