/**
 * HACCP-004 — servidor de selección de medidas de control. Clasifica peligros SIGNIFICATIVOS
 * (PPR/PPRO/PCC) mediante el árbol de decisión (resolver centralizado), guardando el camino de
 * respuestas + la metodología como snapshot. Un peligro que deja de ser significativo o cuyo
 * flujo cambió marca su evaluación como «Revisión requerida» (no se borra). Publicado = inmutable.
 */
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';
import { isVersionEditable } from '@/features/haccp/haccp-state';
import {
  DEFAULT_DECISION_TREE,
  resolveClassification,
  isControlPlanComplete,
  controlMeasureCompleteness,
  classificationLabel,
  type AnswerRecord,
  type HaccpClassification,
} from '@/features/haccp/haccp-control';
import {
  HaccpNotFoundError,
  HaccpValidationError,
  activeVersion,
  requireAdmin,
  requireEditableVersion,
} from './haccp';

const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;
const TREE = DEFAULT_DECISION_TREE;

/** Análisis de medidas de control de la versión activa. */
export async function getControlMeasures(organizationId: string, planId: string) {
  const version = await activeVersion(organizationId, planId);
  if (!version) return null;
  const [hazards, steps, materials, assessments, plans] = await Promise.all([
    getPrisma().haccpHazard.findMany({ where: { organizationId, planVersionId: version.id } }),
    getPrisma().haccpProcessStep.findMany({
      where: { organizationId, planVersionId: version.id },
      orderBy: { sequence: 'asc' },
    }),
    getPrisma().haccpSourceReference.findMany({
      where: { organizationId, planVersionId: version.id, referenceKind: 'material' },
    }),
    getPrisma().haccpControlAssessment.findMany({
      where: { organizationId, planVersionId: version.id },
    }),
    getPrisma().haccpControlPlan.findMany({
      where: { organizationId, planVersionId: version.id },
    }),
  ]);

  const stepNum = new Map(steps.map((s, i) => [s.processStepId, String(i + 1).padStart(2, '0')]));
  const stepName = new Map(steps.map((s) => [s.processStepId, s.name]));
  const matLabel = new Map(
    materials.map((m) => [m.id, `${m.sourceCodeSnapshot ?? ''} · ${m.sourceTitleSnapshot ?? ''}`]),
  );
  const sourceLabel = (h: (typeof hazards)[number]) =>
    h.sourceType === 'process_step'
      ? `${stepNum.get(h.processStepId ?? '') ?? '—'} · ${stepName.get(h.processStepId ?? '') ?? '—'}`
      : (matLabel.get(h.sourceReferenceId ?? '') ?? 'Materia prima');

  const planByMeasure = new Map(plans.map((p) => [p.controlMeasureLogicalId, p]));
  const assessmentByHazard = new Map(assessments.map((a) => [a.hazardLogicalId, a]));
  const significant = hazards.filter((h) => h.isSignificant);

  // Pendientes: peligros significativos sin evaluación (§17/§29).
  const pending = significant
    .filter((h) => !assessmentByHazard.has(h.hazardLogicalId))
    .map((h) => ({
      hazardLogicalId: h.hazardLogicalId,
      name: h.name,
      hazardType: h.hazardType,
      riskScore: h.riskScore,
      sourceLabel: sourceLabel(h),
      existingControlMeasure: h.existingControlMeasure,
    }));

  const qText = new Map(TREE.questions.map((q) => [q.id, q.text]));
  const assessmentView = assessments.map((a) => {
    const hazard = hazards.find((h) => h.hazardLogicalId === a.hazardLogicalId);
    const plan = planByMeasure.get(a.controlMeasureLogicalId) ?? null;
    // §27/§28: revisión requerida si el peligro ya no es significativo o desapareció.
    const needsReview = !hazard || !hazard.isSignificant;
    const path = (a.answers as unknown as AnswerRecord[]).map((r) => ({
      questionId: r.questionId,
      questionText: qText.get(r.questionId) ?? r.questionId,
      answer: r.answer,
    }));
    return {
      id: a.id,
      controlMeasureLogicalId: a.controlMeasureLogicalId,
      hazardLogicalId: a.hazardLogicalId,
      hazardName: hazard?.name ?? '(peligro eliminado)',
      hazardType: hazard?.hazardType ?? null,
      sourceLabel: hazard ? sourceLabel(hazard) : '—',
      classification: a.classification,
      classificationLabel: classificationLabel(a.classification),
      classificationSource: a.classificationSource,
      justification: a.justification,
      path,
      needsReview,
      plan: plan
        ? {
            id: plan.id,
            controlMeasure: plan.controlMeasure,
            criticalLimit: plan.criticalLimit,
            actionCriterion: plan.actionCriterion,
            monitoringWhat: plan.monitoringWhat,
            monitoringHow: plan.monitoringHow,
            monitoringWho: plan.monitoringWho,
            monitoringWhen: plan.monitoringWhen,
            correction: plan.correction,
            correctiveAction: plan.correctiveAction,
            recordReference: plan.recordReference,
          }
        : null,
      planComplete: isControlPlanComplete(a.classification, plan),
    };
  });

  const byClass = (c: HaccpClassification) => assessmentView.filter((a) => a.classification === c);
  const completeness = controlMeasureCompleteness({
    significantHazards: significant.length,
    evaluated: assessments.length,
    pcc: byClass('pcc').length,
    ppro: byClass('ppro').length,
    ppr: byClass('ppr').length,
    incompletePlans: assessmentView.filter((a) => !a.planComplete).length,
  });

  return {
    version: {
      id: version.id,
      versionLabel: version.versionLabel,
      status: version.status,
      editable: isVersionEditable(version.status),
    },
    tree: TREE,
    pending,
    assessments: assessmentView,
    pcc: byClass('pcc'),
    ppro: byClass('ppro'),
    ppr: byClass('ppr'),
    completeness,
  };
}

/** Guarda/actualiza la evaluación (clasificación) de un peligro. Override con justificación. */
export async function saveAssessment(
  organizationId: string,
  userId: string,
  planVersionId: string,
  input: {
    hazardLogicalId: string;
    answers: AnswerRecord[];
    overrideClassification?: HaccpClassification | null;
    overrideReason?: string | null;
    justification?: string | null;
  },
): Promise<void> {
  await requireAdmin(organizationId, userId);
  await requireEditableVersion(organizationId, planVersionId);
  const hazard = await getPrisma().haccpHazard.findFirst({
    where: { organizationId, planVersionId, hazardLogicalId: input.hazardLogicalId },
  });
  if (!hazard) throw new HaccpValidationError(['El peligro no existe en esta versión.']);
  const resolved = resolveClassification(TREE, input.answers);
  const override = input.overrideClassification ?? null;
  if (override && !input.overrideReason?.trim())
    throw new HaccpValidationError(['El override de clasificación requiere justificación.']);
  const classification = override ?? resolved.classification;
  if (!classification)
    throw new HaccpValidationError([
      'El árbol de decisión no está completo; responde todas las preguntas.',
    ]);
  const classificationSource = override ? 'override' : 'calculated';

  await withOrgContext(organizationId, async (tx) => {
    const existing = await tx.haccpControlAssessment.findFirst({
      where: { organizationId, planVersionId, hazardLogicalId: input.hazardLogicalId },
    });
    const data = {
      methodKey: TREE.key,
      methodVersion: TREE.version,
      classification,
      classificationSource,
      justification: input.justification ?? null,
      overrideReason: input.overrideReason ?? null,
      answers: asJson(resolved.path),
      status: 'complete',
    };
    if (existing) await tx.haccpControlAssessment.update({ where: { id: existing.id }, data });
    else
      await tx.haccpControlAssessment.create({
        data: {
          organizationId,
          planVersionId,
          controlMeasureLogicalId: randomUUID(),
          hazardLogicalId: input.hazardLogicalId,
          createdBy: userId,
          ...data,
        },
      });
  });
}

export async function removeAssessment(
  organizationId: string,
  userId: string,
  assessmentId: string,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const a = await getPrisma().haccpControlAssessment.findFirst({
    where: { id: assessmentId, organizationId },
  });
  if (!a) throw new HaccpNotFoundError();
  await requireEditableVersion(organizationId, a.planVersionId);
  await withOrgContext(organizationId, async (tx) => {
    await tx.haccpControlPlan.deleteMany({
      where: {
        organizationId,
        planVersionId: a.planVersionId,
        controlMeasureLogicalId: a.controlMeasureLogicalId,
      },
    });
    await tx.haccpControlAssessment.delete({ where: { id: assessmentId } });
  });
}

export interface ControlPlanInput {
  controlMeasure?: string | null;
  justification?: string | null;
  criticalLimit?: string | null;
  actionCriterion?: string | null;
  monitoringWhat?: string | null;
  monitoringHow?: string | null;
  monitoringWho?: string | null;
  monitoringWhen?: string | null;
  correction?: string | null;
  correctiveAction?: string | null;
  recordReference?: string | null;
}

/** Guarda/actualiza el plan de control de una evaluación (por su identidad lógica). */
export async function saveControlPlan(
  organizationId: string,
  userId: string,
  assessmentId: string,
  input: ControlPlanInput,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const a = await getPrisma().haccpControlAssessment.findFirst({
    where: { id: assessmentId, organizationId },
  });
  if (!a) throw new HaccpNotFoundError();
  await requireEditableVersion(organizationId, a.planVersionId);
  const hazard = await getPrisma().haccpHazard.findFirst({
    where: { organizationId, planVersionId: a.planVersionId, hazardLogicalId: a.hazardLogicalId },
  });
  await withOrgContext(organizationId, async (tx) => {
    const existing = await tx.haccpControlPlan.findFirst({
      where: {
        organizationId,
        planVersionId: a.planVersionId,
        controlMeasureLogicalId: a.controlMeasureLogicalId,
      },
    });
    const data = {
      classification: a.classification,
      processStepId: hazard?.processStepId ?? null,
      sourceReferenceId: hazard?.sourceReferenceId ?? null,
      controlMeasure: input.controlMeasure ?? null,
      justification: input.justification ?? null,
      criticalLimit: input.criticalLimit ?? null,
      actionCriterion: input.actionCriterion ?? null,
      monitoringWhat: input.monitoringWhat ?? null,
      monitoringHow: input.monitoringHow ?? null,
      monitoringWho: input.monitoringWho ?? null,
      monitoringWhen: input.monitoringWhen ?? null,
      correction: input.correction ?? null,
      correctiveAction: input.correctiveAction ?? null,
      recordReference: input.recordReference ?? null,
    };
    if (existing) await tx.haccpControlPlan.update({ where: { id: existing.id }, data });
    else
      await tx.haccpControlPlan.create({
        data: {
          organizationId,
          planVersionId: a.planVersionId,
          controlMeasureLogicalId: a.controlMeasureLogicalId,
          hazardLogicalId: a.hazardLogicalId,
          createdBy: userId,
          ...data,
        },
      });
  });
}
