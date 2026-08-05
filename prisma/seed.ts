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
// Imports RELATIVOS (tsx no resuelve el alias '@/'); estas rutas no usan alias.
import {
  CONTENT_SCHEMA_VERSION,
  contentChecksum,
  renderContentHtml,
  sanitizeContent,
} from '../src/features/documents/content-schema';
import {
  DEFAULT_PAGE_CONFIG,
  getTemplate,
  sanitizePageConfig,
} from '../src/features/documents/templates';

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

// Usuario evaluador de ORG_A (revisor/aprobador/lector de la demo de control).
const USER_C = '00000000-0000-4000-8000-0000000000a3';

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

/** UUID determinista para documentos ('c') y versiones ('d') de demostración. */
function docUuid(kind: 'c' | 'd', n: number): string {
  return `00000000-0000-4000-8000-00000000d0${kind}${n.toString(16)}`;
}

interface DocDef {
  code: string;
  title: string;
  documentType: string;
  origin: string;
  status: string;
  issuedAt: string;
  nextReviewAt: string | null;
  description?: string;
}

// Documentos de demostración para ORG_A (sin archivos binarios).
const DEMO_DOCS: DocDef[] = [
  {
    code: 'POL-01',
    title: 'Política de inocuidad alimentaria',
    documentType: 'policy',
    origin: 'internal',
    status: 'effective',
    issuedAt: '2026-01-01',
    nextReviewAt: '2027-01-01',
    description: 'Compromiso de la dirección con la inocuidad (demo).',
  },
  {
    code: 'PRO-01',
    title: 'Procedimiento de limpieza y desinfección',
    documentType: 'procedure',
    origin: 'internal',
    status: 'effective',
    issuedAt: '2026-02-01',
    nextReviewAt: '2026-08-20',
  },
  {
    code: 'FOR-01',
    title: 'Formato de registro de temperatura',
    documentType: 'form',
    origin: 'internal',
    status: 'effective',
    issuedAt: '2026-03-01',
    nextReviewAt: '2027-03-01',
  },
  {
    code: 'EXT-01',
    title: 'NOM-251 (documento externo)',
    documentType: 'external',
    origin: 'external',
    status: 'effective',
    issuedAt: '2025-10-01',
    nextReviewAt: null,
    description: 'Referencia normativa externa (demo).',
  },
  {
    code: 'INS-01',
    title: 'Instructivo de calibración de termómetros',
    documentType: 'instruction',
    origin: 'internal',
    status: 'in_review',
    issuedAt: '2026-06-01',
    nextReviewAt: '2026-08-12',
  },
  {
    code: 'MAN-01',
    title: 'Manual HACCP (edición anterior)',
    documentType: 'manual',
    origin: 'internal',
    status: 'obsolete',
    issuedAt: '2024-01-01',
    nextReviewAt: '2025-01-01',
    description: 'Versión obsoleta conservada (demo).',
  },
];

async function seedDocuments(): Promise<void> {
  if (await prisma.document.findUnique({ where: { id: docUuid('c', 1) } })) return;

  for (let i = 0; i < DEMO_DOCS.length; i += 1) {
    const d = DEMO_DOCS[i]!;
    const documentId = docUuid('c', i + 1);
    const versionId = docUuid('d', i + 1);
    await prisma.document.create({
      data: {
        id: documentId,
        organizationId: ORG_A,
        code: d.code,
        title: d.title,
        description: d.description ?? null,
        documentType: d.documentType,
        origin: d.origin,
        status: d.status,
        confidentiality: 'internal',
        currentVersionLabel: 'v1',
        siteId: SITE_A,
        responsibleUserId: USER_A,
        issuedAt: new Date(`${d.issuedAt}T00:00:00.000Z`),
        nextReviewAt: d.nextReviewAt ? new Date(`${d.nextReviewAt}T00:00:00.000Z`) : null,
        createdBy: USER_A,
      },
    });
    await prisma.documentVersion.create({
      data: {
        id: versionId,
        organizationId: ORG_A,
        documentId,
        label: 'v1',
        status: d.status === 'effective' ? 'published' : 'draft',
        isCurrent: true,
        author: USER_A,
        publishedAt: d.status === 'effective' ? new Date(`${d.issuedAt}T00:00:00.000Z`) : null,
      },
    });
    await prisma.documentHistory.create({
      data: { organizationId: ORG_A, documentId, action: 'document.created', actorUserId: USER_A },
    });
  }
}

/** UUID determinista para documentos del editor. */
function edUuid(kind: 'c' | 'd', n: number): string {
  return `00000000-0000-4000-8000-00000000d1${kind}${n.toString(16)}`;
}

interface EdDocDef {
  code: string;
  title: string;
  templateKey: string;
  documentType: string;
  versions: { label: string; status: string; current: boolean }[];
}

const EDITOR_DOCS: EdDocDef[] = [
  {
    code: 'PRO-SEN-01',
    title: 'Procedimiento de recepción de materia prima',
    templateKey: 'procedure',
    documentType: 'procedure',
    versions: [
      { label: 'v1', status: 'published', current: false },
      { label: 'v2', status: 'draft', current: true },
    ],
  },
  {
    code: 'POL-SEN-01',
    title: 'Política de calidad (creada en Sentinel)',
    templateKey: 'policy',
    documentType: 'policy',
    versions: [{ label: 'v1', status: 'draft', current: true }],
  },
  {
    code: 'FOR-SEN-01',
    title: 'Formato de control de temperatura',
    templateKey: 'form',
    documentType: 'form',
    versions: [{ label: 'v1', status: 'draft', current: true }],
  },
];

async function seedEditorDocuments(): Promise<void> {
  if (await prisma.document.findUnique({ where: { id: edUuid('c', 1) } })) return;

  let vi = 0;
  for (let i = 0; i < EDITOR_DOCS.length; i += 1) {
    const d = EDITOR_DOCS[i]!;
    const documentId = edUuid('c', i + 1);
    const template = getTemplate(d.templateKey)!;
    const content = sanitizeContent(template.build());
    const html = renderContentHtml(content);
    const checksum = contentChecksum(content);
    const pageConfig = sanitizePageConfig({
      ...DEFAULT_PAGE_CONFIG,
      cover: { enabled: template.cover },
    });

    const currentLabel = d.versions.find((v) => v.current)?.label ?? d.versions[0]!.label;
    await prisma.document.create({
      data: {
        id: documentId,
        organizationId: ORG_A,
        code: d.code,
        title: d.title,
        documentType: d.documentType,
        origin: 'internal',
        status: 'draft',
        confidentiality: 'internal',
        currentVersionLabel: currentLabel,
        siteId: SITE_A,
        responsibleUserId: USER_A,
        createdBy: USER_A,
      },
    });
    for (const v of d.versions) {
      vi += 1;
      await prisma.documentVersion.create({
        data: {
          id: edUuid('d', vi),
          organizationId: ORG_A,
          documentId,
          label: v.label,
          status: v.status,
          isCurrent: v.current,
          author: USER_A,
          updatedBy: USER_A,
          templateKey: template.key,
          contentSchemaVersion: CONTENT_SCHEMA_VERSION,
          contentJson: content as unknown as object,
          contentHtml: html,
          contentChecksum: checksum,
          pageConfig: pageConfig as unknown as object,
          publishedAt: v.status === 'published' ? new Date('2026-06-01T00:00:00.000Z') : null,
        },
      });
    }
    await prisma.documentHistory.create({
      data: { organizationId: ORG_A, documentId, action: 'document.created', actorUserId: USER_A },
    });
  }
}

/** UUID determinista para la demo de control documental. */
function ctlUuid(kind: 'c' | 'd', n: number): string {
  return `00000000-0000-4000-8000-00000000c1${kind}${n.toString(16)}`;
}

async function seedControlDocuments(): Promise<void> {
  if (await prisma.document.findUnique({ where: { id: ctlUuid('c', 1) } })) return;

  const content = sanitizeContent(getTemplate('policy')!.build());
  const html = renderContentHtml(content);
  const sum = contentChecksum(content);
  const now = new Date('2026-08-04T00:00:00.000Z');
  const soon = new Date('2026-08-14T00:00:00.000Z');
  const far = new Date('2027-08-04T00:00:00.000Z');

  async function makeDoc(
    n: number,
    code: string,
    title: string,
    docStatus: string,
    versionStatus: string,
    isCurrent: boolean,
    nextReviewAt: Date | null,
  ) {
    const documentId = ctlUuid('c', n);
    const versionId = ctlUuid('d', n);
    await prisma.document.create({
      data: {
        id: documentId,
        organizationId: ORG_A,
        code,
        title,
        documentType: 'policy',
        origin: 'internal',
        status: docStatus,
        confidentiality: 'internal',
        currentVersionLabel: 'v1',
        siteId: SITE_A,
        responsibleUserId: USER_A,
        createdBy: USER_A,
        issuedAt: now,
        nextReviewAt,
      },
    });
    await prisma.documentVersion.create({
      data: {
        id: versionId,
        organizationId: ORG_A,
        documentId,
        label: 'v1',
        status: versionStatus,
        isCurrent,
        author: USER_A,
        updatedBy: USER_A,
        changeNotes: 'Versión inicial',
        templateKey: 'policy',
        contentSchemaVersion: CONTENT_SCHEMA_VERSION,
        contentJson: content as unknown as object,
        contentHtml: html,
        contentChecksum: sum,
        pageConfig: sanitizePageConfig(DEFAULT_PAGE_CONFIG) as unknown as object,
        publishedAt: versionStatus === 'published' ? now : null,
      },
    });
    await prisma.documentStatusHistory.create({
      data: {
        organizationId: ORG_A,
        documentId,
        versionId,
        toStatus: versionStatus,
        actorUserId: USER_A,
        comment: 'Seed',
      },
    });
    return { documentId, versionId };
  }

  await makeDoc(1, 'CTL-01', 'Política en borrador', 'draft', 'draft', true, null);

  const d2 = await makeDoc(2, 'CTL-02', 'Política en revisión', 'draft', 'in_review', true, null);
  const wf2 = await prisma.documentWorkflow.create({
    data: {
      organizationId: ORG_A,
      documentId: d2.documentId,
      versionId: d2.versionId,
      stage: 'review',
      createdBy: USER_A,
    },
  });
  await prisma.documentWorkflowStep.createMany({
    data: [
      {
        organizationId: ORG_A,
        workflowId: wf2.id,
        documentId: d2.documentId,
        versionId: d2.versionId,
        role: 'reviewer',
        userId: USER_C,
        sequence: 1,
        status: 'pending',
      },
      {
        organizationId: ORG_A,
        workflowId: wf2.id,
        documentId: d2.documentId,
        versionId: d2.versionId,
        role: 'approver',
        userId: USER_C,
        sequence: 2,
        status: 'pending',
      },
    ],
  });

  const d3 = await makeDoc(
    3,
    'CTL-03',
    'Política en aprobación',
    'draft',
    'in_approval',
    true,
    null,
  );
  const wf3 = await prisma.documentWorkflow.create({
    data: {
      organizationId: ORG_A,
      documentId: d3.documentId,
      versionId: d3.versionId,
      stage: 'approval',
      createdBy: USER_A,
    },
  });
  await prisma.documentWorkflowStep.createMany({
    data: [
      {
        organizationId: ORG_A,
        workflowId: wf3.id,
        documentId: d3.documentId,
        versionId: d3.versionId,
        role: 'reviewer',
        userId: USER_C,
        sequence: 1,
        status: 'approved',
        decidedBy: USER_C,
        decidedAt: now,
      },
      {
        organizationId: ORG_A,
        workflowId: wf3.id,
        documentId: d3.documentId,
        versionId: d3.versionId,
        role: 'approver',
        userId: USER_C,
        sequence: 2,
        status: 'pending',
      },
    ],
  });
  await prisma.documentApproval.create({
    data: {
      organizationId: ORG_A,
      documentId: d3.documentId,
      versionId: d3.versionId,
      actorUserId: USER_C,
      stage: 'review',
      decision: 'approved',
      contentChecksum: sum,
    },
  });

  const d4 = await makeDoc(4, 'CTL-04', 'Política vigente', 'effective', 'published', true, far);
  await prisma.documentDistribution.create({
    data: {
      organizationId: ORG_A,
      documentId: d4.documentId,
      versionId: d4.versionId,
      targetType: 'user',
      userId: USER_C,
      distributedBy: USER_A,
      readRequired: true,
    },
  });
  await prisma.documentReadAck.create({
    data: {
      organizationId: ORG_A,
      documentId: d4.documentId,
      versionId: d4.versionId,
      userId: USER_A,
      contentChecksum: sum,
      statement: 'Confirmo que he leído y comprendido esta versión del documento.',
    },
  });
  await prisma.documentControlledCopy.create({
    data: {
      organizationId: ORG_A,
      documentId: d4.documentId,
      versionId: d4.versionId,
      copyNumber: 1,
      recipient: 'Planta Norte',
      format: 'printed',
      issuedBy: USER_A,
      status: 'active',
    },
  });

  await makeDoc(5, 'CTL-05', 'Política próxima a revisión', 'effective', 'published', true, soon);
  await makeDoc(6, 'CTL-06', 'Política obsoleta', 'obsolete', 'obsolete', false, null);
}

/** UUID determinista para la demo CAPA por tipo de entidad. */
function capaUuid(kind: '0' | '1' | '2' | '3' | '4' | '5' | '6', n: number): string {
  return `00000000-0000-4000-8000-00000ca${kind}${n.toString(16).padStart(4, '0')}`;
}

/**
 * Datos demo del módulo CAPA (TASK-007). Cubre distintos estados del ciclo,
 * severidad crítica, vencidas, acciones con responsables y estados, evidencia
 * (solo metadata, sin binarios) e historial representativo. Idempotente.
 */
async function seedCapa(): Promise<void> {
  if (await prisma.capa.findUnique({ where: { id: capaUuid('0', 1) } })) return;

  const YEAR = 2026;
  const past = new Date('2026-07-01T00:00:00.000Z'); // vencida (hoy 2026-08-05)
  const future = new Date('2026-12-31T00:00:00.000Z');
  const detected = new Date('2026-08-01T00:00:00.000Z');

  interface CapaDef {
    n: number;
    folioSeq: number;
    title: string;
    description: string;
    sourceType: string;
    status: string;
    severity: string;
    priority: string;
    scope: string;
    impacts: string[];
    responsible: string | null;
    targetDate: Date | null;
    problemWhat?: string;
    objectiveEvidence?: string;
  }

  const DEFS: CapaDef[] = [
    {
      n: 1,
      folioSeq: 1,
      title: 'Registro incompleto de temperatura',
      description: 'Se detectó un registro de temperatura sin firmar en Planta Norte.',
      sourceType: 'internal_nc',
      status: 'draft',
      severity: 'low',
      priority: 'normal',
      scope: 'point',
      impacts: ['quality'],
      responsible: null,
      targetDate: null,
    },
    {
      n: 2,
      folioSeq: 2,
      title: 'Desviación de peso en línea de envasado',
      description: 'Peso neto por debajo de especificación en un lote.',
      sourceType: 'deviation',
      status: 'reported',
      severity: 'medium',
      priority: 'high',
      scope: 'batch',
      impacts: ['quality', 'customer'],
      responsible: USER_C,
      targetDate: future,
    },
    {
      n: 3,
      folioSeq: 3,
      title: 'Queja de cliente por material extraño',
      description: 'Cliente reporta presencia de material extraño en producto.',
      sourceType: 'customer_complaint',
      status: 'containment',
      severity: 'high',
      priority: 'urgent',
      scope: 'batch',
      impacts: ['safety', 'customer', 'reputation'],
      responsible: USER_C,
      targetDate: future,
      problemWhat: 'Material extraño detectado por el cliente',
    },
    {
      n: 4,
      folioSeq: 4,
      title: 'Hallazgo de auditoría: control de plagas',
      description: 'Auditoría interna detecta estaciones de control sin verificación.',
      sourceType: 'audit_nc',
      status: 'under_investigation',
      severity: 'high',
      priority: 'high',
      scope: 'site',
      impacts: ['safety', 'legal'],
      responsible: USER_C,
      targetDate: future,
      problemWhat: 'Estaciones de control de plagas sin verificar',
      objectiveEvidence: 'Bitácora de verificación incompleta',
    },
    {
      n: 5,
      folioSeq: 5,
      title: 'Resultado fuera de especificación en producto terminado',
      description: 'Análisis microbiológico fuera de límite en producto terminado.',
      sourceType: 'out_of_spec',
      status: 'action_plan',
      severity: 'critical',
      priority: 'urgent',
      scope: 'batch',
      impacts: ['safety', 'quality', 'product'],
      responsible: USER_A,
      targetDate: past, // vencida
      problemWhat: 'Recuento microbiológico fuera de especificación',
      objectiveEvidence: 'Reporte de laboratorio',
    },
    {
      n: 6,
      folioSeq: 6,
      title: 'Incidente de inocuidad por temperatura de cámara',
      description: 'Cámara de refrigeración superó el límite durante 3 horas.',
      sourceType: 'safety_incident',
      status: 'effectiveness_review',
      severity: 'high',
      priority: 'high',
      scope: 'line',
      impacts: ['safety', 'product'],
      responsible: USER_C,
      targetDate: future,
      problemWhat: 'Temperatura de cámara fuera de rango',
      objectiveEvidence: 'Gráfico de temperatura',
    },
    {
      n: 7,
      folioSeq: 7,
      title: 'No conformidad de etiquetado (cerrada)',
      description: 'Etiqueta sin fecha de caducidad en un lote; corregido y verificado.',
      sourceType: 'internal_nc',
      status: 'closed',
      severity: 'medium',
      priority: 'normal',
      scope: 'batch',
      impacts: ['legal', 'customer'],
      responsible: USER_C,
      targetDate: past,
      problemWhat: 'Etiqueta sin fecha de caducidad',
      objectiveEvidence: 'Muestras de etiqueta',
    },
    {
      n: 8,
      folioSeq: 8,
      title: 'Oportunidad de mejora: capacitación en higiene',
      description: 'Se propone reforzar la capacitación de higiene del personal.',
      sourceType: 'improvement',
      status: 'reported',
      severity: 'low',
      priority: 'normal',
      scope: 'organization',
      impacts: ['personnel', 'quality'],
      responsible: USER_A,
      targetDate: past, // vencida
    },
  ];

  for (const d of DEFS) {
    const capaId = capaUuid('0', d.n);
    await prisma.capa.create({
      data: {
        id: capaId,
        organizationId: ORG_A,
        folio: `CAPA-${YEAR}-${String(d.folioSeq).padStart(4, '0')}`,
        year: YEAR,
        title: d.title,
        description: d.description,
        sourceType: d.sourceType,
        status: d.status,
        siteId: SITE_A,
        severity: d.severity,
        priority: d.priority,
        scope: d.scope,
        impacts: d.impacts,
        responsibleUserId: d.responsible,
        reportedBy: USER_A,
        detectedAt: detected,
        targetDate: d.targetDate,
        problemWhat: d.problemWhat ?? null,
        objectiveEvidence: d.objectiveEvidence ?? null,
        createdBy: USER_A,
      },
    });
    await prisma.capaStatusHistory.create({
      data: {
        organizationId: ORG_A,
        capaId,
        event: 'created',
        toStatus: 'draft',
        actorUserId: USER_A,
        detail: `Folio CAPA-${YEAR}-${String(d.folioSeq).padStart(4, '0')}`,
      },
    });
  }

  // Acción inmediata (contención) para la queja de cliente (n=3) y la auditoría (n=4).
  await prisma.capaImmediateAction.createMany({
    data: [
      {
        id: capaUuid('1', 3),
        organizationId: ORG_A,
        capaId: capaUuid('0', 3),
        actionType: 'containment',
        description: 'Retener y segregar el lote afectado',
        responsibleUserId: USER_C,
        status: 'completed',
        executedAt: detected,
        createdBy: USER_A,
      },
      {
        id: capaUuid('1', 4),
        organizationId: ORG_A,
        capaId: capaUuid('0', 4),
        actionType: 'correction',
        description: 'Verificar de inmediato todas las estaciones',
        responsibleUserId: USER_C,
        status: 'in_progress',
        createdBy: USER_A,
      },
    ],
  });

  // Causa raíz (5 porqués) para investigación (4), plan (5), eficacia (6) y cerrada (7).
  for (const [n, root] of [
    [4, 'Falta de un calendario de verificación de estaciones'],
    [5, 'Desviación en el proceso de pasteurización'],
    [6, 'Falla del sensor de temperatura sin alarma'],
    [7, 'Plantilla de etiqueta desactualizada'],
  ] as const) {
    const rcaId = capaUuid('2', n);
    await prisma.capaRootCauseAnalysis.create({
      data: {
        id: rcaId,
        organizationId: ORG_A,
        capaId: capaUuid('0', n),
        method: 'five_whys',
        rootCause: root,
        investigatorUserId: USER_C,
        concludedAt: detected,
        createdBy: USER_A,
      },
    });
    await prisma.capaWhyStep.createMany({
      data: [
        {
          organizationId: ORG_A,
          capaId: capaUuid('0', n),
          rcaId,
          level: 1,
          answer: 'Se observó la desviación.',
        },
        {
          organizationId: ORG_A,
          capaId: capaUuid('0', n),
          rcaId,
          level: 2,
          answer: 'El control no se ejecutó.',
        },
        { organizationId: ORG_A, capaId: capaUuid('0', n), rcaId, level: 3, answer: root },
      ],
    });
  }

  // Plan de acciones para el plan (5), la eficacia (6) y la cerrada (7).
  await prisma.capaAction.createMany({
    data: [
      {
        id: capaUuid('4', 5),
        organizationId: ORG_A,
        capaId: capaUuid('0', 5),
        actionType: 'corrective',
        description: 'Revalidar parámetros de pasteurización',
        responsibleUserId: USER_A,
        dueDate: future,
        priority: 'urgent',
        status: 'in_progress',
        progress: 40,
        createdBy: USER_A,
      },
      {
        id: capaUuid('4', 15),
        organizationId: ORG_A,
        capaId: capaUuid('0', 5),
        actionType: 'preventive',
        description: 'Capacitar al personal de proceso',
        responsibleUserId: USER_C,
        dueDate: future,
        priority: 'high',
        status: 'pending',
        progress: 0,
        createdBy: USER_A,
      },
      {
        id: capaUuid('4', 6),
        organizationId: ORG_A,
        capaId: capaUuid('0', 6),
        actionType: 'maintenance',
        description: 'Reemplazar sensor y configurar alarma',
        responsibleUserId: USER_A,
        dueDate: past,
        priority: 'high',
        status: 'completed',
        progress: 100,
        closedAt: detected,
        createdBy: USER_A,
      },
      {
        id: capaUuid('4', 7),
        organizationId: ORG_A,
        capaId: capaUuid('0', 7),
        actionType: 'document_change',
        description: 'Actualizar plantilla de etiqueta',
        responsibleUserId: USER_C,
        dueDate: past,
        priority: 'normal',
        status: 'completed',
        progress: 100,
        closedAt: detected,
        createdBy: USER_A,
      },
    ],
  });

  // Verificación de eficacia para la cerrada (7): eficaz, verificada por otro usuario.
  await prisma.capaEffectivenessReview.create({
    data: {
      id: capaUuid('5', 7),
      organizationId: ORG_A,
      capaId: capaUuid('0', 7),
      criterion: 'Sin recurrencia de etiquetas sin caducidad en 3 lotes',
      method: 'Revisión documental',
      executedAt: detected,
      verifierUserId: USER_A,
      conclusion: 'effective',
      createdBy: USER_A,
    },
  });

  // Cierre de la CAPA 7 (metadata; acuse interno, no firma legal).
  await prisma.capa.update({
    where: { id: capaUuid('0', 7) },
    data: {
      closedBy: USER_A,
      closedAt: detected,
      closureSummary: 'Causa eliminada; verificación eficaz sin recurrencia.',
      closureChecksum: 'seed-capa-07-closure',
    },
  });

  // Evidencia (solo metadata; binarios fuera de PostgreSQL).
  await prisma.capaFile.createMany({
    data: [
      {
        id: capaUuid('6', 4),
        organizationId: ORG_A,
        capaId: capaUuid('0', 4),
        evidenceType: 'investigation',
        originalName: 'bitacora-plagas.pdf',
        storedName: 'seed-capa-04.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 12000,
        extension: 'pdf',
        storageKey: `${ORG_A}/seed-capa-04.pdf`,
        checksum: 'seed-capa-04',
        uploadedBy: USER_A,
      },
      {
        id: capaUuid('6', 7),
        organizationId: ORG_A,
        capaId: capaUuid('0', 7),
        evidenceType: 'closure',
        originalName: 'etiqueta-corregida.png',
        storedName: 'seed-capa-07.png',
        mimeType: 'image/png',
        sizeBytes: 34000,
        extension: 'png',
        storageKey: `${ORG_A}/seed-capa-07.png`,
        checksum: 'seed-capa-07',
        uploadedBy: USER_A,
      },
    ],
  });

  // Ajusta el contador de folios para que las CAPA creadas por la app continúen.
  await prisma.capaFolioCounter.upsert({
    where: { organizationId_year: { organizationId: ORG_A, year: YEAR } },
    create: { organizationId: ORG_A, year: YEAR, lastSeq: DEFS.length },
    update: { lastSeq: DEFS.length },
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
      { id: USER_C, email: 'revisor.c@example.test', displayName: 'Revisor C' },
    ],
  });
  await prisma.membership.createMany({
    skipDuplicates: true,
    data: [
      { organizationId: ORG_A, userId: USER_A, role: 'owner' },
      { organizationId: ORG_B, userId: USER_B, role: 'owner' },
      { organizationId: ORG_A, userId: USER_C, role: 'evaluator' },
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
  await seedDocuments();
  await seedEditorDocuments();
  await seedControlDocuments();
  await seedCapa();

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
