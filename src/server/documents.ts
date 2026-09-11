/**
 * Acceso a datos del módulo documental con SCOPING por organización (TASK-004).
 *
 * - La `organizationId` proviene SIEMPRE de la sesión de servidor.
 * - Toda lectura/escritura se filtra por organización (recurso ajeno = "no
 *   encontrado").
 * - Las FK compuestas anti-cruce impiden relacionar con sitios/diagnósticos/
 *   requisitos/archivos de otra organización; se sanea el error a un mensaje claro.
 * - Escrituras dentro de `withOrgContext` (RLS) + historial append-only.
 */
import { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';
import { saveDocumentFile, type SavedFile } from './document-storage';
import {
  validateDocumentMetadata,
  isDueSoon,
  isOverdue,
  extensionOf,
  type DocumentMetadataInput,
} from '@/features/documents/catalog';
import {
  CONTENT_SCHEMA_VERSION,
  contentByteSize,
  contentChecksum,
  maxContentBytes,
  renderContentHtml,
  sanitizeContent,
  type DocNode,
} from '@/features/documents/content-schema';
import {
  DEFAULT_PAGE_CONFIG,
  getTemplate,
  sanitizePageConfig,
  type PageConfig,
} from '@/features/documents/templates';
import { isEditableStatus, type VersionStatus } from '@/features/documents/workflow-state';
import {
  nextVersionLabel,
  INITIAL_VERSION_LABEL,
  type VersionBump,
} from '@/features/documents/versioning';
import { getTemplateDefinition, codePrefixFor } from '@/features/documents/template-registry';
import {
  STRUCTURED_SCHEMA_VERSION,
  sanitizeStructuredContent,
  preserveLegacyRepeatableFields,
  extractReferences,
  type StructuredContent,
} from '@/features/documents/structured-content';
import { structuredByteSize, structuredChecksum } from '@/features/documents/structured-checksum';
import {
  renderStructuredHtml,
  type RenderIdentity,
  type ReferenceResolver,
  type ChangeLogRow,
  type CopyMark,
} from '@/features/documents/structured-render';
import {
  sanitizeDocumentTheme,
  validateDocumentTheme,
  DEFAULT_DOCUMENT_THEME,
  type DocumentTheme,
} from '@/features/documents/document-theme';
import { sanitizeDesignId, DEFAULT_DESIGN_ID } from '@/features/documents/document-design';
import { ensureActivityIds } from '@/features/documents/program-execution';
import { randomUUID } from 'node:crypto';
import {
  sanitizeDateFormat,
  formatIsoDate,
  DEFAULT_DATE_FORMAT,
  type DateFormat,
} from '@/features/documents/date-format';
import {
  computeEntitlements,
  resolveShowC3Attribution,
  isSubscriptionPlan,
  isBillingCadence,
  type SubscriptionEntitlements,
  type SubscriptionDescriptor,
} from '@/features/documents/entitlements';
import { REF_RELATION_TYPES, refKey } from '@/features/documents/references';
import { formatDocumentCode, codeFormatError, normalizeAreaCode } from '@/features/documents/code';
import { computeNextReviewAt, reviewMonthsOf } from '@/features/documents/dates';
import { documentContentMode } from '@/features/documents/content-mode';
import { labelOf, DOCUMENT_TYPES, DOCUMENT_STATUSES } from '@/features/documents/catalog';

/** Última etiqueta de versión conocida del documento (vigente o más reciente). */
async function latestVersionLabel(
  organizationId: string,
  documentId: string,
): Promise<string | null> {
  const prisma = getPrisma();
  const current = await prisma.documentVersion.findFirst({
    where: { documentId, organizationId, isCurrent: true },
    select: { label: true },
  });
  if (current) return current.label;
  const latest = await prisma.documentVersion.findFirst({
    where: { documentId, organizationId },
    orderBy: { createdAt: 'desc' },
    select: { label: true },
  });
  return latest?.label ?? null;
}

export class ContentTooLargeError extends Error {
  constructor() {
    super('El contenido supera el tamaño máximo permitido.');
    this.name = 'ContentTooLargeError';
  }
}
export class UnsupportedImageError extends Error {
  constructor() {
    super('Solo se permiten imágenes PNG o JPG.');
    this.name = 'UnsupportedImageError';
  }
}

export class DocumentNotFoundError extends Error {
  constructor() {
    super('Documento no encontrado en esta organización.');
    this.name = 'DocumentNotFoundError';
  }
}
export class DuplicateCodeError extends Error {
  constructor() {
    super('Ya existe un documento con ese código en la organización.');
    this.name = 'DuplicateCodeError';
  }
}
export class DocumentNotEditableError extends Error {
  constructor() {
    super('El documento está archivado y no puede editarse.');
    this.name = 'DocumentNotEditableError';
  }
}
export class DocumentValidationError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super('Datos de documento inválidos.');
    this.name = 'DocumentValidationError';
    this.errors = errors;
  }
}
export class RelationScopeError extends Error {
  constructor(message = 'El recurso relacionado no pertenece a la organización.') {
    super(message);
    this.name = 'RelationScopeError';
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function isoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}
function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

async function loadScopedDocument(organizationId: string, documentId: string) {
  const doc = await getPrisma().document.findFirst({ where: { id: documentId, organizationId } });
  if (!doc) throw new DocumentNotFoundError();
  return doc;
}

async function userNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unique.length === 0) return new Map();
  const users = await getPrisma().user.findMany({
    where: { id: { in: unique } },
    select: { id: true, displayName: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u.displayName ?? u.email]));
}

export interface DocumentFilters {
  search?: string;
  type?: string;
  status?: string;
  /** Grupo de estado para el listado maestro: activos | all | (estado concreto). */
  statusGroup?: 'active' | 'all';
  siteId?: string;
  origin?: string;
  /** Nombre de área (ownerArea). */
  area?: string;
  sort?: 'code' | 'updated';
}

export async function listDocuments(organizationId: string, filters: DocumentFilters = {}) {
  const prisma = getPrisma();
  const where: Prisma.DocumentWhereInput = { organizationId };
  if (filters.search?.trim()) {
    where.OR = [
      { code: { contains: filters.search, mode: 'insensitive' } },
      { title: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.type) where.documentType = filters.type;
  if (filters.status) where.status = filters.status;
  else if (filters.statusGroup === 'active') where.status = { in: ['effective', 'in_review'] };
  if (filters.siteId) where.siteId = filters.siteId;
  if (filters.origin) where.origin = filters.origin;
  if (filters.area) where.ownerArea = filters.area;

  const docs = await prisma.document.findMany({
    where,
    orderBy: filters.sort === 'updated' ? { updatedAt: 'desc' } : { code: 'asc' },
  });

  const siteIds = docs.map((d) => d.siteId).filter((x): x is string => Boolean(x));
  const sites = siteIds.length
    ? await prisma.site.findMany({
        where: { id: { in: siteIds }, organizationId },
        select: { id: true, name: true },
      })
    : [];
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const names = await userNames(docs.map((d) => d.responsibleUserId));
  const t = today();
  // DOC-UX-003 §4/§5: los flags dueSoon/overdue usan la fecha RAW (ISO); solo el
  // texto visible se formatea con el formato de la organización.
  const { dateFormat } = await getDocumentPresentation(organizationId);

  return docs.map((d) => {
    const rawIssued = isoDate(d.issuedAt);
    const rawNext = isoDate(d.nextReviewAt);
    return {
      id: d.id,
      code: d.code,
      title: d.title,
      documentType: d.documentType,
      origin: d.origin,
      status: d.status,
      currentVersionLabel: d.currentVersionLabel,
      siteName: d.siteId ? (siteName.get(d.siteId) ?? null) : null,
      ownerArea: d.ownerArea,
      responsibleName: d.responsibleUserId ? (names.get(d.responsibleUserId) ?? null) : null,
      issuedAt: formatIsoDate(rawIssued, dateFormat),
      nextReviewAt: formatIsoDate(rawNext, dateFormat),
      dueSoon: isDueSoon(rawNext, t),
      overdue: isOverdue(rawNext, t),
    };
  });
}

export async function getDocSummary(organizationId: string) {
  const prisma = getPrisma();
  const all = await prisma.document.findMany({
    where: { organizationId },
    select: { status: true, nextReviewAt: true },
  });
  const t = today();
  return {
    total: all.length,
    effective: all.filter((d) => d.status === 'effective').length,
    obsolete: all.filter((d) => d.status === 'obsolete').length,
    dueSoon: all.filter((d) => isDueSoon(isoDate(d.nextReviewAt), t)).length,
  };
}

/**
 * DOC-UX-001: datos de la biblioteca documental — KPIs reales y carpetas por área
 * (todas las áreas activas, incluso vacías §30) con su conteo de documentos
 * activos (no archivados). Scoped por organización; sin traer structured_content.
 */
export async function getDocumentLibrary(organizationId: string) {
  const prisma = getPrisma();
  const [docs, areas] = await Promise.all([
    prisma.document.findMany({
      where: { organizationId, archivedAt: null },
      select: { status: true, nextReviewAt: true, ownerArea: true },
    }),
    listDocumentAreas(organizationId),
  ]);
  const t = today();
  const isEffective = (s: string) => s === 'effective';
  const summary = {
    effective: docs.filter((d) => isEffective(d.status)).length,
    inReview: docs.filter((d) => d.status === 'in_review').length,
    dueSoon: docs.filter((d) => isEffective(d.status) && isDueSoon(isoDate(d.nextReviewAt), t))
      .length,
    overdue: docs.filter((d) => isEffective(d.status) && isOverdue(isoDate(d.nextReviewAt), t))
      .length,
  };
  const byArea = new Map<string, number>();
  for (const d of docs) {
    const a = (d.ownerArea ?? '').trim();
    if (a) byArea.set(a, (byArea.get(a) ?? 0) + 1);
  }
  const areaFolders = areas.map((a) => ({
    code: a.code,
    name: a.name,
    count: byArea.get(a.name) ?? 0,
  }));
  return { summary, areas: areaFolders };
}

/** Área activa por código corto (o `null`). */
export async function getAreaByCode(organizationId: string, areaCode: string) {
  const areas = await listDocumentAreas(organizationId);
  return areas.find((a) => (a.code ?? '').toUpperCase() === areaCode.toUpperCase()) ?? null;
}

/**
 * Conteo de documentos activos por TIPO dentro de un área (por nombre). Devuelve
 * todos los tipos estructurados principales (incluye 0, §32).
 */
export async function getAreaTypeCounts(organizationId: string, areaName: string) {
  const docs = await getPrisma().document.findMany({
    where: { organizationId, archivedAt: null, ownerArea: areaName },
    select: { documentType: true, status: true, nextReviewAt: true },
  });
  const t = today();
  const counts = new Map<string, { total: number; effective: number; dueSoon: number }>();
  for (const d of docs) {
    const c = counts.get(d.documentType) ?? { total: 0, effective: 0, dueSoon: 0 };
    c.total += 1;
    if (d.status === 'effective') c.effective += 1;
    if (d.status === 'effective' && isDueSoon(isoDate(d.nextReviewAt), t)) c.dueSoon += 1;
    counts.set(d.documentType, c);
  }
  return DOCUMENT_TYPES.filter((t2) => t2.value !== 'external' && t2.value !== 'annex').map(
    (t2) => ({
      type: t2.value,
      label: t2.label,
      ...(counts.get(t2.value) ?? { total: 0, effective: 0, dueSoon: 0 }),
    }),
  );
}

export async function listSites(organizationId: string) {
  return getPrisma().site.findMany({
    where: { organizationId, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

export async function listResponsibles(organizationId: string) {
  const memberships = await getPrisma().membership.findMany({
    where: { organizationId },
    select: { user: { select: { id: true, displayName: true, email: true } } },
  });
  return memberships.map((m) => ({
    id: m.user.id,
    name: m.user.displayName ?? m.user.email,
  }));
}

export async function getDocumentDetail(organizationId: string, documentId: string) {
  const prisma = getPrisma();
  const doc = await loadScopedDocument(organizationId, documentId);
  // DOC-UX-003 §6: las fechas visibles del panel usan el formato de la organización.
  const { dateFormat } = await getDocumentPresentation(organizationId);

  const [versions, relations, history] = await Promise.all([
    prisma.documentVersion.findMany({
      where: { documentId, organizationId },
      orderBy: { createdAt: 'desc' },
      include: { files: { orderBy: { createdAt: 'asc' } } },
    }),
    prisma.documentRelation.findMany({ where: { documentId, organizationId } }),
    prisma.documentHistory.findMany({
      where: { documentId, organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const names = await userNames([
    doc.responsibleUserId,
    doc.createdBy,
    ...versions.map((v) => v.author),
  ]);
  const site = doc.siteId
    ? await prisma.site.findFirst({
        where: { id: doc.siteId, organizationId },
        select: { name: true },
      })
    : null;

  const current = versions.find((v) => v.isCurrent) ?? versions[0] ?? null;

  return {
    id: doc.id,
    code: doc.code,
    title: doc.title,
    description: doc.description,
    documentType: doc.documentType,
    origin: doc.origin,
    // DOC-001: el editor/preview a abrir depende de la versión vigente, no del tipo.
    contentMode: documentContentMode({
      origin: doc.origin,
      hasStructuredContent: current?.structuredContent != null,
    }),
    status: doc.status,
    confidentiality: doc.confidentiality,
    currentVersionLabel: doc.currentVersionLabel,
    siteName: site?.name ?? null,
    responsibleName: doc.responsibleUserId ? (names.get(doc.responsibleUserId) ?? null) : null,
    ownerArea: doc.ownerArea,
    issuedAt: formatIsoDate(isoDate(doc.issuedAt), dateFormat),
    effectiveAt: formatIsoDate(isoDate(doc.effectiveAt), dateFormat),
    nextReviewAt: formatIsoDate(isoDate(doc.nextReviewAt), dateFormat),
    obsoleteAt: formatIsoDate(isoDate(doc.obsoleteAt), dateFormat),
    archived: Boolean(doc.archivedAt),
    editable: !doc.archivedAt,
    currentFiles: current?.files ?? [],
    versions: versions.map((v) => ({
      id: v.id,
      label: v.label,
      status: v.status,
      isCurrent: v.isCurrent,
      changeNotes: v.changeNotes,
      createdAt: v.createdAt,
      createdAtLabel: formatIsoDate(isoDate(v.createdAt), dateFormat) ?? '—',
      authorName: v.author ? (names.get(v.author) ?? null) : null,
      files: v.files.map((f) => ({
        id: f.id,
        kind: f.kind,
        originalName: f.originalName,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
      })),
    })),
    relations: relations.map((r) => ({ id: r.id, relationType: r.relationType })),
    history: history.map((h) => ({
      id: h.id.toString(),
      action: h.action,
      createdAt: h.createdAt,
    })),
  };
}

/** Valores iniciales del documento para el formulario de edición (scoped). */
export async function getDocumentForEdit(organizationId: string, documentId: string) {
  const d = await loadScopedDocument(organizationId, documentId);
  return {
    documentId: d.id,
    code: d.code,
    title: d.title,
    description: d.description,
    documentType: d.documentType,
    origin: d.origin,
    status: d.status,
    confidentiality: d.confidentiality,
    versionLabel: d.currentVersionLabel ?? '',
    siteId: d.siteId,
    responsibleUserId: d.responsibleUserId,
    ownerArea: d.ownerArea,
    issuedAt: isoDate(d.issuedAt),
    nextReviewAt: isoDate(d.nextReviewAt),
    archived: Boolean(d.archivedAt),
  };
}

/** Metadata de un archivo para descarga protegida (scoped por organización). */
export async function getFileForDownload(organizationId: string, fileId: string) {
  const file = await getPrisma().documentFile.findFirst({
    where: { id: fileId, organizationId },
    select: { storageKey: true, originalName: true, mimeType: true },
  });
  if (!file) throw new DocumentNotFoundError();
  return file;
}

function saneCreate<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new DuplicateCodeError();
      if (error.code === 'P2003') throw new RelationScopeError(); // FK compuesta anti-cruce
    }
    throw error;
  });
}

export interface CreateDocumentInput extends DocumentMetadataInput {
  description?: string | null;
  siteId?: string | null;
  responsibleUserId?: string | null;
  ownerArea?: string | null;
  changeNotes?: string | null;
}

export async function createDocument(
  organizationId: string,
  userId: string,
  input: CreateDocumentInput,
  file?: { originalName: string; mimeType: string; data: Buffer },
): Promise<string> {
  const errors = validateDocumentMetadata(input);
  if (errors.length) throw new DocumentValidationError(errors);

  let saved: SavedFile | null = null;
  if (file) saved = await saveDocumentFile({ organizationId, ...file });

  return saneCreate(() =>
    withOrgContext(organizationId, async (tx) => {
      const document = await tx.document.create({
        data: {
          organizationId,
          code: input.code.trim(),
          title: input.title.trim(),
          description: input.description ?? null,
          documentType: input.documentType,
          origin: input.origin,
          status: input.status,
          confidentiality: input.confidentiality,
          currentVersionLabel: input.versionLabel.trim(),
          siteId: input.siteId || null,
          responsibleUserId: input.responsibleUserId || null,
          ownerArea: input.ownerArea ?? null,
          issuedAt: parseDate(input.issuedAt),
          nextReviewAt: parseDate(input.nextReviewAt),
          createdBy: userId,
        },
      });
      const version = await tx.documentVersion.create({
        data: {
          organizationId,
          documentId: document.id,
          label: input.versionLabel.trim(),
          changeNotes: input.changeNotes ?? null,
          status: 'draft',
          isCurrent: true,
          author: userId,
        },
      });
      if (saved) {
        await tx.documentFile.create({
          data: {
            organizationId,
            documentVersionId: version.id,
            kind: 'main',
            originalName: saved.originalName,
            storedName: saved.storedName,
            mimeType: saved.mimeType,
            sizeBytes: saved.sizeBytes,
            extension: saved.extension,
            storageKey: saved.storageKey,
            checksum: saved.checksum,
            uploadedBy: userId,
          },
        });
      }
      await tx.documentHistory.create({
        data: {
          organizationId,
          documentId: document.id,
          action: 'document.created',
          actorUserId: userId,
        },
      });
      if (saved) {
        await tx.documentHistory.create({
          data: {
            organizationId,
            documentId: document.id,
            action: 'file.uploaded',
            actorUserId: userId,
          },
        });
      }
      return document.id;
    }),
  );
}

export interface UpdateMetadataInput {
  title: string;
  description?: string | null;
  documentType: string;
  status: string;
  confidentiality: string;
  siteId?: string | null;
  responsibleUserId?: string | null;
  ownerArea?: string | null;
  issuedAt?: string | null;
  nextReviewAt?: string | null;
}

export async function updateDocumentMetadata(
  organizationId: string,
  userId: string,
  documentId: string,
  input: UpdateMetadataInput,
): Promise<void> {
  const doc = await loadScopedDocument(organizationId, documentId);
  if (doc.archivedAt) throw new DocumentNotEditableError();

  const errors = validateDocumentMetadata({
    code: doc.code,
    title: input.title,
    documentType: input.documentType,
    versionLabel: doc.currentVersionLabel ?? 'v1',
    origin: doc.origin,
    status: input.status,
    confidentiality: input.confidentiality,
    issuedAt: input.issuedAt,
    nextReviewAt: input.nextReviewAt,
  });
  if (errors.length) throw new DocumentValidationError(errors);

  await saneCreate(() =>
    withOrgContext(organizationId, async (tx) => {
      await tx.document.update({
        where: { id: documentId },
        data: {
          title: input.title.trim(),
          description: input.description ?? null,
          documentType: input.documentType,
          status: input.status,
          confidentiality: input.confidentiality,
          siteId: input.siteId || null,
          responsibleUserId: input.responsibleUserId || null,
          ownerArea: input.ownerArea ?? null,
          issuedAt: parseDate(input.issuedAt),
          nextReviewAt: parseDate(input.nextReviewAt),
        },
      });
      await tx.documentHistory.create({
        data: {
          organizationId,
          documentId,
          action: 'document.metadata_updated',
          actorUserId: userId,
        },
      });
    }),
  );
}

export async function addAttachment(
  organizationId: string,
  userId: string,
  documentId: string,
  file: { originalName: string; mimeType: string; data: Buffer },
): Promise<void> {
  const doc = await loadScopedDocument(organizationId, documentId);
  if (doc.archivedAt) throw new DocumentNotEditableError();

  const current = await getPrisma().documentVersion.findFirst({
    where: { documentId, organizationId, isCurrent: true },
  });
  if (!current) throw new DocumentNotFoundError();

  const saved = await saveDocumentFile({ organizationId, ...file });
  await withOrgContext(organizationId, async (tx) => {
    await tx.documentFile.create({
      data: {
        organizationId,
        documentVersionId: current.id,
        kind: 'attachment',
        originalName: saved.originalName,
        storedName: saved.storedName,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        extension: saved.extension,
        storageKey: saved.storageKey,
        checksum: saved.checksum,
        uploadedBy: userId,
      },
    });
    await tx.documentHistory.create({
      data: { organizationId, documentId, action: 'file.uploaded', actorUserId: userId },
    });
  });
}

export async function createVersion(
  organizationId: string,
  userId: string,
  documentId: string,
  input: { label?: string; bump?: VersionBump; changeNotes?: string | null },
): Promise<void> {
  const doc = await loadScopedDocument(organizationId, documentId);
  if (doc.archivedAt) throw new DocumentNotEditableError();

  // Versionado automático: si se indica `bump`, el servidor calcula la etiqueta a
  // partir de la versión actual; si no, se usa la etiqueta explícita (compatible).
  const label = input.bump
    ? nextVersionLabel(await latestVersionLabel(organizationId, documentId), input.bump)
    : input.label?.trim();
  if (!label) throw new DocumentValidationError(['La etiqueta de versión es obligatoria.']);
  if (input.bump && !input.changeNotes?.trim())
    throw new DocumentValidationError(['El motivo del cambio es obligatorio.']);

  // Clon JSON-safe (E4): no comparte referencia mutable con la versión fuente.
  const clone = (v: Prisma.JsonValue | null | undefined) =>
    v == null ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue);

  await saneCreate(() =>
    withOrgContext(organizationId, async (tx) => {
      // Versión FUENTE (la vigente) cuyo contenido se hereda a la nueva (E3/E4/E5).
      const source = await tx.documentVersion.findFirst({
        where: { documentId, organizationId, isCurrent: true },
      });
      // Desmarca la vigente antes de crear la nueva (respeta el único parcial).
      await tx.documentVersion.updateMany({
        where: { documentId, organizationId, isCurrent: true },
        data: { isCurrent: false },
      });
      await tx.documentVersion.create({
        data: {
          organizationId,
          documentId,
          label,
          changeNotes: input.changeNotes?.trim() || null,
          status: 'draft',
          isCurrent: true,
          author: userId,
          // Hereda el CONTENIDO de la versión fuente para no abrir vacío (E1/E5/E6):
          // `structured_content` es la fuente de verdad; el modo (estructurado vs.
          // libre) se preserva copiando ambos. `activityId` se conserva verbatim (E8).
          templateKey: source?.templateKey ?? undefined,
          contentSchemaVersion: source?.contentSchemaVersion ?? 1,
          structuredContent: clone(source?.structuredContent),
          contentJson: clone(source?.contentJson),
          pageConfig: clone(source?.pageConfig),
          contentHtml: source?.contentHtml ?? undefined,
          contentChecksum: source?.contentChecksum ?? undefined,
        },
      });
      await tx.document.update({
        where: { id: documentId },
        data: { currentVersionLabel: label },
      });
      await tx.documentHistory.create({
        data: { organizationId, documentId, action: 'version.created', actorUserId: userId },
      });
    }),
  );
}

export async function archiveDocument(
  organizationId: string,
  userId: string,
  documentId: string,
  reason?: string | null,
): Promise<void> {
  const doc = await loadScopedDocument(organizationId, documentId);
  if (doc.archivedAt) return;
  await withOrgContext(organizationId, async (tx) => {
    await tx.document.update({
      where: { id: documentId },
      data: { status: 'archived', archivedAt: new Date() },
    });
    await tx.documentHistory.create({
      data: {
        organizationId,
        documentId,
        action: 'document.archived',
        actorUserId: userId,
        metadata: reason?.trim() ? { reason: reason.trim() } : Prisma.JsonNull,
      },
    });
  });
}

/** Crea una relación documental (con FK compuesta anti-cruce). */
export async function linkDocument(
  organizationId: string,
  documentId: string,
  relation: {
    relationType: 'site' | 'framework' | 'requirement' | 'diagnostic' | 'document';
    siteId?: string;
    frameworkId?: string;
    requirementId?: string;
    diagnosticId?: string;
    relatedDocumentId?: string;
  },
): Promise<void> {
  await loadScopedDocument(organizationId, documentId);
  await saneCreate(() =>
    withOrgContext(organizationId, async (tx) => {
      await tx.documentRelation.create({
        data: { organizationId, documentId, ...relation },
      });
    }),
  );
}

// --- TASK-005: editor documental enriquecido ---------------------------------

const asJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

async function loadScopedVersion(organizationId: string, documentId: string, versionId: string) {
  const version = await getPrisma().documentVersion.findFirst({
    where: { id: versionId, documentId, organizationId },
  });
  if (!version) throw new DocumentNotFoundError();
  return version;
}

/** Crea un documento interno editado dentro de Sentinel a partir de una plantilla. */
export async function createEditorDocument(
  organizationId: string,
  userId: string,
  input: { code: string; title: string; documentType: string; templateKey: string },
): Promise<string> {
  const template = getTemplate(input.templateKey);
  const errors = validateDocumentMetadata({
    code: input.code,
    title: input.title,
    documentType: input.documentType,
    versionLabel: 'v1',
    origin: 'internal',
    status: 'draft',
    confidentiality: 'internal',
  });
  if (!template) errors.push('Plantilla inválida.');
  if (errors.length) throw new DocumentValidationError(errors);

  const content = sanitizeContent(template!.build());
  const html = renderContentHtml(content);
  const pageConfig = sanitizePageConfig({
    ...DEFAULT_PAGE_CONFIG,
    cover: { enabled: template!.cover },
  });

  return saneCreate(() =>
    withOrgContext(organizationId, async (tx) => {
      const document = await tx.document.create({
        data: {
          organizationId,
          code: input.code.trim(),
          title: input.title.trim(),
          documentType: input.documentType,
          origin: 'internal',
          status: 'draft',
          confidentiality: 'internal',
          currentVersionLabel: 'v1',
          createdBy: userId,
          responsibleUserId: userId,
        },
      });
      await tx.documentVersion.create({
        data: {
          organizationId,
          documentId: document.id,
          label: 'v1',
          status: 'draft',
          isCurrent: true,
          author: userId,
          updatedBy: userId,
          templateKey: template!.key,
          contentSchemaVersion: CONTENT_SCHEMA_VERSION,
          contentJson: asJson(content),
          contentHtml: html,
          contentChecksum: contentChecksum(content),
          pageConfig: asJson(pageConfig),
        },
      });
      await tx.documentHistory.create({
        data: {
          organizationId,
          documentId: document.id,
          action: 'document.created',
          actorUserId: userId,
        },
      });
      return document.id;
    }),
  );
}

export async function getEditorContent(
  organizationId: string,
  documentId: string,
  versionId?: string,
) {
  const doc = await loadScopedDocument(organizationId, documentId);
  const prisma = getPrisma();
  const version = versionId
    ? await loadScopedVersion(organizationId, documentId, versionId)
    : ((await prisma.documentVersion.findFirst({
        where: { documentId, organizationId, isCurrent: true },
      })) ??
      (await prisma.documentVersion.findFirst({
        where: { documentId, organizationId },
        orderBy: { createdAt: 'desc' },
      })));
  if (!version) throw new DocumentNotFoundError();

  const versions = await prisma.documentVersion.findMany({
    where: { documentId, organizationId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, label: true, status: true, isCurrent: true },
  });
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { name: true },
  });
  const editorName = version.updatedBy
    ? ((await userNames([version.updatedBy])).get(version.updatedBy) ?? null)
    : null;

  return {
    documentId: doc.id,
    documentCode: doc.code,
    documentTitle: doc.title,
    documentStatus: doc.status,
    organizationName: org.name,
    siteId: doc.siteId,
    versionId: version.id,
    label: version.label,
    versionStatus: version.status,
    isCurrent: version.isCurrent,
    // Solo la versión VIGENTE en borrador es editable; las anteriores son de solo lectura.
    editable:
      !doc.archivedAt && isEditableStatus(version.status as VersionStatus) && version.isCurrent,
    templateKey: version.templateKey,
    schemaVersion: version.contentSchemaVersion,
    contentChecksum: version.contentChecksum,
    contentJson: (version.contentJson ?? sanitizeContent(null)) as unknown as DocNode,
    contentHtml: version.contentHtml,
    pageConfig: (version.pageConfig ?? DEFAULT_PAGE_CONFIG) as unknown as PageConfig,
    updatedAt: version.updatedAt,
    updatedByName: editorName,
    versions,
  };
}

/** Guarda el contenido de una versión BORRADOR (sanea, valida tamaño, checksum). */
export async function saveContent(
  organizationId: string,
  userId: string,
  documentId: string,
  versionId: string,
  payload: { contentJson: unknown; pageConfig?: unknown },
  recordHistory = false,
): Promise<{ checksum: string; savedAt: string }> {
  const doc = await loadScopedDocument(organizationId, documentId);
  if (doc.archivedAt) throw new DocumentNotEditableError();
  const version = await loadScopedVersion(organizationId, documentId, versionId);
  if (!isEditableStatus(version.status as VersionStatus) || !version.isCurrent)
    throw new DocumentNotEditableError();

  const content = sanitizeContent(payload.contentJson);
  if (contentByteSize(content) > maxContentBytes()) throw new ContentTooLargeError();
  const pageConfig = sanitizePageConfig(
    payload.pageConfig ?? version.pageConfig ?? DEFAULT_PAGE_CONFIG,
  );
  const html = renderContentHtml(content);
  const checksum = contentChecksum(content);

  await withOrgContext(organizationId, async (tx) => {
    await tx.documentVersion.update({
      where: { id: versionId },
      data: {
        contentJson: asJson(content),
        contentHtml: html,
        contentChecksum: checksum,
        pageConfig: asJson(pageConfig),
        contentSchemaVersion: CONTENT_SCHEMA_VERSION,
        updatedBy: userId,
      },
    });
    if (recordHistory) {
      await tx.documentHistory.create({
        data: { organizationId, documentId, action: 'content.updated', actorUserId: userId },
      });
    }
  });
  return { checksum, savedAt: new Date().toISOString() };
}

/** Crea una nueva versión BORRADOR copiando el contenido de la vigente. */
export async function createEditorVersion(
  organizationId: string,
  userId: string,
  documentId: string,
  input: { label?: string; bump?: VersionBump; changeNotes?: string | null },
): Promise<string> {
  const doc = await loadScopedDocument(organizationId, documentId);
  if (doc.archivedAt) throw new DocumentNotEditableError();

  const prisma = getPrisma();
  const current =
    (await prisma.documentVersion.findFirst({
      where: { documentId, organizationId, isCurrent: true },
    })) ??
    (await prisma.documentVersion.findFirst({
      where: { documentId, organizationId },
      orderBy: { createdAt: 'desc' },
    }));

  const label = input.bump
    ? nextVersionLabel(current?.label ?? null, input.bump)
    : input.label?.trim();
  if (!label) throw new DocumentValidationError(['La etiqueta de versión es obligatoria.']);
  if (input.bump && !input.changeNotes?.trim())
    throw new DocumentValidationError(['El motivo del cambio es obligatorio.']);

  return saneCreate(() =>
    withOrgContext(organizationId, async (tx) => {
      await tx.documentVersion.updateMany({
        where: { documentId, organizationId, isCurrent: true },
        data: { isCurrent: false },
      });
      const created = await tx.documentVersion.create({
        data: {
          organizationId,
          documentId,
          label,
          changeNotes: input.changeNotes?.trim() || null,
          status: 'draft',
          isCurrent: true,
          author: userId,
          updatedBy: userId,
          templateKey: current?.templateKey ?? null,
          contentSchemaVersion: current?.contentSchemaVersion ?? CONTENT_SCHEMA_VERSION,
          contentJson: current?.contentJson ? asJson(current.contentJson) : Prisma.JsonNull,
          contentHtml: current?.contentHtml ?? null,
          contentChecksum: current?.contentChecksum ?? null,
          pageConfig: current?.pageConfig ? asJson(current.pageConfig) : Prisma.JsonNull,
          // DOC-001: arrastra el contenido estructurado a la nueva versión borrador.
          structuredContent: current?.structuredContent
            ? asJson(current.structuredContent)
            : Prisma.JsonNull,
        },
      });
      await tx.document.update({
        where: { id: documentId },
        data: { currentVersionLabel: label },
      });
      // DOC-002 (§24): copia las relaciones ACTIVAS de la versión anterior a la
      // nueva (source_version_id = nueva versión). La versión anterior conserva su
      // snapshot relacional histórico intacto.
      if (current) {
        const rels = await tx.documentRelation.findMany({
          where: {
            organizationId,
            documentId,
            sourceVersionId: current.id,
            active: true,
            relationType: { in: [...REF_RELATION_TYPES] },
          },
        });
        for (const r of rels) {
          await tx.documentRelation.create({
            data: {
              organizationId,
              documentId,
              relationType: r.relationType,
              relatedDocumentId: r.relatedDocumentId,
              sourceVersionId: created.id,
              targetVersionId: r.targetVersionId,
              label: r.label,
              active: true,
              createdBy: userId,
            },
          });
        }
      }
      await tx.documentHistory.create({
        data: { organizationId, documentId, action: 'version.created', actorUserId: userId },
      });
      return created.id;
    }),
  );
}

/** Sube una imagen (PNG/JPG) a una versión borrador y devuelve su URL protegida. */
export async function addDocumentImage(
  organizationId: string,
  userId: string,
  documentId: string,
  versionId: string,
  file: { originalName: string; mimeType: string; data: Buffer },
): Promise<{ fileId: string; url: string }> {
  const doc = await loadScopedDocument(organizationId, documentId);
  if (doc.archivedAt) throw new DocumentNotEditableError();
  const version = await loadScopedVersion(organizationId, documentId, versionId);
  if (!isEditableStatus(version.status as VersionStatus) || !version.isCurrent)
    throw new DocumentNotEditableError();

  const ext = extensionOf(file.originalName);
  if (!['png', 'jpg', 'jpeg'].includes(ext) || !file.mimeType.startsWith('image/')) {
    throw new UnsupportedImageError();
  }
  const saved = await saveDocumentFile({ organizationId, ...file });
  const created = await withOrgContext(organizationId, (tx) =>
    tx.documentFile.create({
      data: {
        organizationId,
        documentVersionId: versionId,
        kind: 'image',
        originalName: saved.originalName,
        storedName: saved.storedName,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        extension: saved.extension,
        storageKey: saved.storageKey,
        checksum: saved.checksum,
        uploadedBy: userId,
      },
    }),
  );
  return { fileId: created.id, url: `/dashboard/documents/${documentId}/files/${created.id}` };
}

// --- DOC-001: documentos ESTRUCTURADOS por tipo ------------------------------

type Tx = Prisma.TransactionClient;

/** Áreas cortas configuradas (catálogo de calidad, `kind='area'`). Reutilización §6. */
export async function listDocumentAreas(
  organizationId: string,
): Promise<{ code: string | null; name: string }[]> {
  const rows = await getPrisma().qualityCatalogValue.findMany({
    where: { organizationId, kind: 'area', active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { code: true, name: true },
  });
  return rows;
}

/** Consecutivo atómico por organización + prefijo de tipo + área (§5). */
async function reserveDocumentCodeSeq(
  tx: Tx,
  organizationId: string,
  codePrefix: string,
  areaCode: string,
): Promise<number> {
  const rows = await tx.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO document_code_counters ("organization_id", "code_prefix", "area_code", "last_seq")
    VALUES (${organizationId}::uuid, ${codePrefix}, ${areaCode}, 1)
    ON CONFLICT ("organization_id", "code_prefix", "area_code")
    DO UPDATE SET "last_seq" = document_code_counters."last_seq" + 1
    RETURNING "last_seq"`;
  return rows[0]?.last_seq ?? 1;
}

/**
 * Propone (sin reservar) el siguiente código para un tipo + área. Es una vista
 * previa no autoritativa: la reserva definitiva ocurre al crear el documento.
 */
export async function proposeDocumentCode(
  organizationId: string,
  documentType: string,
  areaCode: string | null | undefined,
): Promise<string> {
  const prefix = codePrefixFor(documentType);
  const area = normalizeAreaCode(areaCode);
  return withOrgContext(organizationId, async (tx) => {
    const rows = await tx.$queryRaw<{ last_seq: number }[]>`
      SELECT "last_seq" FROM document_code_counters
      WHERE "organization_id" = ${organizationId}::uuid
        AND "code_prefix" = ${prefix}
        AND "area_code" = ${area}`;
    const next = (rows[0]?.last_seq ?? 0) + 1;
    return formatDocumentCode(prefix, area, next);
  });
}

function buildRenderIdentity(
  doc: {
    documentType: string;
    code: string;
    title: string;
    ownerArea: string | null;
    issuedAt: Date | null;
    nextReviewAt: Date | null;
  },
  versionLabel: string,
  organizationName: string,
  organizationLogoUrl: string | null = null,
): RenderIdentity {
  return {
    organizationName,
    organizationLogoUrl,
    typeLabel: labelOf(DOCUMENT_TYPES, doc.documentType),
    code: doc.code,
    versionLabel,
    title: doc.title,
    areaLabel: doc.ownerArea,
    issuedAt: isoDate(doc.issuedAt),
    nextReviewAt: isoDate(doc.nextReviewAt),
  };
}

/** Fuente del logo de la organización para el render (PLATFORM-002B §3/§7). */
async function organizationLogoSource(organizationId: string): Promise<string | null> {
  const profile = await getPrisma().organizationProfile.findUnique({
    where: { organizationId },
    select: { logoFileId: true, logoUrl: true },
  });
  if (!profile) return null;
  if (profile.logoFileId) return `/api/files/${profile.logoFileId}`;
  return profile.logoUrl || null;
}

// --- DOC-002: referencias inteligentes y sincronización de relaciones --------

type PrismaLike = Pick<Prisma.TransactionClient, 'document'> | ReturnType<typeof getPrisma>;

/**
 * Resuelve los documentos destino por id (nunca por código) a sus datos ACTUALES
 * (§13). Fuera del alcance/permisos → `available: false` (no se exponen datos).
 */
async function resolveReferences(
  client: PrismaLike,
  organizationId: string,
  ids: string[],
): Promise<ReferenceResolver> {
  const unique = [...new Set(ids)];
  const map: ReferenceResolver = {};
  for (const id of unique) map[id] = { documentId: id, code: '', title: '', available: false };
  if (unique.length === 0) return map;
  const docs = await client.document.findMany({
    where: { id: { in: unique }, organizationId },
    select: {
      id: true,
      code: true,
      title: true,
      documentType: true,
      status: true,
      currentVersionLabel: true,
      archivedAt: true,
    },
  });
  for (const d of docs) {
    map[d.id] = {
      documentId: d.id,
      code: d.code,
      title: d.title,
      typeLabel: labelOf(DOCUMENT_TYPES, d.documentType),
      versionLabel: d.currentVersionLabel,
      statusLabel: labelOf(DOCUMENT_STATUSES, d.status),
      obsolete: d.status === 'obsolete' || Boolean(d.archivedAt),
      available: true,
    };
  }
  return map;
}

/**
 * Sincroniza (§26) las relaciones derivadas del CONTENIDO de una versión con las
 * persistidas: crea las nuevas, reactiva las que vuelven y da de BAJA LÓGICA
 * (`active=false`, respeta el trigger de no-borrado) las que se retiraron. Solo
 * toca relaciones `reference`/`issued_form` de esa versión origen; no afecta a
 * versiones anteriores ni a otros tipos. Debe ejecutarse dentro de una versión
 * editable (el trigger de BD bloquea versiones publicadas).
 */
async function syncVersionRelations(
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
  documentId: string,
  versionId: string,
  content: StructuredContent,
  validTargetIds: Set<string>,
): Promise<void> {
  // Solo se persisten relaciones a destinos EXISTENTES del mismo tenant. Una
  // referencia colgante (destino borrado/sin permisos/otra organización) se
  // conserva en el contenido (se muestra "no disponible") pero no crea fila.
  const desired = extractReferences(content).filter((d) => validTargetIds.has(d.targetDocumentId));
  const desiredKeys = new Set(desired.map((d) => refKey(d.relationType, d.targetDocumentId)));
  const existing = await tx.documentRelation.findMany({
    where: {
      organizationId,
      documentId,
      sourceVersionId: versionId,
      relationType: { in: [...REF_RELATION_TYPES] },
    },
  });
  const byKey = new Map(
    existing.map((r) => [
      refKey(r.relationType as (typeof REF_RELATION_TYPES)[number], r.relatedDocumentId ?? ''),
      r,
    ]),
  );

  for (const r of existing) {
    const key = refKey(
      r.relationType as (typeof REF_RELATION_TYPES)[number],
      r.relatedDocumentId ?? '',
    );
    if (r.active && !desiredKeys.has(key)) {
      await tx.documentRelation.update({ where: { id: r.id }, data: { active: false } });
    }
  }
  for (const d of desired) {
    const key = refKey(d.relationType, d.targetDocumentId);
    const r = byKey.get(key);
    if (!r) {
      await tx.documentRelation.create({
        data: {
          organizationId,
          documentId,
          relationType: d.relationType,
          relatedDocumentId: d.targetDocumentId,
          sourceVersionId: versionId,
          active: true,
          createdBy: userId,
        },
      });
    } else if (!r.active) {
      await tx.documentRelation.update({ where: { id: r.id }, data: { active: true } });
    }
  }
}

/** Referencias resueltas de un contenido (para el editor: chips con datos actuales). */
async function resolvedReferencesOf(organizationId: string, content: StructuredContent) {
  const refs = extractReferences(content);
  const resolved = await resolveReferences(
    getPrisma(),
    organizationId,
    refs.map((r) => r.targetDocumentId),
  );
  return { refs, resolved };
}

export interface CreateStructuredDocumentInput {
  documentType: string;
  title: string;
  /** Código personalizado; si `codeIsCustom` es false o vacío, se genera. */
  code?: string | null;
  codeIsCustom?: boolean;
  /** Código corto de área para el código automático y `ownerArea`. */
  areaCode?: string | null;
  /** Nombre de área a mostrar (prevalece en `ownerArea`). */
  areaName?: string | null;
  siteId?: string | null;
  responsibleUserId?: string | null;
  /** Emisión opcional (ISO). Por defecto se fija al publicar (§8). */
  issuedAt?: string | null;
  /** Periodo de revisión (`'6'|'12'|'24'|'none'` o meses). */
  reviewPeriod?: string | null;
  /** Contenido estructurado inicial (opcional; puede completarse luego). */
  structuredContent?: unknown;
}

/**
 * Crea un documento nativo ESTRUCTURADO (borrador v1.0) con código automático y
 * fechas por defecto. El contenido estructurado es la fuente de verdad; el HTML
 * se deriva del renderer normalizado.
 */
export async function createStructuredDocument(
  organizationId: string,
  userId: string,
  input: CreateStructuredDocumentInput,
): Promise<string> {
  const def = getTemplateDefinition(input.documentType);
  const errors: string[] = [];
  if (!def || !def.supportsStructuredEditor) {
    errors.push('El tipo documental estructurado es inválido.');
  }
  if (!input.title?.trim()) errors.push('El nombre del documento es obligatorio.');
  const useCustom = Boolean(input.codeIsCustom && input.code?.trim());
  if (useCustom) {
    const codeError = codeFormatError(input.code);
    if (codeError) errors.push(codeError);
  }
  if (errors.length) throw new DocumentValidationError(errors);

  const documentType = input.documentType;
  const prefix = def!.codePrefix;
  const areaCode = normalizeAreaCode(input.areaCode);
  const ownerArea = input.areaName?.trim() || (areaCode ? areaCode : null);
  const months = input.reviewPeriod
    ? reviewMonthsOf(input.reviewPeriod, def!.defaultReviewMonths)
    : def!.defaultReviewMonths;
  const issuedAt = input.issuedAt?.trim() || null;
  const nextReviewAt = computeNextReviewAt(issuedAt, months);

  const content = sanitizeStructuredContent(documentType, input.structuredContent);
  // DOC-003: acuña activityId estable para las actividades del Programa (§3/§15).
  if (content.program) content.program = ensureActivityIds(content.program, () => randomUUID());
  if (structuredByteSize(content) > maxContentBytes()) throw new ContentTooLargeError();

  return saneCreate(() =>
    withOrgContext(organizationId, async (tx) => {
      const code = useCustom
        ? input.code!.trim()
        : formatDocumentCode(
            prefix,
            areaCode,
            await reserveDocumentCodeSeq(tx, organizationId, prefix, areaCode),
          );

      const org = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { name: true },
      });
      const identity = buildRenderIdentity(
        {
          documentType,
          code,
          title: input.title.trim(),
          ownerArea,
          issuedAt: parseDate(issuedAt),
          nextReviewAt: parseDate(nextReviewAt),
        },
        INITIAL_VERSION_LABEL,
        org.name,
      );
      // DOC-002: resuelve referencias del contenido inicial (normalmente ninguna).
      const resolved = await resolveReferences(
        tx,
        organizationId,
        extractReferences(content).map((r) => r.targetDocumentId),
      );
      const html = renderStructuredHtml(documentType, content, identity, { resolved });

      const document = await tx.document.create({
        data: {
          organizationId,
          code,
          title: input.title.trim(),
          documentType,
          origin: 'internal',
          status: 'draft',
          confidentiality: 'internal',
          currentVersionLabel: INITIAL_VERSION_LABEL,
          siteId: input.siteId || null,
          responsibleUserId: input.responsibleUserId || userId,
          ownerArea,
          issuedAt: parseDate(issuedAt),
          nextReviewAt: parseDate(nextReviewAt),
          createdBy: userId,
        },
      });
      const version = await tx.documentVersion.create({
        data: {
          organizationId,
          documentId: document.id,
          label: INITIAL_VERSION_LABEL,
          status: 'draft',
          isCurrent: true,
          author: userId,
          updatedBy: userId,
          templateKey: documentType,
          contentSchemaVersion: STRUCTURED_SCHEMA_VERSION,
          structuredContent: asJson(content),
          contentHtml: html,
          contentChecksum: structuredChecksum(content),
        },
      });
      await tx.documentHistory.create({
        data: {
          organizationId,
          documentId: document.id,
          action: 'document.created',
          actorUserId: userId,
        },
      });
      const valid = new Set(
        Object.values(resolved)
          .filter((r) => r.available)
          .map((r) => r.documentId),
      );
      await syncVersionRelations(
        tx,
        organizationId,
        userId,
        document.id,
        version.id,
        content,
        valid,
      );
      return document.id;
    }),
  );
}

/** Presentación documental completa de la organización (tema + diseño + atribución). */
export interface DocumentPresentation {
  theme: DocumentTheme;
  designId: string;
  /** Preferencia guardada (no la efectiva; la efectiva depende del entitlement). */
  showC3AttributionPref: boolean;
  dateFormat: DateFormat;
}

/** Tema + diseño + preferencia de atribución + formato de fecha (o defaults). */
export async function getDocumentPresentation(
  organizationId: string,
): Promise<DocumentPresentation> {
  const row = await getPrisma().documentTheme.findUnique({
    where: { organizationId },
    select: {
      primaryColor: true,
      secondaryColor: true,
      accentColor: true,
      textColor: true,
      headingColor: true,
      designId: true,
      showC3Attribution: true,
      dateFormat: true,
    },
  });
  if (!row) {
    return {
      theme: DEFAULT_DOCUMENT_THEME,
      designId: DEFAULT_DESIGN_ID,
      showC3AttributionPref: true,
      dateFormat: DEFAULT_DATE_FORMAT,
    };
  }
  return {
    theme: sanitizeDocumentTheme({
      primary: row.primaryColor,
      secondary: row.secondaryColor,
      accent: row.accentColor,
      text: row.textColor,
      heading: row.headingColor,
    }),
    designId: sanitizeDesignId(row.designId),
    showC3AttributionPref: row.showC3Attribution,
    dateFormat: sanitizeDateFormat(row.dateFormat),
  };
}

/** Tema documental de la organización (o el default de C3 Sentinel). */
export async function getDocumentTheme(organizationId: string): Promise<DocumentTheme> {
  return (await getDocumentPresentation(organizationId)).theme;
}

/** Suscripción comercial de la organización (provisional; o `null` si no definida). */
export async function getOrganizationSubscription(
  organizationId: string,
): Promise<SubscriptionDescriptor | null> {
  const row = await getPrisma().organizationSubscription.findUnique({
    where: { organizationId },
    select: { plan: true, billingCadence: true },
  });
  if (!row) return null;
  if (!isSubscriptionPlan(row.plan) || !isBillingCadence(row.billingCadence)) return null;
  return { plan: row.plan, cadence: row.billingCadence };
}

/** Entitlements comerciales efectivos de la organización (DOC-UX-002 §84/§110). */
export async function getOrganizationEntitlements(
  organizationId: string,
): Promise<SubscriptionEntitlements> {
  const sub = await getOrganizationSubscription(organizationId);
  return computeEntitlements(sub);
}

/** Atribución C3 EFECTIVA (preferencia + guard de entitlement en servidor). */
export async function resolveShowC3AttributionForOrg(organizationId: string): Promise<boolean> {
  const [presentation, entitlements] = await Promise.all([
    getDocumentPresentation(organizationId),
    getOrganizationEntitlements(organizationId),
  ]);
  return resolveShowC3Attribution(presentation.showC3AttributionPref, entitlements);
}

/**
 * Guarda la presentación documental (tema HEX validado + diseño + atribución).
 * owner/admin no requerido: config org. La atribución solo puede ocultarse si el
 * entitlement lo permite (guard server-side §84/§110).
 */
export async function setDocumentTheme(
  organizationId: string,
  userId: string,
  input: unknown,
): Promise<DocumentPresentation> {
  const errors = validateDocumentTheme(input);
  if (errors.length) throw new DocumentValidationError(errors);
  const theme = sanitizeDocumentTheme(input);
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const designId = sanitizeDesignId(raw.designId);
  const dateFormat = sanitizeDateFormat(raw.dateFormat);

  // Guard de entitlement: si la org no puede ocultar la atribución, la preferencia
  // se fuerza a true independientemente de lo que envíe el cliente.
  const entitlements = await getOrganizationEntitlements(organizationId);
  const requestedShow = raw.showC3Attribution === undefined ? true : Boolean(raw.showC3Attribution);
  const showC3Attribution = entitlements.canHideC3Attribution ? requestedShow : true;

  await withOrgContext(organizationId, async (tx) => {
    await tx.documentTheme.upsert({
      where: { organizationId },
      update: {
        primaryColor: theme.primary,
        secondaryColor: theme.secondary,
        accentColor: theme.accent,
        textColor: theme.text,
        headingColor: theme.heading,
        designId,
        showC3Attribution,
        dateFormat,
        updatedBy: userId,
      },
      create: {
        organizationId,
        primaryColor: theme.primary,
        secondaryColor: theme.secondary,
        accentColor: theme.accent,
        textColor: theme.text,
        headingColor: theme.heading,
        designId,
        showC3Attribution,
        dateFormat,
        updatedBy: userId,
      },
    });
  });
  return { theme, designId, showC3AttributionPref: showC3Attribution, dateFormat };
}

// --- Copias controladas de salida (impresión / PDF) — DOC-UX-002 §67-82 ---------

const REASON_MAX = 300;

export interface ControlledCopyInput {
  documentId: string;
  versionId: string;
  copyType: 'print' | 'pdf';
  destinationAreaCode?: string | null;
  reason?: string | null;
}

export interface ControlledCopyResult {
  id: string;
  folio: string;
  copyType: 'print' | 'pdf';
  versionLabel: string;
  destinationLabel: string | null;
  reason: string | null;
}

/** Consecutivo atómico de folio de copia por (organización, documento). */
async function reserveCopyFolioSeq(
  tx: Tx,
  organizationId: string,
  documentId: string,
): Promise<number> {
  const rows = await tx.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO document_copy_counters ("organization_id", "document_id", "last_seq")
    VALUES (${organizationId}::uuid, ${documentId}::uuid, 1)
    ON CONFLICT ("organization_id", "document_id")
    DO UPDATE SET "last_seq" = document_copy_counters."last_seq" + 1
    RETURNING "last_seq"`;
  return rows[0]?.last_seq ?? 1;
}

/**
 * Genera una COPIA CONTROLADA de salida (impresión o PDF) de una versión
 * PUBLICADA (§80): reserva folio, valida destino/motivo y registra el evento con
 * trazabilidad. No se registra para borradores/obsoletos (esos van marcados como
 * NO CONTROLADOS sin folio, §81/§82). Estado `active`: registramos la GENERACIÓN,
 * no la impresión física (§78).
 */
export async function createControlledCopyOutput(
  organizationId: string,
  userId: string,
  input: ControlledCopyInput,
): Promise<ControlledCopyResult> {
  const doc = await loadScopedDocument(organizationId, input.documentId);
  const version = await loadScopedVersion(organizationId, input.documentId, input.versionId);
  if (version.status !== 'published') {
    throw new DocumentValidationError([
      'Solo las versiones publicadas generan copias controladas formales.',
    ]);
  }

  let destinationLabel: string | null = null;
  let destinationAreaCode: string | null = null;
  let reason: string | null = null;

  if (input.copyType === 'print') {
    const code = (input.destinationAreaCode ?? '').trim();
    if (!code) {
      throw new DocumentValidationError(['Indica el área a la que se entrega la copia.']);
    }
    const area = await getAreaByCode(organizationId, code);
    if (!area) {
      throw new DocumentValidationError(['El área destino no es válida para esta organización.']);
    }
    destinationAreaCode = area.code;
    destinationLabel = area.name;
  } else {
    const r = (input.reason ?? '').trim();
    if (!r) {
      throw new DocumentValidationError(['Indica el motivo de la descarga.']);
    }
    reason = r.slice(0, REASON_MAX);
    destinationLabel = null;
  }

  const recipient = input.copyType === 'print' ? (destinationLabel ?? 'Área') : 'Descarga PDF';
  const format = input.copyType === 'print' ? 'printed' : 'digital';

  const created = await saneCreate(() =>
    withOrgContext(organizationId, async (tx) => {
      const seq = await reserveCopyFolioSeq(tx, organizationId, input.documentId);
      const folio = `CC-${doc.code}-${String(seq).padStart(4, '0')}`;
      return tx.documentControlledCopy.create({
        data: {
          organizationId,
          documentId: input.documentId,
          versionId: input.versionId,
          copyNumber: seq,
          recipient,
          format,
          issuedBy: userId,
          status: 'active',
          copyType: input.copyType,
          folio,
          destinationAreaCode,
          reason,
        },
        select: { id: true, folio: true },
      });
    }),
  );

  return {
    id: created.id,
    folio: created.folio ?? '',
    copyType: input.copyType,
    versionLabel: version.label,
    destinationLabel,
    reason,
  };
}

export interface ControlledCopyHistoryRow {
  id: string;
  folio: string;
  copyType: string;
  versionLabel: string;
  destinationLabel: string | null;
  reason: string | null;
  issuedByName: string | null;
  issuedAt: string | null;
}

/** Historial de copias controladas de SALIDA de un documento (para el panel §79). */
export async function getControlledCopyHistory(
  organizationId: string,
  documentId: string,
): Promise<ControlledCopyHistoryRow[]> {
  const prisma = getPrisma();
  const copies = await prisma.documentControlledCopy.findMany({
    where: { organizationId, documentId, copyType: { not: null } },
    orderBy: { issuedAt: 'desc' },
    select: {
      id: true,
      folio: true,
      copyType: true,
      versionId: true,
      destinationAreaCode: true,
      reason: true,
      issuedBy: true,
      issuedAt: true,
    },
  });
  if (copies.length === 0) return [];

  const [versions, names, areas, presentation] = await Promise.all([
    prisma.documentVersion.findMany({
      where: { documentId, organizationId },
      select: { id: true, label: true },
    }),
    userNames(copies.map((c) => c.issuedBy)),
    listDocumentAreas(organizationId),
    getDocumentPresentation(organizationId),
  ]);
  const versionLabel = new Map(versions.map((v) => [v.id, v.label]));
  const areaName = new Map(areas.map((a) => [(a.code ?? '').toUpperCase(), a.name]));

  return copies.map((c) => ({
    id: c.id,
    folio: c.folio ?? '',
    copyType: c.copyType ?? '',
    versionLabel: versionLabel.get(c.versionId) ?? '—',
    destinationLabel: c.destinationAreaCode
      ? (areaName.get(c.destinationAreaCode.toUpperCase()) ?? c.destinationAreaCode)
      : null,
    reason: c.reason,
    issuedByName: c.issuedBy ? (names.get(c.issuedBy) ?? null) : null,
    issuedAt: formatIsoDate(isoDate(c.issuedAt), presentation.dateFormat),
  }));
}

/** Resuelve una copia controlada por id → versión + marca de copia para render. */
export async function getControlledCopyForRender(
  organizationId: string,
  copyId: string,
): Promise<{ documentId: string; versionId: string; copyMark: CopyMark } | null> {
  const copy = await getPrisma().documentControlledCopy.findFirst({
    where: { id: copyId, organizationId, copyType: { not: null } },
    select: {
      documentId: true,
      versionId: true,
      copyType: true,
      folio: true,
      destinationAreaCode: true,
      reason: true,
      issuedBy: true,
      issuedAt: true,
    },
  });
  if (!copy) return null;
  const [names, areas] = await Promise.all([
    userNames([copy.issuedBy]),
    listDocumentAreas(organizationId),
  ]);
  const areaName = new Map(areas.map((a) => [(a.code ?? '').toUpperCase(), a.name]));
  const copyMark: CopyMark = {
    kind: 'controlled',
    folio: copy.folio,
    destinationLabel: copy.destinationAreaCode
      ? (areaName.get(copy.destinationAreaCode.toUpperCase()) ?? copy.destinationAreaCode)
      : null,
    reason: copy.reason,
    issuedByName: copy.issuedBy ? (names.get(copy.issuedBy) ?? null) : null,
    issuedAt: isoDate(copy.issuedAt),
  };
  return { documentId: copy.documentId, versionId: copy.versionId, copyMark };
}

/**
 * Renderiza una versión en modo `controlled_copy` (con watermark + bloque de
 * copia) para la salida (impresión/PDF). Reutiliza tema/diseño/atribución de la
 * organización. No altera el documento almacenado (§73).
 */
export async function renderDocumentControlledCopy(
  organizationId: string,
  documentId: string,
  versionId: string,
  copyMark: CopyMark,
): Promise<{ html: string; documentCode: string; documentTitle: string; versionLabel: string }> {
  const doc = await loadScopedDocument(organizationId, documentId);
  const version = await loadScopedVersion(organizationId, documentId, versionId);
  const org = await getPrisma().organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { name: true },
  });
  const content = sanitizeStructuredContent(doc.documentType, version.structuredContent);
  const { resolved } = await resolvedReferencesOf(organizationId, content);
  const presentation = await getDocumentPresentation(organizationId);
  const showC3Attribution = await resolveShowC3AttributionForOrg(organizationId);
  const logoSource = await organizationLogoSource(organizationId);
  const identity = formatIdentityDates(
    buildRenderIdentity(doc, version.label, org.name, logoSource),
    presentation.dateFormat,
  );
  const changeLog = await buildChangeLog(
    organizationId,
    documentId,
    version.createdAt,
    presentation.dateFormat,
  );
  const html = renderStructuredHtml(doc.documentType, content, identity, {
    resolved,
    theme: presentation.theme,
    design: presentation.designId,
    showC3Attribution,
    changeLog,
    mode: 'controlled_copy',
    copyMark: { ...copyMark, issuedAt: formatIsoDate(copyMark.issuedAt, presentation.dateFormat) },
  });
  return { html, documentCode: doc.code, documentTitle: doc.title, versionLabel: version.label };
}

/** Aplica el formato de fecha de la organización a las fechas del encabezado. */
function formatIdentityDates(identity: RenderIdentity, fmt: DateFormat): RenderIdentity {
  return {
    ...identity,
    issuedAt: formatIsoDate(identity.issuedAt, fmt),
    nextReviewAt: formatIsoDate(identity.nextReviewAt, fmt),
  };
}

/**
 * Construye el Control de cambios (§40-48) desde el versionado: una fila por
 * versión hasta la versión vista (corte histórico §48), en orden ascendente.
 */
async function buildChangeLog(
  organizationId: string,
  documentId: string,
  uptoCreatedAt: Date,
  dateFormat: DateFormat = DEFAULT_DATE_FORMAT,
): Promise<ChangeLogRow[]> {
  const versions = await getPrisma().documentVersion.findMany({
    where: { documentId, organizationId, createdAt: { lte: uptoCreatedAt } },
    orderBy: { createdAt: 'asc' },
    select: { label: true, changeNotes: true, createdAt: true, publishedAt: true, author: true },
  });
  const names = await userNames(versions.map((v) => v.author));
  return versions.map((v) => {
    const isInitial = v.label === INITIAL_VERSION_LABEL;
    const change =
      v.changeNotes?.trim() ||
      (isInitial ? 'Documento nuevo' : 'Cambio sin descripción registrada');
    return {
      version: v.label.replace(/^v/i, ''),
      date: formatIsoDate(isoDate(v.publishedAt ?? v.createdAt), dateFormat),
      change,
      author: v.author ? (names.get(v.author) ?? '—') : '—',
    };
  });
}

/** Payload del editor estructurado (contenido + identificación + render). */
export async function getStructuredContent(
  organizationId: string,
  documentId: string,
  versionId?: string,
) {
  const doc = await loadScopedDocument(organizationId, documentId);
  const prisma = getPrisma();
  const version = versionId
    ? await loadScopedVersion(organizationId, documentId, versionId)
    : ((await prisma.documentVersion.findFirst({
        where: { documentId, organizationId, isCurrent: true },
      })) ??
      (await prisma.documentVersion.findFirst({
        where: { documentId, organizationId },
        orderBy: { createdAt: 'desc' },
      })));
  if (!version) throw new DocumentNotFoundError();

  const versions = await prisma.documentVersion.findMany({
    where: { documentId, organizationId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, label: true, status: true, isCurrent: true },
  });
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { name: true },
  });

  const content = sanitizeStructuredContent(doc.documentType, version.structuredContent);
  // DOC-002: resuelve referencias del contenido (datos actuales por id).
  const { refs, resolved } = await resolvedReferencesOf(organizationId, content);
  // DOC-UX-001/002/003: presentación (tema + diseño + atribución + formato de fecha),
  // control de cambios (hasta la versión vista §48) y modo (published/preview §55).
  const presentation = await getDocumentPresentation(organizationId);
  const showC3Attribution = await resolveShowC3AttributionForOrg(organizationId);
  const logoSource = await organizationLogoSource(organizationId);
  const identity = formatIdentityDates(
    buildRenderIdentity(doc, version.label, org.name, logoSource),
    presentation.dateFormat,
  );
  const changeLog = await buildChangeLog(
    organizationId,
    documentId,
    version.createdAt,
    presentation.dateFormat,
  );
  const mode = version.status === 'published' ? 'published_document' : 'editor_preview';
  // DOC-003: en Programas, resuelve el nombre del responsable de cada actividad
  // (el render cae en «Usuario» sin este mapa). Solo para el tipo Programa.
  let users: Record<string, string> | undefined;
  if (content.program) {
    const members = await prisma.membership.findMany({
      where: { organizationId },
      select: { userId: true, user: { select: { displayName: true, email: true } } },
    });
    users = Object.fromEntries(members.map((m) => [m.userId, m.user.displayName ?? m.user.email]));
  }
  const renderedHtml = renderStructuredHtml(doc.documentType, content, identity, {
    resolved,
    theme: presentation.theme,
    design: presentation.designId,
    showC3Attribution,
    changeLog,
    mode,
    users,
  });
  const references = refs.map((r) => ({
    relationType: r.relationType,
    ...(resolved[r.targetDocumentId] ?? {
      documentId: r.targetDocumentId,
      code: '',
      title: '',
      available: false,
    }),
  }));

  return {
    documentId: doc.id,
    documentCode: doc.code,
    documentTitle: doc.title,
    documentType: doc.documentType,
    // DOC-001: 'structured' solo si la versión realmente tiene structured_content.
    contentMode: documentContentMode({
      origin: doc.origin,
      hasStructuredContent: version.structuredContent != null,
    }),
    documentStatus: doc.status,
    organizationName: org.name,
    ownerArea: doc.ownerArea,
    issuedAt: isoDate(doc.issuedAt),
    nextReviewAt: isoDate(doc.nextReviewAt),
    versionId: version.id,
    label: version.label,
    versionStatus: version.status,
    isCurrent: version.isCurrent,
    editable:
      !doc.archivedAt && isEditableStatus(version.status as VersionStatus) && version.isCurrent,
    schemaVersion: version.contentSchemaVersion,
    structuredContent: content,
    renderedHtml,
    references,
    versions,
  };
}

/** Guarda el contenido estructurado de una versión BORRADOR (sanea, deriva HTML). */
export async function saveStructuredContent(
  organizationId: string,
  userId: string,
  documentId: string,
  versionId: string,
  payload: { structuredContent: unknown },
): Promise<{ checksum: string; savedAt: string }> {
  const doc = await loadScopedDocument(organizationId, documentId);
  if (doc.archivedAt) throw new DocumentNotEditableError();
  const version = await loadScopedVersion(organizationId, documentId, versionId);
  if (!isEditableStatus(version.status as VersionStatus) || !version.isCurrent) {
    throw new DocumentNotEditableError();
  }
  // DOC-001: no se convierte implícitamente un documento rich_text/externo en
  // estructurado. Solo se guarda contenido estructurado sobre versiones que ya lo
  // son (creadas por createStructuredDocument o heredado por createEditorVersion).
  if (version.structuredContent == null) {
    throw new DocumentValidationError([
      'Este documento no es estructurado; no admite contenido estructurado.',
    ]);
  }

  const sanitized = sanitizeStructuredContent(doc.documentType, payload.structuredContent);
  // DOC-UX-001 §14: preserva los campos legacy conocidos (evidencia/observaciones)
  // presentes en el contenido PREVIO almacenado, para que un re-guardado desde la
  // UI actual —que ya no los expone— no los borre silenciosamente. La fuente es la
  // BD, no el payload del cliente (el allowlist ya descartó cualquier clave suya).
  const content = preserveLegacyRepeatableFields(
    doc.documentType,
    sanitized,
    version.structuredContent,
  );
  // DOC-003: acuña activityId estable para las actividades del Programa (§3/§15);
  // conserva los ids existentes al reordenar/editar.
  if (content.program) content.program = ensureActivityIds(content.program, () => randomUUID());
  if (structuredByteSize(content) > maxContentBytes()) throw new ContentTooLargeError();

  const org = await getPrisma().organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { name: true },
  });
  const logoSource = await organizationLogoSource(organizationId);
  const identity = buildRenderIdentity(doc, version.label, org.name, logoSource);
  const { resolved } = await resolvedReferencesOf(organizationId, content);
  const html = renderStructuredHtml(doc.documentType, content, identity, { resolved });
  const checksum = structuredChecksum(content);
  const valid = new Set(
    Object.values(resolved)
      .filter((r) => r.available)
      .map((r) => r.documentId),
  );

  await withOrgContext(organizationId, async (tx) => {
    await tx.documentVersion.update({
      where: { id: versionId },
      data: {
        structuredContent: asJson(content),
        contentHtml: html,
        contentChecksum: checksum,
        contentSchemaVersion: STRUCTURED_SCHEMA_VERSION,
        updatedBy: userId,
      },
    });
    // DOC-002: reconcilia relaciones derivadas del contenido de esta versión.
    await syncVersionRelations(tx, organizationId, userId, documentId, versionId, content, valid);
  });
  return { checksum, savedAt: new Date().toISOString() };
}

export interface MentionResult {
  id: string;
  code: string;
  title: string;
  documentType: string;
  typeLabel: string;
  statusLabel: string;
  version: string | null;
  area: string | null;
}

/**
 * Búsqueda ligera de documentos para el autocompletado de `@` (§7/§32). Scoped a
 * la organización; excluye archivados y (opcional) el documento origen. No toca
 * `structured_content`.
 */
export async function searchDocumentsForMention(
  organizationId: string,
  query: string,
  opts: { excludeDocumentId?: string; limit?: number } = {},
): Promise<MentionResult[]> {
  const q = query.trim();
  const where: Prisma.DocumentWhereInput = { organizationId, archivedAt: null };
  if (opts.excludeDocumentId) where.id = { not: opts.excludeDocumentId };
  if (q) {
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { title: { contains: q, mode: 'insensitive' } },
    ];
  }
  const docs = await getPrisma().document.findMany({
    where,
    take: Math.min(Math.max(opts.limit ?? 12, 1), 20),
    orderBy: [{ code: 'asc' }],
    select: {
      id: true,
      code: true,
      title: true,
      documentType: true,
      status: true,
      currentVersionLabel: true,
      ownerArea: true,
    },
  });
  return docs.map((d) => ({
    id: d.id,
    code: d.code,
    title: d.title,
    documentType: d.documentType,
    typeLabel: labelOf(DOCUMENT_TYPES, d.documentType),
    statusLabel: labelOf(DOCUMENT_STATUSES, d.status),
    version: d.currentVersionLabel,
    area: d.ownerArea,
  }));
}

export interface IssueFormInput {
  title: string;
  code?: string | null;
  codeIsCustom?: boolean;
  areaCode?: string | null;
  areaName?: string | null;
  proposito?: string | null;
}

/**
 * Emite un FORMATO (documentType 'form') desde un documento origen (§18): reserva
 * código `FO-[ÁREA]-[###]`, crea el documento + versión 1.0 (borrador, sin
 * autoaprobación §21) + contenido base + relación `issued_form` versionada, todo
 * en UNA transacción. Devuelve datos para insertar el token `//` en el origen.
 */
export async function issueFormFromDocument(
  organizationId: string,
  userId: string,
  sourceDocumentId: string,
  sourceVersionId: string,
  input: IssueFormInput,
): Promise<{ documentId: string; code: string; title: string; relationId: string }> {
  // El origen debe ser una versión estructurada EDITABLE (permiso de edición §42).
  const sourceDoc = await loadScopedDocument(organizationId, sourceDocumentId);
  if (sourceDoc.archivedAt) throw new DocumentNotEditableError();
  const sourceVersion = await loadScopedVersion(organizationId, sourceDocumentId, sourceVersionId);
  if (
    !isEditableStatus(sourceVersion.status as VersionStatus) ||
    !sourceVersion.isCurrent ||
    sourceVersion.structuredContent == null
  ) {
    throw new DocumentNotEditableError();
  }

  const errors: string[] = [];
  if (!input.title?.trim()) errors.push('El nombre del formato es obligatorio.');
  const useCustom = Boolean(input.codeIsCustom && input.code?.trim());
  if (useCustom) {
    const codeError = codeFormatError(input.code);
    if (codeError) errors.push(codeError);
  }
  if (errors.length) throw new DocumentValidationError(errors);

  // Hereda el área del documento origen si no se indica otra (§15).
  const areaCode = normalizeAreaCode(input.areaCode) || normalizeAreaCode(sourceDoc.ownerArea);
  const ownerArea = input.areaName?.trim() || sourceDoc.ownerArea || areaCode || null;
  const content = sanitizeStructuredContent('form', {
    fields: { proposito: input.proposito ?? '' },
    repeatables: {},
  });

  return saneCreate(() =>
    withOrgContext(organizationId, async (tx) => {
      const code = useCustom
        ? input.code!.trim()
        : formatDocumentCode(
            'FO',
            areaCode,
            await reserveDocumentCodeSeq(tx, organizationId, 'FO', areaCode),
          );
      const org = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { name: true },
      });
      const identity = buildRenderIdentity(
        {
          documentType: 'form',
          code,
          title: input.title.trim(),
          ownerArea,
          issuedAt: null,
          nextReviewAt: null,
        },
        INITIAL_VERSION_LABEL,
        org.name,
      );
      const html = renderStructuredHtml('form', content, identity, {});

      const formDoc = await tx.document.create({
        data: {
          organizationId,
          code,
          title: input.title.trim(),
          documentType: 'form',
          origin: 'internal',
          status: 'draft',
          confidentiality: 'internal',
          currentVersionLabel: INITIAL_VERSION_LABEL,
          ownerArea,
          responsibleUserId: userId,
          createdBy: userId,
        },
      });
      await tx.documentVersion.create({
        data: {
          organizationId,
          documentId: formDoc.id,
          label: INITIAL_VERSION_LABEL,
          status: 'draft',
          isCurrent: true,
          author: userId,
          updatedBy: userId,
          templateKey: 'form',
          contentSchemaVersion: STRUCTURED_SCHEMA_VERSION,
          structuredContent: asJson(content),
          contentHtml: html,
          contentChecksum: structuredChecksum(content),
        },
      });
      await tx.documentHistory.create({
        data: {
          organizationId,
          documentId: formDoc.id,
          action: 'document.created',
          actorUserId: userId,
        },
      });
      // Relación issued_form: versión origen → formato emitido (§18).
      const relation = await tx.documentRelation.create({
        data: {
          organizationId,
          documentId: sourceDocumentId,
          relationType: 'issued_form',
          relatedDocumentId: formDoc.id,
          sourceVersionId,
          active: true,
          createdBy: userId,
          label: input.title.trim(),
        },
      });
      await tx.documentHistory.create({
        data: {
          organizationId,
          documentId: sourceDocumentId,
          action: 'form.issued',
          actorUserId: userId,
        },
      });
      return { documentId: formDoc.id, code, title: input.title.trim(), relationId: relation.id };
    }),
  );
}

export interface DocumentRelationView {
  id: string;
  relationType: string;
  relatedDocumentId: string;
  code: string;
  title: string;
  typeLabel: string;
  versionLabel: string | null;
  statusLabel: string;
  obsolete: boolean;
  available: boolean;
}

/**
 * Relaciones documentales ACTIVAS derivadas del contenido (referencias y formatos
 * emitidos), resueltas para la sección "Relaciones documentales" del detalle
 * (§36). Toma la versión vigente si no se indica una.
 */
export async function getDocumentRelations(
  organizationId: string,
  documentId: string,
  versionId?: string,
): Promise<{ references: DocumentRelationView[]; issuedForms: DocumentRelationView[] }> {
  const prisma = getPrisma();
  const version =
    versionId != null
      ? { id: versionId }
      : ((await prisma.documentVersion.findFirst({
          where: { documentId, organizationId, isCurrent: true },
          select: { id: true },
        })) ??
        (await prisma.documentVersion.findFirst({
          where: { documentId, organizationId },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        })));
  if (!version) return { references: [], issuedForms: [] };

  const rels = await prisma.documentRelation.findMany({
    where: {
      organizationId,
      documentId,
      sourceVersionId: version.id,
      active: true,
      relationType: { in: [...REF_RELATION_TYPES] },
    },
    orderBy: { createdAt: 'asc' },
  });
  const resolved = await resolveReferences(
    prisma,
    organizationId,
    rels.map((r) => r.relatedDocumentId ?? '').filter(Boolean),
  );
  const view = (r: (typeof rels)[number]): DocumentRelationView => {
    const res = resolved[r.relatedDocumentId ?? ''];
    return {
      id: r.id,
      relationType: r.relationType,
      relatedDocumentId: r.relatedDocumentId ?? '',
      code: res?.code ?? '',
      title: res?.title ?? '',
      typeLabel: res?.typeLabel ?? '',
      versionLabel: res?.versionLabel ?? null,
      statusLabel: res?.statusLabel ?? '',
      obsolete: Boolean(res?.obsolete),
      available: Boolean(res?.available),
    };
  };
  return {
    references: rels.filter((r) => r.relationType === 'reference').map(view),
    issuedForms: rels.filter((r) => r.relationType === 'issued_form').map(view),
  };
}

/**
 * Documentos que EMITIERON este formato (§37): relaciones `issued_form` activas
 * cuyo destino es `documentId`. Resuelve los orígenes.
 */
export async function getIssuedFromSources(
  organizationId: string,
  documentId: string,
): Promise<DocumentRelationView[]> {
  const prisma = getPrisma();
  const rels = await prisma.documentRelation.findMany({
    where: {
      organizationId,
      relatedDocumentId: documentId,
      relationType: 'issued_form',
      active: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  const resolved = await resolveReferences(
    prisma,
    organizationId,
    rels.map((r) => r.documentId),
  );
  return rels.map((r) => {
    const res = resolved[r.documentId];
    return {
      id: r.id,
      relationType: r.relationType,
      relatedDocumentId: r.documentId,
      code: res?.code ?? '',
      title: res?.title ?? '',
      typeLabel: res?.typeLabel ?? '',
      versionLabel: res?.versionLabel ?? null,
      statusLabel: res?.statusLabel ?? '',
      obsolete: Boolean(res?.obsolete),
      available: Boolean(res?.available),
    };
  });
}
