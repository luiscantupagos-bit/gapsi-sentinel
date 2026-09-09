/**
 * Modo de contenido de un documento (DOC-001 — corrección pre-merge).
 *
 * El motor/editor que abre un documento NO se decide por `documentType`: un
 * documento histórico rich_text puede tener un `documentType` que coincide con un
 * tipo estructurado (p. ej. `procedure`). La decisión depende de la VERSIÓN
 * vigente:
 *
 * - `external`  → origen externo (archivo registrado, sin transcripción).
 * - `structured`→ la versión tiene `structured_content` (motor DOC-001).
 * - `rich_text` → interno sin `structured_content` (editor enriquecido TASK-005,
 *   incluye el "Documento libre").
 *
 * `documentType` sigue definiendo QUÉ plantilla estructurada puede usar un
 * documento estructurado, pero no determina por sí solo el editor de un
 * documento existente. Puro y determinista.
 */
export type DocumentContentMode = 'structured' | 'rich_text' | 'external';

export function documentContentMode(input: {
  origin: string;
  hasStructuredContent: boolean;
}): DocumentContentMode {
  if (input.origin === 'external') return 'external';
  return input.hasStructuredContent ? 'structured' : 'rich_text';
}
