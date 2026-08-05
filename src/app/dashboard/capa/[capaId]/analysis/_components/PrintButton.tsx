'use client';

/** Botón para imprimir el reporte del análisis (hoja tamaño carta). */
export function PrintButton() {
  return (
    <button type="button" className="button button--ghost no-print" onClick={() => window.print()}>
      Imprimir
    </button>
  );
}
