/**
 * Ishikawa (espina de pescado) como cadena SVG pura y determinista. Es la ÚNICA
 * implementación del diagrama: el componente React `IshikawaChart` y el reporte 8D
 * (CAPA-8D §D) la reutilizan, de modo que no existe un segundo Ishikawa. Sin dependencia
 * de React → se puede renderizar en un Server Component sin `react-dom/server`.
 *
 * El SVG lleva viewBox + preserveAspectRatio, por lo que se escala al ancho disponible
 * sin deformarse (§D4). La marca de agua del motor de páginas queda por encima (§D5/§F4).
 */
export interface IshikawaCause {
  id: string;
  description: string;
  status: string;
}
export interface IshikawaCategory {
  id: string;
  name: string;
  causes: IshikawaCause[];
}

const truncate = (t: string, n = 26) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Construye el `<svg>` del Ishikawa (mismo layout que el análisis). */
export function buildIshikawaSvg({
  effect,
  categories,
}: {
  effect: string;
  categories: IshikawaCategory[];
}): string {
  const width = 960;
  const height = 460;
  const spineY = height / 2;
  const headX = width - 150;
  const active = categories.slice(0, 6);

  const branches = active
    .map((cat, i) => {
      const top = i % 2 === 0;
      const slot = Math.floor(i / 2);
      const baseX = 140 + slot * 230;
      const endX = baseX + 120;
      const endY = top ? spineY - 150 : spineY + 150;
      const causes = cat.causes
        .slice(0, 3)
        .map((c, j) => {
          const cy = top ? endY + 4 + j * 16 : endY - 24 - j * 16;
          return `<text x="${endX}" y="${cy}" font-size="9" text-anchor="middle" fill="#33424e"><title>${esc(
            c.description,
          )}</title>• ${esc(truncate(c.description, 22))}</text>`;
        })
        .join('');
      return `<g>
        <line x1="${baseX}" y1="${spineY}" x2="${endX}" y2="${endY}" stroke="#55636e" stroke-width="2" />
        <rect x="${endX - 60}" y="${top ? endY - 22 : endY}" width="120" height="22" rx="6" fill="#e7f0fb" stroke="#bcd6f2" />
        <text x="${endX}" y="${top ? endY - 7 : endY + 15}" font-size="11" text-anchor="middle" fill="#1a4f8a">${esc(
          truncate(cat.name, 18),
        )}</text>
        ${causes}
      </g>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <line x1="20" y1="${spineY}" x2="${headX}" y2="${spineY}" stroke="#33424e" stroke-width="3" />
    <polygon points="${headX},${spineY - 10} ${headX + 18},${spineY} ${headX},${spineY + 10}" fill="#33424e" />
    <rect x="${headX + 20}" y="${spineY - 34}" width="120" height="68" rx="8" fill="#0e7c66" />
    <text x="${headX + 80}" y="${spineY - 6}" fill="#fff" font-size="12" text-anchor="middle">Efecto</text>
    <foreignObject x="${headX + 22}" y="${spineY}" width="116" height="34">
      <div xmlns="http://www.w3.org/1999/xhtml" style="color:#fff;font-size:11px;line-height:1.1;padding:0 4px">${esc(
        truncate(effect, 40),
      )}</div>
    </foreignObject>
    ${branches}
  </svg>`;
}
