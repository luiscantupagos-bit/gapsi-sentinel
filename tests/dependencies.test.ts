import { describe, expect, it } from 'vitest';
import {
  assertDependencyAcyclic,
  DependencyCycleError,
  SelfDependencyError,
  wouldCreateCycle,
} from '@/features/tasks/dependencies';

describe('dependencies — anti-ciclo', () => {
  it('detecta auto-dependencia', () => {
    expect(wouldCreateCycle([], { from: 'a', to: 'a' })).toBe(true);
    expect(() => assertDependencyAcyclic([], { from: 'a', to: 'a' })).toThrow(SelfDependencyError);
  });

  it('permite una cadena lineal', () => {
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ];
    // Añadir c→d no cierra ciclo.
    expect(wouldCreateCycle(edges, { from: 'c', to: 'd' })).toBe(false);
  });

  it('detecta ciclo directo e indirecto', () => {
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ];
    // a→b→c ya existe; añadir c→a cerraría el ciclo.
    expect(wouldCreateCycle(edges, { from: 'c', to: 'a' })).toBe(true);
    expect(() => assertDependencyAcyclic(edges, { from: 'c', to: 'a' })).toThrow(
      DependencyCycleError,
    );
    // Ciclo directo b→a (a→b existe).
    expect(wouldCreateCycle(edges, { from: 'b', to: 'a' })).toBe(true);
  });

  it('ramas independientes no generan falsos positivos', () => {
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'x', to: 'y' },
    ];
    expect(wouldCreateCycle(edges, { from: 'b', to: 'y' })).toBe(false);
  });
});
