/**
 * Checksum y tamaño del contenido estructurado (DOC-001). SOLO SERVIDOR.
 *
 * Aísla los builtins de Node (`node:crypto`, `Buffer`) para que
 * `structured-content.ts` permanezca puro y seguro en el cliente (el editor
 * estructurado importa constantes de ese módulo).
 */
import { createHash } from 'node:crypto';
import type { StructuredContent } from './structured-content';

export function structuredByteSize(content: StructuredContent): number {
  return Buffer.byteLength(JSON.stringify(content), 'utf8');
}

/** Checksum determinista del contenido estructurado (para control documental). */
export function structuredChecksum(content: StructuredContent): string {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}
