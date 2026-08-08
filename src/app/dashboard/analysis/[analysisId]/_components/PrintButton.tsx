'use client';

/** Botón que abre el diálogo de impresión (versión imprimible del análisis). */
export function PrintButton() {
  return (
    <button type="button" className="button button--ghost no-print" onClick={() => window.print()}>
      Imprimir
    </button>
  );
}
