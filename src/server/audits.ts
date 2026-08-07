/**
 * Auditorías (TASK-010) con scoping por organización + RLS. Folio `AUD-AAAA-####`.
 * Checklist por SNAPSHOT inmutable desde `template_versions` (fuente de verdad
 * del contenido normativo). Permisos e independencia validados en servidor.
 */
import { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';
import { saveDocumentFile } from './document-storage';
import {
  AUDIT_PRIORITIES,
  AUDIT_TYPES,
  assertAuditTransition,
  isAuditReopen,
  isExecutionStarted,
  isTerminalAudit,
  validateAuditTransition,
  type AuditStatus,
} from '@/features/audits/audit-state';
import {
  CHECKLIST_RESULTS,
  isChecklistResult,
  summarizeChecklist,
} from '@/features/audits/checklist';

type Tx = Prisma.TransactionClient;

export class AuditNotFoundError extends Error {
  constructor() {
    super('Auditoría no encontrada en esta organización.');
    this.name = 'AuditNotFoundError';
  }
}
export class AuditPermissionError extends Error {
  constructor(message = 'No tienes permiso para esta acción.') {
    super(message);
    this.name = 'AuditPermissionError';
  }
}
export class AuditValidationError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super('Datos de auditoría inválidos.');
    this.name = 'AuditValidationError';
    this.errors = errors;
  }
}

const inSet = <T extends string>(set: readonly T[], v: unknown, fallback: T): T =>
  (set as readonly string[]).includes(v as string) ? (v as T) : fallback;
const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const parseDate = (v: string | null | undefined) => (v ? new Date(`${v}T00:00:00.000Z`) : null);
const today = () => new Date().toISOString().slice(0, 10);

async function memberRole(organizationId: string, userId: string): Promise<string> {
  const m = await getPrisma().membership.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!m) throw new AuditPermissionError('No perteneces a esta organización.');
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

async function loadScoped(organizationId: string, auditId: string) {
  const a = await getPrisma().audit.findFirst({ where: { id: auditId, organizationId } });
  if (!a) throw new AuditNotFoundError();
  return a;
}

async function teamUserIds(organizationId: string, auditId: string): Promise<Set<string>> {
  const rows = await getPrisma().auditTeamMember.findMany({
    where: { auditId, organizationId, role: { in: ['lead', 'auditor', 'technical_expert'] } },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

function canAct(
  audit: { leadAuditorUserId: string | null; createdBy: string | null },
  role: string,
  userId: string,
  team: Set<string>,
): boolean {
  return (
    isAdmin(role) ||
    audit.leadAuditorUserId === userId ||
    audit.createdBy === userId ||
    team.has(userId)
  );
}

async function nextFolio(tx: Tx, organizationId: string, year: number): Promise<string> {
  const rows = await tx.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO audit_folio_counters ("organization_id", "year", "last_seq")
    VALUES (${organizationId}::uuid, ${year}, 1)
    ON CONFLICT ("organization_id", "year")
    DO UPDATE SET "last_seq" = audit_folio_counters."last_seq" + 1
    RETURNING "last_seq"`;
  const seq = rows[0]?.last_seq ?? 1;
  return `AUD-${year}-${String(seq).padStart(4, '0')}`;
}

async function recordStatus(
  tx: Tx,
  organizationId: string,
  auditId: string,
  event: string,
  actorUserId: string,
  opts: { fromStatus?: string | null; toStatus?: string | null; detail?: string | null } = {},
): Promise<void> {
  await tx.auditStatusHistory.create({
    data: {
      organizationId,
      auditId,
      event,
      fromStatus: opts.fromStatus ?? null,
      toStatus: opts.toStatus ?? null,
      actorUserId,
      detail: opts.detail ?? null,
    },
  });
}

// --- Listado / KPIs ----------------------------------------------------------

export interface AuditFilters {
  programId?: string;
  year?: number;
  siteId?: string;
  auditType?: string;
  status?: string;
  search?: string;
}

export async function listAudits(organizationId: string, filters: AuditFilters = {}) {
  const prisma = getPrisma();
  const where: Prisma.AuditWhereInput = { organizationId };
  if (filters.programId) where.programId = filters.programId;
  if (filters.siteId) where.siteId = filters.siteId;
  if (filters.auditType) where.auditType = filters.auditType;
  if (filters.status) where.status = filters.status;
  if (filters.search?.trim()) {
    where.OR = [
      { folio: { contains: filters.search, mode: 'insensitive' } },
      { title: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  const audits = await prisma.audit.findMany({ where, orderBy: { createdAt: 'desc' } });
  const ids = audits.map((a) => a.id);
  const [names, sites, checklistCounts, findingCounts] = await Promise.all([
    userNames(audits.map((a) => a.leadAuditorUserId)),
    prisma.site.findMany({
      where: {
        id: { in: audits.map((a) => a.siteId).filter((x): x is string => Boolean(x)) },
        organizationId,
      },
      select: { id: true, name: true },
    }),
    ids.length
      ? prisma.auditChecklistItem.groupBy({
          by: ['auditId', 'result'],
          where: { organizationId, auditId: { in: ids } },
          _count: { _all: true },
        })
      : [],
    ids.length
      ? prisma.auditFinding.groupBy({
          by: ['auditId', 'status'],
          where: { organizationId, auditId: { in: ids } },
          _count: { _all: true },
        })
      : [],
  ]);
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const prep = new Map<string, { total: number; evaluated: number }>();
  for (const row of checklistCounts) {
    const e = prep.get(row.auditId) ?? { total: 0, evaluated: 0 };
    e.total += row._count._all;
    if (row.result !== 'no_evaluado') e.evaluated += row._count._all;
    prep.set(row.auditId, e);
  }
  const openFindings = new Map<string, number>();
  for (const row of findingCounts) {
    if (row.status !== 'closed' && row.status !== 'effective') {
      openFindings.set(row.auditId, (openFindings.get(row.auditId) ?? 0) + row._count._all);
    }
  }
  const t = today();
  return audits.map((a) => {
    const p = prep.get(a.id);
    return {
      id: a.id,
      folio: a.folio,
      title: a.title,
      auditType: a.auditType,
      status: a.status,
      priority: a.priority,
      normVersionLabel: a.normVersionLabel,
      siteName: a.siteId ? (siteName.get(a.siteId) ?? null) : null,
      plannedDate: isoDate(a.plannedDate),
      leadAuditorName: a.leadAuditorUserId ? (names.get(a.leadAuditorUserId) ?? null) : null,
      progressPct: p && p.total > 0 ? Math.round((p.evaluated / p.total) * 100) : 0,
      openFindings: openFindings.get(a.id) ?? 0,
      overdue:
        a.status !== 'closed' &&
        a.status !== 'cancelled' &&
        !!isoDate(a.plannedDate) &&
        isoDate(a.plannedDate)! < t &&
        !isExecutionStarted(a.status as AuditStatus),
    };
  });
}

export async function getAuditSummary(organizationId: string) {
  const prisma = getPrisma();
  const t = today();
  const audits = await prisma.audit.findMany({
    where: { organizationId },
    select: { status: true, plannedDate: true },
  });
  const findings = await prisma.auditFinding.groupBy({
    by: ['status', 'classification'],
    where: { organizationId },
    _count: { _all: true },
  });
  const openFindings = findings
    .filter((f) => f.status !== 'closed' && f.status !== 'effective')
    .reduce((n, f) => n + f._count._all, 0);
  const majorOpen = findings
    .filter(
      (f) => f.classification === 'major_nc' && f.status !== 'closed' && f.status !== 'effective',
    )
    .reduce((n, f) => n + f._count._all, 0);
  const planned = audits.filter((a) => a.status === 'planned' || a.status === 'ready').length;
  const upcoming = audits
    .filter((a) => a.plannedDate && isoDate(a.plannedDate)! >= t)
    .map((a) => isoDate(a.plannedDate)!)
    .sort();
  return {
    planned,
    inProgress: audits.filter((a) => a.status === 'in_progress').length,
    followUp: audits.filter((a) => a.status === 'follow_up').length,
    overdue: audits.filter(
      (a) =>
        a.status !== 'closed' &&
        a.status !== 'cancelled' &&
        !isExecutionStarted(a.status as AuditStatus) &&
        a.plannedDate &&
        isoDate(a.plannedDate)! < t,
    ).length,
    openFindings,
    majorOpen,
    nextAuditDate: upcoming[0] ?? null,
  };
}

// --- CRUD --------------------------------------------------------------------

export interface AuditInput {
  title: string;
  auditType?: string;
  programId?: string | null;
  siteId?: string | null;
  area?: string | null;
  process?: string | null;
  objective?: string | null;
  scope?: string | null;
  criteria?: string | null;
  frameworkId?: string | null;
  templateVersionId?: string | null;
  normVersionLabel?: string | null;
  priority?: string;
  plannedDate?: string | null;
  leadAuditorUserId?: string | null;
  projectId?: string | null;
}

export async function createAudit(
  organizationId: string,
  actorId: string,
  input: AuditInput,
): Promise<string> {
  const role = await memberRole(organizationId, actorId);
  if (!canCreate(role)) throw new AuditPermissionError('No tienes permiso para crear auditorías.');
  if (!input.title?.trim()) throw new AuditValidationError(['El título es obligatorio.']);
  const year = new Date().getUTCFullYear();
  return withOrgContext(organizationId, async (tx) => {
    const folio = await nextFolio(tx, organizationId, year);
    const audit = await tx.audit.create({
      data: {
        organizationId,
        folio,
        title: input.title.trim(),
        auditType: inSet(AUDIT_TYPES, input.auditType, 'internal'),
        programId: input.programId || null,
        siteId: input.siteId || null,
        area: input.area ?? null,
        process: input.process ?? null,
        objective: input.objective ?? null,
        scope: input.scope ?? null,
        criteria: input.criteria ?? null,
        frameworkId: input.frameworkId || null,
        templateVersionId: input.templateVersionId || null,
        normVersionLabel: input.normVersionLabel ?? null,
        priority: inSet(AUDIT_PRIORITIES, input.priority, 'normal'),
        plannedDate: parseDate(input.plannedDate),
        leadAuditorUserId: input.leadAuditorUserId || null,
        projectId: input.projectId || null,
        status: 'draft',
        createdBy: actorId,
      },
    });
    if (input.leadAuditorUserId) {
      await tx.auditTeamMember.create({
        data: {
          organizationId,
          auditId: audit.id,
          userId: input.leadAuditorUserId,
          role: 'lead',
          addedBy: actorId,
        },
      });
    }
    await recordStatus(tx, organizationId, audit.id, 'audit.created', actorId, {
      toStatus: 'draft',
    });
    return audit.id;
  });
}

export async function updateAudit(
  organizationId: string,
  actorId: string,
  auditId: string,
  input: Partial<AuditInput>,
): Promise<void> {
  const audit = await loadScoped(organizationId, auditId);
  const role = await memberRole(organizationId, actorId);
  const team = await teamUserIds(organizationId, auditId);
  if (!canAct(audit, role, actorId, team)) {
    throw new AuditPermissionError('No participas en esta auditoría.');
  }
  if (isTerminalAudit(audit.status as AuditStatus)) {
    throw new AuditValidationError(['La auditoría está en solo lectura.']);
  }
  await withOrgContext(organizationId, async (tx) => {
    await tx.audit.update({
      where: { id: auditId },
      data: {
        title: input.title?.trim() ?? audit.title,
        auditType: input.auditType
          ? inSet(AUDIT_TYPES, input.auditType, 'internal')
          : audit.auditType,
        area: input.area ?? audit.area,
        process: input.process ?? audit.process,
        objective: input.objective ?? audit.objective,
        scope: input.scope ?? audit.scope,
        criteria: input.criteria ?? audit.criteria,
        priority: input.priority
          ? inSet(AUDIT_PRIORITIES, input.priority, 'normal')
          : audit.priority,
        siteId: input.siteId === undefined ? audit.siteId : input.siteId || null,
        plannedDate:
          input.plannedDate === undefined ? audit.plannedDate : parseDate(input.plannedDate),
        leadAuditorUserId:
          input.leadAuditorUserId === undefined
            ? audit.leadAuditorUserId
            : input.leadAuditorUserId || null,
        normVersionLabel: input.normVersionLabel ?? audit.normVersionLabel,
        executiveSummary:
          (input as { executiveSummary?: string }).executiveSummary ?? audit.executiveSummary,
        conclusion: (input as { conclusion?: string }).conclusion ?? audit.conclusion,
      },
    });
    await recordStatus(tx, organizationId, auditId, 'audit.updated', actorId);
  });
}

export async function transitionAudit(
  organizationId: string,
  actorId: string,
  auditId: string,
  to: AuditStatus,
  opts: { reason?: string | null; justification?: string | null } = {},
): Promise<void> {
  const audit = await loadScoped(organizationId, auditId);
  const role = await memberRole(organizationId, actorId);
  const from = audit.status as AuditStatus;
  const reopen = isAuditReopen(from, to);
  if (reopen && !isAdmin(role))
    throw new AuditPermissionError('La reapertura requiere owner/admin.');
  if (!reopen) {
    const team = await teamUserIds(organizationId, auditId);
    if (!canAct(audit, role, actorId, team)) {
      throw new AuditPermissionError('No participas en esta auditoría.');
    }
  }
  assertAuditTransition(from, to, { reopen });

  const scopeCount = await getPrisma().auditScopeItem.count({ where: { auditId, organizationId } });
  const openFollowUp = await getPrisma().auditFinding.count({
    where: {
      auditId,
      organizationId,
      status: { notIn: ['closed', 'effective'] },
      classification: { in: ['major_nc', 'minor_nc', 'observation'] },
    },
  });
  const errors = validateAuditTransition({
    to,
    hasScope: Boolean(audit.scope?.trim()) || scopeCount > 0,
    hasCriteria: Boolean(audit.criteria?.trim()),
    hasLead: Boolean(audit.leadAuditorUserId),
    openFollowUpFindings: openFollowUp,
    justification: opts.justification,
    reason: opts.reason,
  });
  if (errors.length) throw new AuditValidationError(errors);

  await withOrgContext(organizationId, async (tx) => {
    await tx.audit.update({
      where: { id: auditId },
      data: {
        status: to,
        startedAt: to === 'in_progress' && !audit.startedAt ? new Date() : audit.startedAt,
        endedAt: to === 'completed' && !audit.endedAt ? new Date() : audit.endedAt,
        closedAt: to === 'closed' || to === 'cancelled' ? new Date() : audit.closedAt,
        followUpRequired: to === 'follow_up' ? true : audit.followUpRequired,
      },
    });
    await recordStatus(
      tx,
      organizationId,
      auditId,
      reopen ? 'audit.reopened' : 'audit.status',
      actorId,
      {
        fromStatus: from,
        toStatus: to,
        detail: opts.reason ?? opts.justification ?? null,
      },
    );
  });
}

// --- Equipo / agenda / alcance ----------------------------------------------

export async function addTeamMember(
  organizationId: string,
  actorId: string,
  auditId: string,
  input: {
    userId: string;
    role: string;
    area?: string | null;
    conflictJustification?: string | null;
  },
): Promise<{ potentialConflict: boolean }> {
  const audit = await loadScoped(organizationId, auditId);
  const role = await memberRole(organizationId, actorId);
  const team = await teamUserIds(organizationId, auditId);
  if (!canAct(audit, role, actorId, team)) {
    throw new AuditPermissionError('No participas en esta auditoría.');
  }
  const member = await getPrisma().membership.findFirst({
    where: { organizationId, userId: input.userId },
    select: { userId: true },
  });
  if (!member) throw new AuditValidationError(['El usuario no pertenece a la organización.']);
  // Posible conflicto de independencia: el usuario ya figura como auditado (auditee).
  const asAuditee = await getPrisma().auditTeamMember.findFirst({
    where: { auditId, organizationId, userId: input.userId, role: 'auditee' },
    select: { id: true },
  });
  const auditorRole = inSet(
    ['lead', 'auditor', 'technical_expert', 'observer', 'auditee'] as const,
    input.role,
    'auditor',
  );
  const potentialConflict =
    (auditorRole === 'auditor' || auditorRole === 'lead') && Boolean(asAuditee);
  await withOrgContext(organizationId, async (tx) => {
    await tx.auditTeamMember.upsert({
      where: { auditId_userId: { auditId, userId: input.userId } },
      create: {
        organizationId,
        auditId,
        userId: input.userId,
        role: auditorRole,
        area: input.area ?? null,
        potentialConflict,
        conflictJustification: input.conflictJustification ?? null,
        addedBy: actorId,
      },
      update: {
        role: auditorRole,
        area: input.area ?? null,
        potentialConflict,
        conflictJustification: input.conflictJustification ?? null,
      },
    });
    if (auditorRole === 'lead') {
      await tx.audit.update({ where: { id: auditId }, data: { leadAuditorUserId: input.userId } });
    }
  });
  return { potentialConflict };
}

export async function addAgendaItem(
  organizationId: string,
  actorId: string,
  auditId: string,
  input: {
    startTime?: string | null;
    endTime?: string | null;
    processArea?: string | null;
    auditorUserId?: string | null;
    location?: string | null;
    notes?: string | null;
    sequence?: number;
  },
): Promise<void> {
  const audit = await loadScoped(organizationId, auditId);
  const role = await memberRole(organizationId, actorId);
  const team = await teamUserIds(organizationId, auditId);
  if (!canAct(audit, role, actorId, team))
    throw new AuditPermissionError('No participas en esta auditoría.');
  await withOrgContext(organizationId, async (tx) => {
    await tx.auditAgendaItem.create({
      data: {
        organizationId,
        auditId,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        processArea: input.processArea ?? null,
        auditorUserId: input.auditorUserId || null,
        location: input.location ?? null,
        notes: input.notes ?? null,
        sequence: input.sequence ?? 1,
        createdBy: actorId,
      },
    });
  });
}

export async function addScopeItem(
  organizationId: string,
  actorId: string,
  auditId: string,
  input: {
    kind: string;
    siteId?: string | null;
    frameworkId?: string | null;
    label?: string | null;
  },
): Promise<void> {
  const audit = await loadScoped(organizationId, auditId);
  const role = await memberRole(organizationId, actorId);
  const team = await teamUserIds(organizationId, auditId);
  if (!canAct(audit, role, actorId, team))
    throw new AuditPermissionError('No participas en esta auditoría.');
  await withOrgContext(organizationId, async (tx) => {
    await tx.auditScopeItem.create({
      data: {
        organizationId,
        auditId,
        kind: inSet(['site', 'process', 'framework'] as const, input.kind, 'process'),
        siteId: input.siteId || null,
        frameworkId: input.frameworkId || null,
        label: input.label ?? null,
        createdBy: actorId,
      },
    });
  });
}

// --- Checklist (snapshot desde template_versions) ----------------------------

/** Frameworks con versiones publicadas para elegir la fuente del checklist. */
export async function listChecklistSources(organizationId: string) {
  const prisma = getPrisma();
  const versions = await prisma.templateVersion.findMany({
    where: {
      status: 'published',
      OR: [{ organizationId }, { scope: 'master' }],
    },
    select: {
      id: true,
      versionNumber: true,
      framework: { select: { code: true, name: true } },
    },
    orderBy: { versionNumber: 'desc' },
  });
  return versions.map((v) => ({
    templateVersionId: v.id,
    label: `${v.framework.code} · ${v.framework.name} (v${v.versionNumber})`,
  }));
}

/** Genera el checklist congelando los requisitos de una versión publicada. */
export async function generateChecklist(
  organizationId: string,
  actorId: string,
  auditId: string,
  input: { templateVersionId: string; requirementIds?: string[] },
): Promise<number> {
  const audit = await loadScoped(organizationId, auditId);
  const role = await memberRole(organizationId, actorId);
  const team = await teamUserIds(organizationId, auditId);
  if (!canAct(audit, role, actorId, team))
    throw new AuditPermissionError('No participas en esta auditoría.');
  if (isExecutionStarted(audit.status as AuditStatus)) {
    throw new AuditValidationError([
      'El checklist no puede regenerarse tras iniciar la ejecución.',
    ]);
  }
  const prisma = getPrisma();
  const version = await prisma.templateVersion.findFirst({
    where: {
      id: input.templateVersionId,
      status: 'published',
      OR: [{ organizationId }, { scope: 'master' }],
    },
    select: {
      id: true,
      versionNumber: true,
      frameworkId: true,
      framework: { select: { code: true, name: true } },
    },
  });
  if (!version)
    throw new AuditValidationError([
      'La versión de plantilla no está publicada o no es accesible.',
    ]);

  const sections = await prisma.templateSection.findMany({
    where: { templateVersionId: version.id },
    orderBy: { position: 'asc' },
    select: { id: true, code: true, title: true },
  });
  const sectionMap = new Map(sections.map((s) => [s.id, s]));
  const reqWhere: Prisma.TemplateRequirementWhereInput = { templateVersionId: version.id };
  if (input.requirementIds?.length) reqWhere.id = { in: input.requirementIds };
  const requirements = await prisma.templateRequirement.findMany({
    where: reqWhere,
    orderBy: [{ position: 'asc' }],
    include: {
      questions: {
        orderBy: { position: 'asc' },
        select: { code: true, prompt: true, questionType: true },
      },
    },
  });
  if (requirements.length === 0)
    throw new AuditValidationError(['La versión no tiene requisitos.']);

  return withOrgContext(organizationId, async (tx) => {
    // Reemplaza snapshots previos si aún no se ejecuta (los checklist items se
    // recrean; el historial permanece append-only).
    const existing = await tx.auditRequirementSnapshot.findMany({
      where: { auditId, organizationId },
      select: { id: true },
    });
    if (existing.length) {
      await tx.auditChecklistItem
        .deleteMany({ where: { auditId, organizationId } })
        .catch(() => {});
    }
    let seq = 1;
    for (const r of requirements) {
      const section = sectionMap.get(r.sectionId);
      const snapshot = await tx.auditRequirementSnapshot.create({
        data: {
          organizationId,
          auditId,
          frameworkId: version.frameworkId,
          frameworkCode: version.framework.code,
          frameworkName: version.framework.name,
          templateVersionId: version.id,
          versionNumber: version.versionNumber,
          sectionId: r.sectionId,
          sectionCode: section?.code ?? null,
          sectionTitle: section?.title ?? null,
          requirementId: r.id,
          requirementCode: r.code,
          requirementTitle: r.title,
          requirementText: r.description ?? null,
          isCritical: r.isCritical,
          questions: r.questions as unknown as Prisma.InputJsonValue,
          sequence: seq,
          capturedBy: actorId,
        },
      });
      await tx.auditChecklistItem.create({
        data: {
          organizationId,
          auditId,
          snapshotId: snapshot.id,
          result: 'no_evaluado',
        },
      });
      seq += 1;
    }
    await tx.audit.update({
      where: { id: auditId },
      data: {
        frameworkId: version.frameworkId,
        templateVersionId: version.id,
        normVersionLabel: `${version.framework.code} v${version.versionNumber}`,
      },
    });
    await recordStatus(tx, organizationId, auditId, 'audit.checklist_generated', actorId, {
      detail: `${requirements.length} requisitos`,
    });
    return requirements.length;
  });
}

export async function setChecklistResult(
  organizationId: string,
  actorId: string,
  checklistItemId: string,
  input: {
    result?: string;
    expectedEvidence?: string | null;
    foundEvidence?: string | null;
    comment?: string | null;
    fieldVerificationRequired?: boolean;
    privateNotes?: string | null;
  },
): Promise<void> {
  const prisma = getPrisma();
  const item = await prisma.auditChecklistItem.findFirst({
    where: { id: checklistItemId, organizationId },
  });
  if (!item) throw new AuditNotFoundError();
  const audit = await loadScoped(organizationId, item.auditId);
  const role = await memberRole(organizationId, actorId);
  const team = await teamUserIds(organizationId, item.auditId);
  if (!canAct(audit, role, actorId, team))
    throw new AuditPermissionError('No participas en esta auditoría.');
  if (isTerminalAudit(audit.status as AuditStatus)) {
    throw new AuditValidationError(['La auditoría está en solo lectura.']);
  }
  const nextResult = input.result && isChecklistResult(input.result) ? input.result : item.result;
  await withOrgContext(organizationId, async (tx) => {
    await tx.auditChecklistItem.update({
      where: { id: checklistItemId },
      data: {
        result: nextResult,
        expectedEvidence: input.expectedEvidence ?? item.expectedEvidence,
        foundEvidence: input.foundEvidence ?? item.foundEvidence,
        comment: input.comment ?? item.comment,
        fieldVerificationRequired:
          input.fieldVerificationRequired ??
          (nextResult === 'verificacion_campo' ? true : item.fieldVerificationRequired),
        privateNotes: input.privateNotes ?? item.privateNotes,
        updatedBy: actorId,
      },
    });
    if (nextResult !== item.result) {
      await tx.auditRequirementHistory.create({
        data: {
          organizationId,
          auditId: item.auditId,
          checklistItemId,
          snapshotId: item.snapshotId,
          event: 'requirement.result',
          fromResult: item.result,
          toResult: nextResult,
          actorUserId: actorId,
        },
      });
    }
  });
}

// --- Evidencia / entrevistas / archivos / comentarios ------------------------

export async function addEvidence(
  organizationId: string,
  actorId: string,
  auditId: string,
  input: {
    evidenceType: string;
    description: string;
    checklistItemId?: string | null;
    snapshotId?: string | null;
    source?: string | null;
    evidenceDate?: string | null;
    documentId?: string | null;
    documentVersionId?: string | null;
    reliability?: string | null;
    comment?: string | null;
  },
): Promise<void> {
  const audit = await loadScoped(organizationId, auditId);
  const role = await memberRole(organizationId, actorId);
  const team = await teamUserIds(organizationId, auditId);
  if (!canAct(audit, role, actorId, team))
    throw new AuditPermissionError('No participas en esta auditoría.');
  if (!input.description?.trim()) throw new AuditValidationError(['Describe la evidencia.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.auditEvidence.create({
      data: {
        organizationId,
        auditId,
        checklistItemId: input.checklistItemId || null,
        snapshotId: input.snapshotId || null,
        evidenceType: inSet(
          [
            'document',
            'record',
            'interview',
            'observation',
            'photo',
            'measurement',
            'system',
            'sample',
            'other',
          ] as const,
          input.evidenceType,
          'observation',
        ),
        description: input.description.trim(),
        source: input.source ?? null,
        evidenceDate: parseDate(input.evidenceDate),
        documentId: input.documentId || null,
        documentVersionId: input.documentVersionId || null,
        reliability: input.reliability ?? null,
        comment: input.comment ?? null,
        capturedBy: actorId,
      },
    });
  });
}

export async function addInterview(
  organizationId: string,
  actorId: string,
  auditId: string,
  input: {
    checklistItemId?: string | null;
    personRole?: string | null;
    area?: string | null;
    topic?: string | null;
    questions?: string | null;
    answers?: string | null;
    auditorNotes?: string | null;
    interviewDate?: string | null;
  },
): Promise<void> {
  const audit = await loadScoped(organizationId, auditId);
  const role = await memberRole(organizationId, actorId);
  const team = await teamUserIds(organizationId, auditId);
  if (!canAct(audit, role, actorId, team))
    throw new AuditPermissionError('No participas en esta auditoría.');
  await withOrgContext(organizationId, async (tx) => {
    await tx.auditInterview.create({
      data: {
        organizationId,
        auditId,
        checklistItemId: input.checklistItemId || null,
        personRole: input.personRole ?? null,
        area: input.area ?? null,
        topic: input.topic ?? null,
        questions: input.questions ?? null,
        answers: input.answers ?? null,
        auditorNotes: input.auditorNotes ?? null,
        interviewDate: parseDate(input.interviewDate),
        auditorUserId: actorId,
        createdBy: actorId,
      },
    });
  });
}

export async function uploadAuditFile(
  organizationId: string,
  actorId: string,
  auditId: string,
  file: { originalName: string; mimeType: string; data: Buffer },
  kind = 'evidence',
): Promise<void> {
  const audit = await loadScoped(organizationId, auditId);
  const role = await memberRole(organizationId, actorId);
  const team = await teamUserIds(organizationId, auditId);
  if (!canAct(audit, role, actorId, team))
    throw new AuditPermissionError('No participas en esta auditoría.');
  const saved = await saveDocumentFile({ organizationId, ...file });
  await withOrgContext(organizationId, async (tx) => {
    await tx.auditFile.create({
      data: {
        organizationId,
        auditId,
        kind: inSet(
          ['attachment', 'evidence', 'report', 'photo', 'certificate'] as const,
          kind,
          'evidence',
        ),
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
  });
}

export async function addAuditComment(
  organizationId: string,
  actorId: string,
  auditId: string,
  body: string,
): Promise<void> {
  await loadScoped(organizationId, auditId);
  await memberRole(organizationId, actorId);
  if (!body?.trim()) throw new AuditValidationError(['El comentario no puede estar vacío.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.auditComment.create({
      data: { organizationId, auditId, author: actorId, body: body.trim() },
    });
  });
}

// --- Detalle / ejecución / contexto -----------------------------------------

/** Permisos generales del usuario en auditorías (sin auditoría concreta). */
export async function getAuditPerms(organizationId: string, userId: string) {
  const role =
    (
      await getPrisma().membership.findFirst({
        where: { organizationId, userId },
        select: { role: true },
      })
    )?.role ?? 'viewer';
  return { role, isAdmin: isAdmin(role), canCreate: canCreate(role) };
}

export async function getUserAuditContext(organizationId: string, userId: string, auditId: string) {
  const role =
    (
      await getPrisma().membership.findFirst({
        where: { organizationId, userId },
        select: { role: true },
      })
    )?.role ?? 'viewer';
  const audit = await getPrisma().audit.findFirst({
    where: { id: auditId, organizationId },
    select: { leadAuditorUserId: true, createdBy: true },
  });
  const team = await teamUserIds(organizationId, auditId);
  return {
    role,
    isAdmin: isAdmin(role),
    canCreate: canCreate(role),
    canAct: audit ? canAct(audit, role, userId, team) : false,
  };
}

export async function getAuditDetail(organizationId: string, auditId: string) {
  const prisma = getPrisma();
  const a = await loadScoped(organizationId, auditId);
  const [team, agenda, scope, checklist, findings, comments, files, history] = await Promise.all([
    prisma.auditTeamMember.findMany({ where: { auditId, organizationId } }),
    prisma.auditAgendaItem.findMany({
      where: { auditId, organizationId },
      orderBy: { sequence: 'asc' },
    }),
    prisma.auditScopeItem.findMany({ where: { auditId, organizationId } }),
    prisma.auditChecklistItem.findMany({
      where: { auditId, organizationId },
      select: { result: true },
    }),
    prisma.auditFinding.findMany({
      where: { auditId, organizationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        folio: true,
        title: true,
        classification: true,
        severity: true,
        status: true,
      },
    }),
    prisma.auditComment.findMany({
      where: { auditId, organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.auditFile.findMany({
      where: { auditId, organizationId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.auditStatusHistory.findMany({
      where: { auditId, organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);
  const names = await userNames([
    a.leadAuditorUserId,
    a.createdBy,
    ...team.map((t) => t.userId),
    ...comments.map((c) => c.author),
    ...history.map((h) => h.actorUserId),
  ]);
  const site = a.siteId
    ? await prisma.site.findFirst({
        where: { id: a.siteId, organizationId },
        select: { name: true },
      })
    : null;
  const program = a.programId
    ? await prisma.auditProgram.findFirst({
        where: { id: a.programId, organizationId },
        select: { id: true, folio: true, name: true },
      })
    : null;
  const summary = summarizeChecklist(checklist.map((c) => c.result));

  return {
    audit: {
      id: a.id,
      folio: a.folio,
      title: a.title,
      auditType: a.auditType,
      status: a.status,
      priority: a.priority,
      area: a.area,
      process: a.process,
      objective: a.objective,
      scope: a.scope,
      criteria: a.criteria,
      normVersionLabel: a.normVersionLabel,
      templateVersionId: a.templateVersionId,
      siteName: site?.name ?? null,
      plannedDate: isoDate(a.plannedDate),
      startedAt: isoDate(a.startedAt),
      endedAt: isoDate(a.endedAt),
      leadAuditorName: a.leadAuditorUserId ? (names.get(a.leadAuditorUserId) ?? null) : null,
      executiveSummary: a.executiveSummary,
      conclusion: a.conclusion,
      followUpRequired: a.followUpRequired,
      readOnly: isTerminalAudit(a.status as AuditStatus),
    },
    program,
    summary,
    team: team.map((t) => ({
      id: t.id,
      name: names.get(t.userId) ?? t.userId,
      role: t.role,
      area: t.area,
      potentialConflict: t.potentialConflict,
    })),
    agenda: agenda.map((g) => ({
      id: g.id,
      startTime: g.startTime,
      endTime: g.endTime,
      processArea: g.processArea,
      location: g.location,
      notes: g.notes,
    })),
    scope: scope.map((s) => ({ id: s.id, kind: s.kind, label: s.label })),
    findings: findings.map((f) => ({
      id: f.id,
      folio: f.folio,
      title: f.title,
      classification: f.classification,
      severity: f.severity,
      status: f.status,
    })),
    comments: comments.map((c) => ({
      id: c.id,
      author: c.author ? (names.get(c.author) ?? null) : null,
      body: c.body,
      createdAt: c.createdAt,
    })),
    files: files.map((f) => ({
      id: f.id,
      kind: f.kind,
      originalName: f.originalName,
      sizeBytes: f.sizeBytes,
    })),
    history: history.map((h) => ({
      id: h.id.toString(),
      event: h.event,
      toStatus: h.toStatus,
      detail: h.detail,
      actorName: h.actorUserId ? (names.get(h.actorUserId) ?? null) : null,
      createdAt: h.createdAt,
    })),
  };
}

/** Datos del modo ejecución: snapshots + evaluación + evidencia por requisito. */
export async function getExecutionData(organizationId: string, auditId: string) {
  const prisma = getPrisma();
  const a = await loadScoped(organizationId, auditId);
  const snapshots = await prisma.auditRequirementSnapshot.findMany({
    where: { auditId, organizationId },
    orderBy: { sequence: 'asc' },
  });
  const items = await prisma.auditChecklistItem.findMany({ where: { auditId, organizationId } });
  const itemBySnapshot = new Map(items.map((i) => [i.snapshotId, i]));
  const evCounts = await prisma.auditEvidence.groupBy({
    by: ['checklistItemId'],
    where: { auditId, organizationId, checklistItemId: { not: null } },
    _count: { _all: true },
  });
  const evByItem = new Map(evCounts.map((e) => [e.checklistItemId, e._count._all]));
  const rows = snapshots.map((s) => {
    const item = itemBySnapshot.get(s.id);
    return {
      snapshotId: s.id,
      checklistItemId: item?.id ?? null,
      sequence: s.sequence,
      sectionCode: s.sectionCode,
      sectionTitle: s.sectionTitle,
      requirementCode: s.requirementCode,
      requirementTitle: s.requirementTitle,
      requirementText: s.requirementText,
      isCritical: s.isCritical,
      questions: s.questions,
      result: item?.result ?? 'no_evaluado',
      expectedEvidence: item?.expectedEvidence ?? null,
      foundEvidence: item?.foundEvidence ?? null,
      comment: item?.comment ?? null,
      fieldVerificationRequired: item?.fieldVerificationRequired ?? false,
      evidenceCount: item ? (evByItem.get(item.id) ?? 0) : 0,
    };
  });
  return {
    audit: {
      id: a.id,
      folio: a.folio,
      title: a.title,
      status: a.status,
      normVersionLabel: a.normVersionLabel,
    },
    rows,
    summary: summarizeChecklist(rows.map((r) => r.result)),
  };
}

export const _auditResults = CHECKLIST_RESULTS;
