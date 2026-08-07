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

/** UUID determinista para la demo de análisis de calidad (TASK-008). */
function qaUuid(
  kind: 'a' | 'c' | 'b' | 'd' | 'e' | 'f' | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7',
  n: number,
): string {
  return `00000000-0000-4000-8000-0a8${kind}${n.toString(16).padStart(8, '0')}`;
}

/**
 * Datos demo de análisis de calidad (TASK-008): Ishikawa aprobado, árbol de
 * causas, Pareto, AMEF, recurrencia, comparación de 3 CAPA y uno con cambios
 * solicitados; hipótesis descartadas/confirmadas, evidencia (metadata), acción
 * creada desde análisis e historial. Idempotente. Sin datos personales reales.
 */
async function seedQualityAnalysis(): Promise<void> {
  if (await prisma.qualityAnalysis.findUnique({ where: { id: qaUuid('a', 1) } })) return;
  const now = new Date('2026-08-04T00:00:00.000Z');
  const capa = (n: number) => capaUuid('0', n);
  const hist = (analysisId: string, event: string, summary?: string) =>
    prisma.qualityAnalysisHistory.create({
      data: {
        organizationId: ORG_A,
        analysisId,
        event,
        actorUserId: USER_A,
        summary: summary ?? null,
      },
    });

  // 1 + 7 + 9. Ishikawa APROBADO con hipótesis confirmada/descartada/contribuyente.
  const a1 = qaUuid('a', 1);
  await prisma.qualityAnalysis.create({
    data: {
      id: a1,
      organizationId: ORG_A,
      capaId: capa(4),
      type: 'ishikawa',
      title: 'Ishikawa: control de plagas',
      objective: 'Identificar causas del hallazgo de auditoría',
      status: 'approved',
      version: 1,
      responsibleUserId: USER_C,
      reviewerUserId: USER_A,
      approverUserId: USER_A,
      approvedAt: now,
      createdBy: USER_A,
    },
  });
  const cats = ['Mano de obra', 'Método', 'Maquinaria', 'Materiales', 'Medición', 'Medio ambiente'];
  const catIds: string[] = [];
  for (let i = 0; i < cats.length; i += 1) {
    const id = qaUuid('c', 1 + i);
    catIds.push(id);
    await prisma.ishikawaCategory.create({
      data: {
        id,
        organizationId: ORG_A,
        analysisId: a1,
        name: cats[i]!,
        position: i + 1,
        createdBy: USER_A,
      },
    });
  }
  await prisma.qualityHypothesis.createMany({
    data: [
      {
        id: qaUuid('b', 1),
        organizationId: ORG_A,
        analysisId: a1,
        description: 'Falta de calendario de verificación de estaciones',
        ishikawaCategoryId: catIds[1],
        sourceTool: 'ishikawa',
        status: 'confirmed',
        probability: 'high',
        justification: 'Bitácora sin registros en 3 semanas',
        createdBy: USER_A,
      },
      {
        id: qaUuid('b', 2),
        organizationId: ORG_A,
        analysisId: a1,
        description: 'Estaciones físicamente dañadas',
        ishikawaCategoryId: catIds[2],
        sourceTool: 'ishikawa',
        status: 'discarded',
        probability: 'low',
        createdBy: USER_A,
      },
      {
        id: qaUuid('b', 3),
        organizationId: ORG_A,
        analysisId: a1,
        description: 'Personal sin capacitación en el procedimiento',
        ishikawaCategoryId: catIds[0],
        sourceTool: 'ishikawa',
        status: 'contributing',
        probability: 'medium',
        createdBy: USER_A,
      },
    ],
  });
  await prisma.qualityAnalysisConclusion.create({
    data: {
      id: qaUuid('4', 1),
      organizationId: ORG_A,
      analysisId: a1,
      summary: 'La causa raíz es la ausencia de un calendario de verificación.',
      proposedRootCause: 'Falta de calendario de verificación',
      confirmedRootCause: 'Falta de calendario de verificación',
      approvedAt: now,
      createdBy: USER_A,
    },
  });
  await prisma.qualityAnalysisVersion.create({
    data: {
      id: qaUuid('3', 1),
      organizationId: ORG_A,
      analysisId: a1,
      version: 1,
      snapshot: { type: 'ishikawa', title: 'Ishikawa: control de plagas', approved: true },
      approvedBy: USER_A,
    },
  });
  // 10. Evidencia (metadata).
  await prisma.qualityEvidence.create({
    data: {
      id: qaUuid('6', 1),
      organizationId: ORG_A,
      analysisId: a1,
      capaId: capa(4),
      entityType: 'hypothesis',
      entityId: qaUuid('b', 1),
      evidenceType: 'investigation',
      originalName: 'bitacora-verificacion.pdf',
      storedName: 'seed-qa-01.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 18000,
      extension: 'pdf',
      storageKey: `${ORG_A}/seed-qa-01.pdf`,
      checksum: 'seed-qa-01',
      uploadedBy: USER_A,
    },
  });
  // 11. Acción CAPA creada desde el análisis (con vínculo bidireccional).
  const act1 = qaUuid('7', 1);
  await prisma.capaAction.create({
    data: {
      id: act1,
      organizationId: ORG_A,
      capaId: capa(4),
      actionType: 'corrective',
      description: 'Implementar calendario de verificación de estaciones',
      responsibleUserId: USER_C,
      dueDate: new Date('2026-09-30T00:00:00.000Z'),
      priority: 'high',
      status: 'pending',
      createdBy: USER_A,
    },
  });
  await prisma.qualityAnalysisActionLink.create({
    data: {
      id: qaUuid('5', 1),
      organizationId: ORG_A,
      analysisId: a1,
      capaActionId: act1,
      sourceEntity: 'hypothesis',
      sourceId: qaUuid('b', 1),
      createdBy: USER_A,
    },
  });
  await hist(a1, 'analysis_created', 'Ishikawa: control de plagas');
  await hist(a1, 'analysis_approved');
  await hist(a1, 'capa_action_created');

  // 2. Árbol de causas (en desarrollo) con nodos, aristas y causa raíz propuesta.
  const a2 = qaUuid('a', 2);
  await prisma.qualityAnalysis.create({
    data: {
      id: a2,
      organizationId: ORG_A,
      capaId: capa(5),
      type: 'cause_tree',
      title: 'Árbol de causas: fuera de especificación',
      status: 'in_progress',
      startedAt: now,
      responsibleUserId: USER_A,
      createdBy: USER_A,
    },
  });
  const n1 = qaUuid('d', 1);
  const n2 = qaUuid('d', 2);
  const n3 = qaUuid('d', 3);
  await prisma.causeTreeNode.createMany({
    data: [
      {
        id: n1,
        organizationId: ORG_A,
        analysisId: a2,
        type: 'event',
        description: 'Producto fuera de especificación',
        createdBy: USER_A,
      },
      {
        id: n2,
        organizationId: ORG_A,
        analysisId: a2,
        type: 'immediate_cause',
        description: 'Desviación en pasteurización',
        createdBy: USER_A,
      },
      {
        id: n3,
        organizationId: ORG_A,
        analysisId: a2,
        type: 'systemic_cause',
        description: 'Falta de mantenimiento del intercambiador',
        isProposedRootCause: true,
        rootCauseJustification: 'Historial de fallas repetidas',
        createdBy: USER_A,
      },
    ],
  });
  await prisma.causeTreeEdge.createMany({
    data: [
      {
        id: qaUuid('e', 1),
        organizationId: ORG_A,
        analysisId: a2,
        fromNodeId: n2,
        toNodeId: n1,
        relation: 'caused',
        createdBy: USER_A,
      },
      {
        id: qaUuid('e', 2),
        organizationId: ORG_A,
        analysisId: a2,
        fromNodeId: n3,
        toNodeId: n2,
        relation: 'contributed',
        createdBy: USER_A,
      },
    ],
  });
  await hist(a2, 'analysis_created', 'Árbol de causas');

  // 3. Pareto (en desarrollo) con datos.
  const a3 = qaUuid('a', 3);
  await prisma.qualityAnalysis.create({
    data: {
      id: a3,
      organizationId: ORG_A,
      capaId: capa(6),
      type: 'pareto',
      title: 'Pareto: no conformidades por tipo',
      status: 'in_progress',
      startedAt: now,
      responsibleUserId: USER_A,
      config: { cutoff: 80, valueKey: 'count' },
      createdBy: USER_A,
    },
  });
  const paretoData = [
    ['Temperatura', 12],
    ['Etiquetado', 7],
    ['Higiene', 5],
    ['Documentación', 3],
    ['Otros', 1],
  ] as const;
  for (let i = 0; i < paretoData.length; i += 1) {
    await prisma.paretoItem.create({
      data: {
        id: qaUuid('f', 1 + i),
        organizationId: ORG_A,
        analysisId: a3,
        category: paretoData[i]![0],
        count: paretoData[i]![1],
        position: i + 1,
        createdBy: USER_A,
      },
    });
  }
  await hist(a3, 'analysis_created', 'Pareto');

  // 4. AMEF (en desarrollo) con filas y NPR.
  const a4 = qaUuid('a', 4);
  await prisma.qualityAnalysis.create({
    data: {
      id: a4,
      organizationId: ORG_A,
      capaId: capa(5),
      type: 'fmea',
      title: 'AMEF: proceso de pasteurización',
      status: 'in_progress',
      startedAt: now,
      responsibleUserId: USER_A,
      config: { scale: { severityMax: 10, occurrenceMax: 10, detectionMax: 10 } },
      createdBy: USER_A,
    },
  });
  const fmea = [
    ['Pasteurización', 'Temperatura insuficiente', 'Sobrevivencia microbiana', 9, 4, 5, 'high'],
    ['Envasado', 'Sello deficiente', 'Contaminación posterior', 7, 3, 4, 'medium'],
  ] as const;
  for (let i = 0; i < fmea.length; i += 1) {
    const [proc, mode, effect, sev, occ, det, prio] = fmea[i]!;
    await prisma.fmeaRow.create({
      data: {
        id: qaUuid('0', 1 + i),
        organizationId: ORG_A,
        analysisId: a4,
        processStep: proc,
        failureMode: mode,
        effect,
        severity: sev,
        occurrence: occ,
        detection: det,
        npr: sev * occ * det,
        actionPriority: prio,
        position: i + 1,
        createdBy: USER_A,
      },
    });
  }
  await hist(a4, 'analysis_created', 'AMEF');
  await hist(a4, 'fmea_row_created');

  // 5. Recurrencia (en desarrollo) con una coincidencia confirmada.
  const a5 = qaUuid('a', 5);
  await prisma.qualityAnalysis.create({
    data: {
      id: a5,
      organizationId: ORG_A,
      capaId: capa(3),
      type: 'recurrence',
      title: 'Recurrencia: queja de cliente',
      status: 'in_progress',
      startedAt: now,
      responsibleUserId: USER_A,
      createdBy: USER_A,
    },
  });
  await prisma.recurrenceMatch.create({
    data: {
      id: qaUuid('1', 1),
      organizationId: ORG_A,
      analysisId: a5,
      matchedCapaId: capa(1),
      matchReason: 'mismo tipo, mismo sitio',
      confirmation: 'possibly_recurrent',
      justification: 'Ambas en Planta Norte por control de registros',
      confirmedBy: USER_A,
      createdBy: USER_A,
    },
  });
  await hist(a5, 'analysis_created', 'Recurrencia');
  await hist(a5, 'recurrence_confirmed');

  // 6. Comparación de 3 CAPA (en desarrollo).
  const a6 = qaUuid('a', 6);
  await prisma.qualityAnalysis.create({
    data: {
      id: a6,
      organizationId: ORG_A,
      capaId: capa(4),
      type: 'comparative',
      title: 'Comparación de casos de inocuidad',
      status: 'in_progress',
      startedAt: now,
      responsibleUserId: USER_A,
      createdBy: USER_A,
    },
  });
  const compCapas = [capa(3), capa(4), capa(6)];
  for (let i = 0; i < compCapas.length; i += 1) {
    await prisma.comparativeCase.create({
      data: {
        id: qaUuid('2', 1 + i),
        organizationId: ORG_A,
        analysisId: a6,
        capaId: compCapas[i]!,
        position: i + 1,
        createdBy: USER_A,
      },
    });
  }
  await hist(a6, 'analysis_created', 'Comparación');

  // 8. Análisis con CAMBIOS SOLICITADOS (libre).
  const a7 = qaUuid('a', 7);
  await prisma.qualityAnalysis.create({
    data: {
      id: a7,
      organizationId: ORG_A,
      capaId: capa(2),
      type: 'freeform',
      title: 'Análisis libre: desviación de peso',
      status: 'changes_requested',
      startedAt: now,
      responsibleUserId: USER_C,
      reviewerUserId: USER_A,
      createdBy: USER_A,
    },
  });
  await prisma.qualityHypothesis.create({
    data: {
      id: qaUuid('b', 4),
      organizationId: ORG_A,
      analysisId: a7,
      description: 'Calibración de báscula fuera de rango',
      sourceTool: 'freeform',
      status: 'probable',
      probability: 'medium',
      createdBy: USER_A,
    },
  });
  await hist(a7, 'analysis_created', 'Análisis libre');
  await hist(a7, 'changes_requested', 'Falta evidencia de calibración');
}

/** UUID determinista para la demo de proyectos y tareas (TASK-009). */
function ptUuid(kind: '0' | '1' | '2' | '3', n: number): string {
  return `00000000-0000-4000-8000-00000f7${kind}${n.toString(16).padStart(4, '0')}`;
}

/**
 * Datos demo de proyectos y tareas globales (TASK-009). Idempotente (early-return
 * por el primer proyecto). Cubre estados variados, hitos, tareas de proyecto y
 * manual, dependencias, comentarios, una relación a CAPA e historial.
 */
async function seedProjectsAndTasks(): Promise<void> {
  if (await prisma.project.findUnique({ where: { id: ptUuid('0', 1) } })) return;

  const start = new Date('2026-06-01T00:00:00.000Z');
  const past = new Date('2026-07-01T00:00:00.000Z'); // vencida (hoy 2026-08-05)
  const soon = new Date('2026-08-20T00:00:00.000Z');
  const future = new Date('2026-12-31T00:00:00.000Z');

  await prisma.project.createMany({
    skipDuplicates: true,
    data: [
      {
        id: ptUuid('0', 1),
        organizationId: ORG_A,
        siteId: SITE_A,
        folio: 'PRJ-2026-0001',
        name: 'Implementación de mejoras HACCP',
        description: 'Despliegue de controles y verificación en Planta Norte.',
        objective: 'Cerrar brechas del diagnóstico y reforzar inocuidad.',
        projectType: 'implementation',
        status: 'active',
        priority: 'high',
        responsibleUserId: USER_A,
        sponsorUserId: USER_C,
        startDate: start,
        targetDate: future,
        progress: 40,
        origin: 'capa',
        createdBy: USER_A,
      },
      {
        id: ptUuid('0', 2),
        organizationId: ORG_A,
        folio: 'PRJ-2026-0002',
        name: 'Certificación FSSC 22000',
        projectType: 'certification',
        status: 'planned',
        priority: 'normal',
        responsibleUserId: USER_C,
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        targetDate: new Date('2027-03-31T00:00:00.000Z'),
        progress: 0,
        createdBy: USER_A,
      },
      {
        id: ptUuid('0', 3),
        organizationId: ORG_A,
        folio: 'PRJ-2026-0003',
        name: 'Digitalización documental',
        projectType: 'documentation',
        status: 'draft',
        priority: 'low',
        createdBy: USER_A,
      },
      {
        id: ptUuid('0', 4),
        organizationId: ORG_A,
        folio: 'PRJ-2026-0004',
        name: 'Reducción de mermas',
        projectType: 'continuous_improvement',
        status: 'on_hold',
        priority: 'normal',
        responsibleUserId: USER_A,
        startDate: start,
        targetDate: past, // en riesgo/vencido
        progress: 25,
        createdBy: USER_A,
      },
      {
        id: ptUuid('0', 5),
        organizationId: ORG_A,
        folio: 'PRJ-2026-0005',
        name: 'Actualización de infraestructura de frío',
        projectType: 'infrastructure',
        status: 'completed',
        priority: 'high',
        responsibleUserId: USER_C,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        targetDate: new Date('2026-05-31T00:00:00.000Z'),
        closedAt: new Date('2026-05-28T00:00:00.000Z'),
        progress: 100,
        createdBy: USER_A,
      },
    ],
  });

  await prisma.projectMember.createMany({
    skipDuplicates: true,
    data: [
      {
        id: ptUuid('1', 101),
        organizationId: ORG_A,
        projectId: ptUuid('0', 1),
        userId: USER_A,
        role: 'lead',
        addedBy: USER_A,
      },
      {
        id: ptUuid('1', 102),
        organizationId: ORG_A,
        projectId: ptUuid('0', 1),
        userId: USER_C,
        role: 'member',
        addedBy: USER_A,
      },
    ],
  });

  await prisma.projectMilestone.createMany({
    skipDuplicates: true,
    data: [
      {
        id: ptUuid('1', 1),
        organizationId: ORG_A,
        projectId: ptUuid('0', 1),
        name: 'Diagnóstico de brechas',
        status: 'reached',
        targetDate: new Date('2026-06-15T00:00:00.000Z'),
        actualDate: new Date('2026-06-14T00:00:00.000Z'),
        responsibleUserId: USER_A,
        sequence: 1,
        createdBy: USER_A,
      },
      {
        id: ptUuid('1', 2),
        organizationId: ORG_A,
        projectId: ptUuid('0', 1),
        name: 'Plan de acciones aprobado',
        status: 'pending',
        targetDate: soon,
        responsibleUserId: USER_C,
        sequence: 2,
        createdBy: USER_A,
      },
      {
        id: ptUuid('1', 3),
        organizationId: ORG_A,
        projectId: ptUuid('0', 1),
        name: 'Verificación de eficacia',
        status: 'at_risk',
        targetDate: new Date('2026-11-30T00:00:00.000Z'),
        responsibleUserId: USER_A,
        sequence: 3,
        createdBy: USER_A,
      },
    ],
  });

  await prisma.projectRelation.createMany({
    skipDuplicates: true,
    data: [
      {
        id: ptUuid('3', 1),
        organizationId: ORG_A,
        projectId: ptUuid('0', 1),
        relationType: 'capa',
        targetId: capaUuid('0', 1),
        note: 'Proyecto derivado de la CAPA de inocuidad.',
        createdBy: USER_A,
      },
    ],
  });

  // Tareas nativas (del proyecto 1 y una manual independiente).
  await prisma.task.createMany({
    skipDuplicates: true,
    data: [
      {
        id: ptUuid('2', 1),
        organizationId: ORG_A,
        siteId: SITE_A,
        folio: 'TSK-2026-0001',
        title: 'Definir plan de verificación de estaciones',
        taskType: 'project',
        origin: 'project',
        status: 'pending',
        priority: 'high',
        projectId: ptUuid('0', 1),
        milestoneId: ptUuid('1', 2),
        responsibleUserId: USER_A,
        startDate: start,
        targetDate: soon,
        estimatedHours: 8,
        createdBy: USER_A,
      },
      {
        id: ptUuid('2', 2),
        organizationId: ORG_A,
        folio: 'TSK-2026-0002',
        title: 'Actualizar procedimientos de limpieza',
        taskType: 'project',
        origin: 'project',
        status: 'in_progress',
        priority: 'normal',
        projectId: ptUuid('0', 1),
        responsibleUserId: USER_C,
        startDate: start,
        targetDate: future,
        progress: 50,
        estimatedHours: 12,
        createdBy: USER_A,
      },
      {
        id: ptUuid('2', 3),
        organizationId: ORG_A,
        folio: 'TSK-2026-0003',
        title: 'Instalar sensores de temperatura',
        taskType: 'project',
        origin: 'project',
        status: 'blocked',
        priority: 'high',
        projectId: ptUuid('0', 1),
        responsibleUserId: USER_A,
        blockedReason: 'Pendiente de compra de equipo.',
        targetDate: future,
        estimatedHours: 6,
        createdBy: USER_A,
      },
      {
        id: ptUuid('2', 4),
        organizationId: ORG_A,
        folio: 'TSK-2026-0004',
        title: 'Capacitar al personal en el nuevo control',
        taskType: 'project',
        origin: 'project',
        status: 'pending',
        priority: 'urgent',
        projectId: ptUuid('0', 1),
        responsibleUserId: USER_C,
        targetDate: past, // vencida
        estimatedHours: 4,
        createdBy: USER_A,
      },
      {
        id: ptUuid('2', 5),
        organizationId: ORG_A,
        folio: 'TSK-2026-0005',
        title: 'Levantar diagnóstico inicial',
        taskType: 'project',
        origin: 'project',
        status: 'completed',
        priority: 'normal',
        projectId: ptUuid('0', 1),
        responsibleUserId: USER_A,
        startDate: start,
        targetDate: new Date('2026-06-14T00:00:00.000Z'),
        closedAt: new Date('2026-06-14T00:00:00.000Z'),
        progress: 100,
        result: 'Diagnóstico completado y documentado.',
        estimatedHours: 10,
        actualHours: 11,
        createdBy: USER_A,
      },
      {
        id: ptUuid('2', 6),
        organizationId: ORG_A,
        folio: 'TSK-2026-0006',
        title: 'Revisar indicadores de calidad del mes',
        taskType: 'follow_up',
        origin: 'manual',
        status: 'pending',
        priority: 'normal',
        responsibleUserId: USER_A,
        targetDate: soon,
        estimatedHours: 2,
        createdBy: USER_A,
      },
      {
        id: ptUuid('2', 7),
        organizationId: ORG_A,
        folio: 'TSK-2026-0007',
        title: 'Seguimiento a análisis de recurrencia',
        taskType: 'other',
        origin: 'manual',
        status: 'under_review',
        priority: 'normal',
        responsibleUserId: USER_C,
        targetDate: future,
        progress: 80,
        createdBy: USER_A,
      },
    ],
  });

  await prisma.taskAssignment.createMany({
    skipDuplicates: true,
    data: [
      {
        id: ptUuid('3', 20),
        organizationId: ORG_A,
        taskId: ptUuid('2', 2),
        userId: USER_A,
        role: 'participant',
        addedBy: USER_A,
      },
    ],
  });

  // Dependencias finish-to-start: T2 depende de T1; T3 depende de T2.
  await prisma.taskDependency.createMany({
    skipDuplicates: true,
    data: [
      {
        id: ptUuid('3', 30),
        organizationId: ORG_A,
        fromTaskId: ptUuid('2', 1),
        toTaskId: ptUuid('2', 2),
        mandatory: true,
      },
      {
        id: ptUuid('3', 31),
        organizationId: ORG_A,
        fromTaskId: ptUuid('2', 2),
        toTaskId: ptUuid('2', 3),
        mandatory: false,
      },
    ],
  });

  await prisma.taskRelation.createMany({
    skipDuplicates: true,
    data: [
      {
        id: ptUuid('3', 40),
        organizationId: ORG_A,
        taskId: ptUuid('2', 1),
        relationType: 'project',
        targetId: ptUuid('0', 1),
        createdBy: USER_A,
      },
    ],
  });

  await prisma.taskComment.createMany({
    skipDuplicates: true,
    data: [
      {
        id: ptUuid('3', 50),
        organizationId: ORG_A,
        taskId: ptUuid('2', 2),
        author: USER_C,
        body: 'Avance del 50%, falta validar el turno nocturno.',
      },
    ],
  });

  await prisma.taskStatusHistory.createMany({
    skipDuplicates: true,
    data: [
      {
        organizationId: ORG_A,
        taskId: ptUuid('2', 1),
        event: 'task.created',
        toStatus: 'pending',
        actorUserId: USER_A,
      },
      {
        organizationId: ORG_A,
        taskId: ptUuid('2', 5),
        event: 'task.status',
        fromStatus: 'in_progress',
        toStatus: 'completed',
        actorUserId: USER_A,
      },
    ],
  });
  await prisma.projectStatusHistory.createMany({
    skipDuplicates: true,
    data: [
      {
        organizationId: ORG_A,
        projectId: ptUuid('0', 1),
        event: 'project.created',
        toStatus: 'draft',
        actorUserId: USER_A,
      },
      {
        organizationId: ORG_A,
        projectId: ptUuid('0', 1),
        event: 'project.status',
        fromStatus: 'planned',
        toStatus: 'active',
        actorUserId: USER_A,
      },
    ],
  });

  // Contadores de folio para que las creaciones por UI continúen la numeración.
  await prisma.projectFolioCounter.upsert({
    where: { organizationId_year: { organizationId: ORG_A, year: 2026 } },
    create: { organizationId: ORG_A, year: 2026, lastSeq: 5 },
    update: { lastSeq: 5 },
  });
  await prisma.taskFolioCounter.upsert({
    where: { organizationId_year: { organizationId: ORG_A, year: 2026 } },
    create: { organizationId: ORG_A, year: 2026, lastSeq: 7 },
    update: { lastSeq: 7 },
  });
}

/** UUID determinista para la demo de auditorías (TASK-010). */
function auUuid(kind: '0' | '1' | '2' | '3' | '4' | '5', n: number): string {
  return `00000000-0000-4000-8000-00000a0${kind}${n.toString(16).padStart(4, '0')}`;
}

/**
 * Datos demo de auditorías (TASK-010). Idempotente (early-return por el primer
 * programa). Cubre programas, auditorías en varios estados, checklist con
 * snapshot inmutable desde la versión publicada, hallazgos y certificaciones.
 */
async function seedAudits(): Promise<void> {
  if (await prisma.auditProgram.findUnique({ where: { id: auUuid('0', 1) } })) return;

  const past = new Date('2026-07-01T00:00:00.000Z');
  const soon = new Date('2026-08-25T00:00:00.000Z');
  const future = new Date('2026-11-30T00:00:00.000Z');

  await prisma.auditProgram.createMany({
    skipDuplicates: true,
    data: [
      {
        id: auUuid('0', 1),
        organizationId: ORG_A,
        siteId: SITE_A,
        folio: 'PA-2026-0001',
        name: 'Programa anual de auditorías internas 2026',
        objective: 'Verificar el sistema de gestión de inocuidad.',
        year: 2026,
        frequency: 'annual',
        status: 'active',
        responsibleUserId: USER_C,
        createdBy: USER_A,
      },
      {
        id: auUuid('0', 2),
        organizationId: ORG_A,
        folio: 'PA-2026-0002',
        name: 'Programa de preparación FSSC 22000',
        year: 2026,
        frequency: 'custom',
        status: 'completed',
        responsibleUserId: USER_A,
        createdBy: USER_A,
      },
    ],
  });

  // Auditorías en varios estados.
  await prisma.audit.createMany({
    skipDuplicates: true,
    data: [
      {
        id: auUuid('1', 1),
        organizationId: ORG_A,
        folio: 'AUD-2026-0001',
        title: 'Auditoría interna HACCP — Planta Norte',
        auditType: 'internal',
        programId: auUuid('0', 1),
        siteId: SITE_A,
        objective: 'Evaluar controles HACCP.',
        scope: 'Recepción, proceso y almacenamiento.',
        criteria: 'Diagnóstico interno HACCP v1',
        status: 'in_progress',
        priority: 'high',
        plannedDate: soon,
        startedAt: past,
        leadAuditorUserId: USER_A,
        createdBy: USER_A,
      },
      {
        id: auUuid('1', 2),
        organizationId: ORG_A,
        folio: 'AUD-2026-0002',
        title: 'Auditoría de preparación FSSC 22000',
        auditType: 'readiness',
        programId: auUuid('0', 2),
        siteId: SITE_A,
        scope: 'Sistema completo.',
        criteria: 'FSSC 22000 v6',
        status: 'planned',
        priority: 'normal',
        plannedDate: future,
        leadAuditorUserId: USER_C,
        createdBy: USER_A,
      },
      {
        id: auUuid('1', 3),
        organizationId: ORG_A,
        folio: 'AUD-2026-0003',
        title: 'Auditoría de proveedor — Empaques',
        auditType: 'supplier',
        siteId: SITE_A,
        status: 'follow_up',
        priority: 'normal',
        plannedDate: past,
        leadAuditorUserId: USER_A,
        followUpRequired: true,
        createdBy: USER_A,
      },
      {
        id: auUuid('1', 4),
        organizationId: ORG_A,
        folio: 'AUD-2026-0004',
        title: 'Auditoría de proceso — Pasteurización (cerrada)',
        auditType: 'process',
        siteId: SITE_A,
        status: 'closed',
        priority: 'normal',
        plannedDate: new Date('2026-05-01T00:00:00.000Z'),
        endedAt: new Date('2026-05-05T00:00:00.000Z'),
        closedAt: new Date('2026-05-10T00:00:00.000Z'),
        leadAuditorUserId: USER_C,
        createdBy: USER_A,
      },
    ],
  });

  await prisma.auditTeamMember.createMany({
    skipDuplicates: true,
    data: [
      {
        id: auUuid('2', 900),
        organizationId: ORG_A,
        auditId: auUuid('1', 1),
        userId: USER_A,
        role: 'lead',
        addedBy: USER_A,
      },
      {
        id: auUuid('2', 901),
        organizationId: ORG_A,
        auditId: auUuid('1', 1),
        userId: USER_C,
        role: 'auditor',
        addedBy: USER_A,
      },
    ],
  });

  // Checklist con snapshot inmutable para AUD-2026-0001, desde la versión publicada.
  const version = await prisma.templateVersion.findFirst({
    where: { id: PRIV_VER_A },
    select: {
      id: true,
      versionNumber: true,
      frameworkId: true,
      framework: { select: { code: true, name: true } },
    },
  });
  if (version) {
    const requirements = await prisma.templateRequirement.findMany({
      where: { templateVersionId: version.id },
      orderBy: { position: 'asc' },
      include: { section: { select: { code: true, title: true } } },
    });
    const results = ['conforme', 'parcial', 'no_conforme', 'no_evaluado'];
    let i = 0;
    for (const r of requirements) {
      const snapId = auUuid('2', i + 1);
      await prisma.auditRequirementSnapshot.upsert({
        where: { id: snapId },
        create: {
          id: snapId,
          organizationId: ORG_A,
          auditId: auUuid('1', 1),
          frameworkId: version.frameworkId,
          frameworkCode: version.framework.code,
          frameworkName: version.framework.name,
          templateVersionId: version.id,
          versionNumber: version.versionNumber,
          sectionId: r.sectionId,
          sectionCode: r.section.code,
          sectionTitle: r.section.title,
          requirementId: r.id,
          requirementCode: r.code,
          requirementTitle: r.title,
          requirementText: r.description ?? null,
          isCritical: r.isCritical,
          sequence: i + 1,
          capturedBy: USER_A,
        },
        update: {},
      });
      await prisma.auditChecklistItem.upsert({
        where: { auditId_snapshotId: { auditId: auUuid('1', 1), snapshotId: snapId } },
        create: {
          id: auUuid('3', i + 1),
          organizationId: ORG_A,
          auditId: auUuid('1', 1),
          snapshotId: snapId,
          result: results[i % results.length]!,
          foundEvidence: i === 0 ? 'Registro de monitoreo de PCC del turno matutino.' : null,
          updatedBy: USER_A,
        },
        update: {},
      });
      i += 1;
    }
    await prisma.audit.update({
      where: { id: auUuid('1', 1) },
      data: {
        frameworkId: version.frameworkId,
        templateVersionId: version.id,
        normVersionLabel: `${version.framework.code} v${version.versionNumber}`,
      },
    });
  }

  // Hallazgos.
  await prisma.auditFinding.createMany({
    skipDuplicates: true,
    data: [
      {
        id: auUuid('4', 1),
        organizationId: ORG_A,
        folio: 'HAL-2026-0001',
        auditId: auUuid('1', 1),
        siteId: SITE_A,
        title: 'Límites críticos sin evidencia de validación',
        description: 'No se encontró registro de validación de límites críticos del PCC.',
        objectiveEvidence: 'Ausencia de registro en el expediente del PCC-1.',
        requirementBreached: 'R2 · Control de peligros',
        classification: 'major_nc',
        severity: 'high',
        responsibleUserId: USER_A,
        committedDate: future,
        status: 'open',
        detectedAt: past,
        createdBy: USER_A,
      },
      {
        id: auUuid('4', 2),
        organizationId: ORG_A,
        folio: 'HAL-2026-0002',
        auditId: auUuid('1', 1),
        siteId: SITE_A,
        title: 'Higiene del personal: capacitación incompleta',
        classification: 'minor_nc',
        severity: 'medium',
        responsibleUserId: USER_C,
        committedDate: soon,
        status: 'capa_open',
        capaId: capaUuid('0', 2),
        detectedAt: past,
        createdBy: USER_A,
      },
      {
        id: auUuid('4', 3),
        organizationId: ORG_A,
        folio: 'HAL-2026-0003',
        auditId: auUuid('1', 3),
        title: 'Oportunidad de mejora en trazabilidad',
        classification: 'observation',
        severity: 'low',
        status: 'closed',
        closedAt: past,
        createdBy: USER_A,
      },
    ],
  });
  await prisma.auditFindingRelation.createMany({
    skipDuplicates: true,
    data: [
      {
        id: auUuid('5', 800),
        organizationId: ORG_A,
        findingId: auUuid('4', 2),
        relationType: 'capa',
        targetId: capaUuid('0', 2),
        createdBy: USER_A,
      },
    ],
  });
  await prisma.auditFollowUp.createMany({
    skipDuplicates: true,
    data: [
      {
        id: auUuid('5', 810),
        organizationId: ORG_A,
        findingId: auUuid('4', 2),
        status: 'capa_open',
        capaId: capaUuid('0', 2),
        createdBy: USER_A,
      },
    ],
  });

  // Certificaciones (datos demo ficticios).
  await prisma.organizationCertification.createMany({
    skipDuplicates: true,
    data: [
      {
        id: auUuid('5', 1),
        organizationId: ORG_A,
        siteId: SITE_A,
        schemeName: 'FSSC 22000',
        version: '6',
        certifierName: 'Organismo demo',
        status: 'active',
        lastAuditDate: new Date('2026-02-01T00:00:00.000Z'),
        nextAuditDate: future,
        expiryDate: new Date('2027-02-01T00:00:00.000Z'),
        createdBy: USER_A,
      },
      {
        id: auUuid('5', 2),
        organizationId: ORG_A,
        schemeName: 'ISO 9001',
        version: '2015',
        status: 'next_audit',
        nextAuditDate: soon,
        createdBy: USER_A,
      },
    ],
  });

  // Contadores de folio para que la creación por UI continúe.
  await prisma.auditProgramFolioCounter.upsert({
    where: { organizationId_year: { organizationId: ORG_A, year: 2026 } },
    create: { organizationId: ORG_A, year: 2026, lastSeq: 2 },
    update: { lastSeq: 2 },
  });
  await prisma.auditFolioCounter.upsert({
    where: { organizationId_year: { organizationId: ORG_A, year: 2026 } },
    create: { organizationId: ORG_A, year: 2026, lastSeq: 4 },
    update: { lastSeq: 4 },
  });
  await prisma.auditFindingFolioCounter.upsert({
    where: { organizationId_year: { organizationId: ORG_A, year: 2026 } },
    create: { organizationId: ORG_A, year: 2026, lastSeq: 3 },
    update: { lastSeq: 3 },
  });
}

// UUID determinista para eventos de calidad / KPI (familia 'b', hex válido).
function qeUuid(kind: '1' | '2' | '3' | '4' | '5', n: number): string {
  return `00000000-0000-4000-8000-0000000b${kind}${n.toString(16).padStart(3, '0')}`;
}

/**
 * TASK-011 — Siembra eventos de calidad NATIVOS, catálogos, KPI y una regla de
 * alerta, para demostrar KPI/Pareto/tendencias/estadística/calidad sobre datos
 * capturados una sola vez. Idempotente. Los datos de otros módulos NO se copian:
 * la analítica los agrega en vivo.
 */
async function seedEventsAndKpis(): Promise<void> {
  if (await prisma.qualityEvent.findUnique({ where: { id: qeUuid('1', 1) } })) return;

  // Categorías de clasificación.
  await prisma.qualityEventCategory.createMany({
    skipDuplicates: true,
    data: [
      {
        id: qeUuid('2', 1),
        organizationId: ORG_A,
        code: 'CONTAM',
        name: 'Contaminación',
        sortOrder: 1,
        createdBy: USER_A,
      },
      {
        id: qeUuid('2', 2),
        organizationId: ORG_A,
        code: 'EMPAQUE',
        name: 'Empaque',
        sortOrder: 2,
        createdBy: USER_A,
      },
      {
        id: qeUuid('2', 3),
        organizationId: ORG_A,
        code: 'ETIQ',
        name: 'Etiquetado',
        sortOrder: 3,
        createdBy: USER_A,
      },
    ],
  });

  // Catálogos ligeros (para dropdowns).
  await prisma.qualityCatalogValue.createMany({
    skipDuplicates: true,
    data: [
      { id: qeUuid('3', 1), organizationId: ORG_A, kind: 'area', name: 'Producción', sortOrder: 1 },
      { id: qeUuid('3', 2), organizationId: ORG_A, kind: 'area', name: 'Almacén', sortOrder: 2 },
      { id: qeUuid('3', 3), organizationId: ORG_A, kind: 'process', name: 'Llenado', sortOrder: 1 },
      {
        id: qeUuid('3', 4),
        organizationId: ORG_A,
        kind: 'process',
        name: 'Etiquetado',
        sortOrder: 2,
      },
      { id: qeUuid('3', 5), organizationId: ORG_A, kind: 'process', name: 'Sellado', sortOrder: 3 },
      { id: qeUuid('3', 6), organizationId: ORG_A, kind: 'shift', name: 'Matutino', sortOrder: 1 },
      {
        id: qeUuid('3', 7),
        organizationId: ORG_A,
        kind: 'shift',
        name: 'Vespertino',
        sortOrder: 2,
      },
    ],
  });

  // Eventos nativos: distribuidos en el año, con dimensiones y métricas. Uno de
  // ellos referencia una acción CAPA para demostrar la deduplicación en vivo.
  const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
  type EvSeed = {
    n: number;
    title: string;
    type: string;
    date: string;
    sev: string;
    status: string;
    cat?: number;
    area: string;
    process: string;
    machine?: string;
    shift: string;
    qty?: number;
    cost?: number;
    dur?: number;
    units?: number;
    sourceType?: string;
    sourceId?: string;
  };
  const evs: EvSeed[] = [
    {
      n: 1,
      title: 'Material extraño en línea',
      type: 'nonconforming',
      date: '2026-01-12',
      sev: 'high',
      status: 'closed',
      cat: 1,
      area: 'Producción',
      process: 'Llenado',
      machine: 'Llenadora 1',
      shift: 'Matutino',
      qty: 120,
      cost: 4200,
      dur: 3,
      units: 5000,
    },
    {
      n: 2,
      title: 'Sello deficiente',
      type: 'deviation',
      date: '2026-01-20',
      sev: 'medium',
      status: 'closed',
      cat: 2,
      area: 'Producción',
      process: 'Sellado',
      machine: 'Selladora 2',
      shift: 'Vespertino',
      qty: 60,
      cost: 900,
      dur: 1.5,
      units: 5200,
    },
    {
      n: 3,
      title: 'Etiqueta ilegible',
      type: 'nonconforming',
      date: '2026-02-05',
      sev: 'low',
      status: 'in_progress',
      cat: 3,
      area: 'Producción',
      process: 'Etiquetado',
      machine: 'Etiquetadora 1',
      shift: 'Matutino',
      qty: 30,
      cost: 300,
      dur: 1,
      units: 4800,
    },
    {
      n: 4,
      title: 'Contaminación por condensado',
      type: 'incident',
      date: '2026-02-18',
      sev: 'critical',
      status: 'closed',
      cat: 1,
      area: 'Producción',
      process: 'Llenado',
      machine: 'Llenadora 1',
      shift: 'Matutino',
      qty: 200,
      cost: 8100,
      dur: 6,
      units: 5100,
    },
    {
      n: 5,
      title: 'Queja por empaque dañado',
      type: 'complaint',
      date: '2026-03-03',
      sev: 'medium',
      status: 'open',
      cat: 2,
      area: 'Almacén',
      process: 'Sellado',
      shift: 'Vespertino',
      qty: 45,
      cost: 1200,
      dur: 2,
      units: 5300,
    },
    {
      n: 6,
      title: 'Peso fuera de especificación',
      type: 'deviation',
      date: '2026-03-14',
      sev: 'high',
      status: 'in_progress',
      cat: 1,
      area: 'Producción',
      process: 'Llenado',
      machine: 'Llenadora 2',
      shift: 'Vespertino',
      qty: 90,
      cost: 2600,
      dur: 2.5,
      units: 4900,
    },
    {
      n: 7,
      title: 'Etiqueta con lote incorrecto',
      type: 'noncompliance',
      date: '2026-03-27',
      sev: 'high',
      status: 'closed',
      cat: 3,
      area: 'Producción',
      process: 'Etiquetado',
      machine: 'Etiquetadora 1',
      shift: 'Matutino',
      qty: 75,
      cost: 1500,
      dur: 2,
      units: 5000,
    },
    {
      n: 8,
      title: 'Fuga en llenadora',
      type: 'failure',
      date: '2026-04-08',
      sev: 'high',
      status: 'open',
      cat: 1,
      area: 'Producción',
      process: 'Llenado',
      machine: 'Llenadora 1',
      shift: 'Matutino',
      qty: 110,
      cost: 3400,
      dur: 4,
      units: 4700,
    },
    {
      n: 9,
      title: 'Sellado intermitente',
      type: 'deviation',
      date: '2026-04-22',
      sev: 'medium',
      status: 'in_progress',
      cat: 2,
      area: 'Producción',
      process: 'Sellado',
      machine: 'Selladora 2',
      shift: 'Vespertino',
      qty: 50,
      cost: 800,
      dur: 1.5,
      units: 5100,
    },
    {
      n: 10,
      title: 'Observación de mejora en etiquetado',
      type: 'improvement',
      date: '2026-05-06',
      sev: 'low',
      status: 'open',
      cat: 3,
      area: 'Producción',
      process: 'Etiquetado',
      shift: 'Matutino',
      qty: 0,
      cost: 0,
      dur: 0.5,
      units: 5000,
    },
    {
      n: 11,
      title: 'Contaminación cruzada sospechada',
      type: 'incident',
      date: '2026-05-19',
      sev: 'critical',
      status: 'in_progress',
      cat: 1,
      area: 'Producción',
      process: 'Llenado',
      machine: 'Llenadora 2',
      shift: 'Vespertino',
      qty: 160,
      cost: 6200,
      dur: 5,
      units: 4800,
    },
    {
      n: 12,
      title: 'Empaque con folio duplicado (enlazado a CAPA)',
      type: 'nonconforming',
      date: '2026-06-02',
      sev: 'medium',
      status: 'open',
      cat: 2,
      area: 'Almacén',
      process: 'Sellado',
      shift: 'Vespertino',
      qty: 40,
      cost: 700,
      dur: 1,
      units: 5200,
      sourceType: 'capa_action',
      sourceId: capaUuid('1', 3),
    },
  ];

  await prisma.qualityEvent.createMany({
    skipDuplicates: true,
    data: evs.map((e) => ({
      id: qeUuid('1', e.n),
      organizationId: ORG_A,
      siteId: SITE_A,
      folio: `EVT-2026-${String(e.n).padStart(4, '0')}`,
      title: e.title,
      eventType: e.type,
      eventDate: D(e.date),
      severity: e.sev,
      status: e.status,
      categoryId: e.cat ? qeUuid('2', e.cat) : null,
      area: e.area,
      process: e.process,
      machineText: e.machine ?? null,
      shiftText: e.shift,
      quantityAffected: e.qty ?? null,
      cost: e.cost ?? null,
      durationHours: e.dur ?? null,
      unitsProduced: e.units ?? null,
      responsibleUserId: e.n % 2 === 0 ? USER_C : USER_A,
      sourceType: e.sourceType ?? null,
      sourceId: e.sourceId ?? null,
      createdBy: USER_A,
    })),
  });

  await prisma.qualityEventFolioCounter.upsert({
    where: { organizationId_year: { organizationId: ORG_A, year: 2026 } },
    create: { organizationId: ORG_A, year: 2026, lastSeq: evs.length },
    update: { lastSeq: evs.length },
  });

  // Definiciones de KPI (códigos KPI-000n) + contador.
  await prisma.kpiDefinition.createMany({
    skipDuplicates: true,
    data: [
      {
        id: qeUuid('4', 1),
        organizationId: ORG_A,
        code: 'KPI-0001',
        name: 'No conformidades por mes',
        source: 'quality_events',
        measure: 'count',
        period: 'monthly',
        target: 3,
        warningThreshold: 4,
        criticalThreshold: 6,
        desiredDirection: 'lower',
        status: 'active',
        createdBy: USER_A,
      },
      {
        id: qeUuid('4', 2),
        organizationId: ORG_A,
        code: 'KPI-0002',
        name: 'Costo de calidad mensual',
        source: 'quality_events',
        measure: 'sum',
        measureField: 'cost',
        period: 'monthly',
        unit: 'MXN',
        target: 3000,
        warningThreshold: 5000,
        criticalThreshold: 8000,
        desiredDirection: 'lower',
        status: 'active',
        createdBy: USER_A,
      },
      {
        id: qeUuid('4', 3),
        organizationId: ORG_A,
        code: 'KPI-0003',
        name: '% de eventos cerrados',
        source: 'quality_events',
        measure: 'compliance',
        period: 'monthly',
        unit: '%',
        target: 80,
        warningThreshold: 70,
        criticalThreshold: 50,
        desiredDirection: 'higher',
        status: 'active',
        createdBy: USER_A,
      },
    ],
  });
  await prisma.kpiFolioCounter.upsert({
    where: { organizationId: ORG_A },
    create: { organizationId: ORG_A, lastSeq: 3 },
    update: { lastSeq: 3 },
  });

  // Regla de alerta interna: procesos con recurrencia alta.
  await prisma.qualityAlertRule.createMany({
    skipDuplicates: true,
    data: [
      {
        id: qeUuid('5', 1),
        organizationId: ORG_A,
        name: 'Recurrencia por proceso',
        ruleType: 'recurrence',
        severity: 'warning',
        config: { dimension: 'process', minOccurrences: 4 },
        active: true,
        createdBy: USER_A,
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
  await seedQualityAnalysis();
  await seedProjectsAndTasks();
  await seedAudits();
  await seedEventsAndKpis();

  console.log(
    'Seed aplicado/actualizado (idempotente): orgs, usuarios, sitios, maestro + copia privada, 1 diagnóstico, CAPA, análisis, proyectos, tareas, auditorías y eventos/KPI de calidad.',
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
