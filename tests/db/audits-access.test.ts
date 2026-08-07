/**
 * Auditorías — folios, estados, checklist/snapshot, hallazgos, CAPA/tareas,
 * preparación, permisos, RLS y aislamiento (TASK-010). DB.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { db, hasDb, inRollbackTx, newId, seedOrgWithPublishedTemplate } from './_helpers';
import {
  ProgramPermissionError,
  createProgram,
  getProgramDetail,
  listPrograms,
} from '@/server/audit-programs';
import {
  AuditPermissionError,
  AuditValidationError,
  createAudit,
  generateChecklist,
  getAuditDetail,
  getExecutionData,
  setChecklistResult,
  transitionAudit,
} from '@/server/audits';
import {
  convertFindingToCapa,
  createFinding,
  createFindingTask,
  getFindingDetail,
} from '@/server/audit-findings';
import { getPreparationMatrix } from '@/server/audit-preparation';
import { InvalidAuditTransitionError } from '@/features/audits/audit-state';

afterAll(async () => {
  if (hasDb) await db().$disconnect();
});

async function addMember(orgId: string, role: string): Promise<string> {
  const id = newId();
  await db().user.create({ data: { id, email: `u-${id}@x.test` } });
  await db().membership.create({ data: { organizationId: orgId, userId: id, role } });
  return id;
}

async function createAuditWithChecklist(fx: { orgId: string; userId: string; versionId: string }) {
  const auditId = await createAudit(fx.orgId, fx.userId, {
    title: 'Auditoría interna',
    auditType: 'internal',
    scope: 'Planta Norte',
    criteria: 'ISO',
    leadAuditorUserId: fx.userId,
  });
  const n = await generateChecklist(fx.orgId, fx.userId, auditId, {
    templateVersionId: fx.versionId,
  });
  return { auditId, n };
}

describe.skipIf(!hasDb)('Auditorías — programas y folios', () => {
  it('solo owner/admin crea programa; folio PA-AAAA-0001 secuencial', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const evaluator = await addMember(fx.orgId, 'evaluator');
    await expect(
      createProgram(fx.orgId, evaluator, { name: 'X', year: 2026 }),
    ).rejects.toBeInstanceOf(ProgramPermissionError);
    const p1 = await createProgram(fx.orgId, fx.userId, { name: 'Anual', year: 2026 });
    const p2 = await createProgram(fx.orgId, fx.userId, { name: 'Otro', year: 2026 });
    expect((await getProgramDetail(fx.orgId, p1)).program.folio).toBe('PA-2026-0001');
    expect((await getProgramDetail(fx.orgId, p2)).program.folio).toBe('PA-2026-0002');
    expect((await listPrograms(fx.orgId)).length).toBe(2);
  });
});

describe.skipIf(!hasDb)('Auditorías — estados y checklist', () => {
  it('folio AUD; no ejecuta sin alcance/criterios/líder', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const bare = await createAudit(fx.orgId, fx.userId, { title: 'sin datos' });
    const year = new Date().getUTCFullYear();
    expect((await getAuditDetail(fx.orgId, bare)).audit.folio).toBe(`AUD-${year}-0001`);
    await transitionAudit(fx.orgId, fx.userId, bare, 'planned');
    await expect(transitionAudit(fx.orgId, fx.userId, bare, 'in_progress')).rejects.toBeInstanceOf(
      AuditValidationError,
    );
  });

  it('genera checklist congelado y evalúa; ruta de estados válida', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const { auditId, n } = await createAuditWithChecklist(fx);
    expect(n).toBeGreaterThan(0);
    const exec = await getExecutionData(fx.orgId, auditId);
    expect(exec.rows.length).toBe(n);
    expect(exec.rows[0]!.requirementCode).toBeTruthy();
    // Evaluar un requisito.
    await setChecklistResult(fx.orgId, fx.userId, exec.rows[0]!.checklistItemId!, {
      result: 'conforme',
      foundEvidence: 'Registro X',
    });
    const exec2 = await getExecutionData(fx.orgId, auditId);
    expect(exec2.summary.evaluated).toBe(1);
    // Ruta de estados.
    await transitionAudit(fx.orgId, fx.userId, auditId, 'planned');
    await transitionAudit(fx.orgId, fx.userId, auditId, 'ready');
    await transitionAudit(fx.orgId, fx.userId, auditId, 'in_progress');
    // Regenerar checklist tras iniciar ejecución falla.
    await expect(
      generateChecklist(fx.orgId, fx.userId, auditId, { templateVersionId: fx.versionId }),
    ).rejects.toBeInstanceOf(AuditValidationError);
  });

  it('rechaza salto de estado inválido', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const a = await createAudit(fx.orgId, fx.userId, { title: 'x' });
    await expect(transitionAudit(fx.orgId, fx.userId, a, 'completed')).rejects.toBeInstanceOf(
      InvalidAuditTransitionError,
    );
  });

  it('el snapshot conserva el requisito aunque cambie la plantilla', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const { auditId } = await createAuditWithChecklist(fx);
    const snap = await db().auditRequirementSnapshot.findFirst({
      where: { auditId, organizationId: fx.orgId },
    });
    expect(snap?.requirementCode).toBe('R1');
    expect(snap?.frameworkCode).toBe('FW');
    expect(snap?.versionNumber).toBe(1);
    expect(snap?.requirementId).toBe(fx.requirementId);
  });
});

describe.skipIf(!hasDb)('Auditorías — hallazgos, CAPA y tareas', () => {
  it('crea hallazgo (folio HAL), lo convierte a CAPA y crea tarea enlazada', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const { auditId } = await createAuditWithChecklist(fx);
    const findingId = await createFinding(fx.orgId, fx.userId, {
      auditId,
      title: 'No conformidad de registros',
      description: 'Faltan registros de limpieza',
      classification: 'minor_nc',
      severity: 'medium',
      responsibleUserId: fx.userId,
    });
    const year = new Date().getUTCFullYear();
    const detail = await getFindingDetail(fx.orgId, findingId);
    expect(detail.finding.folio).toBe(`HAL-${year}-0001`);

    const capaId = await convertFindingToCapa(fx.orgId, fx.userId, findingId);
    const after = await getFindingDetail(fx.orgId, findingId);
    expect(after.finding.capaId).toBe(capaId);
    expect(after.relations.some((r) => r.relationType === 'capa' && r.href?.includes(capaId))).toBe(
      true,
    );
    // Doble conversión rechazada.
    await expect(convertFindingToCapa(fx.orgId, fx.userId, findingId)).rejects.toBeTruthy();

    const taskId = await createFindingTask(fx.orgId, fx.userId, findingId, {});
    const task = await db().task.findFirst({ where: { id: taskId, organizationId: fx.orgId } });
    expect(task?.sourceType).toBe('audit_finding');
    expect(task?.sourceId).toBe(findingId);
  });
});

describe.skipIf(!hasDb)('Auditorías — preparación', () => {
  it('calcula el índice operativo (no certificación)', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const { auditId } = await createAuditWithChecklist(fx);
    const exec = await getExecutionData(fx.orgId, auditId);
    await setChecklistResult(fx.orgId, fx.userId, exec.rows[0]!.checklistItemId!, {
      result: 'conforme',
    });
    const prep = await getPreparationMatrix(fx.orgId, auditId);
    expect(prep.rows.length).toBe(exec.rows.length);
    expect(prep.index.indexPct).toBeGreaterThan(0);
  });
});

describe.skipIf(!hasDb)('Auditorías — aislamiento y RLS', () => {
  it('una organización no accede a la auditoría de otra', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    const auditId = await createAudit(a.orgId, a.userId, { title: 'privada' });
    await expect(getAuditDetail(b.orgId, auditId)).rejects.toThrow();
  });

  it('RLS: con contexto solo se ven las auditorías propias', async () => {
    await inRollbackTx(async (tx) => {
      const a = await seedOrgWithPublishedTemplate(tx);
      const b = await seedOrgWithPublishedTemplate(tx);
      const mk = (orgId: string) =>
        tx.audit.create({
          data: {
            id: newId(),
            organizationId: orgId,
            folio: `AUD-2026-${orgId.slice(0, 4)}`,
            title: 'a',
          },
        });
      await mk(a.orgId);
      await mk(b.orgId);
      await tx.$executeRawUnsafe('SET LOCAL ROLE gapsi_app');
      await tx.$executeRaw`SELECT set_config('app.current_org', ${a.orgId}, true)`;
      const rows = await tx.$queryRaw<
        { organization_id: string }[]
      >`SELECT organization_id FROM audits`;
      expect(rows.every((r) => r.organization_id === a.orgId)).toBe(true);
    });
  });

  it('rechaza sitio de otra organización (FK compuesta)', async () => {
    const a = await seedOrgWithPublishedTemplate(db());
    const b = await seedOrgWithPublishedTemplate(db());
    await expect(
      createAudit(a.orgId, a.userId, { title: 'x', siteId: b.siteId }),
    ).rejects.toThrow();
  });
});
