/**
 * Utilidades para las pruebas de integración de base de datos.
 *
 * Requieren `DATABASE_URL` y migraciones aplicadas. Cada prueba corre dentro de
 * una transacción que SIEMPRE se revierte (patrón sentinela), de modo que no
 * persiste datos ni choca con los triggers de "no borrado físico".
 */
import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { getPrisma } from '@/server/db';

export const hasDb = Boolean(process.env.DATABASE_URL);

/**
 * Cliente Prisma de las pruebas. CORE-MAINT-001: reutiliza el MISMO singleton que
 * la aplicación (`getPrisma`), de modo que hay UNA sola instancia por worker y las
 * pruebas y las funciones de servidor comparten conexión. No se hace `$disconnect`
 * por archivo (lo cerraba antes de que otras suites terminaran); la conexión se
 * libera al salir el proceso/worker.
 */
export function db(): PrismaClient {
  return getPrisma();
}

export function newId(): string {
  return randomUUID();
}

const ROLLBACK = 'ROLLBACK_SENTINEL';

/** Ejecuta `fn` en una transacción y la revierte al terminar. */
export async function inRollbackTx(
  fn: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<void> {
  try {
    await db().$transaction(async (tx) => {
      await fn(tx);
      throw new Error(ROLLBACK);
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== ROLLBACK) throw error;
  }
}

export interface OrgTemplateFixture {
  orgId: string;
  userId: string;
  siteId: string;
  frameworkId: string;
  versionId: string;
  sectionId: string;
  requirementId: string;
  questionYesNoId: string;
  optionYesId: string;
}

/**
 * Crea una organización con usuario, sitio, marco privado y una versión de
 * plantilla PUBLICADA (con una sección/requisito/pregunta/opción). Devuelve ids.
 */
export async function seedOrgWithPublishedTemplate(
  tx: Prisma.TransactionClient,
): Promise<OrgTemplateFixture> {
  const orgId = newId();
  const userId = newId();
  const siteId = newId();
  const frameworkId = newId();
  const versionId = newId();
  const sectionId = newId();
  const requirementId = newId();
  const questionYesNoId = newId();
  const optionYesId = newId();

  await tx.organization.create({ data: { id: orgId, name: `Org ${orgId.slice(0, 8)}` } });
  await tx.user.create({ data: { id: userId, email: `u-${userId}@example.test` } });
  await tx.membership.create({ data: { organizationId: orgId, userId, role: 'owner' } });
  await tx.site.create({ data: { id: siteId, organizationId: orgId, name: 'Sitio' } });

  await tx.assessmentFramework.create({
    data: { id: frameworkId, scope: 'organization', organizationId: orgId, code: 'FW', name: 'FW' },
  });
  await tx.templateVersion.create({
    data: {
      id: versionId,
      scope: 'organization',
      organizationId: orgId,
      frameworkId,
      versionNumber: 1,
      status: 'draft',
    },
  });
  await tx.templateSection.create({
    data: {
      id: sectionId,
      organizationId: orgId,
      templateVersionId: versionId,
      code: 'S1',
      title: 'S1',
      position: 1,
    },
  });
  await tx.templateRequirement.create({
    data: {
      id: requirementId,
      organizationId: orgId,
      templateVersionId: versionId,
      sectionId,
      code: 'R1',
      title: 'R1',
      isCritical: true,
      position: 1,
    },
  });
  await tx.templateQuestion.create({
    data: {
      id: questionYesNoId,
      organizationId: orgId,
      templateVersionId: versionId,
      requirementId,
      code: 'Q1',
      prompt: '¿Cumple?',
      questionType: 'yes_no',
      weight: 1,
      isCritical: true,
      position: 1,
    },
  });
  await tx.templateAnswerOption.create({
    data: {
      id: optionYesId,
      organizationId: orgId,
      templateVersionId: versionId,
      questionId: questionYesNoId,
      code: 'YES',
      label: 'Sí',
      scoreFraction: 1,
      position: 1,
    },
  });

  // Publicar: congela el contenido.
  await tx.templateVersion.update({
    where: { id: versionId },
    data: { status: 'published', publishedAt: new Date(), contentHash: 'v1' },
  });

  return {
    orgId,
    userId,
    siteId,
    frameworkId,
    versionId,
    sectionId,
    requirementId,
    questionYesNoId,
    optionYesId,
  };
}

export async function createDiagnostic(
  tx: Prisma.TransactionClient,
  fx: OrgTemplateFixture,
): Promise<string> {
  const id = newId();
  await tx.diagnostic.create({
    data: {
      id,
      organizationId: fx.orgId,
      siteId: fx.siteId,
      templateVersionId: fx.versionId,
      name: 'Diagnóstico',
      responsibleUserId: fx.userId,
      createdBy: fx.userId,
    },
  });
  return id;
}
