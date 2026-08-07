/**
 * Hallazgos de auditoría (TASK-010). Folio `HAL-AAAA-####`. Conversión/enlace a
 * CAPA (sourceType `audit_nc`) y a tareas globales (TASK-009) sin duplicar sus
 * workflows. Scoping por organización + RLS.
 */
import { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';
import { createCapa } from './capa';
import { createTask } from './tasks';
import {
  FINDING_CLASSIFICATIONS,
  FINDING_SEVERITIES,
  assertFindingTransition,
  type FindingStatus,
} from '@/features/audits/finding-state';

type Tx = Prisma.TransactionClient;

export class FindingNotFoundError extends Error {
  constructor() {
    super('Hallazgo no encontrado en esta organización.');
    this.name = 'FindingNotFoundError';
  }
}
export class FindingPermissionError extends Error {
  constructor(message = 'No tienes permiso para esta acción.') {
    super(message);
    this.name = 'FindingPermissionError';
  }
}
export class FindingValidationError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super('Datos de hallazgo inválidos.');
    this.name = 'FindingValidationError';
    this.errors = errors;
  }
}

const inSet = <T extends string>(set: readonly T[], v: unknown, fallback: T): T =>
  (set as readonly string[]).includes(v as string) ? (v as T) : fallback;
const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const parseDate = (v: string | null | undefined) => (v ? new Date(`${v}T00:00:00.000Z`) : null);

async function memberRole(organizationId: string, userId: string): Promise<string> {
  const m = await getPrisma().membership.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!m) throw new FindingPermissionError('No perteneces a esta organización.');
  return m.role;
}
const isAdmin = (role: string) => role === 'owner' || role === 'admin';
const canCreate = (role: string) => isAdmin(role) || role === 'evaluator';

async function userNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unique.length === 0) return new Map();
  const users = await getPrisma().user.findMany({
    where: { id: { in: unique } },
    select: { id: true, displayName: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u.displayName ?? u.email]));
}

async function loadScoped(organizationId: string, findingId: string) {
  const f = await getPrisma().auditFinding.findFirst({ where: { id: findingId, organizationId } });
  if (!f) throw new FindingNotFoundError();
  return f;
}

async function nextFolio(tx: Tx, organizationId: string, year: number): Promise<string> {
  const rows = await tx.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO audit_finding_folio_counters ("organization_id", "year", "last_seq")
    VALUES (${organizationId}::uuid, ${year}, 1)
    ON CONFLICT ("organization_id", "year")
    DO UPDATE SET "last_seq" = audit_finding_folio_counters."last_seq" + 1
    RETURNING "last_seq"`;
  const seq = rows[0]?.last_seq ?? 1;
  return `HAL-${year}-${String(seq).padStart(4, '0')}`;
}

export interface FindingInput {
  auditId: string;
  snapshotId?: string | null;
  siteId?: string | null;
  process?: string | null;
  title: string;
  description?: string | null;
  objectiveEvidence?: string | null;
  requirementBreached?: string | null;
  classification?: string;
  severity?: string;
  responsibleUserId?: string | null;
  committedDate?: string | null;
  immediateCorrection?: string | null;
}

export async function createFinding(
  organizationId: string,
  actorId: string,
  input: FindingInput,
): Promise<string> {
  const role = await memberRole(organizationId, actorId);
  if (!canCreate(role)) throw new FindingPermissionError('No tienes permiso para crear hallazgos.');
  if (!input.title?.trim()) throw new FindingValidationError(['El título es obligatorio.']);
  const audit = await getPrisma().audit.findFirst({
    where: { id: input.auditId, organizationId },
    select: { id: true, siteId: true },
  });
  if (!audit) throw new FindingValidationError(['La auditoría no pertenece a la organización.']);
  const year = new Date().getUTCFullYear();
  return withOrgContext(organizationId, async (tx) => {
    const folio = await nextFolio(tx, organizationId, year);
    const finding = await tx.auditFinding.create({
      data: {
        organizationId,
        folio,
        auditId: input.auditId,
        snapshotId: input.snapshotId || null,
        siteId: input.siteId ?? audit.siteId ?? null,
        process: input.process ?? null,
        title: input.title.trim(),
        description: input.description ?? null,
        objectiveEvidence: input.objectiveEvidence ?? null,
        requirementBreached: input.requirementBreached ?? null,
        classification: inSet(FINDING_CLASSIFICATIONS, input.classification, 'observation'),
        severity: inSet(FINDING_SEVERITIES, input.severity, 'medium'),
        responsibleUserId: input.responsibleUserId || null,
        committedDate: parseDate(input.committedDate),
        immediateCorrection: input.immediateCorrection ?? null,
        detectedAt: new Date(),
        status: 'open',
        createdBy: actorId,
      },
    });
    if (input.snapshotId) {
      await tx.auditFindingRelation.create({
        data: {
          organizationId,
          findingId: finding.id,
          relationType: 'requirement',
          targetId: input.snapshotId,
          createdBy: actorId,
        },
      });
    }
    return finding.id;
  });
}

export async function updateFinding(
  organizationId: string,
  actorId: string,
  findingId: string,
  input: Partial<FindingInput>,
): Promise<void> {
  const f = await loadScoped(organizationId, findingId);
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role) && f.createdBy !== actorId && f.responsibleUserId !== actorId) {
    throw new FindingPermissionError('No puedes editar este hallazgo.');
  }
  if (f.status === 'closed')
    throw new FindingValidationError(['El hallazgo cerrado es de solo lectura.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.auditFinding.update({
      where: { id: findingId },
      data: {
        title: input.title?.trim() ?? f.title,
        description: input.description ?? f.description,
        objectiveEvidence: input.objectiveEvidence ?? f.objectiveEvidence,
        requirementBreached: input.requirementBreached ?? f.requirementBreached,
        classification: input.classification
          ? inSet(FINDING_CLASSIFICATIONS, input.classification, 'observation')
          : f.classification,
        severity: input.severity ? inSet(FINDING_SEVERITIES, input.severity, 'medium') : f.severity,
        responsibleUserId:
          input.responsibleUserId === undefined
            ? f.responsibleUserId
            : input.responsibleUserId || null,
        committedDate:
          input.committedDate === undefined ? f.committedDate : parseDate(input.committedDate),
        immediateCorrection: input.immediateCorrection ?? f.immediateCorrection,
      },
    });
  });
}

export async function transitionFinding(
  organizationId: string,
  actorId: string,
  findingId: string,
  to: FindingStatus,
  opts: { comment?: string | null } = {},
): Promise<void> {
  const f = await loadScoped(organizationId, findingId);
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role) && f.responsibleUserId !== actorId && f.createdBy !== actorId) {
    throw new FindingPermissionError('No puedes cambiar el estado de este hallazgo.');
  }
  assertFindingTransition(f.status as FindingStatus, to);
  await withOrgContext(organizationId, async (tx) => {
    await tx.auditFinding.update({
      where: { id: findingId },
      data: { status: to, closedAt: to === 'closed' ? new Date() : f.closedAt },
    });
  });
}

/** Crea una CAPA (origen auditoría) desde el hallazgo y las enlaza. */
export async function convertFindingToCapa(
  organizationId: string,
  actorId: string,
  findingId: string,
  input: { severity?: string } = {},
): Promise<string> {
  const f = await loadScoped(organizationId, findingId);
  if (f.capaId) throw new FindingValidationError(['El hallazgo ya tiene una CAPA vinculada.']);
  const capaSeverity =
    input.severity && ['low', 'medium', 'high', 'critical'].includes(input.severity)
      ? input.severity
      : f.severity;
  const capaId = await createCapa(organizationId, actorId, {
    title: f.title,
    description: [f.description, f.objectiveEvidence ? `Evidencia: ${f.objectiveEvidence}` : null]
      .filter(Boolean)
      .join('\n\n'),
    sourceType: 'audit_nc',
    siteId: f.siteId ?? undefined,
    severity: capaSeverity as never,
  });
  await withOrgContext(organizationId, async (tx) => {
    await tx.auditFinding.update({
      where: { id: findingId },
      data: { capaId, status: f.status === 'open' ? 'capa_open' : f.status },
    });
    await tx.auditFindingRelation.create({
      data: {
        organizationId,
        findingId,
        relationType: 'capa',
        targetId: capaId,
        createdBy: actorId,
      },
    });
    await tx.auditFollowUp.create({
      data: { organizationId, findingId, capaId, status: 'capa_open', createdBy: actorId },
    });
  });
  return capaId;
}

export async function linkFindingCapa(
  organizationId: string,
  actorId: string,
  findingId: string,
  capaId: string,
): Promise<void> {
  const f = await loadScoped(organizationId, findingId);
  await memberRole(organizationId, actorId);
  const capa = await getPrisma().capa.findFirst({
    where: { id: capaId, organizationId },
    select: { id: true },
  });
  if (!capa) throw new FindingValidationError(['La CAPA no pertenece a la organización.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.auditFinding.update({ where: { id: findingId }, data: { capaId } });
    await tx.auditFindingRelation.create({
      data: {
        organizationId,
        findingId,
        relationType: 'capa',
        targetId: capaId,
        createdBy: actorId,
      },
    });
  });
  void f;
}

/** Crea una tarea global de seguimiento enlazada al hallazgo (TASK-009). */
export async function createFindingTask(
  organizationId: string,
  actorId: string,
  findingId: string,
  input: { title?: string; targetDate?: string | null } = {},
): Promise<string> {
  const f = await loadScoped(organizationId, findingId);
  const taskId = await createTask(organizationId, actorId, {
    title: input.title?.trim() || `Seguimiento hallazgo ${f.folio}: ${f.title}`,
    taskType: 'follow_up',
    origin: 'other',
    responsibleUserId: f.responsibleUserId ?? undefined,
    siteId: f.siteId ?? undefined,
    targetDate: input.targetDate ?? isoDate(f.committedDate),
    sourceType: 'audit_finding',
    sourceId: findingId,
  });
  await withOrgContext(organizationId, async (tx) => {
    await tx.auditFindingRelation.create({
      data: {
        organizationId,
        findingId,
        relationType: 'task',
        targetId: taskId,
        createdBy: actorId,
      },
    });
  });
  return taskId;
}

export async function addFollowUp(
  organizationId: string,
  actorId: string,
  findingId: string,
  input: {
    correction?: string | null;
    responsibleUserId?: string | null;
    targetDate?: string | null;
    evidence?: string | null;
    status?: string;
    result?: string | null;
    comment?: string | null;
  },
): Promise<void> {
  const f = await loadScoped(organizationId, findingId);
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role) && f.responsibleUserId !== actorId && f.createdBy !== actorId) {
    throw new FindingPermissionError('No puedes registrar seguimiento de este hallazgo.');
  }
  const status = inSet(
    [
      'open',
      'correction_in_progress',
      'capa_open',
      'pending_verification',
      'effective',
      'not_effective',
      'closed',
    ] as const,
    input.status,
    'correction_in_progress',
  );
  await withOrgContext(organizationId, async (tx) => {
    await tx.auditFollowUp.create({
      data: {
        organizationId,
        findingId,
        correction: input.correction ?? null,
        responsibleUserId: input.responsibleUserId || f.responsibleUserId,
        targetDate: parseDate(input.targetDate),
        evidence: input.evidence ?? null,
        status,
        verifierUserId: status === 'effective' || status === 'not_effective' ? actorId : null,
        verifiedAt: status === 'effective' || status === 'not_effective' ? new Date() : null,
        result: input.result ?? null,
        comment: input.comment ?? null,
        createdBy: actorId,
      },
    });
  });
}

export async function getFindingDetail(organizationId: string, findingId: string) {
  const prisma = getPrisma();
  const f = await loadScoped(organizationId, findingId);
  const [relations, followUps] = await Promise.all([
    prisma.auditFindingRelation.findMany({ where: { findingId, organizationId } }),
    prisma.auditFollowUp.findMany({
      where: { findingId, organizationId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const names = await userNames([
    f.responsibleUserId,
    f.createdBy,
    ...followUps.map((x) => x.responsibleUserId),
    ...followUps.map((x) => x.verifierUserId),
  ]);
  const audit = await prisma.audit.findFirst({
    where: { id: f.auditId, organizationId },
    select: { id: true, folio: true, title: true },
  });
  return {
    finding: {
      id: f.id,
      folio: f.folio,
      auditId: f.auditId,
      title: f.title,
      description: f.description,
      objectiveEvidence: f.objectiveEvidence,
      requirementBreached: f.requirementBreached,
      classification: f.classification,
      severity: f.severity,
      status: f.status,
      process: f.process,
      responsibleName: f.responsibleUserId ? (names.get(f.responsibleUserId) ?? null) : null,
      committedDate: isoDate(f.committedDate),
      immediateCorrection: f.immediateCorrection,
      capaId: f.capaId,
      readOnly: f.status === 'closed',
    },
    audit,
    relations: relations.map((r) => ({
      id: r.id,
      relationType: r.relationType,
      targetId: r.targetId,
      href: relationHref(r.relationType, r.targetId),
    })),
    followUps: followUps.map((x) => ({
      id: x.id,
      correction: x.correction,
      status: x.status,
      responsibleName: x.responsibleUserId ? (names.get(x.responsibleUserId) ?? null) : null,
      targetDate: isoDate(x.targetDate),
      result: x.result,
      verifierName: x.verifierUserId ? (names.get(x.verifierUserId) ?? null) : null,
      createdAt: x.createdAt,
    })),
  };
}

export function relationHref(relationType: string, targetId: string | null): string | null {
  if (!targetId) return null;
  switch (relationType) {
    case 'capa':
      return `/dashboard/capa/${targetId}`;
    case 'task':
      return `/dashboard/tasks/${targetId}`;
    case 'document':
    case 'document_version':
      return `/dashboard/documents/${targetId}`;
    default:
      return null;
  }
}

/** Hallazgos de la organización (para la vista global y dashboard). */
export async function listFindings(
  organizationId: string,
  filters: { status?: string; classification?: string; auditId?: string } = {},
) {
  const prisma = getPrisma();
  const t = new Date().toISOString().slice(0, 10);
  const where: Prisma.AuditFindingWhereInput = { organizationId };
  if (filters.status) where.status = filters.status;
  if (filters.classification) where.classification = filters.classification;
  if (filters.auditId) where.auditId = filters.auditId;
  const findings = await prisma.auditFinding.findMany({ where, orderBy: { createdAt: 'desc' } });
  const audits = await prisma.audit.findMany({
    where: { id: { in: [...new Set(findings.map((f) => f.auditId))] }, organizationId },
    select: { id: true, folio: true },
  });
  const auditFolio = new Map(audits.map((a) => [a.id, a.folio]));
  const names = await userNames(findings.map((f) => f.responsibleUserId));
  return findings.map((f) => ({
    id: f.id,
    folio: f.folio,
    auditId: f.auditId,
    auditFolio: auditFolio.get(f.auditId) ?? null,
    title: f.title,
    classification: f.classification,
    severity: f.severity,
    status: f.status,
    responsibleName: f.responsibleUserId ? (names.get(f.responsibleUserId) ?? null) : null,
    committedDate: isoDate(f.committedDate),
    capaId: f.capaId,
    overdue:
      f.status !== 'closed' &&
      f.status !== 'effective' &&
      !!isoDate(f.committedDate) &&
      isoDate(f.committedDate)! < t,
  }));
}
