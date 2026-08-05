/**
 * CAPA — ciclo de vida completo contra la capa de datos (TASK-007). Requiere DB.
 * Usa organizaciones desechables (persisten; sin borrado físico).
 */
import { afterAll, describe, expect, it } from 'vitest';
import { db, hasDb, newId, seedOrgWithPublishedTemplate } from './_helpers';
import {
  CapaPermissionError,
  CapaValidationError,
  addAction,
  addEffectivenessReview,
  addImmediateAction,
  closeCapa,
  createCapa,
  getCapaDetail,
  reopenCapa,
  saveRootCause,
  transitionCapa,
  updateAction,
  updateCapa,
} from '@/server/capa';

afterAll(async () => {
  if (hasDb) await db().$disconnect();
});

async function addMember(orgId: string, role: string): Promise<string> {
  const id = newId();
  await db().user.create({ data: { id, email: `u-${id}@x.test` } });
  await db().membership.create({ data: { organizationId: orgId, userId: id, role } });
  return id;
}

async function setup() {
  const fx = await seedOrgWithPublishedTemplate(db()); // fx.userId = owner
  const responsible = await addMember(fx.orgId, 'evaluator');
  const other = await addMember(fx.orgId, 'evaluator');
  const viewer = await addMember(fx.orgId, 'viewer');
  return {
    orgId: fx.orgId,
    owner: fx.userId,
    responsible,
    other,
    viewer,
    siteId: fx.siteId,
    requirementId: fx.requirementId,
  };
}

/** Lleva una CAPA recién creada hasta `effectiveness_review` con eficacia. */
async function drive(s: Awaited<ReturnType<typeof setup>>, capaId: string, effective = true) {
  await updateCapa(s.orgId, s.owner, capaId, {
    responsibleUserId: s.responsible,
    targetDate: '2026-12-31',
    problemWhat: 'Temperatura fuera de rango',
    objectiveEvidence: 'Registro de termómetro',
  });
  await transitionCapa(s.orgId, s.owner, capaId, 'reported');
  await transitionCapa(s.orgId, s.owner, capaId, 'containment');
  await addImmediateAction(s.orgId, s.owner, capaId, {
    actionType: 'containment',
    description: 'Aislar producto',
  });
  await transitionCapa(s.orgId, s.owner, capaId, 'under_investigation');
  await saveRootCause(s.orgId, s.owner, capaId, {
    method: 'five_whys',
    rootCause: 'Falta de mantenimiento del equipo',
    conclude: true,
    whys: [
      { level: 1, answer: 'El equipo falló' },
      { level: 2, answer: 'No se le dio mantenimiento' },
    ],
  });
  await transitionCapa(s.orgId, s.owner, capaId, 'action_plan');
  const actionId = await addAction(s.orgId, s.owner, capaId, {
    actionType: 'corrective',
    description: 'Programar mantenimiento preventivo',
    responsibleUserId: s.responsible,
    dueDate: '2026-11-30',
  });
  await transitionCapa(s.orgId, s.owner, capaId, 'in_implementation');
  await updateAction(s.orgId, s.responsible, actionId, { status: 'completed' });
  await transitionCapa(s.orgId, s.owner, capaId, 'effectiveness_review');
  await addEffectivenessReview(s.orgId, s.owner, capaId, {
    criterion: 'Sin recurrencia en 30 días',
    conclusion: effective ? 'effective' : 'not_effective',
    verifierUserId: s.owner,
  });
  return actionId;
}

describe.skipIf(!hasDb)('CAPA — ciclo de vida', () => {
  it('crea con folio automático CAPA-AAAA-0001 y registra historial', async () => {
    const s = await setup();
    const capaId = await createCapa(s.orgId, s.owner, {
      title: 'No conformidad de recepción',
      description: 'Producto recibido fuera de especificación',
      sourceType: 'internal_nc',
      severity: 'high',
    });
    const detail = await getCapaDetail(s.orgId, capaId);
    expect(detail.capa.folio).toMatch(/^CAPA-\d{4}-0001$/);
    expect(detail.capa.status).toBe('draft');
    expect(detail.history.some((h) => h.event === 'created')).toBe(true);
  });

  it('reportar exige responsable y fecha objetivo', async () => {
    const s = await setup();
    const capaId = await createCapa(s.orgId, s.owner, {
      title: 'X',
      description: 'Y',
      sourceType: 'deviation',
    });
    await expect(transitionCapa(s.orgId, s.owner, capaId, 'reported')).rejects.toBeInstanceOf(
      CapaValidationError,
    );
    await updateCapa(s.orgId, s.owner, capaId, {
      responsibleUserId: s.responsible,
      targetDate: '2026-12-31',
    });
    await transitionCapa(s.orgId, s.owner, capaId, 'reported');
    const d = await getCapaDetail(s.orgId, capaId);
    expect(d.capa.status).toBe('reported');
  });

  it('rechaza saltos arbitrarios en la máquina de estados', async () => {
    const s = await setup();
    const capaId = await createCapa(s.orgId, s.owner, {
      title: 'X',
      description: 'Y',
      sourceType: 'deviation',
    });
    // draft → action_plan no está permitido.
    await expect(transitionCapa(s.orgId, s.owner, capaId, 'action_plan')).rejects.toThrow();
  });

  it('avanzar desde contención requiere acción inmediata o justificación', async () => {
    const s = await setup();
    const capaId = await createCapa(s.orgId, s.owner, {
      title: 'X',
      description: 'Y',
      sourceType: 'deviation',
    });
    await updateCapa(s.orgId, s.owner, capaId, {
      responsibleUserId: s.responsible,
      targetDate: '2026-12-31',
    });
    await transitionCapa(s.orgId, s.owner, capaId, 'reported');
    await transitionCapa(s.orgId, s.owner, capaId, 'containment');
    await expect(
      transitionCapa(s.orgId, s.owner, capaId, 'under_investigation'),
    ).rejects.toBeInstanceOf(CapaValidationError);
    // Con justificación sí avanza.
    await transitionCapa(s.orgId, s.owner, capaId, 'under_investigation', {
      justification: 'No aplica contención inmediata',
    });
    const d = await getCapaDetail(s.orgId, capaId);
    expect(d.capa.status).toBe('under_investigation');
  });

  it('plan de acciones requiere problema, evidencia y causa raíz', async () => {
    const s = await setup();
    const capaId = await createCapa(s.orgId, s.owner, {
      title: 'X',
      description: 'Y',
      sourceType: 'deviation',
    });
    await updateCapa(s.orgId, s.owner, capaId, {
      responsibleUserId: s.responsible,
      targetDate: '2026-12-31',
    });
    await transitionCapa(s.orgId, s.owner, capaId, 'reported');
    await transitionCapa(s.orgId, s.owner, capaId, 'containment');
    await addImmediateAction(s.orgId, s.owner, capaId, {
      actionType: 'correction',
      description: 'Reproceso',
    });
    await transitionCapa(s.orgId, s.owner, capaId, 'under_investigation');
    await expect(transitionCapa(s.orgId, s.owner, capaId, 'action_plan')).rejects.toBeInstanceOf(
      CapaValidationError,
    );
  });

  it('completa el ciclo y cierra con eficacia (checksum + solo lectura)', async () => {
    const s = await setup();
    const capaId = await createCapa(s.orgId, s.owner, {
      title: 'NC crítica',
      description: 'Desviación de temperatura',
      sourceType: 'safety_incident',
      severity: 'critical',
    });
    await drive(s, capaId, true);
    await closeCapa(s.orgId, s.owner, capaId, { summary: 'Causa eliminada, sin recurrencia.' });
    const d = await getCapaDetail(s.orgId, capaId);
    expect(d.capa.status).toBe('closed');
    expect(d.capa.closureChecksum).toBeTruthy();
    expect(d.capa.closedBy).toBe(s.owner);
    // Solo lectura: no se puede editar ni añadir acciones.
    await expect(updateCapa(s.orgId, s.owner, capaId, { title: 'otro' })).rejects.toBeInstanceOf(
      CapaValidationError,
    );
    await expect(
      addAction(s.orgId, s.owner, capaId, { actionType: 'other', description: 'z' }),
    ).rejects.toBeInstanceOf(CapaValidationError);
  });

  it('eficacia "no eficaz" bloquea el cierre', async () => {
    const s = await setup();
    const capaId = await createCapa(s.orgId, s.owner, {
      title: 'NC',
      description: 'D',
      sourceType: 'internal_nc',
    });
    await drive(s, capaId, false); // registra "no eficaz"
    await expect(
      closeCapa(s.orgId, s.owner, capaId, { summary: 'Intento de cierre' }),
    ).rejects.toBeInstanceOf(CapaValidationError);
  });

  it('la verificación no la hace el mismo ejecutor si hay otro usuario', async () => {
    const s = await setup();
    const capaId = await createCapa(s.orgId, s.owner, {
      title: 'NC',
      description: 'D',
      sourceType: 'internal_nc',
    });
    // Prepara hasta effectiveness_review con acción ejecutada por `responsible`.
    await updateCapa(s.orgId, s.owner, capaId, {
      responsibleUserId: s.responsible,
      targetDate: '2026-12-31',
      problemWhat: 'Problema',
      objectiveEvidence: 'Evidencia',
    });
    await transitionCapa(s.orgId, s.owner, capaId, 'reported');
    await transitionCapa(s.orgId, s.owner, capaId, 'containment');
    await addImmediateAction(s.orgId, s.owner, capaId, {
      actionType: 'containment',
      description: 'C',
    });
    await transitionCapa(s.orgId, s.owner, capaId, 'under_investigation');
    await saveRootCause(s.orgId, s.owner, capaId, {
      method: 'free_analysis',
      rootCause: 'Causa',
      conclude: true,
    });
    await transitionCapa(s.orgId, s.owner, capaId, 'action_plan');
    const actionId = await addAction(s.orgId, s.owner, capaId, {
      actionType: 'corrective',
      description: 'A',
      responsibleUserId: s.responsible,
      dueDate: '2026-11-30',
    });
    await transitionCapa(s.orgId, s.owner, capaId, 'in_implementation');
    await updateAction(s.orgId, s.responsible, actionId, { status: 'completed' });
    await transitionCapa(s.orgId, s.owner, capaId, 'effectiveness_review');
    // Verificador = ejecutor de la acción → rechazado (hay otros usuarios).
    await expect(
      addEffectivenessReview(s.orgId, s.owner, capaId, {
        criterion: 'C',
        conclusion: 'effective',
        verifierUserId: s.responsible,
      }),
    ).rejects.toBeInstanceOf(CapaValidationError);
    // Verificador distinto → aceptado.
    await addEffectivenessReview(s.orgId, s.owner, capaId, {
      criterion: 'C',
      conclusion: 'effective',
      verifierUserId: s.other,
    });
    await closeCapa(s.orgId, s.owner, capaId, { summary: 'ok' });
    expect((await getCapaDetail(s.orgId, capaId)).capa.status).toBe('closed');
  });

  it('reapertura solo por owner/admin, conserva el conteo y exige datos', async () => {
    const s = await setup();
    const capaId = await createCapa(s.orgId, s.owner, {
      title: 'NC',
      description: 'D',
      sourceType: 'internal_nc',
    });
    await drive(s, capaId, true);
    await closeCapa(s.orgId, s.owner, capaId, { summary: 'cerrada' });
    // viewer no puede reabrir.
    await expect(
      reopenCapa(s.orgId, s.viewer, capaId, {
        reason: 'x',
        target: 'action_plan',
        responsibleUserId: s.responsible,
        targetDate: '2027-01-31',
      }),
    ).rejects.toBeInstanceOf(CapaPermissionError);
    await reopenCapa(s.orgId, s.owner, capaId, {
      reason: 'Recurrencia detectada',
      target: 'action_plan',
      responsibleUserId: s.other,
      targetDate: '2027-01-31',
    });
    const d = await getCapaDetail(s.orgId, capaId);
    expect(d.capa.status).toBe('action_plan');
    expect(d.capa.reopenCount).toBe(1);
    expect(d.capa.responsibleUserId).toBe(s.other);
    expect(d.history.some((h) => h.event === 'reopened')).toBe(true);
  });

  it('cinco porqués: conclusión obligatoria y pasos persistidos', async () => {
    const s = await setup();
    const capaId = await createCapa(s.orgId, s.owner, {
      title: 'NC',
      description: 'D',
      sourceType: 'internal_nc',
    });
    await expect(
      saveRootCause(s.orgId, s.owner, capaId, { method: 'five_whys', conclude: true }),
    ).rejects.toBeInstanceOf(CapaValidationError);
    await saveRootCause(s.orgId, s.owner, capaId, {
      method: 'five_whys',
      rootCause: 'Causa raíz',
      conclude: true,
      whys: [
        { level: 1, answer: 'A' },
        { level: 2, answer: 'B' },
        { level: 3, answer: 'C' },
      ],
    });
    const d = await getCapaDetail(s.orgId, capaId);
    expect(d.whySteps.length).toBe(3);
    expect(d.rca?.concludedAt).toBeTruthy();
  });

  it('el historial es append-only (no se puede modificar)', async () => {
    const s = await setup();
    const capaId = await createCapa(s.orgId, s.owner, {
      title: 'NC',
      description: 'D',
      sourceType: 'internal_nc',
    });
    const h = await db().capaStatusHistory.findFirstOrThrow({ where: { capaId } });
    await expect(
      db().capaStatusHistory.update({ where: { id: h.id }, data: { detail: 'x' } }),
    ).rejects.toThrow();
  });
});
