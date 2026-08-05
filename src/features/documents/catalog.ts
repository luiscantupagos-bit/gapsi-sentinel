/**
 * Catálogo documental y validaciones PURAS (TASK-004).
 *
 * Sin BD ni E/S: valores permitidos, validación de metadatos y de archivos.
 * Los valores se imponen además con CHECK en la migración `..._documents`.
 */

export const DOCUMENT_TYPES = [
  { value: 'policy', label: 'Política' },
  { value: 'manual', label: 'Manual' },
  { value: 'procedure', label: 'Procedimiento' },
  { value: 'instruction', label: 'Instructivo' },
  { value: 'program', label: 'Programa' },
  { value: 'plan', label: 'Plan' },
  { value: 'form', label: 'Formato' },
  { value: 'record', label: 'Registro' },
  { value: 'specification', label: 'Especificación' },
  { value: 'matrix', label: 'Matriz' },
  { value: 'external', label: 'Documento externo' },
  { value: 'annex', label: 'Anexo' },
  { value: 'other', label: 'Otro' },
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number]['value'];

export const DOCUMENT_ORIGINS = [
  { value: 'internal', label: 'Interno' },
  { value: 'external', label: 'Externo' },
] as const;
export type DocumentOrigin = (typeof DOCUMENT_ORIGINS)[number]['value'];

export const DOCUMENT_STATUSES = [
  { value: 'draft', label: 'Borrador' },
  { value: 'in_review', label: 'En revisión' },
  { value: 'effective', label: 'Vigente' },
  { value: 'obsolete', label: 'Obsoleto' },
  { value: 'archived', label: 'Archivado' },
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]['value'];

export const CONFIDENTIALITY_LEVELS = [
  { value: 'public', label: 'Público' },
  { value: 'internal', label: 'Interno' },
  { value: 'confidential', label: 'Confidencial' },
] as const;
export type Confidentiality = (typeof CONFIDENTIALITY_LEVELS)[number]['value'];

export function labelOf(list: readonly { value: string; label: string }[], value: string): string {
  return list.find((x) => x.value === value)?.label ?? value;
}

/** Extensiones permitidas → MIME types aceptados. */
export const ALLOWED_UPLOAD: Record<string, string[]> = {
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
};

/** Tamaño máximo de subida (configurable por env; 10 MB por defecto). */
export function maxUploadBytes(): number {
  const raw = Number(process.env.DOCUMENTS_MAX_UPLOAD_BYTES);
  return Number.isFinite(raw) && raw > 0 ? raw : 10 * 1024 * 1024;
}

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

export interface UploadCandidate {
  filename: string;
  mimeType: string;
  size: number;
}

export interface UploadValidation {
  ok: boolean;
  error?: string;
  extension?: string;
}

/** Valida extensión, MIME y tamaño. Rechaza formatos no permitidos. */
export function validateUpload(
  file: UploadCandidate,
  maxBytes = maxUploadBytes(),
): UploadValidation {
  const extension = extensionOf(file.filename);
  const allowedMimes = ALLOWED_UPLOAD[extension];
  if (!allowedMimes) {
    return { ok: false, error: `Extensión no permitida: .${extension || '(sin extensión)'}` };
  }
  if (!allowedMimes.includes(file.mimeType)) {
    return {
      ok: false,
      error: `El tipo de archivo (${file.mimeType}) no coincide con .${extension}`,
    };
  }
  if (file.size <= 0) {
    return { ok: false, error: 'El archivo está vacío.' };
  }
  if (file.size > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(0);
    return { ok: false, error: `El archivo supera el tamaño máximo de ${mb} MB.` };
  }
  return { ok: true, extension };
}

export interface DocumentMetadataInput {
  code: string;
  title: string;
  documentType: string;
  versionLabel: string;
  origin: string;
  status: string;
  confidentiality: string;
  issuedAt?: string | null;
  nextReviewAt?: string | null;
}

const isValid = (list: readonly { value: string }[], v: string) => list.some((x) => x.value === v);

/** Valida los metadatos del documento. Devuelve mensajes de error en español. */
export function validateDocumentMetadata(input: DocumentMetadataInput): string[] {
  const errors: string[] = [];
  if (!input.code?.trim()) errors.push('El código es obligatorio.');
  if (!input.title?.trim()) errors.push('El título es obligatorio.');
  if (!input.documentType || !isValid(DOCUMENT_TYPES, input.documentType)) {
    errors.push('El tipo documental es obligatorio y debe ser válido.');
  }
  if (!input.versionLabel?.trim()) errors.push('La versión inicial es obligatoria.');
  if (!isValid(DOCUMENT_ORIGINS, input.origin)) errors.push('El origen es inválido.');
  if (!isValid(DOCUMENT_STATUSES, input.status)) errors.push('El estado es inválido.');
  if (!isValid(CONFIDENTIALITY_LEVELS, input.confidentiality)) {
    errors.push('El nivel de confidencialidad es inválido.');
  }
  if (input.issuedAt && input.nextReviewAt && input.nextReviewAt < input.issuedAt) {
    errors.push('La fecha de próxima revisión no puede ser anterior a la fecha de emisión.');
  }
  return errors;
}

/** ¿Está próximo a revisión dentro de `days`? (fechas ISO YYYY-MM-DD, `today` inyectable). */
export function isDueSoon(nextReviewAt: string | null, today: string, days = 30): boolean {
  if (!nextReviewAt) return false;
  const next = new Date(nextReviewAt + 'T00:00:00Z').getTime();
  const now = new Date(today + 'T00:00:00Z').getTime();
  const limit = now + days * 24 * 60 * 60 * 1000;
  return next >= now && next <= limit;
}

export function isOverdue(nextReviewAt: string | null, today: string): boolean {
  if (!nextReviewAt) return false;
  return new Date(nextReviewAt + 'T00:00:00Z').getTime() < new Date(today + 'T00:00:00Z').getTime();
}
