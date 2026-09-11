'use client';

/**
 * DOC-OUTPUT-FOLLOWUP — motor de páginas físicas para la salida documental.
 *
 * Toma el HTML del documento renderizado (`.doc-render`: header + secciones + footer,
 * y en copia controlada la marca de agua) y lo reparte en HOJAS físicas tamaño Carta/A4.
 * Cada hoja lleva su propio encabezado, cuerpo, pie con «Página X de Y» y su marca de
 * agua. Las tablas largas (responsabilidades, actividades, control de cambios) se parten
 * por filas repitiendo el encabezado de columnas. Funciona en pantalla (hojas centradas)
 * y en impresión/PDF (cada hoja es una página física vía `break-after: page`).
 *
 * La paginación se calcula en cliente (mide alturas reales). Mientras hidrata se muestra
 * el documento en flujo continuo como fallback accesible.
 */
import { useEffect, useRef, useState } from 'react';

export type PageSize = 'letter' | 'a4';

function cloneFooterWithPageNo(footer: HTMLElement | null): HTMLElement {
  const el = (footer?.cloneNode(true) as HTMLElement) ?? document.createElement('footer');
  if (!footer) el.className = 'doc-render__footer';
  const no = document.createElement('p');
  no.className = 'doc-render__pageno';
  el.appendChild(no);
  return el;
}

/** Reparte los bloques del documento en hojas midiendo alturas reales. */
function paginate(container: HTMLElement, html: string, pageSize: PageSize): void {
  container.innerHTML = '';
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const article = tpl.content.querySelector('.doc-render') as HTMLElement | null;
  if (!article) {
    container.innerHTML = html;
    return;
  }
  const artClass = article.getAttribute('class') ?? 'doc-render';
  const artStyle = article.getAttribute('style') ?? '';
  const header = article.querySelector(':scope > .doc-render__header') as HTMLElement | null;
  const footer = article.querySelector(':scope > .doc-render__footer') as HTMLElement | null;
  const watermark = article.querySelector(':scope > .doc-copy__watermark') as HTMLElement | null;
  const copyInfo = article.querySelector(':scope > .doc-copy__info') as HTMLElement | null;

  // Bloques de contenido en orden de flujo (la info de copia va primero, en la hoja 1).
  const blocks: HTMLElement[] = [];
  if (copyInfo) blocks.push(copyInfo);
  article
    .querySelectorAll(':scope > .doc-render__section')
    .forEach((s) => blocks.push(s as HTMLElement));

  const pages: HTMLElement[] = [];
  let flow: HTMLElement | null = null;
  let avail = 0;

  const newPage = (): void => {
    const page = document.createElement('div');
    page.className = `doc-page doc-page--${pageSize}`;
    if (watermark) page.appendChild(watermark.cloneNode(true));
    const art = document.createElement('article');
    art.setAttribute('class', artClass);
    if (artStyle) art.setAttribute('style', artStyle);
    if (header) art.appendChild(header.cloneNode(true));
    const body = document.createElement('div');
    body.className = 'doc-page__flow';
    art.appendChild(body);
    art.appendChild(cloneFooterWithPageNo(footer));
    page.appendChild(art);
    container.appendChild(page);
    pages.push(page);
    flow = body;
    // Altura disponible del cuerpo = alto de la hoja menos header/footer y paddings.
    avail = body.clientHeight;
  };

  const fits = (): boolean => !!flow && flow.scrollHeight <= avail + 1;

  newPage();

  const tableOf = (block: HTMLElement): HTMLTableElement | null =>
    block.querySelector('table') as HTMLTableElement | null;

  const placeBlock = (block: HTMLElement): void => {
    flow!.appendChild(block);
    if (fits()) return;

    // No cabe. Si es una sección con tabla, se parte por filas.
    const table = tableOf(block);
    const tbody = table?.querySelector('tbody') ?? null;
    if (!table || !tbody || tbody.rows.length <= 1) {
      // Bloque atómico: si la hoja ya tenía contenido, pásalo a una hoja nueva.
      if (flow!.childElementCount > 1) {
        flow!.removeChild(block);
        newPage();
        flow!.appendChild(block);
      }
      return; // si aún no cabe en hoja vacía, se acepta (bloque más alto que una hoja).
    }

    // Parte la tabla: deja las filas que quepan y continúa el resto en hojas nuevas.
    const allRows = Array.from(tbody.rows);
    // Vacía el tbody y agrega filas hasta que deje de caber.
    tbody.textContent = '';
    let i = 0;
    while (i < allRows.length) {
      tbody.appendChild(allRows[i]!);
      if (!fits()) {
        // La última fila no cupo: quítala y abre continuación.
        if (tbody.rows.length > 1) {
          tbody.removeChild(allRows[i]!);
        } else {
          // Ni una fila cabe en la hoja actual (hoja casi llena): nueva hoja.
          tbody.removeChild(allRows[i]!);
          newPage();
          const cont = buildContinuation(block, table);
          flow!.appendChild(cont);
          continueTable(cont, allRows, i);
          return;
        }
        newPage();
        const cont = buildContinuation(block, table);
        flow!.appendChild(cont);
        continueTable(cont, allRows, i);
        return;
      }
      i += 1;
    }
  };

  const buildContinuation = (originalSection: HTMLElement, originalTable: HTMLTableElement) => {
    const section = originalSection.cloneNode(false) as HTMLElement; // sin hijos
    const h2 = originalSection.querySelector(':scope > h2');
    if (h2) {
      const h = h2.cloneNode(true) as HTMLElement;
      h.textContent = `${h2.textContent ?? ''} (continuación)`;
      section.appendChild(h);
    }
    const wrap = document.createElement('div');
    wrap.className = 'doc-render__table-wrap';
    const table = document.createElement('table');
    table.setAttribute('class', originalTable.getAttribute('class') ?? '');
    const thead = originalTable.querySelector('thead');
    if (thead) table.appendChild(thead.cloneNode(true));
    table.appendChild(document.createElement('tbody'));
    wrap.appendChild(table);
    section.appendChild(wrap);
    return section;
  };

  const continueTable = (section: HTMLElement, rows: HTMLTableRowElement[], startIndex: number) => {
    const tbody = section.querySelector('tbody')!;
    const table = section.querySelector('table') as HTMLTableElement;
    for (let j = startIndex; j < rows.length; j += 1) {
      tbody.appendChild(rows[j]!);
      if (!fits() && tbody.rows.length > 1) {
        tbody.removeChild(rows[j]!);
        newPage();
        const cont = buildContinuation(section, table);
        flow!.appendChild(cont);
        continueTable(cont, rows, j);
        return;
      }
    }
  };

  for (const block of blocks) placeBlock(block);

  // Numera las hojas: «Página X de Y».
  const total = pages.length;
  pages.forEach((page, idx) => {
    const no = page.querySelector('.doc-render__pageno');
    if (no) no.textContent = `Página ${idx + 1} de ${total}`;
  });
}

export function PaginatedDocument({
  html,
  pageSize = 'letter',
}: {
  html: string;
  pageSize?: PageSize;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [paginated, setPaginated] = useState(false);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    let cancelled = false;
    // Repagina tras el layout inicial. Se usa setTimeout (no requestAnimationFrame)
    // para funcionar también cuando la vista no está en primer plano o al imprimir.
    const run = () => {
      if (cancelled || !ref.current) return;
      paginate(ref.current, html, pageSize);
      setPaginated(true);
    };
    const t = setTimeout(run, 50);
    // Repagina al cambiar el ancho disponible y antes de imprimir (layout estable).
    let resizeT: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeT) clearTimeout(resizeT);
      resizeT = setTimeout(run, 150);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('beforeprint', run);
    return () => {
      cancelled = true;
      clearTimeout(t);
      if (resizeT) clearTimeout(resizeT);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('beforeprint', run);
    };
  }, [html, pageSize]);

  const pageRule = `@media print{@page{size:${pageSize === 'a4' ? 'A4' : 'letter'};margin:0}}`;

  return (
    <>
      <style>{pageRule}</style>
      {/* Contenedor de hojas: siempre vacío en JSX; se llena imperativamente al paginar
          (React no reconcilia hijos que no declara), evitando que borre las hojas. */}
      <div className="doc-pages" ref={ref} data-paginated={paginated ? 'true' : 'false'} />
      {!paginated && (
        // Fallback en flujo continuo mientras hidrata/pagina (SSR + accesible).
        <div className="doc-render-fallback doc-pages" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </>
  );
}
