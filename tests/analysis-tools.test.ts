import { describe, expect, it } from 'vitest';
import {
  buildFtaTree,
  validateFtaTree,
  layoutFtaTree,
  interpretFta,
  type FtaNodeInput,
} from '@/features/analysis/fta';
import {
  orderedSteps,
  validateFiveWhys,
  canConclude,
  interpretFiveWhys,
  type FiveWhysModel,
} from '@/features/analysis/five-whys';

// --- FTA ---------------------------------------------------------------------

// top --(AND)--> [i1 --(OR)--> [b1, b2], b3]
function ftaValid(): FtaNodeInput[] {
  return [
    {
      id: 'top',
      parentId: null,
      nodeType: 'top',
      gateType: 'and',
      label: 'Falla del proceso',
      position: 0,
    },
    {
      id: 'i1',
      parentId: 'top',
      nodeType: 'intermediate',
      gateType: 'or',
      label: 'Máquina',
      position: 0,
    },
    {
      id: 'b3',
      parentId: 'top',
      nodeType: 'basic',
      gateType: null,
      label: 'Operador sin capacitar',
      position: 1,
    },
    {
      id: 'b1',
      parentId: 'i1',
      nodeType: 'basic',
      gateType: null,
      label: 'Sensor descalibrado',
      position: 0,
    },
    {
      id: 'b2',
      parentId: 'i1',
      nodeType: 'basic',
      gateType: null,
      label: 'Desgaste de herramienta',
      position: 1,
    },
  ];
}

describe('FTA · buildFtaTree', () => {
  it('anida por padre y ordena por posición', () => {
    const { root, orphanIds } = buildFtaTree(ftaValid());
    expect(orphanIds).toHaveLength(0);
    expect(root?.id).toBe('top');
    expect(root?.children.map((c) => c.id)).toEqual(['i1', 'b3']); // por position
    expect(root?.children[0]?.children.map((c) => c.id)).toEqual(['b1', 'b2']);
    expect(root?.children[0]?.depth).toBe(1);
  });
  it('detecta huérfanos con padre inexistente', () => {
    const { orphanIds } = buildFtaTree([
      { id: 'top', parentId: null, nodeType: 'top', gateType: null, label: 'T', position: 0 },
      { id: 'x', parentId: 'nope', nodeType: 'basic', gateType: null, label: 'X', position: 0 },
    ]);
    expect(orphanIds).toContain('x');
  });
});

describe('FTA · validateFtaTree', () => {
  it('árbol válido sin errores', () => {
    expect(validateFtaTree(ftaValid())).toHaveLength(0);
  });
  it('nodo con hijos sin compuerta', () => {
    const nodes = ftaValid().map((n) => (n.id === 'i1' ? { ...n, gateType: null } : n));
    expect(validateFtaTree(nodes).some((e) => e.includes('compuerta'))).toBe(true);
  });
  it('evento básico con hijo', () => {
    const nodes = [
      ...ftaValid(),
      {
        id: 'b4',
        parentId: 'b3',
        nodeType: 'basic' as const,
        gateType: null,
        label: 'Y',
        position: 0,
      },
    ];
    expect(validateFtaTree(nodes).some((e) => e.includes('básico'))).toBe(true);
  });
  it('dos eventos superiores', () => {
    const nodes = [
      ...ftaValid(),
      {
        id: 'top2',
        parentId: null,
        nodeType: 'top' as const,
        gateType: null,
        label: 'Otro',
        position: 9,
      },
    ];
    expect(validateFtaTree(nodes).some((e) => e.includes('un evento superior'))).toBe(true);
  });
  it('ciclo', () => {
    const nodes: FtaNodeInput[] = [
      { id: 'top', parentId: null, nodeType: 'top', gateType: 'and', label: 'T', position: 0 },
      {
        id: 'a',
        parentId: 'b',
        nodeType: 'intermediate',
        gateType: 'and',
        label: 'A',
        position: 0,
      },
      {
        id: 'b',
        parentId: 'a',
        nodeType: 'intermediate',
        gateType: 'and',
        label: 'B',
        position: 0,
      },
    ];
    expect(validateFtaTree(nodes).some((e) => e.toLowerCase().includes('ciclo'))).toBe(true);
  });
});

describe('FTA · layout e interpretación', () => {
  it('centra el padre sobre sus hijos', () => {
    const layout = layoutFtaTree(buildFtaTree(ftaValid()));
    const pos = new Map(layout.nodes.map((n) => [n.id, n.x]));
    const b1 = pos.get('b1')!;
    const b2 = pos.get('b2')!;
    expect(pos.get('i1')).toBeCloseTo((b1 + b2) / 2, 5);
    expect(layout.edges).toContainEqual({ from: 'i1', to: 'b1', gate: 'or' });
  });
  it('interpretación prudente cuenta compuertas y no confirma causa', () => {
    const s = interpretFta(ftaValid());
    expect(s.detail).toContain('1 Y');
    expect(s.detail).toContain('1 O');
    expect(s.nextStep.toLowerCase()).toContain('no confirma');
  });
});

// --- 5 Porqués ---------------------------------------------------------------

function whys(over: Partial<FiveWhysModel> = {}): FiveWhysModel {
  return {
    problem: 'La pieza sale con rebaba',
    steps: [
      {
        id: 's2',
        order: 2,
        statement: 'La herramienta está desgastada',
        evidence: 'Registro de mantenimiento',
      },
      { id: 's1', order: 1, statement: 'El corte no es limpio' },
    ],
    proposedRootCause: null,
    rootCauseByUser: false,
    conclusion: null,
    ...over,
  };
}

describe('5 Porqués', () => {
  it('orderedSteps renumera 1..n de forma estable', () => {
    const s = orderedSteps(whys().steps);
    expect(s.map((x) => x.id)).toEqual(['s1', 's2']);
    expect(s.map((x) => x.order)).toEqual([1, 2]);
  });
  it('valida problema y niveles', () => {
    expect(validateFiveWhys(whys({ problem: '' })).some((e) => e.includes('problema'))).toBe(true);
    expect(validateFiveWhys(whys({ steps: [] })).some((e) => e.includes('por qué'))).toBe(true);
    expect(validateFiveWhys(whys())).toHaveLength(0);
  });
  it('cadena variable: no exige exactamente cinco', () => {
    const one = whys({ steps: [{ id: 'a', order: 1, statement: 'porque sí' }] });
    expect(validateFiveWhys(one)).toHaveLength(0);
  });
  it('la causa raíz nunca es automática: canConclude requiere marca del responsable', () => {
    expect(canConclude(whys())).toBe(false);
    expect(
      canConclude(whys({ proposedRootCause: 'Falta plan de reemplazo', rootCauseByUser: true })),
    ).toBe(true);
  });
  it('interpretación prudente: sin causa raíz, aclara que no se deduce', () => {
    expect(interpretFiveWhys(whys()).detail.toLowerCase()).toContain('no la deduce');
    const s = interpretFiveWhys(whys({ proposedRootCause: 'X', rootCauseByUser: true }));
    expect(s.detail).toContain('responsable');
  });
});
