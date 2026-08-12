/**
 * Inmutabilidad de plantillas publicadas y conservación de la versión congelada
 * usada por un diagnóstico. Requiere `DATABASE_URL` + migraciones aplicadas.
 */
import { describe, expect, it } from 'vitest';
import {
  createDiagnostic,
  db,
  hasDb,
  inRollbackTx,
  seedOrgWithPublishedTemplate,
} from './_helpers';

describe.skipIf(!hasDb)('inmutabilidad de plantillas', () => {
  it('rechaza modificar el contenido de una versión publicada', async () => {
    await expect(
      db().$transaction(async (tx) => {
        const fx = await seedOrgWithPublishedTemplate(tx);
        // La versión ya está publicada: editar la sección debe fallar por trigger.
        await tx.templateSection.update({
          where: { id: fx.sectionId },
          data: { title: 'modificado' },
        });
      }),
    ).rejects.toThrow();
  });

  it('rechaza insertar nuevas preguntas en una versión publicada', async () => {
    await expect(
      db().$transaction(async (tx) => {
        const fx = await seedOrgWithPublishedTemplate(tx);
        await tx.templateQuestion.create({
          data: {
            organizationId: fx.orgId,
            templateVersionId: fx.versionId,
            requirementId: fx.requirementId,
            code: 'Q99',
            prompt: 'nueva',
            questionType: 'text',
            isScored: false,
            position: 99,
          },
        });
      }),
    ).rejects.toThrow();
  });

  it('rechaza alterar el contenido sellado de la cabecera de versión', async () => {
    await expect(
      db().$transaction(async (tx) => {
        const fx = await seedOrgWithPublishedTemplate(tx);
        await tx.templateVersion.update({
          where: { id: fx.versionId },
          data: { contentHash: 'otro' },
        });
      }),
    ).rejects.toThrow();
  });

  it('conserva la versión congelada referenciada por un diagnóstico', async () => {
    await inRollbackTx(async (tx) => {
      const fx = await seedOrgWithPublishedTemplate(tx);
      const diagnosticId = await createDiagnostic(tx, fx);

      const diag = await tx.diagnostic.findUniqueOrThrow({ where: { id: diagnosticId } });
      expect(diag.templateVersionId).toBe(fx.versionId);

      const version = await tx.templateVersion.findUniqueOrThrow({ where: { id: fx.versionId } });
      expect(version.status).toBe('published');
    });
  });
});
