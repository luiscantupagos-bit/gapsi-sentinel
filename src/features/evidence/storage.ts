/**
 * Interfaz de dominio para el almacenamiento de evidencias (TASK-002).
 *
 * En TASK-002 solo se define la INTERFAZ y un adaptador local/simulado para
 * desarrollo. NO se configuran servicios externos, NO se generan URLs firmadas
 * reales y NO se guardan binarios (los binarios nunca van en PostgreSQL; la BD
 * solo guarda metadatos: `storage_backend`, `file_object_key`, `reference_url`).
 */

export const EVIDENCE_STORAGE_BACKENDS = ['local', 'simulated', 'private'] as const;
export type EvidenceStorageBackend = (typeof EVIDENCE_STORAGE_BACKENDS)[number];

/** Metadatos que la aplicación persistirá en `evidences` (no el binario). */
export interface StoredEvidenceRef {
  backend: EvidenceStorageBackend;
  /** Clave/opaco del objeto en el almacenamiento (no una URL pública). */
  objectKey: string;
  /** Referencia opcional (p. ej. ruta local en dev). Nunca datos personales. */
  referenceUrl: string | null;
}

export interface PutEvidenceInput {
  organizationId: string;
  diagnosticId: string;
  answerId: string;
  filename: string;
}

export interface EvidenceStorage {
  readonly backend: EvidenceStorageBackend;
  /**
   * "Almacena" una evidencia y devuelve sus metadatos. La generación de acceso
   * temporal (URLs firmadas) para producción se implementará en una tarea
   * futura junto con el proveedor definitivo (D9).
   */
  put(input: PutEvidenceInput): Promise<StoredEvidenceRef>;
}

/**
 * Adaptador simulado para desarrollo: no realiza E/S real ni almacena binarios;
 * solo deriva una clave determinista a partir de los identificadores.
 */
export function createSimulatedEvidenceStorage(): EvidenceStorage {
  return {
    backend: 'simulated',
    async put({ organizationId, diagnosticId, answerId, filename }) {
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const objectKey = `${organizationId}/${diagnosticId}/${answerId}/${safeName}`;
      return {
        backend: 'simulated',
        objectKey,
        referenceUrl: `simulated://${objectKey}`,
      };
    },
  };
}
