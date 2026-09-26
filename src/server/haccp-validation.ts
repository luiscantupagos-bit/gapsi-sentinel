/**
 * HACCP-005 — servidor de la VALIDACIÓN de medidas de control. Valida principalmente PCC/PPRO
 * (§2). El status del workflow se deriva del resultado + requisitos (§6/§13). Una validación no
 * satisfactoria / no concluyente queda en «Revisión requerida»; NO cambia la clasificación ni
 * borra el control (§14). Publicado = inmutable. `validation_logical_id` = identidad lógica.
 */
import { randomUUID } from 'node:crypto';
import { getPrisma, withOrgContext } from './db';
import { isVersionEditable } from '@/features/haccp/haccp-state';
import { classificationLabel } from '@/features/haccp/haccp-control';
import { hazardTypeLabel } from '@/features/haccp/haccp-hazards';
import {
  deriveValidationStatus,
  validateSatisfactory,
  validationCompleteness,
  validationMethodLabel,
  validationResultLabel,
  validationStatusLabel,
} from '@/features/haccp/haccp-validation';
import {
  HaccpNotFoundError,
  HaccpValidationError,
  activeVersion,
  memberDirectory,
  requireAdmin,
  requireEditableVersion,
} from './haccp';

/** Clasificaciones que requieren validación (§2): PCC y PPRO. */
const VALIDATABLE = new Set(['pcc', 'ppro']);

export async function getValidations(organizationId: string, planId: string) {
  const version = await activeVersion(organizationId, planId);
  if (!version) return null;
  const [assessments, plans, hazards, validations, steps, names] = await Promise.all([
    getPrisma().haccpControlAssessment.findMany({
      where: { organizationId, planVersionId: version.id },
    }),
    getPrisma().haccpControlPlan.findMany({ where: { organizationId, planVersionId: version.id } }),
    getPrisma().haccpHazard.findMany({ where: { organizationId, planVersionId: version.id } }),
    getPrisma().haccpControlValidation.findMany({
      where: { organizationId, planVersionId: version.id },
    }),
    getPrisma().haccpProcessStep.findMany({
      where: { organizationId, planVersionId: version.id },
      orderBy: { sequence: 'asc' },
    }),
    memberDirectory(organizationId),
  ]);
  const nameOf = (id: string | null | undefined) => (id ? (names.get(id) ?? null) : null);
  const stepNum = new Map(steps.map((s, i) => [s.processStepId, String(i + 1).padStart(2, '0')]));
  const stepName = new Map(steps.map((s) => [s.processStepId, s.name]));
  const hazardOf = new Map(hazards.map((h) => [h.hazardLogicalId, h]));
  const planOf = new Map(plans.map((p) => [p.controlMeasureLogicalId, p]));
  const validationByMeasure = new Map(validations.map((v) => [v.controlMeasureLogicalId, v]));

  // Contexto de cada control validable (PCC/PPRO).
  const controls = assessments
    .filter((a) => VALIDATABLE.has(a.classification))
    .map((a) => {
      const hz = hazardOf.get(a.hazardLogicalId);
      const plan = planOf.get(a.controlMeasureLogicalId) ?? null;
      return {
        controlMeasureLogicalId: a.controlMeasureLogicalId,
        hazardLogicalId: a.hazardLogicalId,
        classification: a.classification,
        classificationLabel: classificationLabel(a.classification),
        hazardName: hz?.name ?? '(peligro eliminado)',
        hazardType: hz?.hazardType ? hazardTypeLabel(hz.hazardType) : null,
        sourceLabel: hz?.processStepId
          ? `${stepNum.get(hz.processStepId) ?? '—'} · ${stepName.get(hz.processStepId) ?? '—'}`
          : 'Materia prima',
        controlMeasure: plan?.controlMeasure ?? null,
        criticalLimit: plan?.criticalLimit ?? null,
        actionCriterion: plan?.actionCriterion ?? null,
      };
    });
  const controlCtx = new Map(controls.map((c) => [c.controlMeasureLogicalId, c]));

  const validationView = validations.map((v) => {
    const ctx = controlCtx.get(v.controlMeasureLogicalId);
    const assessment = assessments.find(
      (a) => a.controlMeasureLogicalId === v.controlMeasureLogicalId,
    );
    // §14/§19: revisión requerida si el resultado no fue satisfactorio o el control desapareció.
    const needsReview =
      v.status === 'needs_review' ||
      v.status === 'unsatisfactory' ||
      v.status === 'expired' ||
      !assessment;
    return {
      id: v.id,
      validationLogicalId: v.validationLogicalId,
      controlMeasureLogicalId: v.controlMeasureLogicalId,
      hazardName: ctx?.hazardName ?? '—',
      classification: ctx?.classification ?? '',
      classificationLabel: ctx ? ctx.classificationLabel : '',
      sourceLabel: ctx?.sourceLabel ?? '—',
      controlMeasure: ctx?.controlMeasure ?? null,
      criticalLimit: ctx?.criticalLimit ?? null,
      actionCriterion: ctx?.actionCriterion ?? null,
      status: v.status,
      statusLabel: validationStatusLabel(v.status),
      result: v.result,
      resultLabel: validationResultLabel(v.result),
      objective: v.objective,
      scope: v.scope,
      methodType: v.methodType,
      methodLabel: validationMethodLabel(v.methodType),
      methodDescription: v.methodDescription,
      evidenceSummary: v.evidenceSummary,
      technicalBasis: v.technicalBasis,
      acceptanceCriteria: v.acceptanceCriteria,
      conclusion: v.conclusion,
      evidenceDocumentId: v.evidenceDocumentId,
      performedAtLabel: v.performedAt ? v.performedAt.toISOString().slice(0, 10) : null,
      performedByName: v.performedByUserId
        ? nameOf(v.performedByUserId)
        : v.performedByExternalName,
      reviewedByName: nameOf(v.reviewedByUserId),
      nextValidationAtLabel: v.nextValidationAt
        ? v.nextValidationAt.toISOString().slice(0, 10)
        : null,
      needsReview,
    };
  });

  const pending = controls.filter((c) => {
    const v = validationByMeasure.get(c.controlMeasureLogicalId);
    return !v || v.status !== 'satisfactory';
  });

  const completeness = validationCompleteness({
    controlsRequiringValidation: controls.length,
    satisfactory: validationView.filter((v) => v.status === 'satisfactory').length,
    pending: pending.length,
    needsReview: validationView.filter((v) => v.needsReview).length,
  });

  return {
    version: {
      id: version.id,
      versionLabel: version.versionLabel,
      status: version.status,
      editable: isVersionEditable(version.status),
    },
    controls,
    validations: validationView,
    pending,
    completeness,
  };
}

export interface ValidationInput {
  controlMeasureLogicalId: string;
  objective?: string | null;
  scope?: string | null;
  methodType?: string | null;
  methodDescription?: string | null;
  evidenceSummary?: string | null;
  technicalBasis?: string | null;
  acceptanceCriteria?: string | null;
  conclusion?: string | null;
  evidenceDocumentId?: string | null;
  evidenceDocumentVersionId?: string | null;
  performedAt?: string | null;
  performedByUserId?: string | null;
  performedByExternalName?: string | null;
  reviewedByUserId?: string | null;
  nextValidationAt?: string | null;
  result?: string | null;
}

const parseDate = (v: string | null | undefined) => (v ? new Date(`${v}T00:00:00.000Z`) : null);

export async function saveValidation(
  organizationId: string,
  userId: string,
  planVersionId: string,
  input: ValidationInput,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  await requireEditableVersion(organizationId, planVersionId);
  const assessment = await getPrisma().haccpControlAssessment.findFirst({
    where: {
      organizationId,
      planVersionId,
      controlMeasureLogicalId: input.controlMeasureLogicalId,
    },
  });
  if (!assessment)
    throw new HaccpValidationError(['La medida de control no existe en esta versión.']);

  const check = {
    objective: input.objective,
    methodType: input.methodType,
    methodDescription: input.methodDescription,
    evidenceSummary: input.evidenceSummary,
    technicalBasis: input.technicalBasis,
    acceptanceCriteria: input.acceptanceCriteria,
    conclusion: input.conclusion,
    performedAt: input.performedAt,
    performedByUserId: input.performedByUserId,
    performedByExternalName: input.performedByExternalName,
  };
  // §13: marcar Satisfactoria exige requisitos mínimos (server-side).
  if (input.result === 'satisfactory') {
    const errors = validateSatisfactory(check);
    if (errors.length) throw new HaccpValidationError(errors);
  }
  const status = deriveValidationStatus(input.result, check);

  await withOrgContext(organizationId, async (tx) => {
    const existing = await tx.haccpControlValidation.findFirst({
      where: {
        organizationId,
        planVersionId,
        controlMeasureLogicalId: input.controlMeasureLogicalId,
      },
    });
    const data = {
      hazardLogicalId: assessment.hazardLogicalId,
      status,
      result: input.result ?? null,
      objective: input.objective ?? null,
      scope: input.scope ?? null,
      methodType: input.methodType ?? null,
      methodDescription: input.methodDescription ?? null,
      evidenceSummary: input.evidenceSummary ?? null,
      technicalBasis: input.technicalBasis ?? null,
      acceptanceCriteria: input.acceptanceCriteria ?? null,
      conclusion: input.conclusion ?? null,
      evidenceDocumentId: input.evidenceDocumentId ?? null,
      evidenceDocumentVersionId: input.evidenceDocumentVersionId ?? null,
      performedAt: parseDate(input.performedAt),
      performedByUserId: input.performedByUserId ?? null,
      performedByExternalName: input.performedByExternalName ?? null,
      reviewedByUserId: input.reviewedByUserId ?? null,
      reviewedAt: input.reviewedByUserId ? new Date() : null,
      nextValidationAt: parseDate(input.nextValidationAt),
    };
    if (existing) await tx.haccpControlValidation.update({ where: { id: existing.id }, data });
    else
      await tx.haccpControlValidation.create({
        data: {
          organizationId,
          planVersionId,
          validationLogicalId: randomUUID(),
          controlMeasureLogicalId: input.controlMeasureLogicalId,
          createdBy: userId,
          ...data,
        },
      });
  });
}

export async function removeValidation(
  organizationId: string,
  userId: string,
  validationId: string,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const v = await getPrisma().haccpControlValidation.findFirst({
    where: { id: validationId, organizationId },
  });
  if (!v) throw new HaccpNotFoundError();
  await requireEditableVersion(organizationId, v.planVersionId);
  await withOrgContext(organizationId, async (tx) => {
    await tx.haccpControlValidation.delete({ where: { id: validationId } });
  });
}
