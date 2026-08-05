/**
 * Autorización y aislamiento del acceso al diagnóstico (TASK-003), contra la
 * capa de datos con scoping (`src/server/diagnostics.ts`). Requiere `DATABASE_URL`.
 *
 * Usa organizaciones desechables (ids aleatorios) creadas de forma persistente
 * para no contaminar la organización demo del seed. Como el modelo prohíbe el
 * borrado físico, no se limpian; `npm run db:reset:local` recrea la base.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { createDiagnostic, db, hasDb, newId, seedOrgWithPublishedTemplate } from './_helpers';
import {
  DiagnosticNotEditableError,
  DiagnosticNotFoundError,
  InvalidAnswerError,
  getDiagnosticDetail,
  saveAnswers,
} from '@/server/diagnostics';

afterAll(async () => {
  if (hasDb) await db().$disconnect();
});

describe.skipIf(!hasDb)('acceso y aislamiento del diagnóstico', () => {
  it('la organización propietaria puede abrir su diagnóstico', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const diagnosticId = await createDiagnostic(db(), fx);

    const detail = await getDiagnosticDetail(fx.orgId, diagnosticId);
    expect(detail.id).toBe(diagnosticId);
    expect(detail.sections.length).toBeGreaterThan(0);
  });

  it('otra organización NO puede abrir el diagnóstico ajeno', async () => {
    const owner = await seedOrgWithPublishedTemplate(db());
    const other = await seedOrgWithPublishedTemplate(db());
    const diagnosticId = await createDiagnostic(db(), owner);

    await expect(getDiagnosticDetail(other.orgId, diagnosticId)).rejects.toBeInstanceOf(
      DiagnosticNotFoundError,
    );
  });

  it('otra organización NO puede guardar respuestas en el diagnóstico ajeno', async () => {
    const owner = await seedOrgWithPublishedTemplate(db());
    const other = await seedOrgWithPublishedTemplate(db());
    const diagnosticId = await createDiagnostic(db(), owner);

    await expect(
      saveAnswers(other.orgId, other.userId, diagnosticId, [
        {
          questionId: owner.questionYesNoId,
          status: 'answered',
          selectedOptionId: owner.optionYesId,
        },
      ]),
    ).rejects.toBeInstanceOf(DiagnosticNotFoundError);
  });

  it('rechaza asociar una pregunta que no pertenece a la plantilla del diagnóstico', async () => {
    const owner = await seedOrgWithPublishedTemplate(db());
    const foreign = await seedOrgWithPublishedTemplate(db());
    const diagnosticId = await createDiagnostic(db(), owner);

    await expect(
      saveAnswers(owner.orgId, owner.userId, diagnosticId, [
        // pregunta de OTRA plantilla:
        {
          questionId: foreign.questionYesNoId,
          status: 'answered',
          selectedOptionId: foreign.optionYesId,
        },
      ]),
    ).rejects.toBeInstanceOf(InvalidAnswerError);
  });

  it('un diagnóstico enviado no admite edición de respuestas', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const submittedId = newId();
    await db().diagnostic.create({
      data: {
        id: submittedId,
        organizationId: fx.orgId,
        siteId: fx.siteId,
        templateVersionId: fx.versionId,
        name: 'Diagnóstico enviado',
        status: 'submitted',
        createdBy: fx.userId,
        submittedBy: fx.userId,
        submittedAt: new Date(),
      },
    });

    await expect(
      saveAnswers(fx.orgId, fx.userId, submittedId, [
        { questionId: fx.questionYesNoId, status: 'answered', selectedOptionId: fx.optionYesId },
      ]),
    ).rejects.toBeInstanceOf(DiagnosticNotEditableError);
  });
});
