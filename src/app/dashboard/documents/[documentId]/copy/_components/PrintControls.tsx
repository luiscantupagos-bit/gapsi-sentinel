'use client';

/**
 * Controles de la salida controlada (DOC-UX-002 §70/§76). Abre el diálogo de
 * impresión del navegador (para imprimir físicamente o "Guardar como PDF") y
 * ofrece volver. La barra no se imprime (`.no-print`).
 */
import Link from 'next/link';
import { useEffect, useRef } from 'react';

export function PrintControls({ backHref, note }: { backHref: string; note: string }) {
  const printed = useRef(false);
  useEffect(() => {
    // Abre el diálogo una sola vez al cargar. El navegador no informa de forma
    // confiable si se imprimió físicamente; por eso el registro se marca como
    // "generada", no "impresa" (§78).
    if (printed.current) return;
    printed.current = true;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="no-print copy-controls">
      <p className="muted">{note}</p>
      <div className="copy-controls__actions">
        <button type="button" className="button button--primary" onClick={() => window.print()}>
          Abrir diálogo de impresión
        </button>
        <Link className="button button--ghost" href={backHref}>
          Volver al documento
        </Link>
      </div>
    </div>
  );
}
