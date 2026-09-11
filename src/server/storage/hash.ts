/** Hash de integridad de binarios (PLATFORM-002 §17). Solo servidor (`node:crypto`). */
import { createHash } from 'node:crypto';

/** SHA-256 en hex de un buffer. Usado para integridad, dedup lógico y trazabilidad. */
export function sha256Hex(data: Buffer | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}
