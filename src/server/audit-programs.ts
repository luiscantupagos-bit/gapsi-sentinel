/**
 * Programas de auditoría (TASK-010) con scoping por organización + RLS.
 * Folio atómico `PA-AAAA-####`. Permisos validados en servidor.
 */
import { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';
import {
  PROGRAM_FREQUENCIES,
  assertProgramTransition,
  isProgramReopen,
  isTerminalProgram,
  validateProgramTransition,
  type ProgramStatus,
} from '@/features/audits/program-state';
import { AUDIT_TYPES } from '@/features/audits/audit-state';

type Tx = Prisma.TransactionClient;

export class ProgramNotFoundError extends Error {
  constructor() {
    super('Programa no encontrado en esta organización.');
    this.name = 'ProgramNotFoundError';
  }
}
export class ProgramPermissionError extends Error {
  constructor(message = 'No tienes permiso para esta acción.') {
    super(message);
    this.name = 'ProgramPermissionError';
  }
}
export class ProgramValidationError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super('Datos de programa inválidos.');
    this.name = 'ProgramValidationError';
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
  if (!m) throw new ProgramPermissionError('No perteneces a esta organización.');
  return m.role;
}
const isAdmin = (role: string) => role === 'owner' || role === 'admin';

async function userNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unique.length === 0) return new Map();
  const users = await getPrisma().user.findMany({
    where: { id: { in: unique } },
    select: { id: true, displayName: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u.displayName ?? u.email]));
}

async function loadScoped(organizationId: string, programId: string) {
  const p = await getPrisma().auditProgram.findFirst({ where: { id: programId, organizationId } });
  if (!p) throw new ProgramNotFoundError();
  return p;
}

async function nextFolio(tx: Tx, organizationId: string, year: number): Promise<string> {
  const rows = await tx.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO audit_program_folio_counters ("organization_id", "year", "last_seq")
    VALUES (${organizationId}::uuid, ${year}, 1)
    ON CONFLICT ("organization_id", "year")
    DO UPDATE SET "last_seq" = audit_program_folio_counters."last_seq" + 1
    RETURNING "last_seq"`;
  const seq = rows[0]?.last_seq ?? 1;
  return `PA-${year}-${String(seq).padStart(4, '0')}`;
}

async function recordHistory(
  tx: Tx,
  organizationId: string,
  programId: string,
  event: string,
  actorUserId: string,
  opts: { fromStatus?: string | null; toStatus?: string | null; detail?: string | null } = {},
): Promise<void> {
  await tx.auditProgramStatusHistory.create({
    data: {
      organizationId,
      programId,
      event,
      fromStatus: opts.fromStatus ?? null,
      toStatus: opts.toStatus ?? null,
      actorUserId,
      detail: opts.detail ?? null,
    },
  });
}

export interface ProgramInput {
  name: string;
  description?: string | null;
  objective?: string | null;
  scope?: string | null;
  criteria?: string | null;
  year: number;
  frequency?: string;
  siteId?: string | null;
  responsibleUserId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export async function createProgram(
  organizationId: string,
  actorId: string,
  input: ProgramInput,
): Promise<string> {
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role)) throw new ProgramPermissionError('Solo owner/admin crea programas.');
  if (!input.name?.trim()) throw new ProgramValidationError(['El nombre es obligatorio.']);
  if (!input.year || input.year < 2000 || input.year > 3000) {
    throw new ProgramValidationError(['El año es inválido.']);
  }
  return withOrgContext(organizationId, async (tx) => {
    const folio = await nextFolio(tx, organizationId, input.year);
    const program = await tx.auditProgram.create({
      data: {
        organizationId,
        folio,
        name: input.name.trim(),
        description: input.description ?? null,
        objective: input.objective ?? null,
        scope: input.scope ?? null,
        criteria: input.criteria ?? null,
        year: input.year,
        frequency: inSet(PROGRAM_FREQUENCIES, input.frequency, 'annual'),
        siteId: input.siteId || null,
        responsibleUserId: input.responsibleUserId || null,
        startDate: parseDate(input.startDate),
        endDate: parseDate(input.endDate),
        status: 'draft',
        createdBy: actorId,
      },
    });
    await recordHistory(tx, organizationId, program.id, 'program.created', actorId, {
      toStatus: 'draft',
    });
    return program.id;
  });
}

export async function listPrograms(
  organizationId: string,
  filters: { year?: number; status?: string } = {},
) {
  const prisma = getPrisma();
  const where: Prisma.AuditProgramWhereInput = { organizationId };
  if (filters.year) where.year = filters.year;
  if (filters.status) where.status = filters.status;
  const programs = await prisma.auditProgram.findMany({
    where,
    orderBy: [{ year: 'desc' }, { folio: 'desc' }],
  });
  const names = await userNames(programs.map((p) => p.responsibleUserId));
  const counts = programs.length
    ? await prisma.audit.groupBy({
        by: ['programId'],
        where: { organizationId, programId: { in: programs.map((p) => p.id) } },
        _count: { _all: true },
      })
    : [];
  const auditCount = new Map(counts.map((c) => [c.programId, c._count._all]));
  return programs.map((p) => ({
    id: p.id,
    folio: p.folio,
    name: p.name,
    year: p.year,
    frequency: p.frequency,
    status: p.status,
    responsibleName: p.responsibleUserId ? (names.get(p.responsibleUserId) ?? null) : null,
    startDate: isoDate(p.startDate),
    endDate: isoDate(p.endDate),
    auditCount: p.id ? (auditCount.get(p.id) ?? 0) : 0,
  }));
}

export async function getProgramDetail(organizationId: string, programId: string) {
  const prisma = getPrisma();
  const p = await loadScoped(organizationId, programId);
  const [items, files, history, audits] = await Promise.all([
    prisma.auditProgramItem.findMany({
      where: { programId, organizationId },
      orderBy: { sequence: 'asc' },
    }),
    prisma.auditProgramFile.findMany({
      where: { programId, organizationId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.auditProgramStatusHistory.findMany({
      where: { programId, organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.audit.findMany({
      where: { programId, organizationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        folio: true,
        title: true,
        status: true,
        auditType: true,
        plannedDate: true,
      },
    }),
  ]);
  const names = await userNames([p.responsibleUserId, ...history.map((h) => h.actorUserId)]);
  const site = p.siteId
    ? await prisma.site.findFirst({
        where: { id: p.siteId, organizationId },
        select: { name: true },
      })
    : null;
  return {
    program: {
      id: p.id,
      folio: p.folio,
      name: p.name,
      description: p.description,
      objective: p.objective,
      scope: p.scope,
      criteria: p.criteria,
      year: p.year,
      frequency: p.frequency,
      status: p.status,
      responsibleName: p.responsibleUserId ? (names.get(p.responsibleUserId) ?? null) : null,
      siteName: site?.name ?? null,
      startDate: isoDate(p.startDate),
      endDate: isoDate(p.endDate),
      readOnly: isTerminalProgram(p.status as ProgramStatus),
    },
    items: items.map((i) => ({
      id: i.id,
      title: i.title,
      plannedDate: isoDate(i.plannedDate),
      auditType: i.auditType,
      status: i.status,
      auditId: i.auditId,
      sequence: i.sequence,
    })),
    files: files.map((f) => ({ id: f.id, originalName: f.originalName, sizeBytes: f.sizeBytes })),
    audits: audits.map((a) => ({
      id: a.id,
      folio: a.folio,
      title: a.title,
      status: a.status,
      auditType: a.auditType,
      plannedDate: isoDate(a.plannedDate),
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

export async function updateProgram(
  organizationId: string,
  actorId: string,
  programId: string,
  input: Partial<ProgramInput>,
): Promise<void> {
  const p = await loadScoped(organizationId, programId);
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role)) throw new ProgramPermissionError('Solo owner/admin edita programas.');
  if (isTerminalProgram(p.status as ProgramStatus)) {
    throw new ProgramValidationError(['El programa está en solo lectura.']);
  }
  await withOrgContext(organizationId, async (tx) => {
    await tx.auditProgram.update({
      where: { id: programId },
      data: {
        name: input.name?.trim() ?? p.name,
        description: input.description ?? p.description,
        objective: input.objective ?? p.objective,
        scope: input.scope ?? p.scope,
        criteria: input.criteria ?? p.criteria,
        frequency: input.frequency
          ? inSet(PROGRAM_FREQUENCIES, input.frequency, 'annual')
          : p.frequency,
        siteId: input.siteId === undefined ? p.siteId : input.siteId || null,
        responsibleUserId:
          input.responsibleUserId === undefined
            ? p.responsibleUserId
            : input.responsibleUserId || null,
        startDate: input.startDate === undefined ? p.startDate : parseDate(input.startDate),
        endDate: input.endDate === undefined ? p.endDate : parseDate(input.endDate),
      },
    });
    await recordHistory(tx, organizationId, programId, 'program.updated', actorId);
  });
}

export async function transitionProgram(
  organizationId: string,
  actorId: string,
  programId: string,
  to: ProgramStatus,
  opts: { reason?: string | null } = {},
): Promise<void> {
  const p = await loadScoped(organizationId, programId);
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role)) throw new ProgramPermissionError('Solo owner/admin cambia el estado.');
  const from = p.status as ProgramStatus;
  const reopen = isProgramReopen(from, to);
  assertProgramTransition(from, to, { reopen });
  const errors = validateProgramTransition({ to, reason: opts.reason });
  if (errors.length) throw new ProgramValidationError(errors);
  await withOrgContext(organizationId, async (tx) => {
    await tx.auditProgram.update({ where: { id: programId }, data: { status: to } });
    await recordHistory(
      tx,
      organizationId,
      programId,
      reopen ? 'program.reopened' : 'program.status',
      actorId,
      {
        fromStatus: from,
        toStatus: to,
        detail: opts.reason ?? null,
      },
    );
  });
}

export async function addProgramItem(
  organizationId: string,
  actorId: string,
  programId: string,
  input: {
    title: string;
    plannedDate?: string | null;
    siteId?: string | null;
    frameworkId?: string | null;
    auditType?: string;
    sequence?: number;
  },
): Promise<string> {
  const p = await loadScoped(organizationId, programId);
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role)) throw new ProgramPermissionError('Solo owner/admin gestiona el programa.');
  if (isTerminalProgram(p.status as ProgramStatus)) {
    throw new ProgramValidationError(['El programa está en solo lectura.']);
  }
  if (!input.title?.trim()) throw new ProgramValidationError(['El título es obligatorio.']);
  return withOrgContext(organizationId, async (tx) => {
    const item = await tx.auditProgramItem.create({
      data: {
        organizationId,
        programId,
        title: input.title.trim(),
        plannedDate: parseDate(input.plannedDate),
        siteId: input.siteId || null,
        frameworkId: input.frameworkId || null,
        auditType: inSet(AUDIT_TYPES, input.auditType, 'internal'),
        sequence: input.sequence ?? 1,
        createdBy: actorId,
      },
    });
    await recordHistory(tx, organizationId, programId, 'program.item_added', actorId, {
      detail: input.title.trim(),
    });
    return item.id;
  });
}

/** Programas activos con auditorías planeadas (para calendario/dashboard). */
export async function getProgramSummary(organizationId: string) {
  const prisma = getPrisma();
  const all = await prisma.auditProgram.findMany({
    where: { organizationId },
    select: { status: true },
  });
  return {
    total: all.length,
    active: all.filter((p) => p.status === 'active').length,
    draft: all.filter((p) => p.status === 'draft').length,
    completed: all.filter((p) => p.status === 'completed').length,
  };
}

export const _programStatuses = ['draft', 'approved', 'active', 'completed', 'cancelled'] as const;
