// CORE-ALIGN-003 Fase 5 — Árbol de Fallas (FTA), dominio puro.
//
// Modela la estructura padre/hijo de eventos (superior/intermedio/básico) y la
// compuerta lógica (AND/OR) con la que se combinan los hijos de un evento. No es
// un editor drag-and-drop: el layout se deriva de la estructura. Sin causalidad
// automática: el árbol organiza hipótesis de falla; confirmarlas exige evidencia
// y la decisión del responsable.

export type FtaNodeType = 'top' | 'intermediate' | 'basic';
export type GateType = 'and' | 'or';

export const GATE_LABEL: Record<GateType, string> = { and: 'Y (AND)', or: 'O (OR)' };
export const FTA_NODE_LABEL: Record<FtaNodeType, string> = {
  top: 'Evento superior',
  intermediate: 'Evento intermedio',
  basic: 'Evento básico',
};

export interface FtaNodeInput {
  id: string;
  parentId: string | null;
  nodeType: FtaNodeType;
  gateType: GateType | null;
  label: string;
  description?: string | null;
  notes?: string | null;
  position: number;
}

export interface FtaTreeNode extends FtaNodeInput {
  children: FtaTreeNode[];
  depth: number;
}

export interface FtaTree {
  root: FtaTreeNode | null;
  orphanIds: string[];
}

/** Construye el árbol a partir de los nodos planos (orden por `position`). */
export function buildFtaTree(nodes: FtaNodeInput[]): FtaTree {
  const byId = new Map<string, FtaTreeNode>();
  for (const n of nodes) byId.set(n.id, { ...n, children: [], depth: 0 });

  let root: FtaTreeNode | null = null;
  const orphanIds: string[] = [];
  for (const n of nodes) {
    const node = byId.get(n.id)!;
    if (n.parentId === null) {
      // El primer nodo raíz gana; otros raíz se tratan como huérfanos.
      if (root === null) root = node;
      else orphanIds.push(n.id);
      continue;
    }
    const parent = byId.get(n.parentId);
    if (!parent || parent.id === n.id) {
      orphanIds.push(n.id);
      continue;
    }
    parent.children.push(node);
  }

  // Evita ciclos: si un nodo no es alcanzable desde la raíz, es huérfano.
  const reachable = new Set<string>();
  const assignDepth = (node: FtaTreeNode, depth: number): void => {
    if (reachable.has(node.id)) return; // corta ciclos
    reachable.add(node.id);
    node.depth = depth;
    node.children.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    for (const c of node.children) assignDepth(c, depth + 1);
  };
  if (root) assignDepth(root, 0);
  for (const n of nodes) {
    if (!reachable.has(n.id) && n.id !== root?.id && !orphanIds.includes(n.id)) {
      orphanIds.push(n.id);
    }
  }

  return { root, orphanIds };
}

/** Valida la estructura del árbol. Devuelve la lista de errores (vacía = válido). */
export function validateFtaTree(nodes: FtaNodeInput[]): string[] {
  const errors: string[] = [];
  if (nodes.length === 0) return ['El árbol no tiene nodos.'];

  const tops = nodes.filter((n) => n.nodeType === 'top');
  if (tops.length === 0) errors.push('Falta el evento superior.');
  if (tops.length > 1) errors.push('Solo puede haber un evento superior.');
  const top = tops[0];
  if (top && top.parentId !== null) errors.push('El evento superior no puede tener padre.');

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string, FtaNodeInput[]>();
  for (const n of nodes) {
    if (n.parentId) {
      if (!byId.has(n.parentId))
        errors.push(`"${n.label || n.id}" referencia un padre inexistente.`);
      else childrenOf.set(n.parentId, [...(childrenOf.get(n.parentId) ?? []), n]);
    } else if (n.nodeType !== 'top') {
      errors.push(`"${n.label || n.id}" no tiene padre y no es el evento superior.`);
    }
    if (!n.label?.trim()) errors.push('Hay un nodo sin etiqueta.');
  }

  for (const n of nodes) {
    const kids = childrenOf.get(n.id) ?? [];
    if (n.nodeType === 'basic' && kids.length > 0)
      errors.push(`El evento básico "${n.label}" no puede tener hijos.`);
    if (n.nodeType !== 'basic' && kids.length > 0 && !n.gateType)
      errors.push(`"${n.label}" combina ${kids.length} hijos: falta la compuerta (Y/O).`);
    if (n.gateType && kids.length === 0)
      errors.push(`"${n.label}" tiene compuerta pero no tiene hijos.`);
  }

  // Ciclos: todo nodo debe alcanzar al superior por la cadena de padres.
  if (top) {
    for (const n of nodes) {
      const seen = new Set<string>();
      let cur: FtaNodeInput | undefined = n;
      while (cur && cur.parentId) {
        if (seen.has(cur.id)) {
          errors.push(`Ciclo detectado en "${n.label}".`);
          break;
        }
        seen.add(cur.id);
        cur = byId.get(cur.parentId);
      }
    }
  }

  return [...new Set(errors)];
}

// --- Layout determinista para SVG (árbol ordenado, sin drag-and-drop) --------

export interface LaidOutNode {
  id: string;
  x: number;
  y: number;
  node: FtaTreeNode;
}
export interface FtaLayout {
  nodes: LaidOutNode[];
  edges: { from: string; to: string; gate: GateType | null }[];
  width: number;
  height: number;
}

/**
 * Layout tipo árbol: las hojas se reparten en X por orden; los padres se centran
 * sobre sus hijos; Y por profundidad. Coordenadas en una grilla (columnas/filas).
 */
export function layoutFtaTree(
  tree: FtaTree,
  opts: { colGap?: number; rowGap?: number } = {},
): FtaLayout {
  const colGap = opts.colGap ?? 180;
  const rowGap = opts.rowGap ?? 120;
  const nodes: LaidOutNode[] = [];
  const edges: FtaLayout['edges'] = [];
  let leafCursor = 0;
  let maxDepth = 0;

  const place = (node: FtaTreeNode): number => {
    maxDepth = Math.max(maxDepth, node.depth);
    let x: number;
    if (node.children.length === 0) {
      x = leafCursor * colGap;
      leafCursor += 1;
    } else {
      const xs = node.children.map((c) => {
        const cx = place(c);
        edges.push({ from: node.id, to: c.id, gate: node.gateType });
        return cx;
      });
      x = (Math.min(...xs) + Math.max(...xs)) / 2;
    }
    nodes.push({ id: node.id, x, y: node.depth * rowGap, node });
    return x;
  };

  if (tree.root) place(tree.root);
  const width = Math.max(colGap, leafCursor * colGap);
  const height = (maxDepth + 1) * rowGap;
  return { nodes, edges, width, height };
}

// --- Interpretación prudente -------------------------------------------------

export interface FtaSummary {
  principal: string;
  detail: string;
  nextStep: string;
}

export function interpretFta(nodes: FtaNodeInput[]): FtaSummary {
  const intermediate = nodes.filter((n) => n.nodeType === 'intermediate').length;
  const basic = nodes.filter((n) => n.nodeType === 'basic').length;
  const andGates = nodes.filter((n) => n.gateType === 'and').length;
  const orGates = nodes.filter((n) => n.gateType === 'or').length;
  const top = nodes.find((n) => n.nodeType === 'top');
  return {
    principal: top
      ? `Árbol del evento superior "${top.label}" con ${intermediate} intermedios y ${basic} básicos.`
      : 'Árbol de fallas en construcción.',
    detail: `Compuertas: ${andGates} Y, ${orGates} O. Una compuerta Y requiere todos sus eventos; una O, cualquiera de ellos.`,
    nextStep:
      'El árbol organiza hipótesis de falla; confirmar cada evento básico requiere evidencia. No confirma la causa por sí solo.',
  };
}
