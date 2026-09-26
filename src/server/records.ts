/**
 * DOC-004 — servidor de REGISTROS digitales. Un documento tipo `form` define, en su
 * DocumentVersion, un `form_schema` (diseñador). Cada registro (record_instance) se
 * captura contra la VERSIÓN EXACTA publicada del formato (§35), con folio REG-AAAA-######
 * atómico por tenant. Validación de obligatorios/tipos/condiciones en SERVIDOR (§14).
 * Idempotencia por client_generated_id (§40). Aislamiento por organización (RLS +
 * withOrgContext). Auditoría en audit_log + marcas de tiempo por transición (§37).
 */
import type { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';
import {
  sanitizeFormSchema,
  sanitizeRecordData,
  validateFormSchema,
  validateRecordData,
  schemaHasFields,
  recordCompleteness,
  emptyRecordData,
  type FormSchema,
  type RecordData,
} from '@/features/records/form-schema';
import {
  canTransition,
  formatRecordNumber,
  isRecordEditable,
  RECORD_SOURCE_TYPES,
  type RecordStatus,
} from '@/features/records/record-state';

export type Tx = Prisma.TransactionClient;

export class RecordNotFoundError extends Error {
  constructor(msg = 'Registro no encontrado.') {
    super(msg);
  }
}
export class RecordPermissionError extends Error {}
export class RecordValidationError extends Error {
  constructor(public errors: string[]) {
    super(errors.join(' '));
  }
}

// --- Permisos ----------------------------------------------------------------
async function memberRole(organizationId: string, userId: string): Promise<string> {
  const m = await getPrisma().membership.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!m) throw new RecordPermissionError('No perteneces a esta organización.');
  return m.role;
}
const canWrite = (role: string) => role === 'owner' || role === 'admin' || role === 'evaluator';
const canReview = (role: string) => role === 'owner' || role === 'admin';

async function requireWrite(organizationId: string, userId: string): Promise<void> {
  if (!canWrite(await memberRole(organizationId, userId)))
    throw new RecordPermissionError('No tienes permiso para capturar registros.');
}
async function requireReview(organizationId: string, userId: string): Promise<void> {
  if (!canReview(await memberRole(organizationId, userId)))
    throw new RecordPermissionError('Solo owner/admin puede revisar o cerrar registros.');
}

export async function memberDirectory(organizationId: string): Promise<Map<string, string>> {
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

// --- Utilidades internas -----------------------------------------------------
const isEditableVersionStatus = (s: string) => s === 'draft' || s === 'in_review';

function readSchema(formSchema: unknown): FormSchema {
  return sanitizeFormSchema(formSchema ?? {});
}
function readData(schema: FormSchema, data: unknown): RecordData {
  return sanitizeRecordData(schema, data ?? emptyRecordData());
}

async function recordEvent(
  tx: Tx,
  organizationId: string,
  recordId: string,
  action: string,
  actorUserId: string,
  metadata?: Prisma.InputJsonValue,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      organizationId,
      actorUserId,
      action,
      entityType: 'record',
      entityId: recordId,
      metadata: metadata ?? undefined,
    },
  });
}

async function nextRecordFolio(tx: Tx, organizationId: string, year: number): Promise<string> {
  const rows = await tx.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO record_code_counters ("organization_id", "year", "last_seq")
    VALUES (${organizationId}::uuid, ${year}, 1)
    ON CONFLICT ("organization_id", "year")
    DO UPDATE SET "last_seq" = record_code_counters."last_seq" + 1
    RETURNING "last_seq"`;
  return formatRecordNumber(year, rows[0]?.last_seq ?? 1);
}

// --- Diseñador de formularios (form_schema en la versión) --------------------
/**
 * Guarda el esquema de formulario en una versión documental EDITABLE de tipo `form`.
 * Publicado = inmutable (solo se edita el borrador, §5/§20). Devuelve el esquema saneado.
 */
export async function saveFormSchema(
  organizationId: string,
  userId: string,
  documentVersionId: string,
  rawSchema: unknown,
): Promise<FormSchema> {
  await requireWrite(organizationId, userId);
  const schema = sanitizeFormSchema(rawSchema);
  const errors = validateFormSchema(schema);
  // El diseño puede guardarse incompleto como borrador, salvo que no tenga ningún campo
  // Y además el usuario intente dejarlo inválido de forma estructural (ids duplicados, etc.).
  // Aquí solo bloqueamos si NO hay campos (no se puede publicar/usar un formulario vacío).
  if (!schemaHasFields(schema) && (rawSchema as { sections?: unknown[] })?.sections?.length)
    throw new RecordValidationError(errors.length ? errors : ['El formulario no tiene campos.']);

  return withOrgContext(organizationId, async (tx) => {
    const version = await tx.documentVersion.findFirst({
      where: { id: documentVersionId, organizationId },
      select: { id: true, status: true, document: { select: { documentType: true } } },
    });
    if (!version) throw new RecordNotFoundError('Versión documental no encontrada.');
    if (version.document.documentType !== 'form')
      throw new RecordValidationError(['Solo los documentos tipo Formato admiten diseñador.']);
    if (!isEditableVersionStatus(version.status))
      throw new RecordValidationError(['La versión publicada es inmutable.']);
    await tx.documentVersion.update({
      where: { id: documentVersionId },
      data: { formSchema: schema as unknown as Prisma.InputJsonValue },
    });
    return schema;
  });
}

export interface FormDesignerData {
  documentId: string;
  code: string;
  title: string;
  documentVersionId: string;
  versionLabel: string;
  status: string;
  editable: boolean;
  schema: FormSchema;
}
/**
 * Carga el diseñador de un formato: toma la versión ACTUAL del documento (borrador si existe,
 * si no la vigente) para editar/ver su esquema. Solo tipo `form`.
 */
export async function getFormDesigner(
  organizationId: string,
  documentId: string,
): Promise<FormDesignerData | null> {
  const version = await withOrgContext(organizationId, (tx) =>
    tx.documentVersion.findFirst({
      where: { organizationId, documentId, isCurrent: true },
      select: {
        id: true,
        label: true,
        status: true,
        formSchema: true,
        document: { select: { id: true, code: true, title: true, documentType: true } },
      },
    }),
  );
  if (!version || version.document.documentType !== 'form') return null;
  return {
    documentId: version.document.id,
    code: version.document.code,
    title: version.document.title,
    documentVersionId: version.id,
    versionLabel: version.label,
    status: version.status,
    editable: isEditableVersionStatus(version.status),
    schema: readSchema(version.formSchema),
  };
}

// --- Formatos disponibles para capturar --------------------------------------
export interface AvailableForm {
  documentId: string;
  documentVersionId: string;
  code: string;
  title: string;
  versionLabel: string;
}
/** Formatos con una versión PUBLICADA que ya tiene esquema con campos (se pueden llenar). */
export async function listAvailableForms(organizationId: string): Promise<AvailableForm[]> {
  const versions = await withOrgContext(organizationId, (tx) =>
    tx.documentVersion.findMany({
      where: {
        organizationId,
        status: 'published',
        isCurrent: true,
        document: { documentType: 'form' },
      },
      select: {
        id: true,
        label: true,
        formSchema: true,
        document: { select: { id: true, code: true, title: true } },
      },
      orderBy: { document: { code: 'asc' } },
    }),
  );
  return versions
    .filter((v) => schemaHasFields(readSchema(v.formSchema)))
    .map((v) => ({
      documentId: v.document.id,
      documentVersionId: v.id,
      code: v.document.code,
      title: v.document.title,
      versionLabel: v.label,
    }));
}

// --- Crear registro ----------------------------------------------------------
export interface CreateRecordInput {
  documentId: string;
  clientGeneratedId?: string | null;
  siteId?: string | null;
  assignedToUserId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
}
/**
 * Crea un registro a partir de la versión PUBLICADA vigente del formato. Idempotente por
 * client_generated_id (§40): un reintento devuelve el mismo registro. Folio atómico.
 */
export async function createRecord(
  organizationId: string,
  userId: string,
  input: CreateRecordInput,
): Promise<string> {
  await requireWrite(organizationId, userId);
  const sourceType =
    input.sourceType && (RECORD_SOURCE_TYPES as readonly string[]).includes(input.sourceType)
      ? input.sourceType
      : 'manual';

  return withOrgContext(organizationId, async (tx) => {
    // Idempotencia: si ya existe un registro con este client_generated_id, devolverlo.
    if (input.clientGeneratedId) {
      const existing = await tx.recordInstance.findFirst({
        where: { organizationId, clientGeneratedId: input.clientGeneratedId },
        select: { id: true },
      });
      if (existing) return existing.id;
    }

    const version = await tx.documentVersion.findFirst({
      where: {
        organizationId,
        documentId: input.documentId,
        status: 'published',
        isCurrent: true,
      },
      select: {
        id: true,
        label: true,
        formSchema: true,
        document: { select: { id: true, code: true, title: true, documentType: true } },
      },
    });
    if (!version || version.document.documentType !== 'form')
      throw new RecordNotFoundError('Formato vigente no encontrado.');
    if (!schemaHasFields(readSchema(version.formSchema)))
      throw new RecordValidationError(['El formato no tiene un formulario diseñado.']);

    const folio = await nextRecordFolio(tx, organizationId, new Date().getFullYear());
    const created = await tx.recordInstance.create({
      data: {
        organizationId,
        recordNumber: folio,
        documentId: version.document.id,
        documentVersionId: version.id,
        formCode: version.document.code,
        formTitle: version.document.title,
        formVersionLabel: version.label,
        status: 'draft',
        data: emptyRecordData() as unknown as Prisma.InputJsonValue,
        assignedToUserId: input.assignedToUserId ?? null,
        siteId: input.siteId ?? null,
        sourceType,
        sourceId: input.sourceId ?? null,
        clientGeneratedId: input.clientGeneratedId ?? null,
        createdBy: userId,
      },
      select: { id: true },
    });
    await recordEvent(tx, organizationId, created.id, 'record.created', userId, { folio });
    return created.id;
  });
}

// --- Lecturas ----------------------------------------------------------------
export interface RecordListItem {
  id: string;
  recordNumber: string;
  formCode: string;
  formTitle: string;
  formVersionLabel: string;
  status: string;
  sourceType: string | null;
  siteName: string | null;
  assignedToName: string | null;
  createdByName: string | null;
  isMine: boolean;
  createdAt: string;
  submittedAt: string | null;
}

export interface RecordListFilters {
  status?: string;
  documentId?: string;
  mine?: boolean;
}

async function siteDirectory(organizationId: string): Promise<Map<string, string>> {
  const sites = await getPrisma().site.findMany({
    where: { organizationId, deletedAt: null },
    select: { id: true, name: true },
  });
  return new Map(sites.map((s) => [s.id, s.name]));
}

export async function getRecords(
  organizationId: string,
  userId: string,
  filters: RecordListFilters = {},
): Promise<RecordListItem[]> {
  const where: Prisma.RecordInstanceWhereInput = { organizationId };
  if (filters.status) where.status = filters.status;
  if (filters.documentId) where.documentId = filters.documentId;
  if (filters.mine) where.createdBy = userId;

  const [rows, members, sites] = await Promise.all([
    withOrgContext(organizationId, (tx) =>
      tx.recordInstance.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 }),
    ),
    memberDirectory(organizationId),
    siteDirectory(organizationId),
  ]);
  return rows.map((r) => ({
    id: r.id,
    recordNumber: r.recordNumber,
    formCode: r.formCode,
    formTitle: r.formTitle,
    formVersionLabel: r.formVersionLabel,
    status: r.status,
    sourceType: r.sourceType,
    siteName: r.siteId ? (sites.get(r.siteId) ?? null) : null,
    assignedToName: r.assignedToUserId ? (members.get(r.assignedToUserId) ?? null) : null,
    createdByName: r.createdBy ? (members.get(r.createdBy) ?? null) : null,
    isMine: r.createdBy === userId,
    createdAt: r.createdAt.toISOString().slice(0, 10),
    submittedAt: r.submittedAt ? r.submittedAt.toISOString().slice(0, 10) : null,
  }));
}

export interface RecordDetail {
  id: string;
  recordNumber: string;
  formCode: string;
  formTitle: string;
  formVersionLabel: string;
  documentId: string;
  status: string;
  editable: boolean;
  sourceType: string | null;
  siteName: string | null;
  assignedToName: string | null;
  createdByName: string | null;
  submittedByName: string | null;
  reviewedByName: string | null;
  closedByName: string | null;
  createdAt: string;
  startedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  closedAt: string | null;
  schema: FormSchema;
  data: RecordData;
  completeness: { required: number; filled: number };
}

export async function getRecord(
  organizationId: string,
  recordId: string,
): Promise<RecordDetail | null> {
  const row = await withOrgContext(organizationId, (tx) =>
    tx.recordInstance.findFirst({
      where: { id: recordId, organizationId },
      include: { version: { select: { formSchema: true } } },
    }),
  );
  if (!row) return null;
  const members = await memberDirectory(organizationId);
  const sites = await siteDirectory(organizationId);
  const schema = readSchema(row.version.formSchema);
  const data = readData(schema, row.data);
  const name = (id: string | null) => (id ? (members.get(id) ?? null) : null);
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  return {
    id: row.id,
    recordNumber: row.recordNumber,
    formCode: row.formCode,
    formTitle: row.formTitle,
    formVersionLabel: row.formVersionLabel,
    documentId: row.documentId,
    status: row.status,
    editable: isRecordEditable(row.status),
    sourceType: row.sourceType,
    siteName: row.siteId ? (sites.get(row.siteId) ?? null) : null,
    assignedToName: name(row.assignedToUserId),
    createdByName: name(row.createdBy),
    submittedByName: name(row.submittedBy),
    reviewedByName: name(row.reviewedBy),
    closedByName: name(row.closedBy),
    createdAt: iso(row.createdAt) ?? '',
    startedAt: iso(row.startedAt),
    submittedAt: iso(row.submittedAt),
    reviewedAt: iso(row.reviewedAt),
    closedAt: iso(row.closedAt),
    schema,
    data,
    completeness: recordCompleteness(schema, data),
  };
}

// --- Captura / workflow ------------------------------------------------------
async function loadEditable(tx: Tx, organizationId: string, recordId: string) {
  const row = await tx.recordInstance.findFirst({
    where: { id: recordId, organizationId },
    include: { version: { select: { formSchema: true } } },
  });
  if (!row) throw new RecordNotFoundError();
  return row;
}

/** Guarda (autosave / borrador) los datos capturados. Solo en estados editables (§25/§26). */
export async function saveRecordData(
  organizationId: string,
  userId: string,
  recordId: string,
  rawData: unknown,
): Promise<void> {
  await requireWrite(organizationId, userId);
  await withOrgContext(organizationId, async (tx) => {
    const row = await loadEditable(tx, organizationId, recordId);
    if (!isRecordEditable(row.status))
      throw new RecordValidationError(['El registro no es editable en su estado actual.']);
    const schema = readSchema(row.version.formSchema);
    const data = sanitizeRecordData(schema, rawData);
    await tx.recordInstance.update({
      where: { id: recordId },
      data: {
        data: data as unknown as Prisma.InputJsonValue,
        status: 'in_progress',
        startedAt: row.startedAt ?? new Date(),
      },
    });
    await recordEvent(tx, organizationId, recordId, 'record.saved', userId);
  });
}

/** Envía el registro: valida contra el esquema (§14/§26). Falla si hay errores. */
export async function submitRecord(
  organizationId: string,
  userId: string,
  recordId: string,
  rawData?: unknown,
): Promise<void> {
  await requireWrite(organizationId, userId);
  await withOrgContext(organizationId, async (tx) => {
    const row = await loadEditable(tx, organizationId, recordId);
    if (!canTransition(row.status, 'submitted'))
      throw new RecordValidationError(['El registro no puede enviarse en su estado actual.']);
    const schema = readSchema(row.version.formSchema);
    const data =
      rawData !== undefined ? sanitizeRecordData(schema, rawData) : readData(schema, row.data);
    const errors = validateRecordData(schema, data);
    if (errors.length) throw new RecordValidationError(errors);
    await tx.recordInstance.update({
      where: { id: recordId },
      data: {
        data: data as unknown as Prisma.InputJsonValue,
        status: 'submitted',
        submittedAt: new Date(),
        submittedBy: userId,
        startedAt: row.startedAt ?? new Date(),
      },
    });
    await recordEvent(tx, organizationId, recordId, 'record.submitted', userId);
  });
}

async function transition(
  organizationId: string,
  userId: string,
  recordId: string,
  to: RecordStatus,
  action: string,
  extra: Prisma.RecordInstanceUpdateInput,
  reviewer: boolean,
): Promise<void> {
  if (reviewer) await requireReview(organizationId, userId);
  else await requireWrite(organizationId, userId);
  await withOrgContext(organizationId, async (tx) => {
    const row = await tx.recordInstance.findFirst({
      where: { id: recordId, organizationId },
      select: { status: true },
    });
    if (!row) throw new RecordNotFoundError();
    if (!canTransition(row.status, to))
      throw new RecordValidationError([`No se puede pasar de «${row.status}» a «${to}».`]);
    await tx.recordInstance.update({ where: { id: recordId }, data: { status: to, ...extra } });
    await recordEvent(tx, organizationId, recordId, action, userId);
  });
}

export function reviewRecord(organizationId: string, userId: string, recordId: string) {
  return transition(
    organizationId,
    userId,
    recordId,
    'reviewed',
    'record.reviewed',
    { reviewedAt: new Date(), reviewedBy: userId },
    true,
  );
}
export function closeRecord(organizationId: string, userId: string, recordId: string) {
  return transition(
    organizationId,
    userId,
    recordId,
    'closed',
    'record.closed',
    { closedAt: new Date(), closedBy: userId },
    true,
  );
}
export function cancelRecord(organizationId: string, userId: string, recordId: string) {
  return transition(
    organizationId,
    userId,
    recordId,
    'cancelled',
    'record.cancelled',
    { closedAt: new Date(), closedBy: userId },
    false,
  );
}
/** Devuelve un registro enviado/revisado a proceso para corrección controlada (§27/§38). */
export function reopenRecord(organizationId: string, userId: string, recordId: string) {
  return transition(organizationId, userId, recordId, 'in_progress', 'record.reopened', {}, true);
}
