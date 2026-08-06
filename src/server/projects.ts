/**
 * Acceso a datos de PROYECTOS (TASK-009) con scoping por organización + RLS.
 *
 * - `organizationId` proviene SIEMPRE de la sesión de servidor.
 * - Permisos validados en servidor por rol/asignación.
 * - Escrituras dentro de `withOrgContext` (RLS) + historial append-only.
 * - Folio atómico `PRJ-AAAA-####` por organización y año.
 */
import { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';
import { saveDocumentFile } from './document-storage';
import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  MILESTONE_STATUSES,
  assertProjectTransition,
  isProjectReopen,
  isTerminalProject,
  validateProjectTransition,
  type ProjectStatus,
} from '@/features/projects/project-state';

type Tx = Prisma.TransactionClient;

export class ProjectNotFoundError extends Error {
  constructor() {
    super('Proyecto no encontrado en esta organización.');
    this.name = 'ProjectNotFoundError';
  }
}
export class ProjectPermissionError extends Error {
  constructor(message = 'No tienes permiso para esta acción.') {
    super(message);
    this.name = 'ProjectPermissionError';
  }
}
export class ProjectValidationError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super('Datos de proyecto inválidos.');
    this.name = 'ProjectValidationError';
    this.errors = errors;
  }
}

const inSet = <T extends string>(set: readonly T[], v: unknown, fallback: T): T =>
  (set as readonly string[]).includes(v as string) ? (v as T) : fallback;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function isoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}
function parseDate(v: string | null | undefined): Date | null {
  return v ? new Date(`${v}T00:00:00.000Z`) : null;
}

async function memberRole(organizationId: string, userId: string): Promise<string> {
  const m = await getPrisma().membership.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!m) throw new ProjectPermissionError('No perteneces a esta organización.');
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

async function loadScoped(organizationId: string, projectId: string) {
  const p = await getPrisma().project.findFirst({ where: { id: projectId, organizationId } });
  if (!p) throw new ProjectNotFoundError();
  return p;
}

async function nextFolio(tx: Tx, organizationId: string, year: number): Promise<string> {
  const rows = await tx.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO project_folio_counters ("organization_id", "year", "last_seq")
    VALUES (${organizationId}::uuid, ${year}, 1)
    ON CONFLICT ("organization_id", "year")
    DO UPDATE SET "last_seq" = project_folio_counters."last_seq" + 1
    RETURNING "last_seq"`;
  const seq = rows[0]?.last_seq ?? 1;
  return `PRJ-${year}-${String(seq).padStart(4, '0')}`;
}

async function recordHistory(
  tx: Tx,
  organizationId: string,
  projectId: string,
  event: string,
  actorUserId: string,
  opts: { fromStatus?: string | null; toStatus?: string | null; detail?: string | null } = {},
): Promise<void> {
  await tx.projectStatusHistory.create({
    data: {
      organizationId,
      projectId,
      event,
      fromStatus: opts.fromStatus ?? null,
      toStatus: opts.toStatus ?? null,
      actorUserId,
      detail: opts.detail ?? null,
    },
  });
}

function canManage(
  project: { responsibleUserId: string | null },
  role: string,
  userId: string,
  leadIds: Set<string>,
): boolean {
  return isAdmin(role) || project.responsibleUserId === userId || leadIds.has(userId);
}

// --- Consultas ---------------------------------------------------------------

export interface ProjectFilters {
  search?: string;
  status?: string;
  type?: string;
  responsibleUserId?: string;
}

export async function listProjects(organizationId: string, filters: ProjectFilters = {}) {
  const prisma = getPrisma();
  const where: Prisma.ProjectWhereInput = { organizationId };
  if (filters.search?.trim()) {
    where.OR = [
      { folio: { contains: filters.search, mode: 'insensitive' } },
      { name: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.status) where.status = filters.status;
  if (filters.type) where.projectType = filters.type;
  if (filters.responsibleUserId) where.responsibleUserId = filters.responsibleUserId;

  const projects = await prisma.project.findMany({ where, orderBy: { createdAt: 'desc' } });
  const names = await userNames(projects.map((p) => p.responsibleUserId));
  const siteIds = projects.map((p) => p.siteId).filter((x): x is string => Boolean(x));
  const sites = siteIds.length
    ? await prisma.site.findMany({
        where: { id: { in: siteIds }, organizationId },
        select: { id: true, name: true },
      })
    : [];
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const t = today();

  // Conteo de tareas por proyecto (para avance/volumen).
  const taskCounts = await prisma.task.groupBy({
    by: ['projectId', 'status'],
    where: { organizationId, projectId: { in: projects.map((p) => p.id) } },
    _count: { _all: true },
  });
  const openByProject = new Map<string, number>();
  const totalByProject = new Map<string, number>();
  for (const row of taskCounts) {
    if (!row.projectId) continue;
    const c = row._count._all;
    totalByProject.set(row.projectId, (totalByProject.get(row.projectId) ?? 0) + c);
    if (row.status !== 'completed' && row.status !== 'cancelled') {
      openByProject.set(row.projectId, (openByProject.get(row.projectId) ?? 0) + c);
    }
  }

  return projects.map((p) => ({
    id: p.id,
    folio: p.folio,
    name: p.name,
    projectType: p.projectType,
    status: p.status,
    priority: p.priority,
    responsibleUserId: p.responsibleUserId,
    responsibleName: p.responsibleUserId ? (names.get(p.responsibleUserId) ?? null) : null,
    siteName: p.siteId ? (siteName.get(p.siteId) ?? null) : null,
    startDate: isoDate(p.startDate),
    targetDate: isoDate(p.targetDate),
    progress: p.progress,
    openTasks: openByProject.get(p.id) ?? 0,
    totalTasks: totalByProject.get(p.id) ?? 0,
    overdue: p.status === 'active' && !!p.targetDate && isoDate(p.targetDate)! < t,
  }));
}

export async function getProjectSummary(organizationId: string) {
  const prisma = getPrisma();
  const all = await prisma.project.findMany({
    where: { organizationId },
    select: { status: true, targetDate: true },
  });
  const t = today();
  const active = all.filter((p) => p.status === 'active');
  return {
    total: all.length,
    active: active.length,
    atRisk: active.filter((p) => p.targetDate && isoDate(p.targetDate)! < t).length,
    planned: all.filter((p) => p.status === 'planned').length,
    completed: all.filter((p) => p.status === 'completed').length,
  };
}

export async function getProjectDetail(organizationId: string, projectId: string) {
  const prisma = getPrisma();
  const p = await loadScoped(organizationId, projectId);
  const [members, milestones, relations, comments, files, tasks, history] = await Promise.all([
    prisma.projectMember.findMany({ where: { projectId, organizationId } }),
    prisma.projectMilestone.findMany({
      where: { projectId, organizationId },
      orderBy: { sequence: 'asc' },
    }),
    prisma.projectRelation.findMany({ where: { projectId, organizationId } }),
    prisma.projectComment.findMany({
      where: { projectId, organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.projectFile.findMany({
      where: { projectId, organizationId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.task.findMany({
      where: { projectId, organizationId },
      orderBy: [{ createdAt: 'asc' }],
    }),
    prisma.projectStatusHistory.findMany({
      where: { projectId, organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  const names = await userNames([
    p.responsibleUserId,
    p.sponsorUserId,
    p.createdBy,
    ...members.map((m) => m.userId),
    ...milestones.map((m) => m.responsibleUserId),
    ...tasks.map((t) => t.responsibleUserId),
    ...comments.map((c) => c.author),
    ...history.map((h) => h.actorUserId),
  ]);
  const site = p.siteId
    ? await prisma.site.findFirst({
        where: { id: p.siteId, organizationId },
        select: { name: true },
      })
    : null;

  return {
    project: {
      id: p.id,
      folio: p.folio,
      name: p.name,
      description: p.description,
      objective: p.objective,
      scope: p.scope,
      projectType: p.projectType,
      status: p.status,
      priority: p.priority,
      responsibleUserId: p.responsibleUserId,
      responsibleName: p.responsibleUserId ? (names.get(p.responsibleUserId) ?? null) : null,
      sponsorName: p.sponsorUserId ? (names.get(p.sponsorUserId) ?? null) : null,
      siteName: site?.name ?? null,
      startDate: isoDate(p.startDate),
      targetDate: isoDate(p.targetDate),
      closedAt: p.closedAt,
      progress: p.progress,
      origin: p.origin,
      risksSummary: p.risksSummary,
      expectedOutcome: p.expectedOutcome,
      actualOutcome: p.actualOutcome,
      readOnly: isTerminalProject(p.status as ProjectStatus),
    },
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: names.get(m.userId) ?? m.userId,
      role: m.role,
    })),
    milestones: milestones.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      targetDate: isoDate(m.targetDate),
      actualDate: isoDate(m.actualDate),
      status: m.status,
      responsibleName: m.responsibleUserId ? (names.get(m.responsibleUserId) ?? null) : null,
      acceptanceCriteria: m.acceptanceCriteria,
      sequence: m.sequence,
    })),
    relations: relations.map((r) => ({
      id: r.id,
      relationType: r.relationType,
      targetId: r.targetId,
      externalRef: r.externalRef,
      note: r.note,
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
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      folio: t.folio,
      title: t.title,
      status: t.status,
      priority: t.priority,
      progress: t.progress,
      responsibleName: t.responsibleUserId ? (names.get(t.responsibleUserId) ?? null) : null,
      startDate: isoDate(t.startDate),
      targetDate: isoDate(t.targetDate),
      milestoneId: t.milestoneId,
    })),
    history: history.map((h) => ({
      id: h.id.toString(),
      event: h.event,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      detail: h.detail,
      actorName: h.actorUserId ? (names.get(h.actorUserId) ?? null) : null,
      createdAt: h.createdAt,
    })),
  };
}

// --- Escrituras --------------------------------------------------------------

export interface ProjectInput {
  name: string;
  description?: string | null;
  objective?: string | null;
  scope?: string | null;
  projectType: string;
  priority?: string;
  siteId?: string | null;
  responsibleUserId?: string | null;
  sponsorUserId?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  origin?: string;
  risksSummary?: string | null;
  expectedOutcome?: string | null;
}

export async function createProject(
  organizationId: string,
  actorId: string,
  input: ProjectInput,
): Promise<string> {
  const role = await memberRole(organizationId, actorId);
  if (!canCreate(role)) throw new ProjectPermissionError('No tienes permiso para crear proyectos.');
  const errors: string[] = [];
  if (!input.name?.trim()) errors.push('El nombre es obligatorio.');
  if (!(PROJECT_TYPES as readonly string[]).includes(input.projectType)) {
    errors.push('El tipo de proyecto es inválido.');
  }
  if (input.startDate && input.targetDate && input.targetDate < input.startDate) {
    errors.push('La fecha objetivo no puede ser anterior a la de inicio.');
  }
  if (errors.length) throw new ProjectValidationError(errors);

  const year = new Date().getUTCFullYear();
  return withOrgContext(organizationId, async (tx) => {
    const folio = await nextFolio(tx, organizationId, year);
    const project = await tx.project.create({
      data: {
        organizationId,
        folio,
        name: input.name.trim(),
        description: input.description ?? null,
        objective: input.objective ?? null,
        scope: input.scope ?? null,
        projectType: input.projectType,
        priority: inSet(PROJECT_PRIORITIES, input.priority, 'normal'),
        siteId: input.siteId || null,
        responsibleUserId: input.responsibleUserId || null,
        sponsorUserId: input.sponsorUserId || null,
        startDate: parseDate(input.startDate),
        targetDate: parseDate(input.targetDate),
        origin: inSet(
          ['manual', 'capa', 'analysis', 'document', 'other'] as const,
          input.origin,
          'manual',
        ),
        risksSummary: input.risksSummary ?? null,
        expectedOutcome: input.expectedOutcome ?? null,
        status: 'draft',
        createdBy: actorId,
      },
    });
    await recordHistory(tx, organizationId, project.id, 'project.created', actorId, {
      toStatus: 'draft',
    });
    return project.id;
  });
}

export async function updateProject(
  organizationId: string,
  actorId: string,
  projectId: string,
  input: Partial<ProjectInput> & { actualOutcome?: string | null },
): Promise<void> {
  const project = await loadScoped(organizationId, projectId);
  const role = await memberRole(organizationId, actorId);
  const leads = new Set(
    (
      await getPrisma().projectMember.findMany({
        where: { projectId, organizationId, role: 'lead' },
        select: { userId: true },
      })
    ).map((m) => m.userId),
  );
  if (!canManage(project, role, actorId, leads)) {
    throw new ProjectPermissionError('No tienes permiso para editar este proyecto.');
  }
  if (isTerminalProject(project.status as ProjectStatus)) {
    throw new ProjectValidationError(['El proyecto está en solo lectura.']);
  }
  await withOrgContext(organizationId, async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: {
        name: input.name?.trim() ?? project.name,
        description: input.description ?? project.description,
        objective: input.objective ?? project.objective,
        scope: input.scope ?? project.scope,
        projectType: input.projectType
          ? inSet(PROJECT_TYPES, input.projectType, project.projectType as never)
          : project.projectType,
        priority: input.priority
          ? inSet(PROJECT_PRIORITIES, input.priority, 'normal')
          : project.priority,
        siteId: input.siteId === undefined ? project.siteId : input.siteId || null,
        responsibleUserId:
          input.responsibleUserId === undefined
            ? project.responsibleUserId
            : input.responsibleUserId || null,
        sponsorUserId:
          input.sponsorUserId === undefined ? project.sponsorUserId : input.sponsorUserId || null,
        startDate: input.startDate === undefined ? project.startDate : parseDate(input.startDate),
        targetDate:
          input.targetDate === undefined ? project.targetDate : parseDate(input.targetDate),
        risksSummary: input.risksSummary ?? project.risksSummary,
        expectedOutcome: input.expectedOutcome ?? project.expectedOutcome,
        actualOutcome: input.actualOutcome ?? project.actualOutcome,
      },
    });
    await recordHistory(tx, organizationId, projectId, 'project.updated', actorId);
  });
}

export async function transitionProject(
  organizationId: string,
  actorId: string,
  projectId: string,
  to: ProjectStatus,
  opts: { reason?: string | null; justification?: string | null } = {},
): Promise<void> {
  const project = await loadScoped(organizationId, projectId);
  const role = await memberRole(organizationId, actorId);
  const from = project.status as ProjectStatus;
  const reopen = isProjectReopen(from, to);
  if (reopen && !isAdmin(role)) {
    throw new ProjectPermissionError('La reapertura requiere owner/admin.');
  }
  if (!reopen) {
    const leads = new Set(
      (
        await getPrisma().projectMember.findMany({
          where: { projectId, organizationId, role: 'lead' },
          select: { userId: true },
        })
      ).map((m) => m.userId),
    );
    if (!canManage(project, role, actorId, leads)) {
      throw new ProjectPermissionError('No tienes permiso para cambiar el estado del proyecto.');
    }
  }
  assertProjectTransition(from, to, { reopen });

  const openMandatory = await getPrisma().task.count({
    where: { projectId, organizationId, status: { notIn: ['completed', 'cancelled'] } },
  });
  const errors = validateProjectTransition({
    to,
    hasResponsible: !!project.responsibleUserId,
    hasStartDate: !!project.startDate,
    hasTargetDate: !!project.targetDate,
    openMandatoryTasks: openMandatory,
    justification: opts.justification,
    reason: opts.reason,
  });
  if (errors.length) throw new ProjectValidationError(errors);

  await withOrgContext(organizationId, async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: {
        status: to,
        closedAt: to === 'completed' || to === 'cancelled' ? new Date() : project.closedAt,
      },
    });
    await recordHistory(
      tx,
      organizationId,
      projectId,
      reopen ? 'project.reopened' : 'project.status',
      actorId,
      {
        fromStatus: from,
        toStatus: to,
        detail: opts.reason ?? opts.justification ?? null,
      },
    );
  });
}

export async function addMilestone(
  organizationId: string,
  actorId: string,
  projectId: string,
  input: {
    name: string;
    description?: string | null;
    targetDate?: string | null;
    responsibleUserId?: string | null;
    acceptanceCriteria?: string | null;
    sequence?: number;
  },
): Promise<string> {
  const project = await loadScoped(organizationId, projectId);
  const role = await memberRole(organizationId, actorId);
  const leads = new Set(
    (
      await getPrisma().projectMember.findMany({
        where: { projectId, organizationId, role: 'lead' },
        select: { userId: true },
      })
    ).map((m) => m.userId),
  );
  if (!canManage(project, role, actorId, leads)) {
    throw new ProjectPermissionError('No tienes permiso para agregar hitos.');
  }
  if (!input.name?.trim()) throw new ProjectValidationError(['El nombre del hito es obligatorio.']);
  return withOrgContext(organizationId, async (tx) => {
    const m = await tx.projectMilestone.create({
      data: {
        organizationId,
        projectId,
        name: input.name.trim(),
        description: input.description ?? null,
        targetDate: parseDate(input.targetDate),
        responsibleUserId: input.responsibleUserId || null,
        acceptanceCriteria: input.acceptanceCriteria ?? null,
        sequence: input.sequence ?? 1,
        createdBy: actorId,
      },
    });
    await recordHistory(tx, organizationId, projectId, 'milestone.created', actorId, {
      detail: input.name.trim(),
    });
    return m.id;
  });
}

export async function updateMilestoneStatus(
  organizationId: string,
  actorId: string,
  milestoneId: string,
  status: string,
): Promise<void> {
  const prisma = getPrisma();
  const m = await prisma.projectMilestone.findFirst({ where: { id: milestoneId, organizationId } });
  if (!m) throw new ProjectNotFoundError();
  const project = await loadScoped(organizationId, m.projectId);
  const role = await memberRole(organizationId, actorId);
  const leads = new Set(
    (
      await prisma.projectMember.findMany({
        where: { projectId: m.projectId, organizationId, role: 'lead' },
        select: { userId: true },
      })
    ).map((x) => x.userId),
  );
  if (!canManage(project, role, actorId, leads)) {
    throw new ProjectPermissionError('No tienes permiso para actualizar el hito.');
  }
  const next = inSet(MILESTONE_STATUSES, status, m.status as never);
  await withOrgContext(organizationId, async (tx) => {
    await tx.projectMilestone.update({
      where: { id: milestoneId },
      data: { status: next, actualDate: next === 'reached' ? new Date() : m.actualDate },
    });
    await recordHistory(tx, organizationId, m.projectId, 'milestone.status', actorId, {
      detail: `${m.name}: ${next}`,
    });
  });
}

export async function addProjectMember(
  organizationId: string,
  actorId: string,
  projectId: string,
  userId: string,
  role: string,
): Promise<void> {
  const project = await loadScoped(organizationId, projectId);
  const actorRole = await memberRole(organizationId, actorId);
  const leads = new Set(
    (
      await getPrisma().projectMember.findMany({
        where: { projectId, organizationId, role: 'lead' },
        select: { userId: true },
      })
    ).map((m) => m.userId),
  );
  if (!canManage(project, actorRole, actorId, leads)) {
    throw new ProjectPermissionError('No tienes permiso para gestionar participantes.');
  }
  const member = await getPrisma().membership.findFirst({
    where: { organizationId, userId },
    select: { userId: true },
  });
  if (!member) throw new ProjectValidationError(['El usuario no pertenece a la organización.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: {
        organizationId,
        projectId,
        userId,
        role: inSet(['lead', 'member', 'viewer'] as const, role, 'member'),
        addedBy: actorId,
      },
      update: { role: inSet(['lead', 'member', 'viewer'] as const, role, 'member') },
    });
  });
}

export async function addProjectRelation(
  organizationId: string,
  actorId: string,
  projectId: string,
  input: {
    relationType: string;
    targetId?: string | null;
    externalRef?: string | null;
    note?: string | null;
  },
): Promise<void> {
  await loadScoped(organizationId, projectId);
  await memberRole(organizationId, actorId);
  await withOrgContext(organizationId, async (tx) => {
    await tx.projectRelation.create({
      data: {
        organizationId,
        projectId,
        relationType: inSet(
          ['capa', 'analysis', 'document', 'document_version', 'external'] as const,
          input.relationType,
          'external',
        ),
        targetId: input.targetId || null,
        externalRef: input.externalRef ?? null,
        note: input.note ?? null,
        createdBy: actorId,
      },
    });
  });
}

export async function addProjectComment(
  organizationId: string,
  actorId: string,
  projectId: string,
  body: string,
): Promise<void> {
  await loadScoped(organizationId, projectId);
  await memberRole(organizationId, actorId);
  if (!body?.trim()) throw new ProjectValidationError(['El comentario no puede estar vacío.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.projectComment.create({
      data: { organizationId, projectId, author: actorId, body: body.trim() },
    });
  });
}

export async function uploadProjectFile(
  organizationId: string,
  actorId: string,
  projectId: string,
  file: { originalName: string; mimeType: string; data: Buffer },
  kind: 'attachment' | 'evidence' = 'attachment',
): Promise<void> {
  await loadScoped(organizationId, projectId);
  await memberRole(organizationId, actorId);
  const saved = await saveDocumentFile({ organizationId, ...file });
  await withOrgContext(organizationId, async (tx) => {
    await tx.projectFile.create({
      data: {
        organizationId,
        projectId,
        kind,
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

export async function listOrgMembers(organizationId: string) {
  const memberships = await getPrisma().membership.findMany({
    where: { organizationId },
    select: { user: { select: { id: true, displayName: true, email: true } } },
  });
  return memberships.map((m) => ({ id: m.user.id, name: m.user.displayName ?? m.user.email }));
}

/** Hitos con fecha (para calendario y dashboard), opcionalmente en un rango. */
export async function listMilestones(
  organizationId: string,
  range?: { from?: string; to?: string },
) {
  const where: Prisma.ProjectMilestoneWhereInput = {
    organizationId,
    targetDate: { not: null },
  };
  if (range?.from || range?.to) {
    where.targetDate = {
      ...(range.from ? { gte: new Date(`${range.from}T00:00:00.000Z`) } : {}),
      ...(range.to ? { lte: new Date(`${range.to}T00:00:00.000Z`) } : {}),
    };
  }
  const milestones = await getPrisma().projectMilestone.findMany({
    where,
    orderBy: { targetDate: 'asc' },
  });
  const projectIds = [...new Set(milestones.map((m) => m.projectId))];
  const projects = projectIds.length
    ? await getPrisma().project.findMany({
        where: { id: { in: projectIds }, organizationId },
        select: { id: true, folio: true, name: true },
      })
    : [];
  const pMap = new Map(projects.map((p) => [p.id, p]));
  const t = today();
  return milestones.map((m) => ({
    id: m.id,
    name: m.name,
    status: m.status,
    targetDate: isoDate(m.targetDate),
    projectId: m.projectId,
    projectName: pMap.get(m.projectId)?.name ?? null,
    projectFolio: pMap.get(m.projectId)?.folio ?? null,
    overdue:
      m.status !== 'reached' &&
      m.status !== 'cancelled' &&
      !!m.targetDate &&
      isoDate(m.targetDate)! < t,
  }));
}

/** Contexto de permisos del usuario sobre un proyecto (para la interfaz). */
export async function getUserProjectContext(
  organizationId: string,
  userId: string,
  projectId: string,
) {
  const role =
    (
      await getPrisma().membership.findFirst({
        where: { organizationId, userId },
        select: { role: true },
      })
    )?.role ?? 'viewer';
  const project = await getPrisma().project.findFirst({
    where: { id: projectId, organizationId },
    select: { responsibleUserId: true },
  });
  const leads = new Set(
    (
      await getPrisma().projectMember.findMany({
        where: { projectId, organizationId, role: 'lead' },
        select: { userId: true },
      })
    ).map((m) => m.userId),
  );
  const canManageProject = project ? canManage(project, role, userId, leads) : false;
  return { role, isAdmin: isAdmin(role), canManage: canManageProject };
}

export const _projectStatuses = PROJECT_STATUSES;
