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
  type DocumentMetadataInput,
} from '@/features/documents/catalog';

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
  siteId?: string;
  origin?: string;
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
  if (filters.siteId) where.siteId = filters.siteId;
  if (filters.origin) where.origin = filters.origin;

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

  return docs.map((d) => ({
    id: d.id,
    code: d.code,
    title: d.title,
    documentType: d.documentType,
    origin: d.origin,
    status: d.status,
    currentVersionLabel: d.currentVersionLabel,
    siteName: d.siteId ? (siteName.get(d.siteId) ?? null) : null,
    responsibleName: d.responsibleUserId ? (names.get(d.responsibleUserId) ?? null) : null,
    issuedAt: isoDate(d.issuedAt),
    nextReviewAt: isoDate(d.nextReviewAt),
    dueSoon: isDueSoon(isoDate(d.nextReviewAt), t),
    overdue: isOverdue(isoDate(d.nextReviewAt), t),
  }));
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

  const names = await userNames([doc.responsibleUserId, doc.createdBy]);
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
    status: doc.status,
    confidentiality: doc.confidentiality,
    currentVersionLabel: doc.currentVersionLabel,
    siteName: site?.name ?? null,
    responsibleName: doc.responsibleUserId ? (names.get(doc.responsibleUserId) ?? null) : null,
    ownerArea: doc.ownerArea,
    issuedAt: isoDate(doc.issuedAt),
    effectiveAt: isoDate(doc.effectiveAt),
    nextReviewAt: isoDate(doc.nextReviewAt),
    obsoleteAt: isoDate(doc.obsoleteAt),
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
  input: { label: string; changeNotes?: string | null },
): Promise<void> {
  const doc = await loadScopedDocument(organizationId, documentId);
  if (doc.archivedAt) throw new DocumentNotEditableError();
  if (!input.label?.trim())
    throw new DocumentValidationError(['La etiqueta de versión es obligatoria.']);

  await saneCreate(() =>
    withOrgContext(organizationId, async (tx) => {
      // Desmarca la vigente antes de crear la nueva (respeta el único parcial).
      await tx.documentVersion.updateMany({
        where: { documentId, organizationId, isCurrent: true },
        data: { isCurrent: false },
      });
      await tx.documentVersion.create({
        data: {
          organizationId,
          documentId,
          label: input.label.trim(),
          changeNotes: input.changeNotes ?? null,
          status: 'draft',
          isCurrent: true,
          author: userId,
        },
      });
      await tx.document.update({
        where: { id: documentId },
        data: { currentVersionLabel: input.label.trim() },
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
): Promise<void> {
  const doc = await loadScopedDocument(organizationId, documentId);
  if (doc.archivedAt) return;
  await withOrgContext(organizationId, async (tx) => {
    await tx.document.update({
      where: { id: documentId },
      data: { status: 'archived', archivedAt: new Date() },
    });
    await tx.documentHistory.create({
      data: { organizationId, documentId, action: 'document.archived', actorUserId: userId },
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
