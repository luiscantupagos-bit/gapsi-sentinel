/**
 * Detección de comandos de referencia en el editor (DOC-002 §34). PURO.
 *
 * `@`  → autocompletar documentos. Solo dispara tras inicio o separador (evita
 *        correos como `usuario@dominio`).
 * `//` → emitir formato. No dispara dentro de una URL (`https://`).
 *
 * Reciben el texto ANTERIOR al caret (dentro del nodo de texto actual).
 */

/**
 * Query del `@` inmediatamente antes del caret, o `null` si no hay disparador.
 * Cadena vacía = `@` recién escrito (aún sin filtro).
 */
export function detectMentionQuery(before: string): string | null {
  const m = before.match(/(?:^|[\s(<[{])@([\p{L}\p{N}._/-]{0,40})$/u);
  return m ? (m[1] ?? '') : null;
}

/** ¿El texto termina en `//` fuera de una URL (`://`)? */
export function detectFormCommand(before: string): boolean {
  return /(?:^|[^:/])\/\/$/.test(before);
}
