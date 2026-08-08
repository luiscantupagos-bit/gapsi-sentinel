// CORE-ALIGN-003 — Servidor de Estudios de Datos.
//
// Crear estudio (folio EST-AAAA-####), importar dataset (CSV/XLSX/pegar TSV) con
// límites del MVP, clasificar variables, reportar calidad y paginar filas. Sin
// eval, sin macros, sin modificar datasets históricos (reimportar = nueva
// versión). Escrituras bajo RLS; historial append-only. Los motores estadísticos
// (Fase 4) consumen estas filas vía un adaptador.

import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';
import {
  DATASET_LIMITS,
  classifyDataset,
  parseCsv,
  parseTsv,
  type ParsedDataset,
  type VariableType,
} from '@/features/studies/dataset';
import { analyzeDatasetQuality, type DatasetQualityReport } from '@/features/studies/data-quality';
import { evalFormula, type FormulaNode } from '@/features/studies/formula';

type Tx = Prisma.TransactionClient;

export class StudyError extends Error {}
export class StudyPermissionError extends StudyError {}
export class StudyValidationError extends StudyError {
  constructor(public readonly errors: string[]) {
    super(errors.join(' '));
  }
}

export const STUDY_STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  data_loaded: 'Datos cargados',
  analyzing: 'En análisis',
  review: 'En revisión',
  concluded: 'Concluido',
  archived: 'Archivado',
};

export const STUDY_SOURCE_LABEL: Record<string, string> = {
  capa: 'CAPA',
  project: 'Proyecto',
  audit_finding: 'Hallazgo',
  quality_event: 'Evento',
  independent: 'Independiente',
};

async function memberRole(organizationId: string, userId: string): Promise<string> {
  const m = await getPrisma().membership.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!m) throw new StudyPermissionError('No perteneces a esta organización.');
  return m.role;
}
function canWrite(role: string): boolean {
  return role === 'owner' || role === 'admin' || role === 'evaluator';
}

async function nextFolio(tx: Tx, organizationId: string, year: number): Promise<string> {
  const rows = await tx.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO data_study_folio_counters ("organization_id", "year", "last_seq")
    VALUES (${organizationId}::uuid, ${year}, 1)
    ON CONFLICT ("organization_id", "year")
    DO UPDATE SET "last_seq" = data_study_folio_counters."last_seq" + 1
    RETURNING "last_seq"`;
  const seq = rows[0]?.last_seq ?? 1;
  return `EST-${year}-${String(seq).padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------
// Estudios
// ---------------------------------------------------------------------------

export interface StudyInput {
  title: string;
  objective?: string | null;
  question?: string | null;
  responsibleUserId?: string | null;
  siteId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
}

export async function createStudy(
  organizationId: string,
  actorId: string,
  input: StudyInput,
): Promise<string> {
  const role = await memberRole(organizationId, actorId);
  if (!canWrite(role)) throw new StudyPermissionError('No tienes permiso para crear estudios.');
  if (!input.title?.trim()) throw new StudyValidationError(['El título es obligatorio.']);

  const year = new Date().getUTCFullYear();
  return withOrgContext(organizationId, async (tx) => {
    const folio = await nextFolio(tx, organizationId, year);
    const study = await tx.dataStudy.create({
      data: {
        organizationId,
        folio,
        title: input.title.trim(),
        objective: input.objective?.trim() || null,
        question: input.question?.trim() || null,
        responsibleUserId: input.responsibleUserId || actorId,
        siteId: input.siteId || null,
        sourceType: input.sourceType || 'independent',
        sourceId: input.sourceId || null,
        status: 'draft',
        createdBy: actorId,
      },
    });
    await tx.dataStudyHistory.create({
      data: { organizationId, studyId: study.id, event: 'study.created', actorUserId: actorId },
    });
    return study.id;
  });
}

export async function listStudies(
  organizationId: string,
  opts: { search?: string; status?: string } = {},
) {
  const where: Prisma.DataStudyWhereInput = { organizationId };
  if (opts.status) where.status = opts.status;
  if (opts.search) where.title = { contains: opts.search, mode: 'insensitive' };
  return getPrisma().dataStudy.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      folio: true,
      title: true,
      status: true,
      sourceType: true,
      responsibleUserId: true,
      updatedAt: true,
      createdAt: true,
    },
  });
}

export async function getStudySummary(organizationId: string) {
  const rows = await getPrisma().dataStudy.groupBy({
    by: ['status'],
    where: { organizationId },
    _count: { _all: true },
  });
  const by = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
  return {
    total: rows.reduce((a, r) => a + r._count._all, 0),
    draft: by('draft'),
    analyzing: by('data_loaded') + by('analyzing') + by('review'),
    concluded: by('concluded'),
  };
}

export async function getStudy(organizationId: string, studyId: string) {
  return getPrisma().dataStudy.findFirst({ where: { id: studyId, organizationId } });
}

/** Dataset más reciente del estudio (o null) con sus variables. */
export async function getLatestDataset(organizationId: string, studyId: string) {
  const dataset = await getPrisma().studyDataset.findFirst({
    where: { studyId, organizationId },
    orderBy: { version: 'desc' },
    include: { variables: { orderBy: { position: 'asc' } } },
  });
  return dataset;
}

// ---------------------------------------------------------------------------
// Importación de datos
// ---------------------------------------------------------------------------

/** Parsea el buffer de un archivo XLSX a una matriz de celdas (server-only). */
export async function parseXlsxBuffer(buffer: Buffer): Promise<string[][]> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const matrix: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    const values = row.values as unknown[]; // índice 1-based; [0] es null
    for (let i = 1; i < values.length; i += 1) {
      const v = values[i];
      cells.push(v === null || v === undefined ? '' : cellToString(v));
    }
    matrix.push(cells);
  });
  return matrix;
}

function cellToString(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object' && v !== null) {
    const obj = v as { text?: string; result?: unknown; hyperlink?: string };
    if (typeof obj.text === 'string') return obj.text;
    if (obj.result !== undefined) return String(obj.result);
  }
  return String(v);
}

/** Convierte un contenido crudo (csv/xlsx/paste) a dataset parseado. */
export async function parseUpload(
  sourceKind: 'csv' | 'xlsx' | 'paste',
  content: { text?: string; buffer?: Buffer },
): Promise<ParsedDataset> {
  if (sourceKind === 'xlsx') {
    if (!content.buffer) throw new StudyValidationError(['Archivo XLSX vacío.']);
    const { toDataset } = await import('@/features/studies/dataset');
    return toDataset(await parseXlsxBuffer(content.buffer));
  }
  const text = content.text ?? '';
  if (text.trim() === '') throw new StudyValidationError(['No se recibieron datos.']);
  return sourceKind === 'paste' ? parseTsv(text) : parseCsv(text);
}

function validateLimits(ds: ParsedDataset, bytes: number): void {
  const errors: string[] = [];
  if (ds.headers.length === 0) errors.push('El archivo no tiene columnas/encabezados.');
  if (ds.rows.length === 0) errors.push('El archivo no tiene filas de datos.');
  if (ds.rows.length > DATASET_LIMITS.maxRows)
    errors.push(`Máximo ${DATASET_LIMITS.maxRows.toLocaleString('es-MX')} filas.`);
  if (ds.headers.length > DATASET_LIMITS.maxColumns)
    errors.push(`Máximo ${DATASET_LIMITS.maxColumns} columnas.`);
  if (bytes > DATASET_LIMITS.maxBytes) errors.push('El archivo supera 10 MB.');
  if (errors.length) throw new StudyValidationError(errors);
}

export interface ImportInput {
  sourceKind: 'csv' | 'xlsx' | 'paste';
  name: string;
  fileName?: string | null;
  bytes: number;
  dataset: ParsedDataset;
  types?: VariableType[];
}

/** Persiste un dataset importado como nueva versión (no altera versiones previas). */
export async function importDataset(
  organizationId: string,
  actorId: string,
  studyId: string,
  input: ImportInput,
): Promise<string> {
  const role = await memberRole(organizationId, actorId);
  if (!canWrite(role)) throw new StudyPermissionError('No tienes permiso para importar datos.');
  const study = await getPrisma().dataStudy.findFirst({
    where: { id: studyId, organizationId },
    select: { id: true },
  });
  if (!study) throw new StudyValidationError(['El estudio no pertenece a la organización.']);

  const ds = input.dataset;
  validateLimits(ds, input.bytes);
  const types = input.types ?? classifyDataset(ds);
  const checksum = createHash('sha256')
    .update(ds.headers.join('|') + '\n' + ds.rows.map((r) => r.join('|')).join('\n'))
    .digest('hex');

  return withOrgContext(organizationId, async (tx) => {
    const prev = await tx.studyDataset.findFirst({
      where: { studyId, organizationId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (prev?.version ?? 0) + 1;

    const dataset = await tx.studyDataset.create({
      data: {
        organizationId,
        studyId,
        version,
        name: input.name.trim() || `Datos v${version}`,
        sourceKind: input.sourceKind,
        fileName: input.fileName?.trim() || null,
        fileChecksum: checksum,
        fileSize: input.bytes,
        rowCount: ds.rows.length,
        columnCount: ds.headers.length,
        createdBy: actorId,
      },
    });

    await tx.studyVariable.createMany({
      data: ds.headers.map((h, i) => ({
        organizationId,
        datasetId: dataset.id,
        columnKey: columnKey(h, i),
        label: h,
        varType: types[i] ?? 'text',
        position: i,
      })),
    });

    // Inserta filas por lotes (valores estructurados por clave de columna).
    const keys = ds.headers.map((h, i) => columnKey(h, i));
    const BATCH = 1000;
    for (let start = 0; start < ds.rows.length; start += BATCH) {
      const slice = ds.rows.slice(start, start + BATCH);
      await tx.studyRow.createMany({
        data: slice.map((r, j) => ({
          organizationId,
          datasetId: dataset.id,
          rowIndex: start + j,
          values: Object.fromEntries(keys.map((k, c) => [k, r[c] ?? ''])) as Prisma.InputJsonValue,
        })),
      });
    }

    await tx.dataStudy.update({
      where: { id: studyId },
      data: { status: 'data_loaded' },
    });
    await tx.dataStudyHistory.create({
      data: {
        organizationId,
        studyId,
        event: 'dataset.imported',
        actorUserId: actorId,
        detail: `v${version} · ${ds.rows.length} filas · ${ds.headers.length} columnas`,
      },
    });
    return dataset.id;
  });
}

/** Clave de columna estable (snake, única por índice). */
function columnKey(header: string, index: number): string {
  const base = header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base ? `${base}_${index}` : `col_${index}`;
}

// ---------------------------------------------------------------------------
// Lectura de filas + variables calculadas (on-the-fly, sin mutar el dataset)
// ---------------------------------------------------------------------------

export async function updateVariableType(
  organizationId: string,
  actorId: string,
  variableId: string,
  varType: VariableType,
): Promise<void> {
  const role = await memberRole(organizationId, actorId);
  if (!canWrite(role)) throw new StudyPermissionError('Sin permiso.');
  await withOrgContext(organizationId, async (tx) => {
    await tx.studyVariable.updateMany({
      where: { id: variableId, organizationId },
      data: { varType },
    });
  });
}

export interface CalculatedInput {
  label: string;
  formula: FormulaNode;
}

export async function addCalculatedVariable(
  organizationId: string,
  actorId: string,
  datasetId: string,
  input: CalculatedInput,
): Promise<void> {
  const role = await memberRole(organizationId, actorId);
  if (!canWrite(role)) throw new StudyPermissionError('Sin permiso.');
  if (!input.label?.trim())
    throw new StudyValidationError(['El nombre de la variable es obligatorio.']);
  await withOrgContext(organizationId, async (tx) => {
    const count = await tx.studyVariable.count({ where: { datasetId, organizationId } });
    await tx.studyVariable.create({
      data: {
        organizationId,
        datasetId,
        columnKey: columnKey(input.label, count),
        label: input.label.trim(),
        varType: 'numeric',
        position: count,
        calculated: true,
        formula: input.formula as unknown as Prisma.InputJsonValue,
      },
    });
  });
}

/** Página de filas del dataset con columnas calculadas resueltas al vuelo. */
export async function getDatasetPage(
  organizationId: string,
  datasetId: string,
  opts: { skip?: number; take?: number } = {},
) {
  const prisma = getPrisma();
  const [variables, rows, total] = await Promise.all([
    prisma.studyVariable.findMany({
      where: { datasetId, organizationId },
      orderBy: { position: 'asc' },
    }),
    prisma.studyRow.findMany({
      where: { datasetId, organizationId },
      orderBy: { rowIndex: 'asc' },
      skip: opts.skip ?? 0,
      take: Math.min(opts.take ?? 50, 200),
    }),
    prisma.studyRow.count({ where: { datasetId, organizationId } }),
  ]);

  const calc = variables.filter((v) => v.calculated && v.formula);
  const resolved = rows.map((r) => {
    const base = r.values as Record<string, string>;
    const out: Record<string, string> = { ...base };
    if (calc.length > 0) {
      const nums: Record<string, number | null> = {};
      for (const v of variables) {
        if (!v.calculated) {
          const raw = base[v.columnKey];
          const n = raw === undefined || raw === '' ? null : Number(raw);
          nums[v.columnKey] = Number.isFinite(n as number) ? (n as number) : null;
        }
      }
      for (const v of calc) {
        const res = evalFormula(v.formula as unknown as FormulaNode, nums);
        out[v.columnKey] = res.value === null ? '' : String(res.value);
        nums[v.columnKey] = res.value;
      }
    }
    return { rowIndex: r.rowIndex, excluded: r.excluded, values: out };
  });

  return { variables, rows: resolved, total };
}

/** Reporte de calidad de datos del dataset (sobre las columnas base). */
export async function getDatasetQuality(
  organizationId: string,
  datasetId: string,
): Promise<DatasetQualityReport> {
  const prisma = getPrisma();
  const [variables, rows] = await Promise.all([
    prisma.studyVariable.findMany({
      where: { datasetId, organizationId, calculated: false },
      orderBy: { position: 'asc' },
    }),
    prisma.studyRow.findMany({
      where: { datasetId, organizationId },
      orderBy: { rowIndex: 'asc' },
    }),
  ]);
  const matrix = rows.map((r) => {
    const v = r.values as Record<string, string>;
    return variables.map((col) => v[col.columnKey] ?? '');
  });
  return analyzeDatasetQuality({
    columns: variables.map((v) => ({
      key: v.columnKey,
      label: v.label,
      type: v.varType as VariableType,
    })),
    rows: matrix,
  });
}
