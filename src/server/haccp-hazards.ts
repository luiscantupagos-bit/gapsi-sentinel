/**
 * HACCP-003 — servidor del análisis de peligros. Peligros sobre MATERIAS PRIMAS
 * (haccp_source_references kind=material) y ETAPAS del proceso (process_step_id), con score y
 * significancia CALCULADOS server-side desde la matriz de riesgo de la versión (snapshot).
 * `hazard_logical_id` = identidad LÓGICA estable entre versiones. Publicado = inmutable.
 */
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';

/** Las escalas se guardan como JSON; Prisma exige `InputJsonValue`. */
const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;
import { isVersionEditable } from '@/features/haccp/haccp-state';
import { flowChanged, type FlowSnapshot } from '@/features/haccp/haccp-flow';
import {
  DEFAULT_RISK_MATRIX,
  computeRiskScore,
  resolveSignificance,
  validateMatrixConfig,
  hazardAnalysisCompleteness,
  type RiskMatrixConfig,
} from '@/features/haccp/haccp-hazards';
import {
  HaccpNotFoundError,
  HaccpValidationError,
  activeVersion,
  requireAdmin,
  requireEditableVersion,
  type Tx,
} from './haccp';

function asMatrix(row: {
  probabilityScale: unknown;
  severityScale: unknown;
  scoreFormula: string;
  significanceThreshold: number;
}): RiskMatrixConfig {
  return {
    probabilityScale: row.probabilityScale as RiskMatrixConfig['probabilityScale'],
    severityScale: row.severityScale as RiskMatrixConfig['severityScale'],
    scoreFormula: row.scoreFormula,
    significanceThreshold: row.significanceThreshold,
  };
}

/** Config de matriz de la versión, o la de por defecto (para display si aún no hay). */
async function versionMatrix(
  organizationId: string,
  planVersionId: string,
): Promise<RiskMatrixConfig> {
  const row = await getPrisma().haccpRiskMatrixConfig.findFirst({
    where: { organizationId, planVersionId },
  });
  return row ? asMatrix(row) : DEFAULT_RISK_MATRIX;
}

/** Garantiza una config de matriz para la versión (crea la por defecto si no existe). */
async function ensureMatrix(
  tx: Tx,
  organizationId: string,
  planVersionId: string,
): Promise<RiskMatrixConfig> {
  const existing = await tx.haccpRiskMatrixConfig.findFirst({
    where: { organizationId, planVersionId },
  });
  if (existing) return asMatrix(existing);
  const created = await tx.haccpRiskMatrixConfig.create({
    data: {
      organizationId,
      planVersionId,
      probabilityScale: asJson(DEFAULT_RISK_MATRIX.probabilityScale),
      severityScale: asJson(DEFAULT_RISK_MATRIX.severityScale),
      scoreFormula: DEFAULT_RISK_MATRIX.scoreFormula,
      significanceThreshold: DEFAULT_RISK_MATRIX.significanceThreshold,
    },
  });
  return asMatrix(created);
}

async function flowSnapshotOf(
  organizationId: string,
  planVersionId: string,
): Promise<FlowSnapshot> {
  const [steps, connections] = await Promise.all([
    getPrisma().haccpProcessStep.findMany({ where: { organizationId, planVersionId } }),
    getPrisma().haccpProcessConnection.findMany({ where: { organizationId, planVersionId } }),
  ]);
  return {
    steps: steps.map((s) => ({
      processStepId: s.processStepId,
      name: s.name,
      stepType: s.stepType,
      sequence: s.sequence,
    })),
    connections: connections.map((c) => ({
      fromStepId: c.fromStepId,
      toStepId: c.toStepId,
      connectionType: c.connectionType,
    })),
  };
}

/** Análisis de peligros de la versión activa: matriz + peligros por MP y por etapa. */
export async function getHazardAnalysis(organizationId: string, planId: string) {
  const version = await activeVersion(organizationId, planId);
  if (!version) return null;
  const [materials, steps, hazards, matrix, processInputs] = await Promise.all([
    getPrisma().haccpSourceReference.findMany({
      where: { organizationId, planVersionId: version.id, referenceKind: 'material' },
      orderBy: { sortOrder: 'asc' },
    }),
    getPrisma().haccpProcessStep.findMany({
      where: { organizationId, planVersionId: version.id },
      orderBy: { sequence: 'asc' },
    }),
    getPrisma().haccpHazard.findMany({
      where: { organizationId, planVersionId: version.id },
      orderBy: { createdAt: 'asc' },
    }),
    versionMatrix(organizationId, version.id),
    // HACCP-PROCESS-EXPANSION §O: entradas por etapa para el análisis de peligros.
    getPrisma().haccpProcessInput.findMany({
      where: { organizationId, planVersionId: version.id },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  // §33 — aviso de cambio de flujo: si hay draft y una versión publicada, compara sus flujos.
  let flowChangedWarning = false;
  if (isVersionEditable(version.status)) {
    const published = await getPrisma().haccpPlanVersion.findFirst({
      where: { organizationId, planId, isCurrent: true, status: 'published' },
    });
    if (published && published.id !== version.id) {
      const [a, b] = await Promise.all([
        flowSnapshotOf(organizationId, version.id),
        flowSnapshotOf(organizationId, published.id),
      ]);
      flowChangedWarning = flowChanged(a, b);
    }
  }

  const hazardView = (h: (typeof hazards)[number]) => ({
    id: h.id,
    hazardLogicalId: h.hazardLogicalId,
    sourceType: h.sourceType,
    sourceReferenceId: h.sourceReferenceId,
    processStepId: h.processStepId,
    contextType: h.contextType,
    inputLogicalId: h.inputLogicalId,
    outputLogicalId: h.outputLogicalId,
    hazardType: h.hazardType,
    name: h.name,
    description: h.description,
    originOrCause: h.originOrCause,
    probability: h.probability,
    severity: h.severity,
    riskScore: h.riskScore,
    isSignificant: h.isSignificant,
    significanceSource: h.significanceSource,
    significanceReason: h.significanceReason,
    existingControlMeasure: h.existingControlMeasure,
  });

  const materialGroups = materials.map((m) => {
    const list = hazards.filter((h) => h.sourceReferenceId === m.id).map(hazardView);
    return {
      sourceReferenceId: m.id,
      sourceDocumentId: m.sourceDocumentId,
      code: m.sourceCodeSnapshot,
      title: m.sourceTitleSnapshot,
      versionLabel: m.sourceVersionLabelSnapshot,
      hazards: list,
      significantCount: list.filter((h) => h.isSignificant).length,
    };
  });
  const stepGroups = steps.map((s, i) => {
    const list = hazards.filter((h) => h.processStepId === s.processStepId).map(hazardView);
    // §O: entradas de la etapa con sus peligros (contexto input) y las de etapa.
    const stepInputs = processInputs
      .filter((inp) => inp.processStepId === s.processStepId)
      .map((inp) => {
        const inputHazards = list.filter(
          (h) => h.contextType === 'input' && h.inputLogicalId === inp.inputLogicalId,
        );
        return {
          inputLogicalId: inp.inputLogicalId,
          name: inp.name,
          inputType: inp.inputType,
          hazards: inputHazards,
        };
      });
    return {
      processStepId: s.processStepId,
      number: String(i + 1).padStart(2, '0'),
      name: s.name,
      stepType: s.stepType,
      inputs: stepInputs,
      // Peligros generados/intensificados en la ETAPA (contexto step o sin contexto de entrada).
      stepHazards: list.filter((h) => h.contextType !== 'input'),
      hazards: list,
      significantCount: list.filter((h) => h.isSignificant).length,
    };
  });

  const significantWithoutControl = hazards.filter(
    (h) => h.isSignificant && !h.existingControlMeasure?.trim(),
  ).length;

  return {
    version: {
      id: version.id,
      versionLabel: version.versionLabel,
      status: version.status,
      editable: isVersionEditable(version.status),
    },
    matrix,
    materialGroups,
    stepGroups,
    flowChangedWarning,
    completeness: hazardAnalysisCompleteness({
      totalMaterials: materials.length,
      materialsWithHazards: materialGroups.filter((g) => g.hazards.length > 0).length,
      totalSteps: steps.length,
      stepsWithHazards: stepGroups.filter((g) => g.hazards.length > 0).length,
      significantWithoutControl,
    }),
    totals: {
      hazards: hazards.length,
      significant: hazards.filter((h) => h.isSignificant).length,
    },
  };
}

export async function saveRiskMatrix(
  organizationId: string,
  userId: string,
  planVersionId: string,
  config: RiskMatrixConfig,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  await requireEditableVersion(organizationId, planVersionId);
  const errors = validateMatrixConfig(config);
  if (errors.length) throw new HaccpValidationError(errors);
  await withOrgContext(organizationId, async (tx) => {
    const existing = await tx.haccpRiskMatrixConfig.findFirst({
      where: { organizationId, planVersionId },
    });
    const data = {
      probabilityScale: asJson(config.probabilityScale),
      severityScale: asJson(config.severityScale),
      scoreFormula: config.scoreFormula,
      significanceThreshold: config.significanceThreshold,
    };
    if (existing) await tx.haccpRiskMatrixConfig.update({ where: { id: existing.id }, data });
    else
      await tx.haccpRiskMatrixConfig.create({ data: { organizationId, planVersionId, ...data } });
    // Recalcula score/significancia de los peligros existentes con la nueva matriz.
    const hazards = await tx.haccpHazard.findMany({ where: { organizationId, planVersionId } });
    for (const h of hazards) {
      if (h.significanceSource === 'override') continue; // respeta el override manual
      const score = computeRiskScore(h.probability, h.severity, config.scoreFormula);
      await tx.haccpHazard.update({
        where: { id: h.id },
        data: {
          riskScore: score,
          isSignificant: resolveSignificance(score, config.significanceThreshold),
        },
      });
    }
  });
}

export interface HazardInput {
  sourceType: 'material' | 'process_step';
  sourceReferenceId?: string | null;
  processStepId?: string | null;
  /** HACCP-PROCESS-EXPANSION §M: contexto del peligro en la etapa (step|input|output). */
  contextType?: 'step' | 'input' | 'output' | null;
  /** Identidad lógica de la entrada cuando contextType='input'. */
  inputLogicalId?: string | null;
  /** Identidad lógica de la salida cuando contextType='output'. */
  outputLogicalId?: string | null;
  hazardType: string;
  name: string;
  description?: string | null;
  originOrCause?: string | null;
  probability: number;
  severity: number;
  existingControlMeasure?: string | null;
  /** Override manual de significancia (§21): requiere justificación. */
  overrideSignificant?: boolean | null;
  significanceReason?: string | null;
}

async function computeHazardRisk(
  matrix: RiskMatrixConfig,
  input: { probability: number; severity: number; overrideSignificant?: boolean | null },
) {
  const score = computeRiskScore(input.probability, input.severity, matrix.scoreFormula);
  const calculated = resolveSignificance(score, matrix.significanceThreshold);
  const override = input.overrideSignificant;
  const isSignificant = override === null || override === undefined ? calculated : override;
  const significanceSource = isSignificant === calculated ? 'calculated' : 'override';
  return { score, isSignificant, significanceSource };
}

export async function addHazard(
  organizationId: string,
  userId: string,
  planVersionId: string,
  input: HazardInput,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  await requireEditableVersion(organizationId, planVersionId);
  if (!input.name?.trim())
    throw new HaccpValidationError(['El nombre del peligro es obligatorio.']);
  if (input.sourceType === 'material' && !input.sourceReferenceId)
    throw new HaccpValidationError(['Indica la materia prima.']);
  if (input.sourceType === 'process_step' && !input.processStepId)
    throw new HaccpValidationError(['Indica la etapa del proceso.']);
  if (input.contextType === 'input' && !input.inputLogicalId)
    throw new HaccpValidationError(['Indica la entrada asociada al peligro.']);
  if (input.contextType === 'output' && !input.outputLogicalId)
    throw new HaccpValidationError(['Indica la salida asociada al peligro.']);
  if (
    input.overrideSignificant !== null &&
    input.overrideSignificant !== undefined &&
    !input.significanceReason?.trim()
  )
    throw new HaccpValidationError(['El override de significancia requiere justificación.']);
  await withOrgContext(organizationId, async (tx) => {
    const matrix = await ensureMatrix(tx, organizationId, planVersionId);
    const risk = await computeHazardRisk(matrix, input);
    await tx.haccpHazard.create({
      data: {
        organizationId,
        planVersionId,
        hazardLogicalId: randomUUID(),
        sourceType: input.sourceType,
        sourceReferenceId: input.sourceType === 'material' ? input.sourceReferenceId! : null,
        processStepId: input.sourceType === 'process_step' ? input.processStepId! : null,
        // §M: contexto del peligro. Default 'step' para peligros de etapa (compat backfill).
        contextType:
          input.sourceType === 'process_step'
            ? (input.contextType ?? 'step')
            : (input.contextType ?? null),
        inputLogicalId: input.contextType === 'input' ? (input.inputLogicalId ?? null) : null,
        outputLogicalId: input.contextType === 'output' ? (input.outputLogicalId ?? null) : null,
        hazardType: input.hazardType,
        name: input.name.trim(),
        description: input.description ?? null,
        originOrCause: input.originOrCause ?? null,
        probability: input.probability,
        severity: input.severity,
        riskScore: risk.score,
        isSignificant: risk.isSignificant,
        significanceSource: risk.significanceSource,
        significanceReason: input.significanceReason ?? null,
        existingControlMeasure: input.existingControlMeasure ?? null,
        createdBy: userId,
      },
    });
  });
}

async function loadHazard(organizationId: string, hazardId: string) {
  const h = await getPrisma().haccpHazard.findFirst({ where: { id: hazardId, organizationId } });
  if (!h) throw new HaccpNotFoundError();
  return h;
}

export async function updateHazard(
  organizationId: string,
  userId: string,
  hazardId: string,
  input: Partial<HazardInput>,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const h = await loadHazard(organizationId, hazardId);
  await requireEditableVersion(organizationId, h.planVersionId);
  const probability = input.probability ?? h.probability;
  const severity = input.severity ?? h.severity;
  const override = input.overrideSignificant === undefined ? null : input.overrideSignificant;
  if (override !== null && override !== undefined && !input.significanceReason?.trim())
    throw new HaccpValidationError(['El override de significancia requiere justificación.']);
  await withOrgContext(organizationId, async (tx) => {
    const matrix = await ensureMatrix(tx, organizationId, h.planVersionId);
    const risk = await computeHazardRisk(matrix, {
      probability,
      severity,
      overrideSignificant: override,
    });
    await tx.haccpHazard.update({
      where: { id: hazardId },
      data: {
        hazardType: input.hazardType ?? h.hazardType,
        name: input.name?.trim() ?? h.name,
        description: input.description === undefined ? h.description : input.description,
        originOrCause: input.originOrCause === undefined ? h.originOrCause : input.originOrCause,
        probability,
        severity,
        riskScore: risk.score,
        isSignificant: risk.isSignificant,
        significanceSource: risk.significanceSource,
        significanceReason:
          input.significanceReason === undefined ? h.significanceReason : input.significanceReason,
        existingControlMeasure:
          input.existingControlMeasure === undefined
            ? h.existingControlMeasure
            : input.existingControlMeasure,
      },
    });
  });
}

export async function removeHazard(
  organizationId: string,
  userId: string,
  hazardId: string,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const h = await loadHazard(organizationId, hazardId);
  await requireEditableVersion(organizationId, h.planVersionId);
  await withOrgContext(organizationId, async (tx) => {
    await tx.haccpHazard.delete({ where: { id: hazardId } });
  });
}
