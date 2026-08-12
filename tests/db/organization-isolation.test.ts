/**
 * Aislamiento entre organizaciones: relaciones válidas dentro de una org,
 * rechazo de relaciones cruzadas, rechazo de diagnóstico sobre plantilla
 * maestra, y RLS. Requiere `DATABASE_URL` + migraciones aplicadas.
 */
import { describe, expect, it } from 'vitest';
import {
  createDiagnostic,
  db,
  hasDb,
  inRollbackTx,
  newId,
  seedOrgWithPublishedTemplate,
} from './_helpers';

describe.skipIf(!hasDb)('aislamiento por organización', () => {
  it('permite relaciones válidas dentro de una organización', async () => {
    await inRollbackTx(async (tx) => {
      const fx = await seedOrgWithPublishedTemplate(tx);
      const diagnosticId = await createDiagnostic(tx, fx);

      const answerId = newId();
      await tx.diagnosticAnswer.create({
        data: {
          id: answerId,
          organizationId: fx.orgId,
          diagnosticId,
          questionId: fx.questionYesNoId,
          answerStatus: 'answered',
          selectedOptionId: fx.optionYesId,
          answeredBy: fx.userId,
        },
      });

      const answer = await tx.diagnosticAnswer.findUniqueOrThrow({ where: { id: answerId } });
      expect(answer.organizationId).toBe(fx.orgId);
      expect(answer.questionId).toBe(fx.questionYesNoId);
    });
  });

  it('rechaza un diagnóstico que referencia el sitio de otra organización', async () => {
    await expect(
      db().$transaction(async (tx) => {
        const orgA = await seedOrgWithPublishedTemplate(tx);
        const orgB = await seedOrgWithPublishedTemplate(tx);
        // Diagnóstico de A pero con el sitio de B: la FK compuesta debe rechazarlo.
        await tx.diagnostic.create({
          data: {
            id: newId(),
            organizationId: orgA.orgId,
            siteId: orgB.siteId,
            templateVersionId: orgA.versionId,
            name: 'cruce',
            createdBy: orgA.userId,
          },
        });
      }),
    ).rejects.toThrow();
  });

  it('rechaza un diagnóstico ejecutado sobre una plantilla MAESTRA', async () => {
    await expect(
      db().$transaction(async (tx) => {
        const org = await seedOrgWithPublishedTemplate(tx);
        const masterFw = newId();
        const masterVer = newId();
        await tx.assessmentFramework.create({
          data: { id: masterFw, scope: 'master', organizationId: null, code: 'M', name: 'M' },
        });
        await tx.templateVersion.create({
          data: {
            id: masterVer,
            scope: 'master',
            organizationId: null,
            frameworkId: masterFw,
            versionNumber: 1,
            status: 'published',
            publishedAt: new Date(),
          },
        });
        // Diagnóstico de la org apuntando a la versión maestra (org NULL): rechazado.
        await tx.diagnostic.create({
          data: {
            id: newId(),
            organizationId: org.orgId,
            siteId: org.siteId,
            templateVersionId: masterVer,
            name: 'sobre-maestra',
            createdBy: org.userId,
          },
        });
      }),
    ).rejects.toThrow();
  });

  it('RLS: con contexto de organización solo se ven las filas propias', async () => {
    await inRollbackTx(async (tx) => {
      const a = await seedOrgWithPublishedTemplate(tx);
      const b = await seedOrgWithPublishedTemplate(tx);

      // Aplica RLS incluso al propietario mediante el rol de aplicación.
      await tx.$executeRawUnsafe('SET LOCAL ROLE gapsi_app');

      await tx.$executeRaw`SELECT set_config('app.current_org', ${a.orgId}, true)`;
      const sitesA = await tx.$queryRaw<{ organization_id: string }[]>`
        SELECT organization_id FROM sites`;
      expect(sitesA.every((s) => s.organization_id === a.orgId)).toBe(true);
      expect(sitesA.some((s) => s.organization_id === b.orgId)).toBe(false);

      await tx.$executeRaw`SELECT set_config('app.current_org', ${b.orgId}, true)`;
      const sitesB = await tx.$queryRaw<{ organization_id: string }[]>`
        SELECT organization_id FROM sites`;
      expect(sitesB.every((s) => s.organization_id === b.orgId)).toBe(true);
    });
  });
});
