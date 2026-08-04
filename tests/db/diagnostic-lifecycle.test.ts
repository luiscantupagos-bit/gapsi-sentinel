/**
 * Ciclo de vida del diagnóstico: un solo sitio, historial de estados append-only
 * e invalidación del resultado vigente al reabrir. Requiere `DATABASE_URL` +
 * migraciones aplicadas.
 */
import { afterAll, describe, expect, it } from 'vitest';
import {
  createDiagnostic,
  db,
  hasDb,
  inRollbackTx,
  newId,
  seedOrgWithPublishedTemplate,
  type OrgTemplateFixture,
} from './_helpers';
import type { Prisma } from '@prisma/client';

afterAll(async () => {
  if (hasDb) await db().$disconnect();
});

async function createCurrentResult(
  tx: Prisma.TransactionClient,
  fx: OrgTemplateFixture,
  diagnosticId: string,
): Promise<string> {
  const id = newId();
  await tx.diagnosticResult.create({
    data: {
      id,
      organizationId: fx.orgId,
      diagnosticId,
      numerator: 1,
      denominator: 1,
      percentage: 100,
      riskLevel: 'low',
      engineVersion: 'test-0',
      inputsHash: 'hash-0',
    },
  });
  return id;
}

describe.skipIf(!hasDb)('ciclo de vida del diagnóstico', () => {
  it('un diagnóstico pertenece a un solo sitio', async () => {
    await inRollbackTx(async (tx) => {
      const fx = await seedOrgWithPublishedTemplate(tx);
      const diagnosticId = await createDiagnostic(tx, fx);
      const diag = await tx.diagnostic.findUniqueOrThrow({
        where: { id: diagnosticId },
        include: { site: true },
      });
      expect(diag.siteId).toBe(fx.siteId);
      expect(diag.site.id).toBe(fx.siteId);
    });
  });

  it('registra historial de estados y lo trata como append-only', async () => {
    // Inserción válida del historial.
    await inRollbackTx(async (tx) => {
      const fx = await seedOrgWithPublishedTemplate(tx);
      const diagnosticId = await createDiagnostic(tx, fx);
      await tx.diagnosticStateHistory.create({
        data: {
          organizationId: fx.orgId,
          diagnosticId,
          fromStatus: null,
          toStatus: 'draft',
          changedBy: fx.userId,
        },
      });
      const rows = await tx.diagnosticStateHistory.findMany({ where: { diagnosticId } });
      expect(rows).toHaveLength(1);
    });

    // Intentar actualizar el historial debe fallar (append-only).
    await expect(
      db().$transaction(async (tx) => {
        const fx = await seedOrgWithPublishedTemplate(tx);
        const diagnosticId = await createDiagnostic(tx, fx);
        const row = await tx.diagnosticStateHistory.create({
          data: { organizationId: fx.orgId, diagnosticId, toStatus: 'draft', changedBy: fx.userId },
        });
        await tx.diagnosticStateHistory.update({
          where: { id: row.id },
          data: { note: 'no permitido' },
        });
      }),
    ).rejects.toThrow();
  });

  it('mantiene un solo resultado vigente e invalida el anterior al reabrir', async () => {
    await inRollbackTx(async (tx) => {
      const fx = await seedOrgWithPublishedTemplate(tx);
      const diagnosticId = await createDiagnostic(tx, fx);

      const firstResult = await createCurrentResult(tx, fx, diagnosticId);

      // Reapertura: invalidar el resultado vigente (no se borra).
      await tx.diagnosticResult.update({
        where: { id: firstResult },
        data: {
          invalidatedAt: new Date(),
          invalidatedBy: fx.userId,
          invalidatedReason: 'Reapertura autorizada',
        },
      });

      // Nuevo resultado vigente tras un nuevo envío/revisión.
      await createCurrentResult(tx, fx, diagnosticId);

      const all = await tx.diagnosticResult.findMany({ where: { diagnosticId } });
      const current = all.filter((r) => r.invalidatedAt === null);
      expect(all).toHaveLength(2); // el invalidado se conserva
      expect(current).toHaveLength(1); // único vigente
    });
  });

  it('rechaza dos resultados vigentes para el mismo diagnóstico', async () => {
    await expect(
      db().$transaction(async (tx) => {
        const fx = await seedOrgWithPublishedTemplate(tx);
        const diagnosticId = await createDiagnostic(tx, fx);
        await createCurrentResult(tx, fx, diagnosticId);
        await createCurrentResult(tx, fx, diagnosticId); // viola el único parcial
      }),
    ).rejects.toThrow();
  });
});
