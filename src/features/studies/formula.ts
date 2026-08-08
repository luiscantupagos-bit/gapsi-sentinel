// CORE-ALIGN-003 — Variables calculadas con AST SEGURO (sin eval).
//
// La fórmula se representa como un árbol de operaciones controladas entre
// columnas numéricas y constantes. NO se interpreta texto arbitrario ni se usa
// eval/Function. La división entre cero devuelve null (con marca de advertencia),
// igual que cualquier operando nulo/no finito. Caso clave: Desviación %.

export type FormulaNode =
  | { kind: 'col'; column: string }
  | { kind: 'const'; value: number }
  | { kind: 'op'; op: '+' | '-' | '*' | '/'; left: FormulaNode; right: FormulaNode };

export interface FormulaEvalResult {
  value: number | null;
  divisionByZero: boolean;
}

/** Evalúa la fórmula para una fila (mapa columna → número|null). */
export function evalFormula(
  node: FormulaNode,
  row: Record<string, number | null>,
): FormulaEvalResult {
  switch (node.kind) {
    case 'col': {
      const v = row[node.column];
      return {
        value: typeof v === 'number' && Number.isFinite(v) ? v : null,
        divisionByZero: false,
      };
    }
    case 'const':
      return { value: Number.isFinite(node.value) ? node.value : null, divisionByZero: false };
    case 'op': {
      const l = evalFormula(node.left, row);
      const r = evalFormula(node.right, row);
      const dz = l.divisionByZero || r.divisionByZero;
      if (l.value === null || r.value === null) return { value: null, divisionByZero: dz };
      switch (node.op) {
        case '+':
          return { value: round(l.value + r.value), divisionByZero: dz };
        case '-':
          return { value: round(l.value - r.value), divisionByZero: dz };
        case '*':
          return { value: round(l.value * r.value), divisionByZero: dz };
        case '/': {
          if (r.value === 0) return { value: null, divisionByZero: true };
          return { value: round(l.value / r.value), divisionByZero: dz };
        }
      }
    }
  }
}

function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

/** Valida que la fórmula solo referencie columnas conocidas y sea finita. */
export function validateFormula(node: FormulaNode, knownColumns: Set<string>): string[] {
  const errors: string[] = [];
  const walk = (n: FormulaNode) => {
    if (n.kind === 'col' && !knownColumns.has(n.column)) {
      errors.push(`La columna "${n.column}" no existe.`);
    } else if (n.kind === 'const' && !Number.isFinite(n.value)) {
      errors.push('Constante no válida.');
    } else if (n.kind === 'op') {
      walk(n.left);
      walk(n.right);
    }
  };
  walk(node);
  return errors;
}

/** Constructor de "Desviación %": ((real - nominal) / nominal) * 100. */
export function deviationPercentFormula(realColumn: string, nominalColumn: string): FormulaNode {
  return {
    kind: 'op',
    op: '*',
    left: {
      kind: 'op',
      op: '/',
      left: {
        kind: 'op',
        op: '-',
        left: { kind: 'col', column: realColumn },
        right: { kind: 'col', column: nominalColumn },
      },
      right: { kind: 'col', column: nominalColumn },
    },
    right: { kind: 'const', value: 100 },
  };
}

/** Constructor de una operación binaria simple entre dos columnas o constante. */
export function binaryFormula(
  op: '+' | '-' | '*' | '/',
  left: { column: string } | { value: number },
  right: { column: string } | { value: number },
): FormulaNode {
  const toNode = (x: { column: string } | { value: number }): FormulaNode =>
    'column' in x ? { kind: 'col', column: x.column } : { kind: 'const', value: x.value };
  return { kind: 'op', op, left: toNode(left), right: toNode(right) };
}
