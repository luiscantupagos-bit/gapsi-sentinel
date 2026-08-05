/**
 * Visualizaciones SVG (renderizadas en servidor) para las herramientas de
 * análisis. Son un apoyo visual: toda la información está también disponible en
 * las tablas accesibles de la página. No dependen solo del color (usan texto).
 */
import type { ParetoResult } from '@/features/capa/analysis-state';

const truncate = (t: string, n = 26) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

interface Cause {
  id: string;
  description: string;
  status: string;
}
interface Category {
  id: string;
  name: string;
  causes: Cause[];
}

/** Diagrama de espina de pescado (Ishikawa). */
export function IshikawaChart({ effect, categories }: { effect: string; categories: Category[] }) {
  const width = 960;
  const height = 460;
  const spineY = height / 2;
  const headX = width - 150;
  const active = categories.slice(0, 6);
  return (
    <div className="analysis-svg" role="img" aria-label={`Diagrama de Ishikawa: ${effect}`}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" preserveAspectRatio="xMidYMid meet">
        <line x1={20} y1={spineY} x2={headX} y2={spineY} stroke="#33424e" strokeWidth={3} />
        <polygon
          points={`${headX},${spineY - 10} ${headX + 18},${spineY} ${headX},${spineY + 10}`}
          fill="#33424e"
        />
        <rect x={headX + 20} y={spineY - 34} width={120} height={68} rx={8} fill="#0e7c66" />
        <text x={headX + 80} y={spineY - 6} fill="#fff" fontSize={12} textAnchor="middle">
          Efecto
        </text>
        <foreignObject x={headX + 22} y={spineY} width={116} height={34}>
          <div style={{ color: '#fff', fontSize: 11, lineHeight: '1.1', padding: '0 4px' }}>
            {truncate(effect, 40)}
          </div>
        </foreignObject>
        {active.map((cat, i) => {
          const top = i % 2 === 0;
          const slot = Math.floor(i / 2);
          const baseX = 140 + slot * 230;
          const endX = baseX + 120;
          const endY = top ? spineY - 150 : spineY + 150;
          return (
            <g key={cat.id}>
              <line x1={baseX} y1={spineY} x2={endX} y2={endY} stroke="#55636e" strokeWidth={2} />
              <rect
                x={endX - 60}
                y={top ? endY - 22 : endY}
                width={120}
                height={22}
                rx={6}
                fill="#e7f0fb"
                stroke="#bcd6f2"
              />
              <text
                x={endX}
                y={top ? endY - 7 : endY + 15}
                fontSize={11}
                textAnchor="middle"
                fill="#1a4f8a"
              >
                {truncate(cat.name, 18)}
              </text>
              {cat.causes.slice(0, 3).map((c, j) => {
                const cy = top ? endY + 4 + j * 16 : endY - 24 - j * 16;
                return (
                  <text key={c.id} x={endX} y={cy} fontSize={9} textAnchor="middle" fill="#33424e">
                    <title>{c.description}</title>• {truncate(c.description, 22)}
                  </text>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Gráfico de Pareto: barras + línea acumulada + corte. */
export function ParetoChart({ result }: { result: ParetoResult }) {
  const width = 900;
  const height = 380;
  const padL = 44;
  const padR = 44;
  const padB = 70;
  const padT = 20;
  const rows = result.rows.slice(0, 12);
  const maxVal = Math.max(1, ...rows.map((r) => r.value));
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const bw = rows.length > 0 ? plotW / rows.length : plotW;
  const x = (i: number) => padL + i * bw;
  const yVal = (v: number) => padT + plotH - (v / maxVal) * plotH;
  const yPct = (p: number) => padT + plotH - (p / 100) * plotH;
  const cutoffY = yPct(result.cutoff);
  const linePts = rows.map((r, i) => `${x(i) + bw / 2},${yPct(r.cumulativePercentage)}`).join(' ');
  return (
    <div className="analysis-svg" role="img" aria-label="Gráfico de Pareto">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" preserveAspectRatio="xMidYMid meet">
        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#b8c2ca" />
        <line x1={padL} y1={padT + plotH} x2={width - padR} y2={padT + plotH} stroke="#b8c2ca" />
        <line
          x1={padL}
          y1={cutoffY}
          x2={width - padR}
          y2={cutoffY}
          stroke="#a5480a"
          strokeDasharray="5 4"
        />
        <text x={width - padR} y={cutoffY - 4} fontSize={10} textAnchor="end" fill="#a5480a">
          {result.cutoff}%
        </text>
        {rows.map((r, i) => (
          <g key={r.id ?? r.category}>
            <rect
              x={x(i) + 6}
              y={yVal(r.value)}
              width={Math.max(4, bw - 12)}
              height={padT + plotH - yVal(r.value)}
              fill={r.vitalFew ? '#0e7c66' : '#bcd6f2'}
              stroke={r.vitalFew ? '#0b5a4a' : '#8fb6e0'}
            >
              <title>
                {r.category}: {r.value} ({r.percentage}%)
              </title>
            </rect>
            <text
              x={x(i) + bw / 2}
              y={yVal(r.value) - 4}
              fontSize={9}
              textAnchor="middle"
              fill="#14202b"
            >
              {r.value}
            </text>
            <text
              x={x(i) + bw / 2}
              y={padT + plotH + 14}
              fontSize={9}
              textAnchor="middle"
              fill="#33424e"
            >
              {truncate(r.category, 10)}
            </text>
          </g>
        ))}
        {rows.length > 0 && (
          <polyline points={linePts} fill="none" stroke="#7a5a00" strokeWidth={2} />
        )}
        {rows.map((r, i) => (
          <circle
            key={`p-${r.id ?? r.category}`}
            cx={x(i) + bw / 2}
            cy={yPct(r.cumulativePercentage)}
            r={3}
            fill="#7a5a00"
          />
        ))}
      </svg>
    </div>
  );
}

interface TreeNode {
  id: string;
  type: string;
  description: string;
  isProposedRootCause: boolean;
}
interface TreeEdge {
  fromNodeId: string;
  toNodeId: string;
  relation: string;
}

/** Árbol de causas por niveles (layout jerárquico simple). */
export function CauseTreeChart({ nodes, edges }: { nodes: TreeNode[]; edges: TreeEdge[] }) {
  if (nodes.length === 0) return null;
  // Nivel = mayor distancia desde una raíz (nodo sin aristas entrantes).
  const incoming = new Map<string, number>();
  nodes.forEach((n) => incoming.set(n.id, 0));
  edges.forEach((e) => incoming.set(e.toNodeId, (incoming.get(e.toNodeId) ?? 0) + 1));
  const level = new Map<string, number>();
  const adj = new Map<string, string[]>();
  edges.forEach((e) => adj.set(e.fromNodeId, [...(adj.get(e.fromNodeId) ?? []), e.toNodeId]));
  const queue = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0).map((n) => n.id);
  queue.forEach((id) => level.set(id, 0));
  const seen = new Set(queue);
  let head = 0;
  while (head < queue.length) {
    const id = queue[head++] as string;
    const lv = level.get(id) ?? 0;
    for (const next of adj.get(id) ?? []) {
      level.set(next, Math.max(level.get(next) ?? 0, lv + 1));
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  nodes.forEach((n) => {
    if (!level.has(n.id)) level.set(n.id, 0);
  });
  const byLevel = new Map<number, TreeNode[]>();
  nodes.forEach((n) => {
    const lv = level.get(n.id) ?? 0;
    byLevel.set(lv, [...(byLevel.get(lv) ?? []), n]);
  });
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  const colW = 210;
  const rowH = 70;
  const width = Math.max(400, levels.length * colW + 40);
  const height = Math.max(120, Math.max(...[...byLevel.values()].map((v) => v.length)) * rowH + 40);
  const pos = new Map<string, { x: number; y: number }>();
  levels.forEach((lv, ci) => {
    (byLevel.get(lv) ?? []).forEach((n, ri) => {
      pos.set(n.id, { x: 20 + ci * colW, y: 20 + ri * rowH });
    });
  });
  return (
    <div className="analysis-svg" role="img" aria-label="Árbol de causas">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" preserveAspectRatio="xMidYMid meet">
        {edges.map((e, i) => {
          const a = pos.get(e.fromNodeId);
          const b = pos.get(e.toNodeId);
          if (!a || !b) return null;
          return (
            <g key={i}>
              <line
                x1={a.x + 180}
                y1={a.y + 22}
                x2={b.x}
                y2={b.y + 22}
                stroke="#8fb6e0"
                strokeWidth={1.5}
              />
              <text
                x={(a.x + 180 + b.x) / 2}
                y={(a.y + b.y) / 2 + 18}
                fontSize={8}
                textAnchor="middle"
                fill="#55636e"
              >
                {e.relation}
              </text>
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = pos.get(n.id);
          if (!p) return null;
          return (
            <g key={n.id}>
              <rect
                x={p.x}
                y={p.y}
                width={180}
                height={44}
                rx={6}
                fill={n.isProposedRootCause ? '#fce8e6' : '#f2f5f7'}
                stroke={n.isProposedRootCause ? '#a11a09' : '#c7d0d6'}
              />
              <text x={p.x + 8} y={p.y + 16} fontSize={9} fill="#55636e">
                {n.type}
              </text>
              <text x={p.x + 8} y={p.y + 32} fontSize={10} fill="#14202b">
                <title>{n.description}</title>
                {truncate(n.description, 24)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
