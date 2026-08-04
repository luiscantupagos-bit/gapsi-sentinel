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

// Catálogo maestro (GAPSI).
const MASTER_FW = '00000000-0000-4000-8000-00000000ma00';
const MASTER_VER = '00000000-0000-4000-8000-00000000ma01';

// Copia privada de la organización A.
const PRIV_FW_A = '00000000-0000-4000-8000-0000000pa000';
const PRIV_VER_A = '00000000-0000-4000-8000-0000000pa001';

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
  section: '00000000-0000-4000-8000-00000000ma10',
  requirement: '00000000-0000-4000-8000-00000000ma20',
  qYesNo: '00000000-0000-4000-8000-00000000ma31',
  qChoice: '00000000-0000-4000-8000-00000000ma32',
  qText: '00000000-0000-4000-8000-00000000ma33',
  optYes: '00000000-0000-4000-8000-00000000ma41',
  optNo: '00000000-0000-4000-8000-00000000ma42',
  optAdequate: '00000000-0000-4000-8000-00000000ma43',
  optPartial: '00000000-0000-4000-8000-00000000ma44',
  optNone: '00000000-0000-4000-8000-00000000ma45',
};

const PRIV_IDS: ContentIds = {
  section: '00000000-0000-4000-8000-0000000pa010',
  requirement: '00000000-0000-4000-8000-0000000pa020',
  qYesNo: '00000000-0000-4000-8000-0000000pa031',
  qChoice: '00000000-0000-4000-8000-0000000pa032',
  qText: '00000000-0000-4000-8000-0000000pa033',
  optYes: '00000000-0000-4000-8000-0000000pa041',
  optNo: '00000000-0000-4000-8000-0000000pa042',
  optAdequate: '00000000-0000-4000-8000-0000000pa043',
  optPartial: '00000000-0000-4000-8000-0000000pa044',
  optNone: '00000000-0000-4000-8000-0000000pa045',
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

async function main(): Promise<void> {
  const existing = await prisma.organization.findUnique({ where: { id: ORG_A } });
  if (existing) {
    console.log(
      'Seed ya aplicado (organización demo existe). Usa `npm run db:reset:local` para recargar.',
    );
    return;
  }

  // Organizaciones y usuarios.
  await prisma.organization.createMany({
    data: [
      { id: ORG_A, name: 'Alimentos Demo A', slug: 'demo-a' },
      { id: ORG_B, name: 'Alimentos Demo B', slug: 'demo-b' },
    ],
  });

  await prisma.user.createMany({
    data: [
      { id: USER_A, email: 'evaluador.a@example.test', displayName: 'Evaluador A' },
      { id: USER_B, email: 'evaluador.b@example.test', displayName: 'Evaluador B' },
    ],
  });

  await prisma.membership.createMany({
    data: [
      { organizationId: ORG_A, userId: USER_A, role: 'owner' },
      { organizationId: ORG_B, userId: USER_B, role: 'owner' },
    ],
  });

  // Un sitio por organización.
  await prisma.site.createMany({
    data: [
      { id: SITE_A, organizationId: ORG_A, code: 'PN', name: 'Planta Norte' },
      { id: SITE_B, organizationId: ORG_B, code: 'PS', name: 'Planta Sur' },
    ],
  });

  // Marco maestro (GAPSI) + versión + contenido, luego se publica.
  await prisma.assessmentFramework.create({
    data: {
      id: MASTER_FW,
      scope: 'master',
      organizationId: null,
      code: 'HACCP-INTERNAL',
      name: 'Diagnóstico interno HACCP (maestro)',
      description: 'Marco maestro administrado por GAPSI.',
    },
  });
  await prisma.templateVersion.create({
    data: {
      id: MASTER_VER,
      scope: 'master',
      organizationId: null,
      frameworkId: MASTER_FW,
      versionNumber: 1,
      status: 'draft',
    },
  });
  await seedVersionContent(MASTER_VER, null, MASTER_IDS);
  await prisma.templateVersion.update({
    where: { id: MASTER_VER },
    data: { status: 'published', publishedAt: new Date(), contentHash: 'seed-master-v1' },
  });

  // Copia PRIVADA de la organización A (personalizable), luego publicada.
  await prisma.assessmentFramework.create({
    data: {
      id: PRIV_FW_A,
      scope: 'organization',
      organizationId: ORG_A,
      code: 'HACCP-INTERNAL',
      name: 'Diagnóstico interno HACCP (copia A)',
      description: 'Copia privada de la organización A a partir del maestro.',
      createdBy: USER_A,
    },
  });
  await prisma.templateVersion.create({
    data: {
      id: PRIV_VER_A,
      scope: 'organization',
      organizationId: ORG_A,
      frameworkId: PRIV_FW_A,
      sourceMasterVersionId: MASTER_VER,
      versionNumber: 1,
      status: 'draft',
      createdBy: USER_A,
    },
  });
  await seedVersionContent(PRIV_VER_A, ORG_A, PRIV_IDS);
  await prisma.templateVersion.update({
    where: { id: PRIV_VER_A },
    data: { status: 'published', publishedAt: new Date(), contentHash: 'seed-priv-a-v1' },
  });

  // Diagnóstico de ejemplo (organización A, sitio A, versión privada congelada).
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

  console.log(
    'Seed aplicado: 2 orgs, 2 usuarios, membresías, sitios, maestro + copia privada, 1 diagnóstico.',
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
