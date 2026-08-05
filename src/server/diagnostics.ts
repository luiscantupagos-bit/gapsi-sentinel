/**
 * Acceso a datos del diagnóstico con SCOPING por organización (TASK-003).
 *
 * Reglas de seguridad multi-tenant:
 * - La `organizationId` SIEMPRE proviene de la sesión de servidor, nunca del
 *   cliente.
 * - Toda lectura/escritura se filtra por `organizationId`; un recurso de otra
 *   organización se resuelve como "no encontrado".
 * - Las escrituras usan `withOrgContext` (fija `app.current_org` para RLS) como
 *   defensa adicional.
 * - Una pregunta que no pertenece a la versión de plantilla del diagnóstico se
 *   rechaza (no puede asociarse una pregunta de otra plantilla).
 * - Un diagnóstico enviado no admite edición de respuestas.
 */
import { getPrisma, withOrgContext } from './db';
import { assertTransition, type DiagnosticStatus } from '@/features/diagnostics/state';
import {
  computePreview,
  type PreviewAnswer,
  type PreviewQuestion,
  type PreviewResult,
} from '@/features/diagnostics/scoring-preview';

export class DiagnosticNotFoundError extends Error {
  constructor() {
    super('Diagnóstico no encontrado en esta organización.');
    this.name = 'DiagnosticNotFoundError';
  }
}
export class DiagnosticNotEditableError extends Error {
  constructor() {
    super('El diagnóstico ya fue enviado y no admite edición.');
    this.name = 'DiagnosticNotEditableError';
  }
}
export class InvalidAnswerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAnswerError';
  }
}
export class SubmitValidationError extends Error {
  missing: string[];
  constructor(missing: string[]) {
    super('Faltan respuestas obligatorias.');
    this.name = 'SubmitValidationError';
    this.missing = missing;
  }
}

export interface QuestionView {
  id: string;
  code: string;
  prompt: string;
  questionType: string;
  isCritical: boolean;
  isScored: boolean;
  allowsNotApplicable: boolean;
  weight: number;
  requirementCode: string;
  options: { id: string; code: string; label: string }[];
  answer: {
    status: string;
    selectedOptionId: string | null;
    valueText: string | null;
    naJustification: string | null;
  } | null;
}

export interface RequirementView {
  id: string;
  code: string;
  title: string;
  isCritical: boolean;
  questions: QuestionView[];
}

export interface SectionView {
  id: string;
  code: string;
  title: string;
  requirements: RequirementView[];
}

export interface DiagnosticDetail {
  id: string;
  name: string;
  status: DiagnosticStatus;
  organizationName: string;
  siteName: string;
  templateLabel: string;
  editable: boolean;
  submittedAt: Date | null;
  sections: SectionView[];
  progress: { answered: number; total: number; percentage: number };
}

export interface DashboardData {
  organization: { id: string; name: string };
  sites: { id: string; name: string; code: string | null }[];
  diagnosticsCount: number;
  diagnostics: {
    id: string;
    name: string;
    status: DiagnosticStatus;
    siteName: string;
    updatedAt: Date;
    progress: { answered: number; total: number; percentage: number };
  }[];
}

function progressOf(total: number, answered: number) {
  return { answered, total, percentage: total > 0 ? Math.round((answered / total) * 100) : 0 };
}

/** Carga (scoped) un diagnóstico con su plantilla congelada y respuestas, o lanza si no es de la organización. */
async function loadScopedDiagnostic(organizationId: string, diagnosticId: string) {
  const prisma = getPrisma();
  const diagnostic = await prisma.diagnostic.findFirst({
    where: { id: diagnosticId, organizationId, deletedAt: null },
  });
  if (!diagnostic) throw new DiagnosticNotFoundError();
  return diagnostic;
}

export async function getDashboardData(organizationId: string): Promise<DashboardData | null> {
  const prisma = getPrisma();
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!organization) return null;

  const sites = await prisma.site.findMany({
    where: { organizationId, deletedAt: null },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });

  const diagnostics = await prisma.diagnostic.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      status: true,
      updatedAt: true,
      createdAt: true,
      templateVersionId: true,
      site: { select: { name: true } },
    },
  });

  const rows = await Promise.all(
    diagnostics.map(async (d) => {
      const total = await prisma.templateQuestion.count({
        where: { templateVersionId: d.templateVersionId },
      });
      const answered = await prisma.diagnosticAnswer.count({
        where: { diagnosticId: d.id, organizationId, answerStatus: { not: 'pending' } },
      });
      return {
        id: d.id,
        name: d.name,
        status: d.status as DiagnosticStatus,
        siteName: d.site.name,
        updatedAt: d.updatedAt ?? d.createdAt,
        progress: progressOf(total, answered),
      };
    }),
  );

  return {
    organization,
    sites,
    diagnosticsCount: diagnostics.length,
    diagnostics: rows,
  };
}

export async function getDiagnosticDetail(
  organizationId: string,
  diagnosticId: string,
): Promise<DiagnosticDetail> {
  const prisma = getPrisma();
  const diagnostic = await loadScopedDiagnostic(organizationId, diagnosticId);

  const [organization, site, version, sections, answers] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    }),
    prisma.site.findUniqueOrThrow({ where: { id: diagnostic.siteId }, select: { name: true } }),
    prisma.templateVersion.findUniqueOrThrow({
      where: { id: diagnostic.templateVersionId },
      select: { versionNumber: true, framework: { select: { name: true } } },
    }),
    prisma.templateSection.findMany({
      where: { templateVersionId: diagnostic.templateVersionId },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        code: true,
        title: true,
        requirements: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            code: true,
            title: true,
            isCritical: true,
            questions: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                code: true,
                prompt: true,
                questionType: true,
                isCritical: true,
                isScored: true,
                allowsNotApplicable: true,
                weight: true,
                options: {
                  orderBy: { position: 'asc' },
                  select: { id: true, code: true, label: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.diagnosticAnswer.findMany({ where: { diagnosticId, organizationId } }),
  ]);

  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));

  let total = 0;
  let answered = 0;
  const sectionViews: SectionView[] = sections.map((s) => ({
    id: s.id,
    code: s.code,
    title: s.title,
    requirements: s.requirements.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      isCritical: r.isCritical,
      questions: r.questions.map((q) => {
        total += 1;
        const a = answerByQuestion.get(q.id) ?? null;
        if (a && a.answerStatus !== 'pending') answered += 1;
        return {
          id: q.id,
          code: q.code,
          prompt: q.prompt,
          questionType: q.questionType,
          isCritical: q.isCritical,
          isScored: q.isScored,
          allowsNotApplicable: q.allowsNotApplicable,
          weight: Number(q.weight),
          requirementCode: r.code,
          options: q.options,
          answer: a
            ? {
                status: a.answerStatus,
                selectedOptionId: a.selectedOptionId,
                valueText: a.valueText,
                naJustification: a.naJustification,
              }
            : null,
        };
      }),
    })),
  }));

  const status = diagnostic.status as DiagnosticStatus;
  return {
    id: diagnostic.id,
    name: diagnostic.name,
    status,
    organizationName: organization.name,
    siteName: site.name,
    templateLabel: `${version.framework.name} · v${version.versionNumber}`,
    editable: status === 'draft' || status === 'in_progress',
    submittedAt: diagnostic.submittedAt,
    sections: sectionViews,
    progress: progressOf(total, answered),
  };
}

export interface AnswerInput {
  questionId: string;
  status: 'answered' | 'not_applicable' | 'pending';
  selectedOptionId?: string | null;
  valueText?: string | null;
  naJustification?: string | null;
}

/** Índice de las preguntas (y sus opciones) de la versión del diagnóstico. */
async function loadQuestionIndex(templateVersionId: string) {
  const prisma = getPrisma();
  const questions = await prisma.templateQuestion.findMany({
    where: { templateVersionId },
    select: {
      id: true,
      questionType: true,
      allowsNotApplicable: true,
      options: { select: { id: true } },
    },
  });
  return new Map(
    questions.map((q) => [
      q.id,
      {
        questionType: q.questionType,
        allowsNotApplicable: q.allowsNotApplicable,
        optionIds: new Set(q.options.map((o) => o.id)),
      },
    ]),
  );
}

/**
 * Guarda respuestas de forma idempotente (upsert por diagnóstico+pregunta).
 * Valida en servidor, rechaza preguntas ajenas a la plantilla y bloquea la
 * edición tras el envío. Si el diagnóstico está en `draft`, lo pasa a
 * `in_progress` (registrando el historial).
 */
export async function saveAnswers(
  organizationId: string,
  userId: string,
  diagnosticId: string,
  inputs: AnswerInput[],
): Promise<void> {
  const diagnostic = await loadScopedDiagnostic(organizationId, diagnosticId);
  const status = diagnostic.status as DiagnosticStatus;
  if (status !== 'draft' && status !== 'in_progress') {
    throw new DiagnosticNotEditableError();
  }

  const index = await loadQuestionIndex(diagnostic.templateVersionId);

  // Validación en servidor (antes de escribir).
  for (const input of inputs) {
    const q = index.get(input.questionId);
    if (!q) {
      throw new InvalidAnswerError('La pregunta no pertenece a la plantilla del diagnóstico.');
    }
    if (input.status === 'not_applicable') {
      if (!q.allowsNotApplicable) {
        throw new InvalidAnswerError('Esta pregunta no admite "No aplica".');
      }
      if (!input.naJustification || input.naJustification.trim() === '') {
        throw new InvalidAnswerError('"No aplica" requiere una justificación.');
      }
    } else if (input.status === 'answered') {
      if (q.questionType === 'text') {
        // texto: valueText opcional; sin opción.
      } else {
        if (!input.selectedOptionId || !q.optionIds.has(input.selectedOptionId)) {
          throw new InvalidAnswerError('Opción de respuesta inválida para la pregunta.');
        }
      }
    }
  }

  await withOrgContext(organizationId, async (tx) => {
    if (status === 'draft') {
      assertTransition('draft', 'in_progress');
      await tx.diagnostic.update({
        where: { id: diagnosticId },
        data: { status: 'in_progress' },
      });
      await tx.diagnosticStateHistory.create({
        data: {
          organizationId,
          diagnosticId,
          fromStatus: 'draft',
          toStatus: 'in_progress',
          changedBy: userId,
          note: 'Inicio de captura.',
        },
      });
    }

    for (const input of inputs) {
      const isNa = input.status === 'not_applicable';
      const isText =
        input.status === 'answered' && index.get(input.questionId)!.questionType === 'text';
      const data = {
        answerStatus: input.status,
        selectedOptionId: isNa || isText ? null : (input.selectedOptionId ?? null),
        valueText: isText ? (input.valueText ?? null) : null,
        naJustification: isNa ? (input.naJustification ?? null) : null,
        answeredBy: userId,
        answeredAt: new Date(),
      };
      await tx.diagnosticAnswer.upsert({
        where: { diagnosticId_questionId: { diagnosticId, questionId: input.questionId } },
        create: { organizationId, diagnosticId, questionId: input.questionId, ...data },
        update: data,
      });
    }
  });
}

/**
 * Envía el diagnóstico: valida completitud, cambia `in_progress → submitted`,
 * registra historial, usuario y fecha. Tras el envío no se pueden editar
 * respuestas.
 */
export async function submitDiagnostic(
  organizationId: string,
  userId: string,
  diagnosticId: string,
): Promise<void> {
  const diagnostic = await loadScopedDiagnostic(organizationId, diagnosticId);
  const status = diagnostic.status as DiagnosticStatus;
  if (status === 'submitted' || status === 'reviewed' || status === 'archived') {
    throw new DiagnosticNotEditableError();
  }

  const prisma = getPrisma();
  const questions = await prisma.templateQuestion.findMany({
    where: { templateVersionId: diagnostic.templateVersionId },
    select: { id: true, code: true },
  });
  const answers = await prisma.diagnosticAnswer.findMany({
    where: { diagnosticId, organizationId },
    select: { questionId: true, answerStatus: true },
  });
  const answeredSet = new Set(
    answers.filter((a) => a.answerStatus !== 'pending').map((a) => a.questionId),
  );
  const missing = questions.filter((q) => !answeredSet.has(q.id)).map((q) => q.code);
  if (missing.length > 0) {
    throw new SubmitValidationError(missing);
  }

  assertTransition(status, 'submitted');
  await withOrgContext(organizationId, async (tx) => {
    await tx.diagnostic.update({
      where: { id: diagnosticId },
      data: { status: 'submitted', submittedBy: userId, submittedAt: new Date() },
    });
    await tx.diagnosticStateHistory.create({
      data: {
        organizationId,
        diagnosticId,
        fromStatus: status,
        toStatus: 'submitted',
        changedBy: userId,
        note: 'Envío del diagnóstico.',
      },
    });
  });
}

export interface PreviewResultWithMeta extends PreviewResult {
  diagnosticName: string;
  status: DiagnosticStatus;
  sectionTitles: Record<string, string>;
}

/**
 * Calcula el resultado PRELIMINAR de demostración al consultar (no se persiste).
 * Determinista; usa el módulo de dominio provisional `computePreview`.
 */
export async function getPreviewResult(
  organizationId: string,
  diagnosticId: string,
): Promise<PreviewResultWithMeta> {
  const detail = await getDiagnosticDetail(organizationId, diagnosticId);

  const questions: PreviewQuestion[] = [];
  const answers: PreviewAnswer[] = [];
  const prisma = getPrisma();

  // Fracción de la opción elegida por respuesta (para scoring).
  const optionScores = new Map<string, number>();
  const opts = await prisma.templateAnswerOption.findMany({
    where: { organizationId },
    select: { id: true, scoreFraction: true },
  });
  for (const o of opts) optionScores.set(o.id, Number(o.scoreFraction));

  const sectionTitles: Record<string, string> = {};
  for (const s of detail.sections) {
    sectionTitles[s.code] = s.title;
    for (const r of s.requirements) {
      for (const q of r.questions) {
        questions.push({
          questionId: q.id,
          code: q.code,
          sectionId: s.id,
          sectionCode: s.code,
          sectionTitle: s.title,
          requirementCode: r.code,
          isCritical: q.isCritical,
          isScored: q.isScored,
          weight: q.weight,
        });
        if (q.answer) {
          answers.push({
            questionId: q.id,
            status: q.answer.status as PreviewAnswer['status'],
            scoreFraction: q.answer.selectedOptionId
              ? (optionScores.get(q.answer.selectedOptionId) ?? null)
              : null,
          });
        }
      }
    }
  }

  const result = computePreview(questions, answers);
  return {
    ...result,
    diagnosticName: detail.name,
    status: detail.status,
    sectionTitles,
  };
}
