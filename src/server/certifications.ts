/**
 * Registro de esquemas/certificaciones aplicables (TASK-010). Seguimiento
 * únicamente: Sentinel NO valida certificados externos. Scoping por organización.
 */
import { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';

export class CertificationNotFoundError extends Error {
  constructor() {
    super('Certificación no encontrada en esta organización.');
    this.name = 'CertificationNotFoundError';
  }
}
export class CertificationPermissionError extends Error {
  constructor(message = 'No tienes permiso para esta acción.') {
    super(message);
    this.name = 'CertificationPermissionError';
  }
}

const CERT_STATUSES = [
  'preparation',
  'active',
  'next_audit',
  'follow_up',
  'suspended',
  'expired',
] as const;
const inSet = <T extends string>(set: readonly T[], v: unknown, fallback: T): T =>
  (set as readonly string[]).includes(v as string) ? (v as T) : fallback;
const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const parseDate = (v: string | null | undefined) => (v ? new Date(`${v}T00:00:00.000Z`) : null);

async function memberRole(organizationId: string, userId: string): Promise<string> {
  const m = await getPrisma().membership.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!m) throw new CertificationPermissionError('No perteneces a esta organización.');
  return m.role;
}
const isAdmin = (role: string) => role === 'owner' || role === 'admin';

export const CERTIFICATION_STATUS_LABEL: Record<(typeof CERT_STATUSES)[number], string> = {
  preparation: 'Preparación',
  active: 'Activo',
  next_audit: 'Próxima auditoría',
  follow_up: 'Seguimiento',
  suspended: 'Suspendido',
  expired: 'Vencido',
};

export interface CertificationInput {
  schemeName: string;
  version?: string | null;
  siteId?: string | null;
  frameworkId?: string | null;
  scope?: string | null;
  certifierName?: string | null;
  lastAuditDate?: string | null;
  nextAuditDate?: string | null;
  expiryDate?: string | null;
  status?: string;
  comment?: string | null;
}

export async function createCertification(
  organizationId: string,
  actorId: string,
  input: CertificationInput,
): Promise<string> {
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role))
    throw new CertificationPermissionError('Solo owner/admin gestiona certificaciones.');
  if (!input.schemeName?.trim()) {
    throw new CertificationPermissionError('El nombre del esquema es obligatorio.');
  }
  return withOrgContext(organizationId, async (tx) => {
    const cert = await tx.organizationCertification.create({
      data: {
        organizationId,
        schemeName: input.schemeName.trim(),
        version: input.version ?? null,
        siteId: input.siteId || null,
        frameworkId: input.frameworkId || null,
        scope: input.scope ?? null,
        certifierName: input.certifierName ?? null,
        lastAuditDate: parseDate(input.lastAuditDate),
        nextAuditDate: parseDate(input.nextAuditDate),
        expiryDate: parseDate(input.expiryDate),
        status: inSet(CERT_STATUSES, input.status, 'preparation'),
        comment: input.comment ?? null,
        createdBy: actorId,
      },
    });
    return cert.id;
  });
}

export async function updateCertification(
  organizationId: string,
  actorId: string,
  certId: string,
  input: Partial<CertificationInput>,
): Promise<void> {
  const role = await memberRole(organizationId, actorId);
  if (!isAdmin(role))
    throw new CertificationPermissionError('Solo owner/admin gestiona certificaciones.');
  const cert = await getPrisma().organizationCertification.findFirst({
    where: { id: certId, organizationId },
  });
  if (!cert) throw new CertificationNotFoundError();
  await withOrgContext(organizationId, async (tx) => {
    await tx.organizationCertification.update({
      where: { id: certId },
      data: {
        schemeName: input.schemeName?.trim() ?? cert.schemeName,
        version: input.version ?? cert.version,
        scope: input.scope ?? cert.scope,
        certifierName: input.certifierName ?? cert.certifierName,
        lastAuditDate:
          input.lastAuditDate === undefined ? cert.lastAuditDate : parseDate(input.lastAuditDate),
        nextAuditDate:
          input.nextAuditDate === undefined ? cert.nextAuditDate : parseDate(input.nextAuditDate),
        expiryDate: input.expiryDate === undefined ? cert.expiryDate : parseDate(input.expiryDate),
        status: input.status
          ? inSet(CERT_STATUSES, input.status, cert.status as never)
          : cert.status,
        comment: input.comment ?? cert.comment,
      },
    });
  });
}

export async function listCertifications(organizationId: string) {
  const prisma = getPrisma();
  const certs = await prisma.organizationCertification.findMany({
    where: { organizationId },
    orderBy: [{ nextAuditDate: 'asc' }],
  });
  const sites = await prisma.site.findMany({
    where: {
      id: { in: certs.map((c) => c.siteId).filter((x): x is string => Boolean(x)) },
      organizationId,
    },
    select: { id: true, name: true },
  });
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const t = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  return certs.map((c) => ({
    id: c.id,
    schemeName: c.schemeName,
    version: c.version,
    siteName: c.siteId ? (siteName.get(c.siteId) ?? null) : null,
    certifierName: c.certifierName,
    status: c.status,
    lastAuditDate: isoDate(c.lastAuditDate),
    nextAuditDate: isoDate(c.nextAuditDate),
    expiryDate: isoDate(c.expiryDate),
    dueSoon:
      !!isoDate(c.nextAuditDate) &&
      isoDate(c.nextAuditDate)! >= t &&
      isoDate(c.nextAuditDate)! <= soon,
    expired: !!isoDate(c.expiryDate) && isoDate(c.expiryDate)! < t,
  }));
}

/** Próximas auditorías de esquemas (para dashboard). */
export async function getUpcomingCertificationAudits(organizationId: string, withinDays = 120) {
  const prisma = getPrisma();
  const t = new Date();
  const limit = new Date(Date.now() + withinDays * 86400000);
  const certs = await prisma.organizationCertification.findMany({
    where: { organizationId, nextAuditDate: { gte: t, lte: limit } },
    orderBy: { nextAuditDate: 'asc' },
    take: 6,
  });
  return certs.map((c) => ({
    id: c.id,
    schemeName: c.schemeName,
    nextAuditDate: isoDate(c.nextAuditDate),
    daysLeft: c.nextAuditDate
      ? Math.max(0, Math.ceil((c.nextAuditDate.getTime() - t.getTime()) / 86400000))
      : null,
  }));
}

export const _certStatuses = CERT_STATUSES;
void Prisma;
