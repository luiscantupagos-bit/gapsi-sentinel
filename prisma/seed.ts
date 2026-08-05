/**
 * Datos semilla mínimos de DESARROLLO para GAPSI Sentinel (TASK-002 / TASK-003).
 *
 * Contenido: 2 organizaciones, 2 usuarios, membresías, 1 sitio por organización,
 * 1 marco maestro (GAPSI) publicado, 1 copia privada de plantilla publicada con
 * 2 secciones / 4 requisitos / 9 preguntas (yes_no, selección única, texto; 2
 * críticas; 1 admite "No aplica"), y 1 diagnóstico de ejemplo con algunas
 * respuestas (progreso parcial para la demo).
 *
 * Idempotente y con recuperación: cada bloque solo inserta lo que falta; puede
 * ejecutarse sobre una base con datos parciales sin borrar nada. Para una
 * recarga limpia usa `npm run db:reset:local`.
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

// --- Definición family-agnóstica de la plantilla de ejemplo -------------------

type QType = 'yes_no' | 'single_choice' | 'text';
interface OptDef {
  code: string;
  label: string;
  score: number;
}
interface QDef {
  code: string;
  prompt: string;
  type: QType;
  weight: number;
  critical?: boolean;
  na?: boolean;
  options?: OptDef[];
}
interface RDef {
  code: string;
  title: string;
  critical?: boolean;
  questions: QDef[];
}
interface SDef {
  code: string;
  title: string;
  requirements: RDef[];
}

const YES_NO: OptDef[] = [
  { code: 'YES', label: 'Sí', score: 1 },
  { code: 'NO', label: 'No', score: 0 },
];

const TEMPLATE: SDef[] = [
  {
    code: 'S1',
    title: 'Control de peligros',
    requirements: [
      {
        code: 'R1',
        title: 'PCC monitoreado',
        critical: true,
        questions: [
          {
            code: 'Q1',
            prompt: '¿Existe monitoreo de cada PCC?',
            type: 'yes_no',
            weight: 1,
            critical: true,
            options: YES_NO,
          },
          {
            code: 'Q2',
            prompt: '¿Frecuencia de verificación de los PCC?',
            type: 'single_choice',
            weight: 2,
            options: [
              { code: 'ADEQUATE', label: 'Adecuada', score: 1 },
              { code: 'PARTIAL', label: 'Parcial', score: 0.5 },
              { code: 'NONE', label: 'Inexistente', score: 0 },
            ],
          },
          {
            code: 'Q3',
            prompt: 'Describa el método de monitoreo (observación).',
            type: 'text',
            weight: 1,
          },
        ],
      },
      {
        code: 'R2',
        title: 'Límites críticos definidos',
        critical: true,
        questions: [
          {
            code: 'Q4',
            prompt: '¿Se definieron límites críticos para cada PCC?',
            type: 'yes_no',
            weight: 1,
            critical: true,
            options: YES_NO,
          },
          {
            code: 'Q5',
            prompt: '¿Aplica un control específico de alérgenos?',
            type: 'yes_no',
            weight: 1,
            na: true,
            options: YES_NO,
          },
        ],
      },
    ],
  },
  {
    code: 'S2',
    title: 'Prerrequisitos',
    requirements: [
      {
        code: 'R3',
        title: 'Higiene del personal',
        questions: [
          {
            code: 'Q6',
            prompt: '¿Existe un programa de higiene del personal?',
            type: 'yes_no',
            weight: 1,
            options: YES_NO,
          },
          {
            code: 'Q7',
            prompt: '¿Nivel de capacitación del personal?',
            type: 'single_choice',
            weight: 1,
            options: [
              { code: 'HIGH', label: 'Alto', score: 1 },
              { code: 'MEDIUM', label: 'Medio', score: 0.5 },
              { code: 'LOW', label: 'Bajo', score: 0 },
            ],
          },
        ],
      },
      {
        code: 'R4',
        title: 'Control de proveedores',
        questions: [
          {
            code: 'Q8',
            prompt: '¿Se evalúan y aprueban los proveedores?',
            type: 'yes_no',
            weight: 1,
            options: YES_NO,
          },
          {
            code: 'Q9',
            prompt: 'Comentarios sobre proveedores (observación).',
            type: 'text',
            weight: 1,
          },
        ],
      },
    ],
  },
];

/** UUID determinista por familia (`f` maestro, `e` privado) y tipo. */
function seedUuid(family: 'f' | 'e', type: '1' | '2' | '3' | '4', index: number): string {
  const suffix = '00000000' + family + type + index.toString(16).padStart(2, '0');
  return `00000000-0000-4000-8000-${suffix}`;
}

/** Inserta el contenido de una versión (en `draft`) de forma determinista. */
async function seedVersionContent(
  versionId: string,
  organizationId: string | null,
  family: 'f' | 'e',
): Promise<void> {
  let si = 0;
  let ri = 0;
  let qi = 0;
  let oi = 0;

  for (const s of TEMPLATE) {
    si += 1;
    const sectionId = seedUuid(family, '1', si);
    await prisma.templateSection.create({
      data: {
        id: sectionId,
        organizationId,
        templateVersionId: versionId,
        code: s.code,
        title: s.title,
        position: si,
      },
    });

    for (const r of s.requirements) {
      ri += 1;
      const requirementId = seedUuid(family, '2', ri);
      await prisma.templateRequirement.create({
        data: {
          id: requirementId,
          organizationId,
          templateVersionId: versionId,
          sectionId,
          code: r.code,
          title: r.title,
          isCritical: Boolean(r.critical),
          position: ri,
        },
      });

      for (const q of r.questions) {
        qi += 1;
        const questionId = seedUuid(family, '3', qi);
        await prisma.templateQuestion.create({
          data: {
            id: questionId,
            organizationId,
            templateVersionId: versionId,
            requirementId,
            code: q.code,
            prompt: q.prompt,
            questionType: q.type,
            weight: q.weight,
            isCritical: Boolean(q.critical),
            allowsNotApplicable: Boolean(q.na),
            isScored: q.type !== 'text',
            position: qi,
          },
        });

        let opos = 0;
        for (const o of q.options ?? []) {
          oi += 1;
          opos += 1;
          await prisma.templateAnswerOption.create({
            data: {
              id: seedUuid(family, '4', oi),
              organizationId,
              templateVersionId: versionId,
              questionId,
              code: o.code,
              label: o.label,
              scoreFraction: o.score,
              position: opos,
            },
          });
        }
      }
    }
  }
}

/** Crea el marco + versión + contenido y la publica, si el marco no existe aún. */
async function ensureTemplate(
  frameworkId: string,
  versionId: string,
  organizationId: string | null,
  family: 'f' | 'e',
  data: {
    scope: 'master' | 'organization';
    frameworkName: string;
    frameworkDescription: string;
    sourceMasterVersionId: string | null;
    contentHash: string;
    createdBy: string | null;
  },
): Promise<void> {
  if (await prisma.assessmentFramework.findUnique({ where: { id: frameworkId } })) return;

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
  await seedVersionContent(versionId, organizationId, family);
  await prisma.templateVersion.update({
    where: { id: versionId },
    data: { status: 'published', publishedAt: new Date(), contentHash: data.contentHash },
  });
}

async function seedDiagnostic(): Promise<void> {
  if (await prisma.diagnostic.findUnique({ where: { id: DIAG_A } })) return;

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

  // Respuestas parciales (progreso ~33 %): Q1=Sí, Q2=Parcial, Q6=Sí.
  const q1 = seedUuid('e', '3', 1);
  const q2 = seedUuid('e', '3', 2);
  const q6 = seedUuid('e', '3', 6);
  const optYesQ1 = await prisma.templateAnswerOption.findFirstOrThrow({
    where: { questionId: q1, code: 'YES' },
  });
  const optPartialQ2 = await prisma.templateAnswerOption.findFirstOrThrow({
    where: { questionId: q2, code: 'PARTIAL' },
  });
  const optYesQ6 = await prisma.templateAnswerOption.findFirstOrThrow({
    where: { questionId: q6, code: 'YES' },
  });

  await prisma.diagnosticAnswer.createMany({
    skipDuplicates: true,
    data: [
      {
        organizationId: ORG_A,
        diagnosticId: DIAG_A,
        questionId: q1,
        answerStatus: 'answered',
        selectedOptionId: optYesQ1.id,
        answeredBy: USER_A,
        answeredAt: new Date(),
      },
      {
        organizationId: ORG_A,
        diagnosticId: DIAG_A,
        questionId: q2,
        answerStatus: 'answered',
        selectedOptionId: optPartialQ2.id,
        answeredBy: USER_A,
        answeredAt: new Date(),
      },
      {
        organizationId: ORG_A,
        diagnosticId: DIAG_A,
        questionId: q6,
        answerStatus: 'answered',
        selectedOptionId: optYesQ6.id,
        answeredBy: USER_A,
        answeredAt: new Date(),
      },
    ],
  });
}

async function main(): Promise<void> {
  // Base: idempotente con `skipDuplicates`.
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

  await ensureTemplate(MASTER_FW, MASTER_VER, null, 'f', {
    scope: 'master',
    frameworkName: 'Diagnóstico interno HACCP (maestro)',
    frameworkDescription: 'Marco maestro administrado por GAPSI.',
    sourceMasterVersionId: null,
    contentHash: 'seed-master-v1',
    createdBy: null,
  });
  await ensureTemplate(PRIV_FW_A, PRIV_VER_A, ORG_A, 'e', {
    scope: 'organization',
    frameworkName: 'Diagnóstico interno HACCP (copia A)',
    frameworkDescription: 'Copia privada de la organización A a partir del maestro.',
    sourceMasterVersionId: MASTER_VER,
    contentHash: 'seed-priv-a-v1',
    createdBy: USER_A,
  });

  await seedDiagnostic();

  console.log(
    'Seed aplicado/actualizado (idempotente): orgs, usuarios, sitios, maestro + copia privada, 1 diagnóstico.',
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
