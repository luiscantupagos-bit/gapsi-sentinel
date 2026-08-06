/**
 * Dependencias entre tareas (TASK-009). Módulo PURO. Modelo inicial:
 * finish-to-start. Una arista [predecesor, sucesor] significa "sucesor depende
 * de predecesor" (el sucesor no arranca hasta que el predecesor esté completado).
 * Evita ciclos y auto-dependencias.
 */

export type Edge = { from: string; to: string };

export class DependencyCycleError extends Error {
  constructor() {
    super('La dependencia crearía un ciclo entre tareas.');
    this.name = 'DependencyCycleError';
  }
}
export class SelfDependencyError extends Error {
  constructor() {
    super('Una tarea no puede depender de sí misma.');
    this.name = 'SelfDependencyError';
  }
}

/**
 * ¿Agregar la arista `from → to` (to depende de from) crearía un ciclo?
 * Hay ciclo si `from` ya es alcanzable partiendo de `to` siguiendo las aristas
 * existentes (es decir, `to` ya es, directa o transitivamente, predecesor de `from`).
 */
export function wouldCreateCycle(existing: Edge[], add: Edge): boolean {
  if (add.from === add.to) return true;
  // Alcanzables desde `add.to` siguiendo from→to.
  const adjacency = new Map<string, string[]>();
  for (const e of existing) {
    const list = adjacency.get(e.from) ?? [];
    list.push(e.to);
    adjacency.set(e.from, list);
  }
  const seen = new Set<string>();
  const stack = [add.to];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === add.from) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    for (const next of adjacency.get(node) ?? []) stack.push(next);
  }
  return false;
}

/** Lanza si la arista es inválida (auto-dependencia o ciclo). */
export function assertDependencyAcyclic(existing: Edge[], add: Edge): void {
  if (add.from === add.to) throw new SelfDependencyError();
  if (wouldCreateCycle(existing, add)) throw new DependencyCycleError();
}
