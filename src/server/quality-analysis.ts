/**
 * Herramientas de calidad y análisis avanzado de causa (TASK-008) — capa de
 * datos. Amplía CAPA con Ishikawa, árbol de causas, Pareto, AMEF, recurrencia y
 * comparación. Las herramientas AYUDAN a investigar; no deciden la causa raíz.
 *
 * Seguridad: organización desde la sesión; permisos por rol/participación
 * validados en SERVIDOR; escrituras en `withOrgContext` (RLS); historial y
 * versiones append-only; conversión a acciones respeta el estado de la CAPA.
 */
import { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';
import { saveDocumentFile } from './document-storage';
import { addAction } from './capa';
import {
  FMEA_DEFAULT_SCALE,
  ISHIKAWA_DEFAULT_CATEGORIES,
  assertAnalysisTransition,
  computeNpr,
  computePareto,
  isAnalysisEditable,
  isValidScaleValue,
  wouldCreateCycle,
  type AnalysisEvidenceEntity,
  type AnalysisStatus,
  type AnalysisType,
  type CauseEdgeRelation,
  type CauseNodeType,
  type HypothesisStatus,
  type ParticipantRole,
  type QualProbability,
  type RecurrenceConfirmation,
} from '@/features/capa/analysis-state';
import {
  ACTION_TYPES,
  CAPA_PRIORITIES,
  type ActionType,
  type CapaPriority,
} from '@/features/capa/capa-state';

// --- Errores -----------------------------------------------------------------

export class AnalysisPermissionError extends Error {
  constructor(message = 'No tienes permiso para esta acción.') {
    super(message);
    this.name = 'AnalysisPermissionError';
  }
}
export class AnalysisValidationError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super('Validación del análisis fallida.');
    this.name = 'AnalysisValidationError';
    this.errors = errors;
  }
}
export class AnalysisNotFoundError extends Error {
  constructor(message = 'Análisis no encontrado.') {
    super(message);
    this.name = 'AnalysisNotFoundError';
  }
}

type Tx = Prisma.TransactionClient;
type Analysis = Prisma.QualityAnalysisGetPayload<object>;
const inSet = <T extends string>(set: readonly T[], v: unknown, fallback: T): T =>
  (set as readonly string[]).includes(v as string) ? (v as T) : fallback;

// --- Permisos ----------------------------------------------------------------

async function memberRole(organizationId: string, userId: string): Promise<string> {
  const m = await getPrisma().membership.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!m) throw new AnalysisPermissionError('No perteneces a esta organización.');
  return m.role;
}
const isAdmin = (role: string) => role === 'owner' || role === 'admin';
const canCreate = (role: string) => isAdmin(role) || role === 'evaluator';

async function loadAnalysis(organizationId: string, analysisId: string): Promise<Analysis> {
  const a = await getPrisma().qualityAnalysis.findFirst({
    where: { id: analysisId, organizationId },
  });
  if (!a || a.deletedAt) throw new AnalysisNotFoundError();
  return a;
}

async function isParticipant(
  organizationId: string,
  analysis: Analysis,
  userId: string,
): Promise<boolean> {
  if (
    analysis.responsibleUserId === userId ||
    analysis.reviewerUserId === userId ||
    analysis.approverUserId === userId ||
    analysis.createdBy === userId
  ) {
    return true;
  }
  const p = await getPrisma().qualityAnalysisParticipant.findFirst({
    where: { analysisId: analysis.id, organizationId, userId },
    select: { id: true },
  });
  return Boolean(p);
}

/** Carga el análisis y exige que sea editable y que el actor pueda editarlo. */
async function assertEditor(
  organizationId: string,
  analysisId: string,
  userId: string,
): Promise<{ analysis: Analysis; role: string }> {
  const analysis = await loadAnalysis(organizationId, analysisId);
  const role = await memberRole(organizationId, userId);
  if (!isAnalysisEditable(analysis.status as AnalysisStatus)) {
    throw new AnalysisValidationError(['El análisis no es editable en su estado actual.']);
  }
  if (!isAdmin(role) && !(await isParticipant(organizationId, analysis, userId))) {
    throw new AnalysisPermissionError();
  }
  return { analysis, role };
}

async function recordHistory(
  tx: Tx,
  organizationId: string,
  analysisId: string,
  event: string,
  actorUserId: string,
  opts: {
    fromStatus?: string | null;
    toStatus?: string | null;
    entity?: string;
    summary?: string;
  } = {},
): Promise<void> {
  await tx.qualityAnalysisHistory.create({
    data: {
      organizationId,
      analysisId,
      event,
      fromStatus: opts.fromStatus ?? null,
      toStatus: opts.toStatus ?? null,
      actorUserId,
      entity: opts.entity ?? null,
      summary: opts.summary ?? null,
    },
  });
}

async function assertCapaInOrg(organizationId: string, capaId: string): Promise<void> {
  const capa = await getPrisma().capa.findFirst({
    where: { id: capaId, organizationId },
    select: { id: true },
  });
  if (!capa) throw new AnalysisNotFoundError('CAPA no encontrada.');
}

// --- Creación / edición del análisis -----------------------------------------

export async function createAnalysis(
  organizationId: string,
  actorId: string,
  capaId: string,
  input: {
    type: AnalysisType;
    title: string;
    objective?: string | null;
    scope?: string | null;
    responsibleUserId?: string | null;
  },
): Promise<string> {
  const role = await memberRole(organizationId, actorId);
  if (!canCreate(role)) throw new AnalysisPermissionError('Tu rol no permite crear análisis.');
  await assertCapaInOrg(organizationId, capaId);
  const errors: string[] = [];
  if (!input.title?.trim()) errors.push('Falta el título.');
  const type = input.type;
  if (errors.length) throw new AnalysisValidationError(errors);

  const config =
    type === 'fmea'
      ? { scale: FMEA_DEFAULT_SCALE }
      : type === 'pareto'
        ? { cutoff: 80, valueKey: 'count' }
        : undefined;

  return withOrgContext(organizationId, async (tx) => {
    const a = await tx.qualityAnalysis.create({
      data: {
        organizationId,
        capaId,
        type,
        title: input.title.trim(),
        objective: input.objective?.trim() || null,
        scope: input.scope?.trim() || null,
        status: 'draft',
        responsibleUserId: input.responsibleUserId || actorId,
        config: config as Prisma.InputJsonValue | undefined,
        createdBy: actorId,
      },
    });
    // Ishikawa: sembrar las 6M por defecto.
    if (type === 'ishikawa') {
      let pos = 0;
      for (const name of ISHIKAWA_DEFAULT_CATEGORIES) {
        pos += 1;
        await tx.ishikawaCategory.create({
          data: { organizationId, analysisId: a.id, name, position: pos, createdBy: actorId },
        });
      }
    }
    await recordHistory(tx, organizationId, a.id, 'analysis_created', actorId, {
      toStatus: 'draft',
      summary: input.title.trim(),
    });
    await recordHistory(tx, organizationId, a.id, 'type_selected', actorId, { entity: type });
    return a.id;
  });
}

export async function updateAnalysis(
  organizationId: string,
  actorId: string,
  analysisId: string,
  input: {
    title?: string;
    objective?: string | null;
    scope?: string | null;
    responsibleUserId?: string | null;
    reviewerUserId?: string | null;
    approverUserId?: string | null;
    config?: unknown;
  },
): Promise<void> {
  const { analysis } = await assertEditor(organizationId, analysisId, actorId);
  const data: Prisma.QualityAnalysisUpdateInput = {};
  if (input.title !== undefined) {
    if (!input.title.trim()) throw new AnalysisValidationError(['El título no puede estar vacío.']);
    data.title = input.title.trim();
  }
  if (input.objective !== undefined) data.objective = input.objective?.trim() || null;
  if (input.scope !== undefined) data.scope = input.scope?.trim() || null;
  if (input.responsibleUserId !== undefined)
    data.responsibleUserId = input.responsibleUserId || null;
  if (input.reviewerUserId !== undefined) data.reviewerUserId = input.reviewerUserId || null;
  if (input.approverUserId !== undefined) data.approverUserId = input.approverUserId || null;
  if (input.config !== undefined) data.config = input.config as Prisma.InputJsonValue;
  await withOrgContext(organizationId, async (tx) => {
    await tx.qualityAnalysis.update({ where: { id: analysis.id }, data });
  });
}

export async function addParticipant(
  organizationId: string,
  actorId: string,
  analysisId: string,
  userId: string,
  role: ParticipantRole = 'participant',
): Promise<void> {
  const { analysis } = await assertEditor(organizationId, analysisId, actorId);
  const member = await getPrisma().membership.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });
  if (!member)
    throw new AnalysisValidationError(['El participante debe pertenecer a la organización.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.qualityAnalysisParticipant.upsert({
      where: { analysisId_userId_role: { analysisId: analysis.id, userId, role } },
      create: { organizationId, analysisId: analysis.id, userId, role, addedBy: actorId },
      update: {},
    });
    await recordHistory(tx, organizationId, analysis.id, 'participant_added', actorId, {
      entity: role,
    });
  });
}

// --- Transiciones ------------------------------------------------------------

export async function transitionAnalysis(
  organizationId: string,
  actorId: string,
  analysisId: string,
  to: AnalysisStatus,
  opts: { comment?: string } = {},
): Promise<void> {
  const analysis = await loadAnalysis(organizationId, analysisId);
  const role = await memberRole(organizationId, actorId);
  const from = analysis.status as AnalysisStatus;
  assertAnalysisTransition(from, to);

  const participant = await isParticipant(organizationId, analysis, actorId);
  const isReviewer = analysis.reviewerUserId === actorId;

  // Permisos por transición.
  if (to === 'approved') {
    if (!isAdmin(role) && !isReviewer)
      throw new AnalysisPermissionError('Solo owner/admin o el revisor asignado aprueba.');
  } else if (to === 'changes_requested') {
    if (!isAdmin(role) && !isReviewer)
      throw new AnalysisPermissionError('Solo owner/admin o el revisor solicita cambios.');
    if (!opts.comment?.trim())
      throw new AnalysisValidationError(['Indica qué cambios se solicitan.']);
  } else if (to === 'cancelled') {
    if (!isAdmin(role) && analysis.createdBy !== actorId)
      throw new AnalysisPermissionError('Solo owner/admin o el creador cancela.');
  } else if (!isAdmin(role) && !participant) {
    throw new AnalysisPermissionError();
  }

  // Enviar a revisión exige una conclusión con resumen y causa raíz propuesta.
  if (to === 'under_review') {
    const c = await getPrisma().qualityAnalysisConclusion.findFirst({
      where: { analysisId: analysis.id, organizationId },
    });
    if (!c?.summary?.trim() || !c?.proposedRootCause?.trim())
      throw new AnalysisValidationError([
        'Antes de revisar, registra la conclusión (resumen y causa raíz propuesta).',
      ]);
  }

  await withOrgContext(organizationId, async (tx) => {
    const patch: Prisma.QualityAnalysisUpdateInput = { status: to };
    if (to === 'in_progress' && !analysis.startedAt) patch.startedAt = new Date();
    if (to === 'under_review') patch.reviewedAt = new Date();
    if (to === 'approved') {
      patch.approvedAt = new Date();
      patch.approverUserId = actorId;
      // Snapshot inmutable de la versión aprobada.
      const snapshot = await buildSnapshot(tx, organizationId, analysis);
      patch.snapshot = snapshot as Prisma.InputJsonValue;
      await tx.qualityAnalysisVersion.create({
        data: {
          organizationId,
          analysisId: analysis.id,
          version: analysis.version,
          snapshot: snapshot as Prisma.InputJsonValue,
          approvedBy: actorId,
        },
      });
      await tx.qualityAnalysisConclusion.updateMany({
        where: { analysisId: analysis.id, organizationId },
        data: { approvedAt: new Date() },
      });
    }
    await tx.qualityAnalysis.update({ where: { id: analysis.id }, data: patch });
    const event =
      to === 'approved'
        ? 'analysis_approved'
        : to === 'changes_requested'
          ? 'changes_requested'
          : to === 'under_review'
            ? 'conclusion_submitted'
            : to === 'cancelled'
              ? 'analysis_cancelled'
              : 'type_selected';
    await recordHistory(tx, organizationId, analysis.id, event, actorId, {
      fromStatus: from,
      toStatus: to,
      summary: opts.comment?.trim(),
    });
  });
}

/** Construye el snapshot JSON de todo el contenido del análisis. */
async function buildSnapshot(tx: Tx, organizationId: string, analysis: Analysis) {
  const [categories, hypotheses, nodes, edges, pareto, fmea, recurrence, comparative, conclusion] =
    await Promise.all([
      tx.ishikawaCategory.findMany({ where: { analysisId: analysis.id, organizationId } }),
      tx.qualityHypothesis.findMany({ where: { analysisId: analysis.id, organizationId } }),
      tx.causeTreeNode.findMany({ where: { analysisId: analysis.id, organizationId } }),
      tx.causeTreeEdge.findMany({ where: { analysisId: analysis.id, organizationId } }),
      tx.paretoItem.findMany({ where: { analysisId: analysis.id, organizationId } }),
      tx.fmeaRow.findMany({ where: { analysisId: analysis.id, organizationId } }),
      tx.recurrenceMatch.findMany({ where: { analysisId: analysis.id, organizationId } }),
      tx.comparativeCase.findMany({ where: { analysisId: analysis.id, organizationId } }),
      tx.qualityAnalysisConclusion.findFirst({
        where: { analysisId: analysis.id, organizationId },
      }),
    ]);
  return {
    version: analysis.version,
    type: analysis.type,
    title: analysis.title,
    categories,
    hypotheses,
    nodes,
    edges,
    pareto,
    fmea,
    recurrence,
    comparative,
    conclusion,
  };
}

// --- Ishikawa ----------------------------------------------------------------

export async function addIshikawaCategory(
  organizationId: string,
  actorId: string,
  analysisId: string,
  name: string,
): Promise<string> {
  const { analysis } = await assertEditor(organizationId, analysisId, actorId);
  if (!name?.trim()) throw new AnalysisValidationError(['La categoría requiere nombre.']);
  const count = await getPrisma().ishikawaCategory.count({
    where: { analysisId: analysis.id, organizationId },
  });
  return withOrgContext(organizationId, async (tx) => {
    const c = await tx.ishikawaCategory.create({
      data: {
        organizationId,
        analysisId: analysis.id,
        name: name.trim(),
        position: count + 1,
        createdBy: actorId,
      },
    });
    return c.id;
  });
}

export async function updateIshikawaCategory(
  organizationId: string,
  actorId: string,
  categoryId: string,
  input: { name?: string; active?: boolean; position?: number },
): Promise<void> {
  const cat = await getPrisma().ishikawaCategory.findFirst({
    where: { id: categoryId, organizationId },
  });
  if (!cat) throw new AnalysisNotFoundError('Categoría no encontrada.');
  await assertEditor(organizationId, cat.analysisId, actorId);
  await withOrgContext(organizationId, async (tx) => {
    await tx.ishikawaCategory.update({
      where: { id: categoryId },
      data: {
        name: input.name?.trim() || undefined,
        active: input.active,
        position: input.position,
      },
    });
  });
}

// --- Hipótesis / causas (compartidas) ----------------------------------------

export async function createHypothesis(
  organizationId: string,
  actorId: string,
  analysisId: string,
  input: {
    description: string;
    category?: string | null;
    ishikawaCategoryId?: string | null;
    parentHypothesisId?: string | null;
    sourceTool?: string | null;
    responsibleUserId?: string | null;
    probability?: QualProbability;
    impact?: string | null;
    evidenceFor?: string | null;
    evidenceAgainst?: string | null;
  },
): Promise<string> {
  const { analysis } = await assertEditor(organizationId, analysisId, actorId);
  if (!input.description?.trim())
    throw new AnalysisValidationError(['La hipótesis requiere descripción.']);
  return withOrgContext(organizationId, async (tx) => {
    const h = await tx.qualityHypothesis.create({
      data: {
        organizationId,
        analysisId: analysis.id,
        description: input.description.trim(),
        category: input.category?.trim() || null,
        ishikawaCategoryId: input.ishikawaCategoryId || null,
        parentHypothesisId: input.parentHypothesisId || null,
        sourceTool: input.sourceTool || analysis.type,
        responsibleUserId: input.responsibleUserId || null,
        probability: inSet(
          ['low', 'medium', 'high', 'undetermined'],
          input.probability,
          'undetermined',
        ),
        impact: input.impact || null,
        evidenceFor: input.evidenceFor?.trim() || null,
        evidenceAgainst: input.evidenceAgainst?.trim() || null,
        createdBy: actorId,
      },
    });
    await recordHistory(tx, organizationId, analysis.id, 'hypothesis_created', actorId, {
      entity: 'hypothesis',
      summary: input.description.trim().slice(0, 120),
    });
    return h.id;
  });
}

export async function updateHypothesis(
  organizationId: string,
  actorId: string,
  hypothesisId: string,
  input: {
    status?: HypothesisStatus;
    probability?: QualProbability;
    impact?: string | null;
    conclusion?: string | null;
    justification?: string | null;
    evidenceFor?: string | null;
    evidenceAgainst?: string | null;
  },
): Promise<void> {
  const h = await getPrisma().qualityHypothesis.findFirst({
    where: { id: hypothesisId, organizationId },
  });
  if (!h) throw new AnalysisNotFoundError('Hipótesis no encontrada.');
  await assertEditor(organizationId, h.analysisId, actorId);
  const status = input.status
    ? inSet(
        ['pending', 'evaluating', 'discarded', 'contributing', 'probable', 'confirmed'],
        input.status,
        h.status as HypothesisStatus,
      )
    : undefined;
  // Confirmar como causa raíz exige justificación.
  if (status === 'confirmed' && !input.justification?.trim() && !h.justification)
    throw new AnalysisValidationError(['Confirmar una causa raíz exige justificación.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.qualityHypothesis.update({
      where: { id: hypothesisId },
      data: {
        status,
        probability: input.probability,
        impact: input.impact !== undefined ? input.impact || null : undefined,
        conclusion: input.conclusion !== undefined ? input.conclusion?.trim() || null : undefined,
        justification:
          input.justification !== undefined ? input.justification?.trim() || null : undefined,
        evidenceFor:
          input.evidenceFor !== undefined ? input.evidenceFor?.trim() || null : undefined,
        evidenceAgainst:
          input.evidenceAgainst !== undefined ? input.evidenceAgainst?.trim() || null : undefined,
        evaluatedAt: status && status !== 'pending' ? new Date() : undefined,
        evaluatorUserId: status && status !== 'pending' ? actorId : undefined,
      },
    });
    const event = status === 'discarded' ? 'cause_discarded' : 'cause_modified';
    await recordHistory(tx, organizationId, h.analysisId, event, actorId, { entity: 'hypothesis' });
  });
}

// --- Árbol de causas ---------------------------------------------------------

export async function addCauseNode(
  organizationId: string,
  actorId: string,
  analysisId: string,
  input: { type: CauseNodeType; description: string; posX?: number; posY?: number },
): Promise<string> {
  const { analysis } = await assertEditor(organizationId, analysisId, actorId);
  if (!input.description?.trim())
    throw new AnalysisValidationError(['El nodo requiere descripción.']);
  return withOrgContext(organizationId, async (tx) => {
    const n = await tx.causeTreeNode.create({
      data: {
        organizationId,
        analysisId: analysis.id,
        type: input.type,
        description: input.description.trim(),
        posX: input.posX ?? 0,
        posY: input.posY ?? 0,
        createdBy: actorId,
      },
    });
    await recordHistory(tx, organizationId, analysis.id, 'node_created', actorId, {
      entity: 'cause_tree_node',
    });
    return n.id;
  });
}

export async function addCauseEdge(
  organizationId: string,
  actorId: string,
  analysisId: string,
  input: { fromNodeId: string; toNodeId: string; relation: CauseEdgeRelation },
): Promise<string> {
  const { analysis } = await assertEditor(organizationId, analysisId, actorId);
  if (input.fromNodeId === input.toNodeId)
    throw new AnalysisValidationError(['Un nodo no puede relacionarse consigo mismo.']);
  const nodes = await getPrisma().causeTreeNode.findMany({
    where: {
      analysisId: analysis.id,
      organizationId,
      id: { in: [input.fromNodeId, input.toNodeId] },
    },
    select: { id: true },
  });
  if (nodes.length !== 2)
    throw new AnalysisValidationError(['Los nodos deben existir en este análisis.']);
  const edges = await getPrisma().causeTreeEdge.findMany({
    where: { analysisId: analysis.id, organizationId },
    select: { fromNodeId: true, toNodeId: true },
  });
  if (wouldCreateCycle(edges, input.fromNodeId, input.toNodeId))
    throw new AnalysisValidationError(['La relación crearía un ciclo en el árbol.']);
  return withOrgContext(organizationId, async (tx) => {
    const e = await tx.causeTreeEdge.create({
      data: {
        organizationId,
        analysisId: analysis.id,
        fromNodeId: input.fromNodeId,
        toNodeId: input.toNodeId,
        relation: input.relation,
        createdBy: actorId,
      },
    });
    await recordHistory(tx, organizationId, analysis.id, 'edge_created', actorId, {
      entity: 'cause_tree_edge',
    });
    return e.id;
  });
}

export async function markNodeRootCause(
  organizationId: string,
  actorId: string,
  nodeId: string,
  justification: string,
): Promise<void> {
  const node = await getPrisma().causeTreeNode.findFirst({ where: { id: nodeId, organizationId } });
  if (!node) throw new AnalysisNotFoundError('Nodo no encontrado.');
  await assertEditor(organizationId, node.analysisId, actorId);
  if (!justification?.trim())
    throw new AnalysisValidationError(['Confirmar una causa raíz exige justificación.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.causeTreeNode.update({
      where: { id: nodeId },
      data: { isProposedRootCause: true, rootCauseJustification: justification.trim() },
    });
    await recordHistory(tx, organizationId, node.analysisId, 'cause_modified', actorId, {
      entity: 'cause_tree_node',
      summary: 'Causa raíz propuesta',
    });
  });
}

// --- Pareto ------------------------------------------------------------------

export async function setParetoItems(
  organizationId: string,
  actorId: string,
  analysisId: string,
  items: {
    category: string;
    count: number;
    cost?: number | null;
    period?: string | null;
    source?: string | null;
  }[],
): Promise<void> {
  const { analysis } = await assertEditor(organizationId, analysisId, actorId);
  await withOrgContext(organizationId, async (tx) => {
    await tx.paretoItem.deleteMany({ where: { analysisId: analysis.id, organizationId } });
    let pos = 0;
    for (const it of items) {
      pos += 1;
      if (!it.category?.trim()) continue;
      await tx.paretoItem.create({
        data: {
          organizationId,
          analysisId: analysis.id,
          category: it.category.trim(),
          count: Math.max(0, Math.trunc(it.count || 0)),
          cost: it.cost != null ? new Prisma.Decimal(it.cost) : null,
          period: it.period?.trim() || null,
          source: it.source?.trim() || null,
          position: pos,
          createdBy: actorId,
        },
      });
    }
    await recordHistory(tx, organizationId, analysis.id, 'pareto_updated', actorId, {
      entity: 'pareto',
    });
  });
}

/** Genera datos de Pareto agregando CAPA de la organización por una dimensión. */
export async function buildParetoFromCapa(
  organizationId: string,
  dimension: 'sourceType' | 'severity' | 'priority' | 'siteId' | 'area' | 'process',
): Promise<{ category: string; count: number }[]> {
  const capas = await getPrisma().capa.findMany({
    where: { organizationId, deletedAt: null },
    select: {
      sourceType: true,
      severity: true,
      priority: true,
      siteId: true,
      area: true,
      process: true,
    },
  });
  const counts = new Map<string, number>();
  for (const c of capas) {
    const key = String((c as Record<string, unknown>)[dimension] ?? '—');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([category, count]) => ({ category, count }));
}

export async function getParetoResult(organizationId: string, analysisId: string) {
  const analysis = await loadAnalysis(organizationId, analysisId);
  const items = await getPrisma().paretoItem.findMany({
    where: { analysisId, organizationId },
    orderBy: { position: 'asc' },
  });
  const config = (analysis.config ?? {}) as { cutoff?: number; valueKey?: 'count' | 'cost' };
  return computePareto(
    items.map((i) => ({
      id: i.id,
      category: i.category,
      count: i.count,
      cost: i.cost ? Number(i.cost) : null,
    })),
    { cutoff: config.cutoff ?? 80, valueKey: config.valueKey ?? 'count' },
  );
}

// --- AMEF --------------------------------------------------------------------

function fmeaScaleMax(analysis: Analysis): { s: number; o: number; d: number } {
  const cfg = (analysis.config ?? {}) as {
    scale?: { severityMax?: number; occurrenceMax?: number; detectionMax?: number };
  };
  return {
    s: cfg.scale?.severityMax ?? 10,
    o: cfg.scale?.occurrenceMax ?? 10,
    d: cfg.scale?.detectionMax ?? 10,
  };
}

function actionPriorityForNpr(npr: number): 'low' | 'medium' | 'high' | 'critical' {
  const t = FMEA_DEFAULT_SCALE.nprThresholds;
  if (npr >= t.critical) return 'critical';
  if (npr >= t.high) return 'high';
  if (npr >= t.medium) return 'medium';
  return 'low';
}

export async function addFmeaRow(
  organizationId: string,
  actorId: string,
  analysisId: string,
  input: {
    processStep?: string | null;
    functionText?: string | null;
    requirement?: string | null;
    failureMode: string;
    effect?: string | null;
    severity: number;
    causePotential?: string | null;
    occurrence: number;
    preventionControls?: string | null;
    detectionControls?: string | null;
    detection: number;
    recommendedAction?: string | null;
    responsibleUserId?: string | null;
    actionPriority?: 'low' | 'medium' | 'high' | 'critical';
  },
): Promise<string> {
  const { analysis } = await assertEditor(organizationId, analysisId, actorId);
  if (!input.failureMode?.trim()) throw new AnalysisValidationError(['Falta el modo de falla.']);
  const max = fmeaScaleMax(analysis);
  const errs: string[] = [];
  if (!isValidScaleValue(input.severity, max.s))
    errs.push(`Severidad fuera de rango (1–${max.s}).`);
  if (!isValidScaleValue(input.occurrence, max.o))
    errs.push(`Ocurrencia fuera de rango (1–${max.o}).`);
  if (!isValidScaleValue(input.detection, max.d))
    errs.push(`Detección fuera de rango (1–${max.d}).`);
  if (errs.length) throw new AnalysisValidationError(errs);
  const npr = computeNpr(input.severity, input.occurrence, input.detection);
  const count = await getPrisma().fmeaRow.count({
    where: { analysisId: analysis.id, organizationId },
  });
  return withOrgContext(organizationId, async (tx) => {
    const r = await tx.fmeaRow.create({
      data: {
        organizationId,
        analysisId: analysis.id,
        processStep: input.processStep?.trim() || null,
        functionText: input.functionText?.trim() || null,
        requirement: input.requirement?.trim() || null,
        failureMode: input.failureMode.trim(),
        effect: input.effect?.trim() || null,
        severity: input.severity,
        causePotential: input.causePotential?.trim() || null,
        occurrence: input.occurrence,
        preventionControls: input.preventionControls?.trim() || null,
        detectionControls: input.detectionControls?.trim() || null,
        detection: input.detection,
        npr,
        actionPriority: input.actionPriority ?? actionPriorityForNpr(npr),
        recommendedAction: input.recommendedAction?.trim() || null,
        responsibleUserId: input.responsibleUserId || null,
        position: count + 1,
        createdBy: actorId,
      },
    });
    await recordHistory(tx, organizationId, analysis.id, 'fmea_row_created', actorId, {
      entity: 'fmea_row',
    });
    return r.id;
  });
}

/** Actualiza una fila AMEF; recalcula NPR y NPR posterior en servidor. */
export async function updateFmeaRow(
  organizationId: string,
  actorId: string,
  rowId: string,
  input: {
    severity?: number;
    occurrence?: number;
    detection?: number;
    actionPriority?: 'low' | 'medium' | 'high' | 'critical';
    executedAction?: string | null;
    severityPost?: number | null;
    occurrencePost?: number | null;
    detectionPost?: number | null;
    status?: string | null;
  },
): Promise<void> {
  const row = await getPrisma().fmeaRow.findFirst({ where: { id: rowId, organizationId } });
  if (!row) throw new AnalysisNotFoundError('Fila AMEF no encontrada.');
  const { analysis } = await assertEditor(organizationId, row.analysisId, actorId);
  const max = fmeaScaleMax(analysis);
  const s = input.severity ?? row.severity;
  const o = input.occurrence ?? row.occurrence;
  const d = input.detection ?? row.detection;
  const errs: string[] = [];
  if (!isValidScaleValue(s, max.s)) errs.push(`Severidad fuera de rango (1–${max.s}).`);
  if (!isValidScaleValue(o, max.o)) errs.push(`Ocurrencia fuera de rango (1–${max.o}).`);
  if (!isValidScaleValue(d, max.d)) errs.push(`Detección fuera de rango (1–${max.d}).`);
  const sp = input.severityPost ?? row.severityPost;
  const op = input.occurrencePost ?? row.occurrencePost;
  const dp = input.detectionPost ?? row.detectionPost;
  const hasPost = sp != null && op != null && dp != null;
  if (hasPost) {
    if (!isValidScaleValue(sp, max.s)) errs.push(`Severidad posterior fuera de rango.`);
    if (!isValidScaleValue(op, max.o)) errs.push(`Ocurrencia posterior fuera de rango.`);
    if (!isValidScaleValue(dp, max.d)) errs.push(`Detección posterior fuera de rango.`);
  }
  if (errs.length) throw new AnalysisValidationError(errs);
  const npr = computeNpr(s, o, d);
  const nprPost = hasPost ? computeNpr(sp, op, dp) : row.nprPost;
  await withOrgContext(organizationId, async (tx) => {
    await tx.fmeaRow.update({
      where: { id: rowId },
      data: {
        severity: s,
        occurrence: o,
        detection: d,
        npr,
        actionPriority: input.actionPriority ?? actionPriorityForNpr(npr),
        executedAction:
          input.executedAction !== undefined ? input.executedAction?.trim() || null : undefined,
        severityPost: input.severityPost !== undefined ? input.severityPost : undefined,
        occurrencePost: input.occurrencePost !== undefined ? input.occurrencePost : undefined,
        detectionPost: input.detectionPost !== undefined ? input.detectionPost : undefined,
        nprPost,
        status: input.status !== undefined ? input.status || 'open' : undefined,
      },
    });
    await recordHistory(tx, organizationId, row.analysisId, 'npr_recalculated', actorId, {
      entity: 'fmea_row',
      summary: `NPR ${npr}${hasPost ? ` → ${nprPost}` : ''}`,
    });
  });
}

// --- Recurrencia -------------------------------------------------------------

/** Busca CAPA candidatas por coincidencias estructuradas (sin IA). */
export async function findRecurrenceCandidates(organizationId: string, analysisId: string) {
  const analysis = await loadAnalysis(organizationId, analysisId);
  const base = await getPrisma().capa.findFirstOrThrow({
    where: { id: analysis.capaId, organizationId },
  });
  const candidates = await getPrisma().capa.findMany({
    where: {
      organizationId,
      deletedAt: null,
      id: { not: base.id },
      OR: [
        { sourceType: base.sourceType },
        base.siteId ? { siteId: base.siteId } : {},
        base.area ? { area: base.area } : {},
        base.process ? { process: base.process } : {},
        base.requirementId ? { requirementId: base.requirementId } : {},
      ].filter((c) => Object.keys(c).length > 0),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return candidates.map((c) => {
    const reasons: string[] = [];
    if (c.sourceType === base.sourceType) reasons.push('mismo tipo');
    if (base.siteId && c.siteId === base.siteId) reasons.push('mismo sitio');
    if (base.area && c.area === base.area) reasons.push('misma área');
    if (base.process && c.process === base.process) reasons.push('mismo proceso');
    if (base.requirementId && c.requirementId === base.requirementId)
      reasons.push('mismo requisito');
    return {
      capaId: c.id,
      folio: c.folio,
      title: c.title,
      status: c.status,
      severity: c.severity,
      matchReason: reasons.join(', '),
    };
  });
}

export async function confirmRecurrence(
  organizationId: string,
  actorId: string,
  analysisId: string,
  input: {
    matchedCapaId: string;
    confirmation: RecurrenceConfirmation;
    justification: string;
    matchReason?: string | null;
  },
): Promise<void> {
  const { analysis } = await assertEditor(organizationId, analysisId, actorId);
  await assertCapaInOrg(organizationId, input.matchedCapaId);
  if (!input.justification?.trim())
    throw new AnalysisValidationError(['Confirmar recurrencia exige justificación.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.recurrenceMatch.upsert({
      where: {
        analysisId_matchedCapaId: { analysisId: analysis.id, matchedCapaId: input.matchedCapaId },
      },
      create: {
        organizationId,
        analysisId: analysis.id,
        matchedCapaId: input.matchedCapaId,
        confirmation: input.confirmation,
        justification: input.justification.trim(),
        matchReason: input.matchReason?.trim() || null,
        confirmedBy: actorId,
        createdBy: actorId,
      },
      update: {
        confirmation: input.confirmation,
        justification: input.justification.trim(),
        confirmedBy: actorId,
      },
    });
    await recordHistory(tx, organizationId, analysis.id, 'recurrence_confirmed', actorId, {
      entity: 'recurrence',
    });
  });
}

// --- Comparación de casos ----------------------------------------------------

export async function setComparativeCases(
  organizationId: string,
  actorId: string,
  analysisId: string,
  capaIds: string[],
): Promise<void> {
  const { analysis } = await assertEditor(organizationId, analysisId, actorId);
  const unique = [...new Set(capaIds.filter(Boolean))];
  if (unique.length < 2 || unique.length > 5)
    throw new AnalysisValidationError(['Selecciona entre 2 y 5 CAPA.']);
  const found = await getPrisma().capa.findMany({
    where: { organizationId, id: { in: unique }, deletedAt: null },
    select: { id: true },
  });
  if (found.length !== unique.length)
    throw new AnalysisValidationError(['Todas las CAPA deben pertenecer a la organización.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.comparativeCase.deleteMany({ where: { analysisId: analysis.id, organizationId } });
    let pos = 0;
    for (const capaId of unique) {
      pos += 1;
      await tx.comparativeCase.create({
        data: {
          organizationId,
          analysisId: analysis.id,
          capaId,
          position: pos,
          createdBy: actorId,
        },
      });
    }
  });
}

export async function getComparison(organizationId: string, analysisId: string) {
  const cases = await getPrisma().comparativeCase.findMany({
    where: { analysisId, organizationId },
    orderBy: { position: 'asc' },
  });
  const capaIds = cases.map((c) => c.capaId);
  const [capas, rcas] = await Promise.all([
    getPrisma().capa.findMany({ where: { id: { in: capaIds }, organizationId } }),
    getPrisma().capaRootCauseAnalysis.findMany({
      where: { capaId: { in: capaIds }, organizationId },
    }),
  ]);
  const rcaByCapa = new Map(rcas.map((r) => [r.capaId, r]));
  return capaIds.map((id) => {
    const c = capas.find((x) => x.id === id);
    return {
      capaId: id,
      folio: c?.folio ?? '—',
      title: c?.title ?? '—',
      sourceType: c?.sourceType ?? null,
      area: c?.area ?? null,
      process: c?.process ?? null,
      severity: c?.severity ?? null,
      status: c?.status ?? null,
      rootCause: rcaByCapa.get(id)?.rootCause ?? null,
    };
  });
}

// --- Conclusión --------------------------------------------------------------

export async function saveConclusion(
  organizationId: string,
  actorId: string,
  analysisId: string,
  input: {
    summary?: string | null;
    immediateCause?: string | null;
    contributingCauses?: string | null;
    proposedRootCause?: string | null;
    confirmedRootCause?: string | null;
    mainEvidence?: string | null;
    contradictoryEvidence?: string | null;
    limitations?: string | null;
    pendingInfo?: string | null;
    recurrenceRisk?: string | null;
    recommendations?: string | null;
  },
): Promise<void> {
  const { analysis } = await assertEditor(organizationId, analysisId, actorId);
  const clean = (v: string | null | undefined) => (v !== undefined ? v?.trim() || null : undefined);
  await withOrgContext(organizationId, async (tx) => {
    const existing = await tx.qualityAnalysisConclusion.findFirst({
      where: { analysisId: analysis.id, organizationId },
    });
    const data = {
      summary: clean(input.summary),
      immediateCause: clean(input.immediateCause),
      contributingCauses: clean(input.contributingCauses),
      proposedRootCause: clean(input.proposedRootCause),
      confirmedRootCause: clean(input.confirmedRootCause),
      mainEvidence: clean(input.mainEvidence),
      contradictoryEvidence: clean(input.contradictoryEvidence),
      limitations: clean(input.limitations),
      pendingInfo: clean(input.pendingInfo),
      recurrenceRisk: clean(input.recurrenceRisk),
      recommendations: clean(input.recommendations),
      responsibleUserId: analysis.responsibleUserId,
    };
    if (existing) {
      await tx.qualityAnalysisConclusion.update({ where: { id: existing.id }, data });
    } else {
      await tx.qualityAnalysisConclusion.create({
        data: { organizationId, analysisId: analysis.id, ...data, createdBy: actorId },
      });
    }
  });
}

/** Envía la causa raíz confirmada del análisis aprobado a la CAPA. */
export async function sendRootCauseToCapa(
  organizationId: string,
  actorId: string,
  analysisId: string,
): Promise<void> {
  const analysis = await loadAnalysis(organizationId, analysisId);
  const role = await memberRole(organizationId, actorId);
  if (analysis.status !== 'approved')
    throw new AnalysisValidationError([
      'Solo un análisis aprobado puede actualizar la causa raíz.',
    ]);
  if (
    !isAdmin(role) &&
    analysis.approverUserId !== actorId &&
    analysis.responsibleUserId !== actorId
  )
    throw new AnalysisPermissionError();
  const conclusion = await getPrisma().qualityAnalysisConclusion.findFirst({
    where: { analysisId, organizationId },
  });
  const rootCause = conclusion?.confirmedRootCause?.trim() || conclusion?.proposedRootCause?.trim();
  if (!rootCause) throw new AnalysisValidationError(['La conclusión no tiene causa raíz.']);

  await withOrgContext(organizationId, async (tx) => {
    const existing = await tx.capaRootCauseAnalysis.findFirst({
      where: { capaId: analysis.capaId, organizationId },
    });
    if (existing) {
      await tx.capaRootCauseAnalysis.update({
        where: { id: existing.id },
        data: { rootCause, method: 'free_analysis', concludedAt: new Date() },
      });
    } else {
      await tx.capaRootCauseAnalysis.create({
        data: {
          organizationId,
          capaId: analysis.capaId,
          method: 'free_analysis',
          rootCause,
          investigatorUserId: actorId,
          concludedAt: new Date(),
          createdBy: actorId,
        },
      });
    }
    // Historial en ambos lados (append-only).
    await tx.capaStatusHistory.create({
      data: {
        organizationId,
        capaId: analysis.capaId,
        event: 'root_cause_concluded',
        actorUserId: actorId,
        detail: `Desde análisis ${analysis.title}`,
      },
    });
    await recordHistory(tx, organizationId, analysisId, 'root_cause_sent_to_capa', actorId, {
      summary: rootCause.slice(0, 120),
    });
  });
}

// --- Conversión a acción CAPA ------------------------------------------------

export async function createCapaActionFromAnalysis(
  organizationId: string,
  actorId: string,
  analysisId: string,
  input: {
    sourceEntity: string;
    sourceId?: string | null;
    description: string;
    actionType?: ActionType;
    priority?: CapaPriority;
    responsibleUserId?: string | null;
    dueDate?: string | null;
  },
): Promise<string> {
  const analysis = await loadAnalysis(organizationId, analysisId);
  await memberRole(organizationId, actorId);
  if (!input.description?.trim())
    throw new AnalysisValidationError(['La acción requiere descripción.']);
  // Evita duplicados: una acción por elemento de origen.
  if (input.sourceId) {
    const dup = await getPrisma().qualityAnalysisActionLink.findFirst({
      where: { analysisId, organizationId, sourceId: input.sourceId },
    });
    if (dup)
      throw new AnalysisValidationError(['Ya existe una acción creada desde este elemento.']);
  }
  // `addAction` valida rol/edición y que la CAPA esté abierta.
  const actionId = await addAction(organizationId, actorId, analysis.capaId, {
    actionType: inSet(ACTION_TYPES, input.actionType, 'corrective'),
    description: input.description.trim(),
    responsibleUserId: input.responsibleUserId || null,
    dueDate: input.dueDate || null,
    priority: inSet(CAPA_PRIORITIES, input.priority, 'normal'),
  });
  await withOrgContext(organizationId, async (tx) => {
    await tx.qualityAnalysisActionLink.create({
      data: {
        organizationId,
        analysisId,
        capaActionId: actionId,
        sourceEntity: input.sourceEntity,
        sourceId: input.sourceId || null,
        createdBy: actorId,
      },
    });
    await recordHistory(tx, organizationId, analysisId, 'capa_action_created', actorId, {
      entity: input.sourceEntity,
      summary: input.description.trim().slice(0, 120),
    });
  });
  return actionId;
}

// --- Nueva versión -----------------------------------------------------------

/** Duplica un análisis aprobado en un nuevo borrador (versión + 1). */
export async function createNewVersion(
  organizationId: string,
  actorId: string,
  analysisId: string,
): Promise<string> {
  const analysis = await loadAnalysis(organizationId, analysisId);
  const role = await memberRole(organizationId, actorId);
  if (analysis.status !== 'approved')
    throw new AnalysisValidationError(['Solo un análisis aprobado genera una nueva versión.']);
  if (!isAdmin(role) && !(await isParticipant(organizationId, analysis, actorId)))
    throw new AnalysisPermissionError();

  const [categories, hypotheses, nodes, edges, pareto, fmea] = await Promise.all([
    getPrisma().ishikawaCategory.findMany({ where: { analysisId, organizationId } }),
    getPrisma().qualityHypothesis.findMany({ where: { analysisId, organizationId } }),
    getPrisma().causeTreeNode.findMany({ where: { analysisId, organizationId } }),
    getPrisma().causeTreeEdge.findMany({ where: { analysisId, organizationId } }),
    getPrisma().paretoItem.findMany({ where: { analysisId, organizationId } }),
    getPrisma().fmeaRow.findMany({ where: { analysisId, organizationId } }),
  ]);

  return withOrgContext(organizationId, async (tx) => {
    const copy = await tx.qualityAnalysis.create({
      data: {
        organizationId,
        capaId: analysis.capaId,
        type: analysis.type,
        title: analysis.title,
        objective: analysis.objective,
        scope: analysis.scope,
        status: 'draft',
        version: analysis.version + 1,
        parentAnalysisId: analysis.id,
        responsibleUserId: analysis.responsibleUserId,
        config: (analysis.config ?? undefined) as Prisma.InputJsonValue | undefined,
        createdBy: actorId,
      },
    });
    const catMap = new Map<string, string>();
    for (const c of categories) {
      const nc = await tx.ishikawaCategory.create({
        data: {
          organizationId,
          analysisId: copy.id,
          name: c.name,
          position: c.position,
          active: c.active,
          createdBy: actorId,
        },
      });
      catMap.set(c.id, nc.id);
    }
    for (const h of hypotheses) {
      await tx.qualityHypothesis.create({
        data: {
          organizationId,
          analysisId: copy.id,
          description: h.description,
          category: h.category,
          ishikawaCategoryId: h.ishikawaCategoryId
            ? (catMap.get(h.ishikawaCategoryId) ?? null)
            : null,
          sourceTool: h.sourceTool,
          status: h.status,
          probability: h.probability,
          impact: h.impact,
          createdBy: actorId,
        },
      });
    }
    const nodeMap = new Map<string, string>();
    for (const n of nodes) {
      const nn = await tx.causeTreeNode.create({
        data: {
          organizationId,
          analysisId: copy.id,
          type: n.type,
          description: n.description,
          validationStatus: n.validationStatus,
          posX: n.posX,
          posY: n.posY,
          createdBy: actorId,
        },
      });
      nodeMap.set(n.id, nn.id);
    }
    for (const e of edges) {
      const from = nodeMap.get(e.fromNodeId);
      const to = nodeMap.get(e.toNodeId);
      if (from && to)
        await tx.causeTreeEdge.create({
          data: {
            organizationId,
            analysisId: copy.id,
            fromNodeId: from,
            toNodeId: to,
            relation: e.relation,
            createdBy: actorId,
          },
        });
    }
    for (const p of pareto) {
      await tx.paretoItem.create({
        data: {
          organizationId,
          analysisId: copy.id,
          category: p.category,
          count: p.count,
          cost: p.cost,
          period: p.period,
          source: p.source,
          position: p.position,
          createdBy: actorId,
        },
      });
    }
    for (const f of fmea) {
      await tx.fmeaRow.create({
        data: {
          organizationId,
          analysisId: copy.id,
          processStep: f.processStep,
          functionText: f.functionText,
          requirement: f.requirement,
          failureMode: f.failureMode,
          effect: f.effect,
          severity: f.severity,
          causePotential: f.causePotential,
          occurrence: f.occurrence,
          preventionControls: f.preventionControls,
          detectionControls: f.detectionControls,
          detection: f.detection,
          npr: f.npr,
          actionPriority: f.actionPriority,
          recommendedAction: f.recommendedAction,
          position: f.position,
          createdBy: actorId,
        },
      });
    }
    await recordHistory(tx, organizationId, copy.id, 'new_version', actorId, {
      summary: `Versión ${copy.version} desde ${analysis.id}`,
    });
    return copy.id;
  });
}

// --- Comentarios y evidencia -------------------------------------------------

export async function addAnalysisComment(
  organizationId: string,
  actorId: string,
  analysisId: string,
  body: string,
  section?: string | null,
): Promise<void> {
  const analysis = await loadAnalysis(organizationId, analysisId);
  await memberRole(organizationId, actorId);
  if (!body?.trim()) throw new AnalysisValidationError(['El comentario está vacío.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.qualityAnalysisComment.create({
      data: {
        organizationId,
        analysisId: analysis.id,
        author: actorId,
        body: body.trim(),
        section: section || null,
      },
    });
  });
}

export async function addAnalysisEvidence(
  organizationId: string,
  actorId: string,
  analysisId: string,
  input: {
    entityType: AnalysisEvidenceEntity;
    entityId?: string | null;
    evidenceType?: string | null;
    originalName: string;
    mimeType: string;
    data: Buffer;
  },
): Promise<string> {
  const { analysis } = await assertEditor(organizationId, analysisId, actorId);
  const saved = await saveDocumentFile({
    organizationId,
    originalName: input.originalName,
    mimeType: input.mimeType,
    data: input.data,
  });
  return withOrgContext(organizationId, async (tx) => {
    const e = await tx.qualityEvidence.create({
      data: {
        organizationId,
        analysisId: analysis.id,
        capaId: analysis.capaId,
        entityType: input.entityType,
        entityId: input.entityId || null,
        evidenceType: input.evidenceType || null,
        originalName: saved.originalName,
        storedName: saved.storedName,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        extension: saved.extension,
        storageKey: saved.storageKey,
        checksum: saved.checksum,
        uploadedBy: actorId,
      },
    });
    await recordHistory(tx, organizationId, analysis.id, 'evidence_added', actorId, {
      entity: input.entityType,
      summary: saved.originalName,
    });
    return e.id;
  });
}

// --- Consultas ---------------------------------------------------------------

export async function listAnalyses(
  organizationId: string,
  filters: { capaId?: string; type?: string; status?: string; search?: string } = {},
) {
  const where: Prisma.QualityAnalysisWhereInput = { organizationId, deletedAt: null };
  if (filters.capaId) where.capaId = filters.capaId;
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.search?.trim())
    where.title = { contains: filters.search.trim(), mode: 'insensitive' };
  const rows = await getPrisma().qualityAnalysis.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });
  const [members, capas] = await Promise.all([
    memberDirectory(organizationId),
    getPrisma().capa.findMany({
      where: { organizationId, id: { in: [...new Set(rows.map((r) => r.capaId))] } },
      select: { id: true, folio: true },
    }),
  ]);
  const folioByCapa = new Map(capas.map((c) => [c.id, c.folio]));
  return rows.map((a) => ({
    id: a.id,
    capaId: a.capaId,
    capaFolio: folioByCapa.get(a.capaId) ?? '—',
    type: a.type,
    title: a.title,
    status: a.status,
    version: a.version,
    responsibleName: a.responsibleUserId ? (members.get(a.responsibleUserId) ?? null) : null,
    updatedAt: (a.updatedAt ?? a.createdAt).toISOString().slice(0, 10),
  }));
}

async function memberDirectory(organizationId: string): Promise<Map<string, string>> {
  const members = await getPrisma().membership.findMany({
    where: { organizationId },
    select: { userId: true },
  });
  const users = await getPrisma().user.findMany({
    where: { id: { in: members.map((m) => m.userId) } },
    select: { id: true, displayName: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u.displayName ?? u.email]));
}

export async function getAnalysisDetail(organizationId: string, analysisId: string) {
  const analysis = await loadAnalysis(organizationId, analysisId);
  const [
    participants,
    categories,
    hypotheses,
    nodes,
    edges,
    fmea,
    recurrence,
    comparative,
    conclusion,
    evidence,
    comments,
    history,
    actionLinks,
    members,
  ] = await Promise.all([
    getPrisma().qualityAnalysisParticipant.findMany({ where: { analysisId, organizationId } }),
    getPrisma().ishikawaCategory.findMany({
      where: { analysisId, organizationId },
      orderBy: { position: 'asc' },
    }),
    getPrisma().qualityHypothesis.findMany({
      where: { analysisId, organizationId },
      orderBy: { createdAt: 'asc' },
    }),
    getPrisma().causeTreeNode.findMany({ where: { analysisId, organizationId } }),
    getPrisma().causeTreeEdge.findMany({ where: { analysisId, organizationId } }),
    getPrisma().fmeaRow.findMany({
      where: { analysisId, organizationId },
      orderBy: { position: 'asc' },
    }),
    getPrisma().recurrenceMatch.findMany({ where: { analysisId, organizationId } }),
    getPrisma().comparativeCase.findMany({
      where: { analysisId, organizationId },
      orderBy: { position: 'asc' },
    }),
    getPrisma().qualityAnalysisConclusion.findFirst({ where: { analysisId, organizationId } }),
    getPrisma().qualityEvidence.findMany({
      where: { analysisId, organizationId },
      orderBy: { createdAt: 'desc' },
    }),
    getPrisma().qualityAnalysisComment.findMany({
      where: { analysisId, organizationId, active: true },
      orderBy: { createdAt: 'desc' },
    }),
    getPrisma().qualityAnalysisHistory.findMany({
      where: { analysisId, organizationId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    getPrisma().qualityAnalysisActionLink.findMany({ where: { analysisId, organizationId } }),
    memberDirectory(organizationId),
  ]);
  const pareto =
    analysis.type === 'pareto' ? await getParetoResult(organizationId, analysisId) : null;
  const nameOf = (id: string | null | undefined) => (id ? (members.get(id) ?? null) : null);
  return {
    analysis,
    participants,
    categories,
    hypotheses,
    nodes,
    edges,
    pareto,
    fmea,
    recurrence,
    comparative,
    conclusion,
    evidence,
    comments,
    history,
    actionLinks,
    nameOf,
  };
}

export interface AnalysisUserContext {
  role: string;
  isAdmin: boolean;
  canEdit: boolean;
  canReview: boolean;
}

export async function getAnalysisUserContext(
  organizationId: string,
  userId: string,
  analysisId: string,
): Promise<AnalysisUserContext> {
  const analysis = await loadAnalysis(organizationId, analysisId);
  const role = await memberRole(organizationId, userId);
  const participant = await isParticipant(organizationId, analysis, userId);
  return {
    role,
    isAdmin: isAdmin(role),
    canEdit:
      (isAdmin(role) || participant) && isAnalysisEditable(analysis.status as AnalysisStatus),
    canReview: isAdmin(role) || analysis.reviewerUserId === userId,
  };
}

export async function listAnalysisMembers(organizationId: string) {
  const members = await getPrisma().membership.findMany({
    where: { organizationId, status: 'active' },
    select: { userId: true },
  });
  const users = await getPrisma().user.findMany({
    where: { id: { in: members.map((m) => m.userId) } },
    select: { id: true, displayName: true, email: true },
  });
  return users.map((u) => ({ id: u.id, name: u.displayName ?? u.email }));
}
