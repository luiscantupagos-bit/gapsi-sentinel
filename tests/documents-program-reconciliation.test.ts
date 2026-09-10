/**
 * DOC-003 — reconciliación entre versiones (motor PURO §2-13). Decide, por cada
 * ocurrencia futura no iniciada de la versión anterior, si CONTINÚA (carry) o se
 * SUSTITUYE (supersede) al publicar una versión nueva. El histórico nunca entra al
 * plan.
 */
import { describe, expect, it } from 'vitest';
import {
  planReconciliation,
  occurrenceMapKey,
  type DesiredOccurrence,
  type PriorInstanceState,
} from '@/features/documents/program-execution';

const A1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const A2 = 'aaaaaaaa-0000-4000-8000-000000000002';

function prior(over: Partial<PriorInstanceState> = {}): PriorInstanceState {
  return {
    instanceId: 'inst-1',
    activityId: A1,
    occurrenceKey: 'monthly:2026-11',
    dueAt: '2026-11-01',
    plannedStart: '2026-11-01',
    responsibleUserId: 'user-1',
    taskId: 'task-1',
    eligible: true,
    ...over,
  };
}

function desired(over: Partial<DesiredOccurrence> = {}): DesiredOccurrence {
  return {
    activityId: A1,
    occurrenceKey: 'monthly:2026-11',
    dueAt: '2026-11-01',
    plannedStart: '2026-11-01',
    responsibleUserId: 'user-1',
    ...over,
  };
}

describe('planReconciliation (§3-6)', () => {
  it('CONTINÚA (carry) una ocurrencia futura equivalente: misma fecha/plan/responsable', () => {
    const plan = planReconciliation([prior()], [desired()]);
    expect(plan.carry).toHaveLength(1);
    expect(plan.supersede).toHaveLength(0);
    expect(plan.carry[0]).toMatchObject({ instanceId: 'inst-1', taskId: 'task-1' });
  });

  it('SUSTITUYE (supersede) cuando la actividad ya no existe en la versión nueva (§4)', () => {
    const plan = planReconciliation([prior()], []); // desired vacío
    expect(plan.carry).toHaveLength(0);
    expect(plan.supersede).toEqual([{ instanceId: 'inst-1', taskId: 'task-1' }]);
  });

  it('SUSTITUYE cuando cambia la fecha dentro del mismo periodo (misma clave, distinto dueAt) (§3)', () => {
    const plan = planReconciliation([prior()], [desired({ dueAt: '2026-11-15' })]);
    expect(plan.carry).toHaveLength(0);
    expect(plan.supersede).toHaveLength(1);
  });

  it('SUSTITUYE cuando cambia el responsable (§3)', () => {
    const plan = planReconciliation([prior()], [desired({ responsibleUserId: 'user-2' })]);
    expect(plan.supersede).toHaveLength(1);
    expect(plan.carry).toHaveLength(0);
  });

  it('NO toca el histórico: instancias no elegibles quedan fuera del plan (§3)', () => {
    const plan = planReconciliation(
      [prior({ eligible: false }), prior({ instanceId: 'inst-2', eligible: false })],
      [desired()],
    );
    expect(plan.carry).toHaveLength(0);
    expect(plan.supersede).toHaveLength(0);
  });

  it('una ocurrencia NUEVA (sin previa) no genera carry ni supersede (la crea la activación §5)', () => {
    const plan = planReconciliation(
      [],
      [desired({ activityId: A2, occurrenceKey: 'single:2026-12-15' })],
    );
    expect(plan.carry).toHaveLength(0);
    expect(plan.supersede).toHaveLength(0);
  });

  it('mezcla: una continúa, otra se sustituye por eliminación', () => {
    const priors = [
      prior({ instanceId: 'keep', activityId: A1, occurrenceKey: 'monthly:2026-11' }),
      prior({
        instanceId: 'gone',
        activityId: A2,
        occurrenceKey: 'monthly:2026-11',
        taskId: 'task-2',
      }),
    ];
    const plan = planReconciliation(priors, [desired({ activityId: A1 })]);
    expect(plan.carry.map((c) => c.instanceId)).toEqual(['keep']);
    expect(plan.supersede.map((s) => s.instanceId)).toEqual(['gone']);
  });

  it('la clave del mapa de continuidad combina actividad y ocurrencia', () => {
    expect(occurrenceMapKey(A1, 'monthly:2026-11')).toBe(`${A1}::monthly:2026-11`);
  });

  it('carry conserva la referencia a la tarea (para adoptarla); sin tarea también es válido', () => {
    const plan = planReconciliation([prior({ taskId: null })], [desired()]);
    expect(plan.carry[0]?.taskId).toBeNull();
  });
});
