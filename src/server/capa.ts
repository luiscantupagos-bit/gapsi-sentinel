/**
 * No conformidades y acciones correctivas (CAPA) — capa de datos (TASK-007).
 *
 * Seguridad: la organización proviene de la sesión; los permisos por rol y
 * asignación se validan en SERVIDOR; las escrituras usan `withOrgContext` (RLS);
 * el historial es append-only y no se permite el borrado físico. El folio se
 * genera de forma atómica con un contador por organización y año.
 */
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';
import { saveDocumentFile } from './document-storage';
import {
  ACTION_STATUSES,
  ACTION_TYPES,
  CAPA_EVIDENCE_TYPES,
  CAPA_PRIORITIES,
  CAPA_SCOPES,
  CAPA_SEVERITIES,
  CAPA_SOURCE_TYPES,
  IMMEDIATE_ACTION_STATUSES,
  IMMEDIATE_ACTION_TYPES,
  RCA_METHODS,
  assertCapaTransition,
  canReopenTo,
  type ActionStatus,
  type ActionType,
  type CapaEvidenceType,
  type CapaPriority,
  type CapaScope,
  type CapaSeverity,
  type CapaSourceType,
  type CapaStatus,
  type EffectivenessResult,
  type ImmediateActionStatus,
  type ImmediateActionType,
  type RcaMethod,
} from '@/features/capa/capa-state';

// --- Errores -----------------------------------------------------------------

export class CapaPermissionError extends Error {
  constructor(message = 'No tienes permiso para esta acción.') {
    super(message);
    this.name = 'CapaPermissionError';
  }
}
export class CapaValidationError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super('Validación de la CAPA fallida.');
    this.name = 'CapaValidationError';
    this.errors = errors;
  }
}
export class CapaNotFoundError extends Error {
  constructor(message = 'CAPA no encontrada.') {
    super(message);
    this.name = 'CapaNotFoundError';
  }
}

type Tx = Prisma.TransactionClient;
type Capa = Prisma.CapaGetPayload<object>;

/** Umbral de "acción próxima a vencer" (días), configurable. */
export function actionSoonDays(): number {
  const raw = Number(process.env.CAPA_ACTION_SOON_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : 15;
}

// --- Permisos ----------------------------------------------------------------

async function memberRole(organizationId: string, userId: string): Promise<string> {
  const m = await getPrisma().membership.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!m) throw new CapaPermissionError('No perteneces a esta organización.');
  return m.role;
}

const isAdmin = (role: string) => role === 'owner' || role === 'admin';
const canCreate = (role: string) => isAdmin(role) || role === 'evaluator';

/** Puede editar/gestionar la CAPA: admin, responsable, creador o reportante. */
function isEditor(capa: Capa, role: string, userId: string): boolean {
  return (
    isAdmin(role) ||
    capa.responsibleUserId === userId ||
    capa.createdBy === userId ||
    capa.reportedBy === userId
  );
}

async function loadCapa(organizationId: string, capaId: string): Promise<Capa> {
  const capa = await getPrisma().capa.findFirst({ where: { id: capaId, organizationId } });
  if (!capa || capa.deletedAt) throw new CapaNotFoundError();
  return capa;
}

function assertOpen(capa: Capa): void {
  if (capa.status === 'closed' || capa.status === 'cancelled') {
    throw new CapaValidationError(['La CAPA está en solo lectura (cerrada o cancelada).']);
  }
}

async function recordHistory(
  tx: Tx,
  organizationId: string,
  capaId: string,
  event: string,
  actorUserId: string,
  opts: {
    fromStatus?: string | null;
    toStatus?: string | null;
    detail?: string;
    related?: string;
  } = {},
): Promise<void> {
  await tx.capaStatusHistory.create({
    data: {
      organizationId,
      capaId,
      event,
      fromStatus: opts.fromStatus ?? null,
      toStatus: opts.toStatus ?? null,
      actorUserId,
      detail: opts.detail ?? null,
      relatedEntity: opts.related ?? null,
    },
  });
}

// --- Utilidades de entrada ---------------------------------------------------

const inSet = <T extends string>(set: readonly T[], v: unknown, fallback: T): T =>
  (set as readonly string[]).includes(v as string) ? (v as T) : fallback;

function cleanImpacts(values: string[] | undefined): string[] {
  const allowed = new Set([
    'quality',
    'safety',
    'legal',
    'customer',
    'product',
    'process',
    'personnel',
    'environment',
    'cost',
    'reputation',
  ]);
  return [...new Set((values ?? []).filter((v) => allowed.has(v)))];
}

// --- Folio -------------------------------------------------------------------

/** Siguiente folio `CAPA-AAAA-####` de forma atómica (contador por org y año). */
async function nextFolio(tx: Tx, organizationId: string, year: number): Promise<string> {
  const rows = await tx.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO capa_folio_counters ("organization_id", "year", "last_seq")
    VALUES (${organizationId}::uuid, ${year}, 1)
    ON CONFLICT ("organization_id", "year")
    DO UPDATE SET "last_seq" = capa_folio_counters."last_seq" + 1
    RETURNING "last_seq"`;
  const seq = rows[0]?.last_seq ?? 1;
  return `CAPA-${year}-${String(seq).padStart(4, '0')}`;
}

// --- Creación / edición ------------------------------------------------------

export interface CapaInput {
  title: string;
  description: string;
  sourceType: CapaSourceType;
  siteId?: string | null;
  area?: string | null;
  process?: string | null;
  product?: string | null;
  diagnosticId?: string | null;
  documentId?: string | null;
  documentVersionId?: string | null;
  requirementId?: string | null;
  findingId?: string | null;
  externalReference?: string | null;
  detectedAt?: string | null;
  responsibleUserId?: string | null;
  priority?: CapaPriority;
  severity?: CapaSeverity;
  impacts?: string[];
  scope?: CapaScope;
  targetDate?: string | null;
  tags?: string[];
  // Descripción estructurada (5W2H + condición/requisito/evidencia).
  problemWhat?: string | null;
  problemWhere?: string | null;
  problemWhen?: string | null;
  problemWhoDetect?: string | null;
  problemWhoAffect?: string | null;
  problemHowMuch?: string | null;
  problemHow?: string | null;
  conditionObserved?: string | null;
  requirementBreached?: string | null;
  objectiveEvidence?: string | null;
  knownScope?: string | null;
  knownRecurrence?: string | null;
  relatedRefs?: string | null;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value.length <= 10 ? `${value}T00:00:00.000Z` : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Crea una CAPA en borrador con folio automático. owner/admin/evaluator. */
export async function createCapa(
  organizationId: string,
  actorId: string,
  input: CapaInput,
): Promise<string> {
  const role = await memberRole(organizationId, actorId);
  if (!canCreate(role)) throw new CapaPermissionError('Tu rol no permite registrar CAPA.');

  const errors: string[] = [];
  if (!input.title?.trim()) errors.push('Falta el título.');
  if (!input.description?.trim()) errors.push('Falta la descripción.');
  if (!(CAPA_SOURCE_TYPES as readonly string[]).includes(input.sourceType))
    errors.push('Tipo/origen no válido.');
  if (errors.length) throw new CapaValidationError(errors);

  const detectedAt = toDate(input.detectedAt) ?? new Date();
  const year = detectedAt.getUTCFullYear();

  return withOrgContext(organizationId, async (tx) => {
    const folio = await nextFolio(tx, organizationId, year);
    const capa = await tx.capa.create({
      data: {
        organizationId,
        folio,
        year,
        title: input.title.trim(),
        description: input.description.trim(),
        sourceType: input.sourceType,
        status: 'draft',
        siteId: input.siteId || null,
        area: input.area?.trim() || null,
        process: input.process?.trim() || null,
        product: input.product?.trim() || null,
        diagnosticId: input.diagnosticId || null,
        documentId: input.documentId || null,
        documentVersionId: input.documentVersionId || null,
        requirementId: input.requirementId || null,
        findingId: input.findingId || null,
        externalReference: input.externalReference?.trim() || null,
        detectedAt,
        reportedBy: actorId,
        responsibleUserId: input.responsibleUserId || null,
        priority: inSet(CAPA_PRIORITIES, input.priority, 'normal'),
        severity: inSet(CAPA_SEVERITIES, input.severity, 'medium'),
        impacts: cleanImpacts(input.impacts),
        scope: inSet(CAPA_SCOPES, input.scope, 'point'),
        targetDate: toDate(input.targetDate),
        tags: [...new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean))],
        problemWhat: input.problemWhat?.trim() || null,
        problemWhere: input.problemWhere?.trim() || null,
        problemWhen: input.problemWhen?.trim() || null,
        problemWhoDetect: input.problemWhoDetect?.trim() || null,
        problemWhoAffect: input.problemWhoAffect?.trim() || null,
        problemHowMuch: input.problemHowMuch?.trim() || null,
        problemHow: input.problemHow?.trim() || null,
        conditionObserved: input.conditionObserved?.trim() || null,
        requirementBreached: input.requirementBreached?.trim() || null,
        objectiveEvidence: input.objectiveEvidence?.trim() || null,
        knownScope: input.knownScope?.trim() || null,
        knownRecurrence: input.knownRecurrence?.trim() || null,
        relatedRefs: input.relatedRefs?.trim() || null,
        createdBy: actorId,
      },
    });
    await recordHistory(tx, organizationId, capa.id, 'created', actorId, {
      toStatus: 'draft',
      detail: `Folio ${folio}`,
    });
    return capa.id;
  });
}

/** Actualiza campos de una CAPA abierta. Editor (admin/responsable/creador). */
export async function updateCapa(
  organizationId: string,
  actorId: string,
  capaId: string,
  input: Partial<CapaInput>,
): Promise<void> {
  const capa = await loadCapa(organizationId, capaId);
  const role = await memberRole(organizationId, actorId);
  if (!isEditor(capa, role, actorId)) throw new CapaPermissionError();
  assertOpen(capa);

  const data: Prisma.CapaUpdateInput = {};
  const set = <K extends keyof Prisma.CapaUpdateInput>(k: K, v: Prisma.CapaUpdateInput[K]) => {
    if (v !== undefined) data[k] = v;
  };
  if (input.title !== undefined) set('title', input.title.trim());
  if (input.description !== undefined) set('description', input.description.trim());
  if (input.sourceType !== undefined)
    set(
      'sourceType',
      inSet(CAPA_SOURCE_TYPES, input.sourceType, capa.sourceType as CapaSourceType),
    );
  if (input.responsibleUserId !== undefined)
    set('responsibleUserId', input.responsibleUserId || null);
  if (input.priority !== undefined)
    set('priority', inSet(CAPA_PRIORITIES, input.priority, capa.priority as CapaPriority));
  if (input.severity !== undefined)
    set('severity', inSet(CAPA_SEVERITIES, input.severity, capa.severity as CapaSeverity));
  if (input.scope !== undefined)
    set('scope', inSet(CAPA_SCOPES, input.scope, capa.scope as CapaScope));
  if (input.impacts !== undefined) set('impacts', cleanImpacts(input.impacts));
  if (input.tags !== undefined)
    set('tags', [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))]);
  if (input.targetDate !== undefined) set('targetDate', toDate(input.targetDate));
  if (input.detectedAt !== undefined)
    set('detectedAt', toDate(input.detectedAt) ?? capa.detectedAt);
  if (input.siteId !== undefined) set('siteId', input.siteId || null);
  if (input.area !== undefined) set('area', input.area?.trim() || null);
  if (input.process !== undefined) set('process', input.process?.trim() || null);
  if (input.product !== undefined) set('product', input.product?.trim() || null);
  if (input.diagnosticId !== undefined) set('diagnosticId', input.diagnosticId || null);
  if (input.documentId !== undefined) set('documentId', input.documentId || null);
  if (input.documentVersionId !== undefined)
    set('documentVersionId', input.documentVersionId || null);
  if (input.requirementId !== undefined) set('requirementId', input.requirementId || null);
  if (input.findingId !== undefined) set('findingId', input.findingId || null);
  if (input.externalReference !== undefined)
    set('externalReference', input.externalReference?.trim() || null);
  for (const k of [
    'problemWhat',
    'problemWhere',
    'problemWhen',
    'problemWhoDetect',
    'problemWhoAffect',
    'problemHowMuch',
    'problemHow',
    'conditionObserved',
    'requirementBreached',
    'objectiveEvidence',
    'knownScope',
    'knownRecurrence',
    'relatedRefs',
  ] as const) {
    if (input[k] !== undefined) set(k, (input[k] as string | null)?.trim() || null);
  }

  await withOrgContext(organizationId, async (tx) => {
    await tx.capa.update({ where: { id: capaId }, data });
    if (
      input.responsibleUserId !== undefined &&
      input.responsibleUserId !== capa.responsibleUserId
    ) {
      await recordHistory(tx, organizationId, capaId, 'responsible_assigned', actorId, {
        detail: 'Responsable actualizado',
      });
    }
  });
}

/** Borrado lógico (solo borrador). owner/admin. */
export async function deleteCapaDraft(
  organizationId: string,
  actorId: string,
  capaId: string,
): Promise<void> {
  const capa = await loadCapa(organizationId, capaId);
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role)) throw new CapaPermissionError('Solo owner/admin elimina un borrador.');
  if (capa.status !== 'draft')
    throw new CapaValidationError(['Solo un borrador puede eliminarse lógicamente.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.capa.update({ where: { id: capaId }, data: { deletedAt: new Date() } });
  });
}

// --- Contención / corrección inmediata ---------------------------------------

export async function addImmediateAction(
  organizationId: string,
  actorId: string,
  capaId: string,
  input: {
    actionType: ImmediateActionType;
    description: string;
    responsibleUserId?: string | null;
    committedAt?: string | null;
    executedAt?: string | null;
    status?: ImmediateActionStatus;
    result?: string | null;
    estimatedCost?: string | null;
  },
): Promise<string> {
  const capa = await loadCapa(organizationId, capaId);
  const role = await memberRole(organizationId, actorId);
  if (!isEditor(capa, role, actorId)) throw new CapaPermissionError();
  assertOpen(capa);
  if (!input.description?.trim())
    throw new CapaValidationError(['La acción inmediata requiere descripción.']);

  const cost = input.estimatedCost ? Number(input.estimatedCost) : null;
  return withOrgContext(organizationId, async (tx) => {
    const row = await tx.capaImmediateAction.create({
      data: {
        organizationId,
        capaId,
        actionType: inSet(IMMEDIATE_ACTION_TYPES, input.actionType, 'containment'),
        description: input.description.trim(),
        responsibleUserId: input.responsibleUserId || null,
        committedAt: toDate(input.committedAt),
        executedAt: toDate(input.executedAt),
        status: inSet(IMMEDIATE_ACTION_STATUSES, input.status, 'pending'),
        result: input.result?.trim() || null,
        estimatedCost: cost !== null && Number.isFinite(cost) ? new Prisma.Decimal(cost) : null,
        createdBy: actorId,
      },
    });
    await recordHistory(tx, organizationId, capaId, 'containment_added', actorId, {
      detail: input.description.trim().slice(0, 120),
      related: 'immediate_action',
    });
    return row.id;
  });
}

export async function updateImmediateAction(
  organizationId: string,
  actorId: string,
  actionId: string,
  input: { status?: ImmediateActionStatus; executedAt?: string | null; result?: string | null },
): Promise<void> {
  const action = await getPrisma().capaImmediateAction.findFirst({
    where: { id: actionId, organizationId },
  });
  if (!action) throw new CapaNotFoundError('Acción inmediata no encontrada.');
  const capa = await loadCapa(organizationId, action.capaId);
  const role = await memberRole(organizationId, actorId);
  if (!isEditor(capa, role, actorId)) throw new CapaPermissionError();
  assertOpen(capa);
  await withOrgContext(organizationId, async (tx) => {
    await tx.capaImmediateAction.update({
      where: { id: actionId },
      data: {
        status: input.status
          ? inSet(IMMEDIATE_ACTION_STATUSES, input.status, action.status as ImmediateActionStatus)
          : undefined,
        executedAt: input.executedAt !== undefined ? toDate(input.executedAt) : undefined,
        result: input.result !== undefined ? input.result?.trim() || null : undefined,
      },
    });
  });
}

// --- Investigación y causa raíz ----------------------------------------------

export async function saveRootCause(
  organizationId: string,
  actorId: string,
  capaId: string,
  input: {
    method: RcaMethod;
    immediateCause?: string | null;
    contributingCause?: string | null;
    rootCause?: string | null;
    justification?: string | null;
    investigatorUserId?: string | null;
    conclude?: boolean;
    whys?: { level: number; question?: string | null; answer: string }[];
  },
): Promise<void> {
  const capa = await loadCapa(organizationId, capaId);
  const role = await memberRole(organizationId, actorId);
  if (!isEditor(capa, role, actorId)) throw new CapaPermissionError();
  assertOpen(capa);

  const method = inSet(RCA_METHODS, input.method, 'five_whys');
  if (input.conclude && !input.rootCause?.trim())
    throw new CapaValidationError(['Para concluir la causa raíz indica la conclusión.']);

  await withOrgContext(organizationId, async (tx) => {
    const existing = await tx.capaRootCauseAnalysis.findFirst({
      where: { capaId, organizationId },
    });
    const rca = existing
      ? await tx.capaRootCauseAnalysis.update({
          where: { id: existing.id },
          data: {
            method,
            immediateCause: input.immediateCause?.trim() || null,
            contributingCause: input.contributingCause?.trim() || null,
            rootCause: input.rootCause?.trim() || null,
            justification: input.justification?.trim() || null,
            investigatorUserId: input.investigatorUserId || existing.investigatorUserId,
            concludedAt: input.conclude ? new Date() : existing.concludedAt,
          },
        })
      : await tx.capaRootCauseAnalysis.create({
          data: {
            organizationId,
            capaId,
            method,
            immediateCause: input.immediateCause?.trim() || null,
            contributingCause: input.contributingCause?.trim() || null,
            rootCause: input.rootCause?.trim() || null,
            justification: input.justification?.trim() || null,
            investigatorUserId: input.investigatorUserId || actorId,
            concludedAt: input.conclude ? new Date() : null,
            createdBy: actorId,
          },
        });

    if (method === 'five_whys' && input.whys) {
      // Reemplaza los pasos (no se borran físicamente: se sobreescriben por nivel).
      for (const w of input.whys) {
        if (w.level < 1 || w.level > 5 || !w.answer?.trim()) continue;
        const prev = await tx.capaWhyStep.findFirst({ where: { rcaId: rca.id, level: w.level } });
        if (prev) {
          await tx.capaWhyStep.update({
            where: { id: prev.id },
            data: { question: w.question?.trim() || null, answer: w.answer.trim() },
          });
        } else {
          await tx.capaWhyStep.create({
            data: {
              organizationId,
              capaId,
              rcaId: rca.id,
              level: w.level,
              question: w.question?.trim() || null,
              answer: w.answer.trim(),
            },
          });
        }
      }
    }

    await recordHistory(
      tx,
      organizationId,
      capaId,
      input.conclude ? 'root_cause_concluded' : 'investigation_updated',
      actorId,
      { detail: input.conclude ? 'Causa raíz concluida' : 'Investigación actualizada' },
    );
  });
}

// --- Plan de acciones --------------------------------------------------------

export async function addAction(
  organizationId: string,
  actorId: string,
  capaId: string,
  input: {
    actionType: ActionType;
    description: string;
    responsibleUserId?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
    priority?: CapaPriority;
    documentId?: string | null;
    documentVersionId?: string | null;
    docChangeRequest?: string | null;
  },
): Promise<string> {
  const capa = await loadCapa(organizationId, capaId);
  const role = await memberRole(organizationId, actorId);
  if (!isEditor(capa, role, actorId)) throw new CapaPermissionError();
  assertOpen(capa);
  if (!input.description?.trim())
    throw new CapaValidationError(['La acción requiere descripción.']);

  return withOrgContext(organizationId, async (tx) => {
    const row = await tx.capaAction.create({
      data: {
        organizationId,
        capaId,
        actionType: inSet(ACTION_TYPES, input.actionType, 'corrective'),
        description: input.description.trim(),
        responsibleUserId: input.responsibleUserId || null,
        startDate: toDate(input.startDate),
        dueDate: toDate(input.dueDate),
        priority: inSet(CAPA_PRIORITIES, input.priority, 'normal'),
        documentId: input.documentId || null,
        documentVersionId: input.documentVersionId || null,
        docChangeRequest: input.docChangeRequest?.trim() || null,
        createdBy: actorId,
      },
    });
    await recordHistory(tx, organizationId, capaId, 'action_created', actorId, {
      detail: input.description.trim().slice(0, 120),
      related: 'action',
    });
    return row.id;
  });
}

export async function updateAction(
  organizationId: string,
  actorId: string,
  actionId: string,
  input: {
    status?: ActionStatus;
    progress?: number;
    responsibleUserId?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
    result?: string | null;
    comment?: string | null;
  },
): Promise<void> {
  const action = await getPrisma().capaAction.findFirst({
    where: { id: actionId, organizationId },
  });
  if (!action) throw new CapaNotFoundError('Acción no encontrada.');
  const capa = await loadCapa(organizationId, action.capaId);
  const role = await memberRole(organizationId, actorId);
  if (!isEditor(capa, role, actorId)) throw new CapaPermissionError();
  assertOpen(capa);

  let status = action.status as ActionStatus;
  if (input.status) status = inSet(ACTION_STATUSES, input.status, status);
  let progress = input.progress ?? action.progress;
  if (progress < 0) progress = 0;
  if (progress > 100) progress = 100;
  if (status === 'completed') progress = 100;

  await withOrgContext(organizationId, async (tx) => {
    await tx.capaAction.update({
      where: { id: actionId },
      data: {
        status,
        progress,
        responsibleUserId:
          input.responsibleUserId !== undefined ? input.responsibleUserId || null : undefined,
        startDate: input.startDate !== undefined ? toDate(input.startDate) : undefined,
        dueDate: input.dueDate !== undefined ? toDate(input.dueDate) : undefined,
        result: input.result !== undefined ? input.result?.trim() || null : undefined,
        comment: input.comment !== undefined ? input.comment?.trim() || null : undefined,
        closedAt: status === 'completed' ? (action.closedAt ?? new Date()) : action.closedAt,
      },
    });
    await recordHistory(tx, organizationId, action.capaId, 'action_updated', actorId, {
      detail: `Acción ${status} (${progress}%)`,
      related: 'action',
    });
  });
}

// --- Verificación de eficacia ------------------------------------------------

export async function addEffectivenessReview(
  organizationId: string,
  actorId: string,
  capaId: string,
  input: {
    criterion: string;
    method?: string | null;
    plannedAt?: string | null;
    executedAt?: string | null;
    verifierUserId?: string | null;
    followUpPeriod?: string | null;
    observedResult?: string | null;
    conclusion: EffectivenessResult;
    comment?: string | null;
    requiresNewAction?: boolean;
    requiresReopen?: boolean;
  },
): Promise<string> {
  const capa = await loadCapa(organizationId, capaId);
  const role = await memberRole(organizationId, actorId);
  if (!isEditor(capa, role, actorId)) throw new CapaPermissionError();
  assertOpen(capa);

  const errors: string[] = [];
  if (!input.criterion?.trim()) errors.push('Falta el criterio de eficacia.');
  const conclusion = input.conclusion;
  if (!['effective', 'partially_effective', 'not_effective'].includes(conclusion))
    errors.push('Conclusión no válida.');
  if (conclusion === 'partially_effective' && !input.requiresNewAction && !input.comment?.trim())
    errors.push('Parcialmente eficaz requiere una acción adicional o una justificación.');
  if (errors.length) throw new CapaValidationError(errors);

  // El verificador no debe ser el único ejecutor de las acciones cuando existe
  // otro usuario disponible (segregación básica de funciones).
  const verifier = input.verifierUserId || actorId;
  const actions = await getPrisma().capaAction.findMany({
    where: { capaId, organizationId },
    select: { responsibleUserId: true },
  });
  const responsibles = new Set(actions.map((a) => a.responsibleUserId).filter(Boolean) as string[]);
  if (responsibles.has(verifier)) {
    const others = await getPrisma().membership.count({
      where: { organizationId, status: 'active', userId: { not: verifier } },
    });
    if (others > 0)
      throw new CapaValidationError([
        'La verificación de eficacia no puede realizarla la misma persona que ejecutó la acción cuando hay otro usuario disponible.',
      ]);
  }

  return withOrgContext(organizationId, async (tx) => {
    const row = await tx.capaEffectivenessReview.create({
      data: {
        organizationId,
        capaId,
        criterion: input.criterion.trim(),
        method: input.method?.trim() || null,
        plannedAt: toDate(input.plannedAt),
        executedAt: toDate(input.executedAt),
        verifierUserId: verifier,
        followUpPeriod: input.followUpPeriod?.trim() || null,
        observedResult: input.observedResult?.trim() || null,
        conclusion,
        comment: input.comment?.trim() || null,
        requiresNewAction: Boolean(input.requiresNewAction),
        requiresReopen: Boolean(input.requiresReopen),
        createdBy: actorId,
      },
    });
    await recordHistory(tx, organizationId, capaId, 'effectiveness_evaluated', actorId, {
      detail: `Conclusión: ${conclusion}`,
      related: 'effectiveness',
    });
    return row.id;
  });
}

// --- Transiciones de estado --------------------------------------------------

async function latestEffectiveness(organizationId: string, capaId: string) {
  return getPrisma().capaEffectivenessReview.findFirst({
    where: { capaId, organizationId },
    orderBy: { createdAt: 'desc' },
  });
}

/** Valida las precondiciones de una transición de avance. */
async function assertStageRequirements(
  organizationId: string,
  capa: Capa,
  to: CapaStatus,
  justification?: string,
): Promise<void> {
  const errors: string[] = [];
  if (to === 'reported') {
    if (!capa.responsibleUserId) errors.push('Asigna un responsable.');
    if (!capa.targetDate) errors.push('Define una fecha objetivo.');
  }
  if (to === 'under_investigation') {
    const count = await getPrisma().capaImmediateAction.count({
      where: { capaId: capa.id, organizationId },
    });
    if (count === 0 && !justification?.trim())
      errors.push('Registra una acción inmediata o justifica por qué no aplica.');
  }
  if (to === 'action_plan') {
    if (!capa.problemWhat?.trim() && !capa.conditionObserved?.trim())
      errors.push('Describe el problema (qué ocurrió o condición observada).');
    const evidence =
      Boolean(capa.objectiveEvidence?.trim()) ||
      (await getPrisma().capaFile.count({
        where: {
          capaId: capa.id,
          organizationId,
          evidenceType: { in: ['finding', 'investigation'] },
        },
      })) > 0;
    if (!evidence) errors.push('Adjunta evidencia objetiva de la investigación.');
    const rca = await getPrisma().capaRootCauseAnalysis.findFirst({
      where: { capaId: capa.id, organizationId },
    });
    if (!rca?.rootCause?.trim()) errors.push('Concluye la causa raíz.');
  }
  if (to === 'in_implementation') {
    const actions = await getPrisma().capaAction.findMany({
      where: { capaId: capa.id, organizationId },
    });
    if (actions.length === 0) errors.push('Agrega al menos una acción al plan.');
    if (actions.some((a) => !a.responsibleUserId || !a.dueDate))
      errors.push('Cada acción requiere responsable y fecha compromiso.');
  }
  if (to === 'effectiveness_review') {
    const pending = await getPrisma().capaAction.count({
      where: { capaId: capa.id, organizationId, status: { notIn: ['completed', 'cancelled'] } },
    });
    if (pending > 0)
      errors.push('Completa (o cancela) todas las acciones antes de verificar la eficacia.');
  }
  if (to === 'closed') {
    const rca = await getPrisma().capaRootCauseAnalysis.findFirst({
      where: { capaId: capa.id, organizationId },
    });
    if (!rca?.rootCause?.trim()) errors.push('Falta la causa raíz.');
    const review = await latestEffectiveness(organizationId, capa.id);
    if (!review) errors.push('Falta la verificación de eficacia.');
    else if (review.conclusion !== 'effective')
      errors.push('La verificación de eficacia debe ser "eficaz" para cerrar.');
  }
  if (errors.length) throw new CapaValidationError(errors);
}

/** Avanza/cambia el estado de una CAPA respetando la máquina de estados. */
export async function transitionCapa(
  organizationId: string,
  actorId: string,
  capaId: string,
  to: CapaStatus,
  opts: { justification?: string; reason?: string } = {},
): Promise<void> {
  const capa = await loadCapa(organizationId, capaId);
  const role = await memberRole(organizationId, actorId);
  const from = capa.status as CapaStatus;
  assertCapaTransition(from, to);

  // Permisos: cancelación y cierre son de owner/admin; avances los realiza el editor.
  if (to === 'cancelled') {
    const isDraftOwner = from === 'draft' && isEditor(capa, role, actorId);
    if (!isAdmin(role) && !isDraftOwner)
      throw new CapaPermissionError('Solo owner/admin puede cancelar (o el creador en borrador).');
    if (!opts.reason?.trim())
      throw new CapaValidationError(['Indica el motivo de la cancelación.']);
  } else if (to === 'closed') {
    if (!isAdmin(role)) throw new CapaPermissionError('El cierre requiere owner/admin.');
  } else if (!isEditor(capa, role, actorId)) {
    throw new CapaPermissionError();
  }

  if (to !== 'cancelled')
    await assertStageRequirements(organizationId, capa, to, opts.justification);

  await withOrgContext(organizationId, async (tx) => {
    await tx.capa.update({ where: { id: capaId }, data: { status: to } });
    const event =
      to === 'reported' ? 'reported' : to === 'cancelled' ? 'cancelled' : 'status_changed';
    await recordHistory(tx, organizationId, capaId, event, actorId, {
      fromStatus: from,
      toStatus: to,
      detail: opts.reason?.trim() || opts.justification?.trim() || undefined,
    });
  });
}

/** Cierra la CAPA con conclusión, checksum/snapshot y responsable de cierre. */
export async function closeCapa(
  organizationId: string,
  actorId: string,
  capaId: string,
  input: { summary: string },
): Promise<void> {
  const capa = await loadCapa(organizationId, capaId);
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role)) throw new CapaPermissionError('El cierre requiere owner/admin.');
  assertCapaTransition(capa.status as CapaStatus, 'closed');
  if (!input.summary?.trim()) throw new CapaValidationError(['Escribe una conclusión de cierre.']);
  await assertStageRequirements(organizationId, capa, 'closed');

  // Snapshot de datos relevantes + checksum (acuse interno, no firma legal).
  const [rca, actions, reviews] = await Promise.all([
    getPrisma().capaRootCauseAnalysis.findFirst({ where: { capaId, organizationId } }),
    getPrisma().capaAction.findMany({ where: { capaId, organizationId } }),
    getPrisma().capaEffectivenessReview.findMany({ where: { capaId, organizationId } }),
  ]);
  const snapshot = {
    folio: capa.folio,
    rootCause: rca?.rootCause ?? null,
    actions: actions.map((a) => ({ id: a.id, status: a.status, progress: a.progress })),
    effectiveness: reviews.map((r) => ({ id: r.id, conclusion: r.conclusion })),
    closedBy: actorId,
  };
  const checksum = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');

  await withOrgContext(organizationId, async (tx) => {
    await tx.capa.update({
      where: { id: capaId },
      data: {
        status: 'closed',
        closedBy: actorId,
        closedAt: new Date(),
        closureSummary: input.summary.trim(),
        closureChecksum: checksum,
        closureSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
    await recordHistory(tx, organizationId, capaId, 'closed', actorId, {
      fromStatus: capa.status,
      toStatus: 'closed',
      detail: `Cierre (checksum ${checksum.slice(0, 12)}…)`,
    });
  });
}

/** Reabre una CAPA cerrada. Solo owner/admin; conserva el cierre anterior. */
export async function reopenCapa(
  organizationId: string,
  actorId: string,
  capaId: string,
  input: {
    reason: string;
    target: CapaStatus;
    responsibleUserId: string;
    targetDate: string;
  },
): Promise<void> {
  const capa = await loadCapa(organizationId, capaId);
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role)) throw new CapaPermissionError('La reapertura requiere owner/admin.');
  if (capa.status !== 'closed')
    throw new CapaValidationError(['Solo una CAPA cerrada puede reabrirse.']);
  if (!canReopenTo(input.target))
    throw new CapaValidationError(['Destino de reapertura no válido.']);
  const errors: string[] = [];
  if (!input.reason?.trim()) errors.push('Indica el motivo de la reapertura.');
  if (!input.responsibleUserId) errors.push('Asigna un nuevo responsable.');
  const newDate = toDate(input.targetDate);
  if (!newDate) errors.push('Define una nueva fecha objetivo.');
  if (errors.length) throw new CapaValidationError(errors);

  await withOrgContext(organizationId, async (tx) => {
    await tx.capa.update({
      where: { id: capaId },
      data: {
        status: input.target,
        responsibleUserId: input.responsibleUserId,
        targetDate: newDate,
        reopenCount: { increment: 1 },
      },
    });
    await recordHistory(tx, organizationId, capaId, 'reopened', actorId, {
      fromStatus: 'closed',
      toStatus: input.target,
      detail: input.reason.trim(),
    });
  });
}

// --- Comentarios y archivos --------------------------------------------------

export async function addComment(
  organizationId: string,
  actorId: string,
  capaId: string,
  body: string,
): Promise<void> {
  const capa = await loadCapa(organizationId, capaId);
  await memberRole(organizationId, actorId);
  if (!body?.trim()) throw new CapaValidationError(['El comentario está vacío.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.capaComment.create({
      data: { organizationId, capaId: capa.id, author: actorId, body: body.trim() },
    });
  });
}

/** Registra una evidencia (metadata) tras guardar el binario fuera de PostgreSQL. */
export async function addFile(
  organizationId: string,
  actorId: string,
  capaId: string,
  input: {
    evidenceType: CapaEvidenceType;
    originalName: string;
    mimeType: string;
    data: Buffer;
    actionId?: string | null;
    immediateActionId?: string | null;
  },
): Promise<string> {
  const capa = await loadCapa(organizationId, capaId);
  const role = await memberRole(organizationId, actorId);
  if (!isEditor(capa, role, actorId)) throw new CapaPermissionError();
  assertOpen(capa);

  const saved = await saveDocumentFile({
    organizationId,
    originalName: input.originalName,
    mimeType: input.mimeType,
    data: input.data,
  });
  return withOrgContext(organizationId, async (tx) => {
    const row = await tx.capaFile.create({
      data: {
        organizationId,
        capaId,
        evidenceType: inSet(CAPA_EVIDENCE_TYPES, input.evidenceType, 'finding'),
        actionId: input.actionId || null,
        immediateActionId: input.immediateActionId || null,
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
    await recordHistory(tx, organizationId, capaId, 'evidence_added', actorId, {
      detail: saved.originalName,
      related: 'file',
    });
    return row.id;
  });
}

// --- Consultas (listado, detalle, bandeja, alertas) --------------------------

function daysBetween(target: Date | null, now: Date): number | null {
  if (!target) return null;
  const ms = target.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export interface CapaListFilters {
  search?: string;
  siteId?: string;
  responsibleUserId?: string;
  status?: string;
  priority?: string;
  severity?: string;
  sourceType?: string;
  overdue?: boolean;
}

export async function listCapas(organizationId: string, filters: CapaListFilters = {}) {
  const where: Prisma.CapaWhereInput = { organizationId, deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.severity) where.severity = filters.severity;
  if (filters.sourceType) where.sourceType = filters.sourceType;
  if (filters.siteId) where.siteId = filters.siteId;
  if (filters.responsibleUserId) where.responsibleUserId = filters.responsibleUserId;
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { folio: { contains: q, mode: 'insensitive' } },
      { title: { contains: q, mode: 'insensitive' } },
    ];
  }
  const now = new Date();
  const rows = await getPrisma().capa.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    take: 500,
  });
  const [members, sites, actionAgg] = await Promise.all([
    memberDirectory(organizationId),
    siteDirectory(organizationId),
    getPrisma().capaAction.groupBy({
      by: ['capaId'],
      where: { organizationId },
      _avg: { progress: true },
    }),
  ]);
  const progressByCapa = new Map(
    actionAgg.map((a) => [a.capaId, Math.round(a._avg.progress ?? 0)]),
  );

  const list = rows.map((c) => {
    const days = daysBetween(c.targetDate, now);
    return {
      id: c.id,
      folio: c.folio,
      title: c.title,
      sourceType: c.sourceType,
      status: c.status,
      severity: c.severity,
      priority: c.priority,
      siteName: c.siteId ? (sites.get(c.siteId) ?? null) : null,
      responsibleName: c.responsibleUserId ? (members.get(c.responsibleUserId) ?? null) : null,
      targetDate: c.targetDate ? c.targetDate.toISOString().slice(0, 10) : null,
      daysRemaining: days,
      overdue: days !== null && days < 0 && c.status !== 'closed' && c.status !== 'cancelled',
      progress: progressByCapa.get(c.id) ?? 0,
    };
  });
  return filters.overdue ? list.filter((c) => c.overdue) : list;
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

async function siteDirectory(organizationId: string): Promise<Map<string, string>> {
  const sites = await getPrisma().site.findMany({
    where: { organizationId, deletedAt: null },
    select: { id: true, name: true },
  });
  return new Map(sites.map((s) => [s.id, s.name]));
}

export async function listMembers(organizationId: string) {
  const members = await getPrisma().membership.findMany({
    where: { organizationId, status: 'active' },
    select: { userId: true, role: true },
  });
  const users = await getPrisma().user.findMany({
    where: { id: { in: members.map((m) => m.userId) } },
    select: { id: true, displayName: true, email: true },
  });
  const roleById = new Map(members.map((m) => [m.userId, m.role]));
  return users.map((u) => ({
    id: u.id,
    name: u.displayName ?? u.email,
    role: roleById.get(u.id) ?? 'viewer',
  }));
}

/** Opciones para el formulario de creación (sitios, diagnósticos, documentos). */
export async function getCreateOptions(organizationId: string) {
  const [members, sites, diagnostics, documents] = await Promise.all([
    listMembers(organizationId),
    getPrisma().site.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    getPrisma().diagnostic.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    getPrisma().document.findMany({
      where: { organizationId },
      select: { id: true, code: true, title: true },
      orderBy: { code: 'asc' },
      take: 300,
    }),
  ]);
  return { members, sites, diagnostics, documents };
}

/** Detalle completo de una CAPA con sus entidades relacionadas. */
export async function getCapaDetail(organizationId: string, capaId: string) {
  const capa = await loadCapa(organizationId, capaId);
  const [
    immediateActions,
    rca,
    whySteps,
    actions,
    reviews,
    files,
    relations,
    history,
    comments,
    members,
    sites,
  ] = await Promise.all([
    getPrisma().capaImmediateAction.findMany({
      where: { capaId, organizationId },
      orderBy: { createdAt: 'asc' },
    }),
    getPrisma().capaRootCauseAnalysis.findFirst({ where: { capaId, organizationId } }),
    getPrisma().capaWhyStep.findMany({
      where: { capaId, organizationId },
      orderBy: { level: 'asc' },
    }),
    getPrisma().capaAction.findMany({
      where: { capaId, organizationId },
      orderBy: { createdAt: 'asc' },
    }),
    getPrisma().capaEffectivenessReview.findMany({
      where: { capaId, organizationId },
      orderBy: { createdAt: 'desc' },
    }),
    getPrisma().capaFile.findMany({
      where: { capaId, organizationId },
      orderBy: { createdAt: 'desc' },
    }),
    getPrisma().capaRelation.findMany({ where: { capaId, organizationId } }),
    getPrisma().capaStatusHistory.findMany({
      where: { capaId, organizationId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    getPrisma().capaComment.findMany({
      where: { capaId, organizationId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    memberDirectory(organizationId),
    siteDirectory(organizationId),
  ]);
  const nameOf = (id: string | null) => (id ? (members.get(id) ?? null) : null);
  return {
    capa,
    siteName: capa.siteId ? (sites.get(capa.siteId) ?? null) : null,
    responsibleName: nameOf(capa.responsibleUserId),
    reporterName: nameOf(capa.reportedBy),
    immediateActions,
    rca,
    whySteps,
    actions,
    reviews,
    files,
    relations,
    history,
    comments,
    nameOf,
  };
}

export interface CapaUserContext {
  role: string;
  isAdmin: boolean;
  canEdit: boolean;
}

export async function getCapaUserContext(
  organizationId: string,
  userId: string,
  capaId: string,
): Promise<CapaUserContext> {
  const capa = await loadCapa(organizationId, capaId);
  const role = await memberRole(organizationId, userId);
  return {
    role,
    isAdmin: isAdmin(role),
    canEdit:
      isEditor(capa, role, userId) && capa.status !== 'closed' && capa.status !== 'cancelled',
  };
}

/** Bandeja de tareas del usuario. */
export async function getCapaTasks(organizationId: string, userId: string) {
  const now = new Date();
  const soon = new Date(now.getTime() + actionSoonDays() * 86_400_000);
  const [
    assigned,
    pendingContainment,
    pendingInvestigation,
    overdueActions,
    upcomingActions,
    verifications,
  ] = await Promise.all([
    getPrisma().capa.findMany({
      where: {
        organizationId,
        deletedAt: null,
        responsibleUserId: userId,
        status: { notIn: ['closed', 'cancelled'] },
      },
      orderBy: { targetDate: 'asc' },
    }),
    getPrisma().capa.findMany({
      where: { organizationId, deletedAt: null, responsibleUserId: userId, status: 'containment' },
    }),
    getPrisma().capa.findMany({
      where: {
        organizationId,
        deletedAt: null,
        responsibleUserId: userId,
        status: 'under_investigation',
      },
    }),
    getPrisma().capaAction.findMany({
      where: {
        organizationId,
        responsibleUserId: userId,
        status: { notIn: ['completed', 'cancelled'] },
        dueDate: { lt: now },
      },
      orderBy: { dueDate: 'asc' },
    }),
    getPrisma().capaAction.findMany({
      where: {
        organizationId,
        responsibleUserId: userId,
        status: { notIn: ['completed', 'cancelled'] },
        dueDate: { gte: now, lte: soon },
      },
      orderBy: { dueDate: 'asc' },
    }),
    getPrisma().capa.findMany({
      where: {
        organizationId,
        deletedAt: null,
        responsibleUserId: userId,
        status: 'effectiveness_review',
      },
    }),
  ]);
  const closures = await getPrisma().capa.findMany({
    where: { organizationId, deletedAt: null, status: 'effectiveness_review' },
  });
  const fmt = (c: { id: string; folio: string; title: string; targetDate: Date | null }) => ({
    id: c.id,
    folio: c.folio,
    title: c.title,
    targetDate: c.targetDate ? c.targetDate.toISOString().slice(0, 10) : null,
  });
  const fmtA = (a: { id: string; capaId: string; description: string; dueDate: Date | null }) => ({
    id: a.id,
    capaId: a.capaId,
    description: a.description,
    dueDate: a.dueDate ? a.dueDate.toISOString().slice(0, 10) : null,
  });
  return {
    assigned: assigned.map(fmt),
    pendingContainment: pendingContainment.map(fmt),
    pendingInvestigation: pendingInvestigation.map(fmt),
    overdueActions: overdueActions.map(fmtA),
    upcomingActions: upcomingActions.map(fmtA),
    verifications: verifications.map(fmt),
    closures: closures.map(fmt),
  };
}

/** Resumen para el panel principal. */
export async function getCapaAlerts(organizationId: string) {
  const now = new Date();
  const openFilter = { notIn: ['closed', 'cancelled'] };
  const [open, critical, overdue, pendingActions, pendingVerifications, recentlyClosed] =
    await Promise.all([
      getPrisma().capa.count({ where: { organizationId, deletedAt: null, status: openFilter } }),
      getPrisma().capa.count({
        where: { organizationId, deletedAt: null, status: openFilter, severity: 'critical' },
      }),
      getPrisma().capa.count({
        where: { organizationId, deletedAt: null, status: openFilter, targetDate: { lt: now } },
      }),
      getPrisma().capaAction.count({
        where: { organizationId, status: { notIn: ['completed', 'cancelled'] } },
      }),
      getPrisma().capa.count({
        where: { organizationId, deletedAt: null, status: 'effectiveness_review' },
      }),
      getPrisma().capa.count({ where: { organizationId, deletedAt: null, status: 'closed' } }),
    ]);
  return { open, critical, overdue, pendingActions, pendingVerifications, recentlyClosed };
}

/** Datos de solo lectura para el panel: distribución por estado/prioridad,
 *  actividad reciente y acciones próximas. No modifica lógica de negocio. */
export async function getCapaDashboard(organizationId: string) {
  const now = new Date();
  const openFilter = { notIn: ['closed', 'cancelled'] };
  const [byStatus, byPriority, recent, upcoming, capas, actionsCompleted, overdueActionRows] =
    await Promise.all([
      getPrisma().capa.groupBy({
        by: ['status'],
        where: { organizationId, deletedAt: null },
        _count: true,
      }),
      getPrisma().capa.groupBy({
        by: ['priority'],
        where: { organizationId, deletedAt: null, status: openFilter },
        _count: true,
      }),
      getPrisma().capaStatusHistory.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      getPrisma().capaAction.findMany({
        where: {
          organizationId,
          status: { notIn: ['completed', 'cancelled'] },
          dueDate: { gte: now },
        },
        orderBy: { dueDate: 'asc' },
        take: 6,
      }),
      getPrisma().capa.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, folio: true },
      }),
      getPrisma().capaAction.count({ where: { organizationId, status: 'completed' } }),
      getPrisma().capaAction.findMany({
        where: {
          organizationId,
          status: { notIn: ['completed', 'cancelled'] },
          dueDate: { lt: now },
        },
        orderBy: { dueDate: 'asc' },
        take: 6,
      }),
    ]);
  const folioByCapa = new Map(capas.map((c) => [c.id, c.folio]));
  const daysAgo = (d: Date | null) =>
    d ? Math.max(0, Math.round((now.getTime() - d.getTime()) / 86_400_000)) : null;
  return {
    actionsCompleted,
    actionsOverdue: overdueActionRows.length,
    byStatus: byStatus.map((s) => ({ key: s.status, count: s._count })),
    byPriority: byPriority.map((p) => ({ key: p.priority, count: p._count })),
    recent: recent.map((h) => ({
      id: String(h.id),
      event: h.event,
      folio: folioByCapa.get(h.capaId) ?? '—',
      detail: h.detail,
      at: h.createdAt.toISOString().slice(0, 10),
    })),
    upcoming: upcoming.map((a) => ({
      id: a.id,
      capaId: a.capaId,
      folio: folioByCapa.get(a.capaId) ?? '—',
      description: a.description,
      dueDate: a.dueDate ? a.dueDate.toISOString().slice(0, 10) : null,
    })),
    overdueActions: overdueActionRows.map((a) => ({
      id: a.id,
      capaId: a.capaId,
      folio: folioByCapa.get(a.capaId) ?? '—',
      description: a.description,
      daysOverdue: daysAgo(a.dueDate),
    })),
  };
}
