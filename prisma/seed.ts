/**
 * Datos semilla mínimos de DESARROLLO para GAPSI Sentinel (TASK-002).
 *
 * Contenido: 2 organizaciones, 2 usuarios, membresías, 1 sitio por organización,
 * 1 marco maestro (GAPSI) publicado, 1 copia privada de plantilla publicada con
 * secciones/requisitos/preguntas/opciones, y 1 diagnóstico de ejemplo con
 * respuestas e historial de estado.
 *
 * Idempotente: si la organización demo ya existe, no vuelve a insertar (los
 * triggers de inmutabilidad bloquearían re-sembrar contenido publicado). Para
 * una recarga limpia usa `npm run db:reset:local`.
 *
 * No usa datos personales reales.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// UUID fijos para reproducibilidad.
const ORG_A = '00000000-0000-4000-8000-0000000000a0';
const ORG_B = '00000000-0000-4000-8000-0000000000b0';
const USER_A = '00000000-0000-4000-8000-0000000000a1';
const USER_B = '00000000-0000-4000-8000-0000000000b1';
const SITE_A = '00000000-0000-4000-8000-0000000000a2';
const SITE_B = '00000000-0000-4000-8000-0000000000b2';

// Catálogo maestro (GAPSI). Sufijo hex `fa` (antes `ma`: `m` no es hexadecimal).
const MASTER_FW = '00000000-0000-4000-8000-00000000fa00';
const MASTER_VER = '00000000-0000-4000-8000-00000000fa01';

// Copia privada de la organización A. Sufijo hex `ea` (antes `pa`: `p` no es hexadecimal).
const PRIV_FW_A = '00000000-0000-4000-8000-0000000ea000';
const PRIV_VER_A = '00000000-0000-4000-8000-0000000ea001';

const DIAG_A = '00000000-0000-4000-8000-0000000da001';

interface ContentIds {
  section: string;
  requirement: string;
  qYesNo: string;
  qChoice: string;
  qText: string;
  optYes: string;
  optNo: string;
  optAdequate: string;
  optPartial: string;
  optNone: string;
}

const MASTER_IDS: ContentIds = {
  section: '00000000-0000-4000-8000-00000000fa10',
  requirement: '00000000-0000-4000-8000-00000000fa20',
  qYesNo: '00000000-0000-4000-8000-00000000fa31',
  qChoice: '00000000-0000-4000-8000-00000000fa32',
  qText: '00000000-0000-4000-8000-00000000fa33',
  optYes: '00000000-0000-4000-8000-00000000fa41',
  optNo: '00000000-0000-4000-8000-00000000fa42',
  optAdequate: '00000000-0000-4000-8000-00000000fa43',
  optPartial: '00000000-0000-4000-8000-00000000fa44',
  optNone: '00000000-0000-4000-8000-00000000fa45',
};

const PRIV_IDS: ContentIds = {
  section: '00000000-0000-4000-8000-0000000ea010',
  requirement: '00000000-0000-4000-8000-0000000ea020',
  qYesNo: '00000000-0000-4000-8000-0000000ea031',
  qChoice: '00000000-0000-4000-8000-0000000ea032',
  qText: '00000000-0000-4000-8000-0000000ea033',
  optYes: '00000000-0000-4000-8000-0000000ea041',
  optNo: '00000000-0000-4000-8000-0000000ea042',
  optAdequate: '00000000-0000-4000-8000-0000000ea043',
  optPartial: '00000000-0000-4000-8000-0000000ea044',
  optNone: '00000000-0000-4000-8000-0000000ea045',
};

/** Inserta el contenido (sección/requisito/preguntas/opciones) de una versión en `draft`. */
async function seedVersionContent(
  versionId: string,
  organizationId: string | null,
  ids: ContentIds,
): Promise<void> {
  await prisma.templateSection.create({
    data: {
      id: ids.section,
      organizationId,
      templateVersionId: versionId,
      code: 'S1',
      title: 'Control de peligros',
      position: 1,
    },
  });

  await prisma.templateRequirement.create({
    data: {
      id: ids.requirement,
      organizationId,
      templateVersionId: versionId,
      sectionId: ids.section,
      code: 'R1',
      title: 'PCC monitoreado',
      isCritical: true,
      position: 1,
    },
  });

  await prisma.templateQuestion.createMany({
    data: [
      {
        id: ids.qYesNo,
        organizationId,
        templateVersionId: versionId,
        requirementId: ids.requirement,
        code: 'Q1',
        prompt: '¿Existe monitoreo de cada PCC?',
        questionType: 'yes_no',
        weight: 1,
        isCritical: true,
        allowsNotApplicable: false,
        isScored: true,
        position: 1,
      },
      {
        id: ids.qChoice,
        organizationId,
        templateVersionId: versionId,
        requirementId: ids.requirement,
        code: 'Q2',
        prompt: '¿Frecuencia de verificación?',
        questionType: 'single_choice',
        weight: 2,
        isCritical: false,
        allowsNotApplicable: false,
        isScored: true,
        position: 2,
      },
      {
        id: ids.qText,
        organizationId,
        templateVersionId: versionId,
        requirementId: ids.requirement,
        code: 'Q3',
        prompt: 'Describa el método de monitoreo (observación).',
        questionType: 'text',
        weight: 1,
        isCritical: false,
        allowsNotApplicable: false,
        isScored: false, // texto: no puntúa por defecto
        position: 3,
      },
    ],
  });

  await prisma.templateAnswerOption.createMany({
    data: [
      {
        id: ids.optYes,
        organizationId,
        templateVersionId: versionId,
        questionId: ids.qYesNo,
        code: 'YES',
        label: 'Sí',
        scoreFraction: 1,
        position: 1,
      },
      {
        id: ids.optNo,
        organizationId,
        templateVersionId: versionId,
        questionId: ids.qYesNo,
        code: 'NO',
        label: 'No',
        scoreFraction: 0,
        position: 2,
      },
      {
        id: ids.optAdequate,
        organizationId,
        templateVersionId: versionId,
        questionId: ids.qChoice,
        code: 'ADEQUATE',
        label: 'Adecuada',
        scoreFraction: 1,
        position: 1,
      },
      {
        id: ids.optPartial,
        organizationId,
        templateVersionId: versionId,
        questionId: ids.qChoice,
        code: 'PARTIAL',
        label: 'Parcial',
        scoreFraction: 0.5,
        position: 2,
      },
      {
        id: ids.optNone,
        organizationId,
        templateVersionId: versionId,
        questionId: ids.qChoice,
        code: 'NONE',
        label: 'Inexistente',
        scoreFraction: 0,
        position: 3,
      },
    ],
  });
}

/** Crea el marco + versión + contenido de una plantilla y la publica, si el marco no existe aún. */
async function ensureTemplate(
  frameworkId: string,
  versionId: string,
  organizationId: string | null,
  ids: ContentIds,
  data: {
    scope: 'master' | 'organization';
    frameworkName: string;
    frameworkDescription: string;
    sourceMasterVersionId: string | null;
    contentHash: string;
    createdBy: string | null;
  },
): Promise<boolean> {
  const exists = await prisma.assessmentFramework.findUnique({ where: { id: frameworkId } });
  if (exists) return false;

  await prisma.assessmentFramework.create({
    data: {
      id: frameworkId,
      scope: data.scope,
      organizationId,
      code: 'HACCP-INTERNAL',
      name: data.frameworkName,
      description: data.frameworkDescription,
      createdBy: data.createdBy,
    },
  });
  await prisma.templateVersion.create({
    data: {
      id: versionId,
      scope: data.scope,
      organizationId,
      frameworkId,
      sourceMasterVersionId: data.sourceMasterVersionId,
      versionNumber: 1,
      status: 'draft',
      createdBy: data.createdBy,
    },
  });
  await seedVersionContent(versionId, organizationId, ids);
  await prisma.templateVersion.update({
    where: { id: versionId },
    data: { status: 'published', publishedAt: new Date(), contentHash: data.contentHash },
  });
  return true;
}

async function main(): Promise<void> {
  // Idempotente y con recuperación: se puede ejecutar sobre una base con datos
  // parciales (p. ej. un seed que falló a mitad) sin borrar nada. Cada bloque
  // solo inserta lo que falta.

  // Organizaciones, usuarios, membresías y sitios: `skipDuplicates` los hace
  // idempotentes (respetan sus restricciones únicas).
  await prisma.organization.createMany({
    skipDuplicates: true,
    data: [
      { id: ORG_A, name: 'Alimentos Demo A', slug: 'demo-a' },
      { id: ORG_B, name: 'Alimentos Demo B', slug: 'demo-b' },
    ],
  });

  await prisma.user.createMany({
    skipDuplicates: true,
    data: [
      { id: USER_A, email: 'evaluador.a@example.test', displayName: 'Evaluador A' },
      { id: USER_B, email: 'evaluador.b@example.test', displayName: 'Evaluador B' },
    ],
  });

  await prisma.membership.createMany({
    skipDuplicates: true,
    data: [
      { organizationId: ORG_A, userId: USER_A, role: 'owner' },
      { organizationId: ORG_B, userId: USER_B, role: 'owner' },
    ],
  });

  await prisma.site.createMany({
    skipDuplicates: true,
    data: [
      { id: SITE_A, organizationId: ORG_A, code: 'PN', name: 'Planta Norte' },
      { id: SITE_B, organizationId: ORG_B, code: 'PS', name: 'Planta Sur' },
    ],
  });

  // Marco maestro (GAPSI) + copia privada de la organización A.
  await ensureTemplate(MASTER_FW, MASTER_VER, null, MASTER_IDS, {
    scope: 'master',
    frameworkName: 'Diagnóstico interno HACCP (maestro)',
    frameworkDescription: 'Marco maestro administrado por GAPSI.',
    sourceMasterVersionId: null,
    contentHash: 'seed-master-v1',
    createdBy: null,
  });
  await ensureTemplate(PRIV_FW_A, PRIV_VER_A, ORG_A, PRIV_IDS, {
    scope: 'organization',
    frameworkName: 'Diagnóstico interno HACCP (copia A)',
    frameworkDescription: 'Copia privada de la organización A a partir del maestro.',
    sourceMasterVersionId: MASTER_VER,
    contentHash: 'seed-priv-a-v1',
    createdBy: USER_A,
  });

  // Diagnóstico de ejemplo (solo si aún no existe).
  const diagnosticExists = await prisma.diagnostic.findUnique({ where: { id: DIAG_A } });
  if (!diagnosticExists) {
    await prisma.diagnostic.create({
      data: {
        id: DIAG_A,
        organizationId: ORG_A,
        siteId: SITE_A,
        templateVersionId: PRIV_VER_A,
        name: 'Diagnóstico inicial Planta Norte',
        responsibleUserId: USER_A,
        status: 'draft',
        createdBy: USER_A,
      },
    });
    await prisma.diagnosticStateHistory.create({
      data: {
        organizationId: ORG_A,
        diagnosticId: DIAG_A,
        fromStatus: null,
        toStatus: 'draft',
        changedBy: USER_A,
        note: 'Creación del diagnóstico.',
      },
    });
    // Respuestas de ejemplo (trazabilidad respuesta → pregunta congelada).
    await prisma.diagnosticAnswer.createMany({
      skipDuplicates: true,
      data: [
        {
          organizationId: ORG_A,
          diagnosticId: DIAG_A,
          questionId: PRIV_IDS.qYesNo,
          answerStatus: 'answered',
          selectedOptionId: PRIV_IDS.optYes,
          answeredBy: USER_A,
          answeredAt: new Date(),
        },
        {
          organizationId: ORG_A,
          diagnosticId: DIAG_A,
          questionId: PRIV_IDS.qChoice,
          answerStatus: 'answered',
          selectedOptionId: PRIV_IDS.optPartial,
          answeredBy: USER_A,
          answeredAt: new Date(),
        },
        {
          organizationId: ORG_A,
          diagnosticId: DIAG_A,
          questionId: PRIV_IDS.qText,
          answerStatus: 'answered',
          valueText: 'Monitoreo por registro manual cada turno.',
          answeredBy: USER_A,
          answeredAt: new Date(),
        },
      ],
    });
  }

  console.log(
    'Seed aplicado/actualizado (idempotente): orgs, usuarios, membresías, sitios, maestro + copia privada, 1 diagnóstico.',
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
