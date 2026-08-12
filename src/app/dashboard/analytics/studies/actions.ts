'use server';

/**
 * Server Actions de Estudios de Datos (CORE-ALIGN-003). Organización y usuario
 * desde la sesión; permisos y límites validados en la capa de datos. Sin eval;
 * el XLSX se parsea en el servidor con exceljs (sin macros); reimportar crea una
 * nueva versión sin alterar el pasado.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  StudyPermissionError,
  StudyValidationError,
  addCalculatedVariable,
  createStudy,
  deleteStudyAnalysis,
  importDataset,
  parseUpload,
  runStudyAnalysis,
  setStudyConclusion,
  updateVariableType,
} from '@/server/studies';
import { deviationPercentFormula } from '@/features/studies/formula';
import type { VariableType } from '@/features/studies/dataset';
import type { AnalysisConfig, StudyMethod } from '@/features/studies/analysis-adapter';

export interface FormState {
  ok: boolean;
  message: string;
  errors?: string[];
}

function toState(error: unknown): FormState {
  if (error instanceof StudyValidationError)
    return { ok: false, message: 'Revisa los datos.', errors: error.errors };
  if (error instanceof StudyPermissionError) return { ok: false, message: error.message };
  return { ok: false, message: 'Ocurrió un error al procesar la solicitud.' };
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const opt = (fd: FormData, k: string) => s(fd, k) || null;

export async function createStudyAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  let id: string;
  try {
    id = await createStudy(session.organizationId, session.userId, {
      title: s(fd, 'title'),
      objective: opt(fd, 'objective'),
      question: opt(fd, 'question'),
      sourceType: opt(fd, 'sourceType'),
      sourceId: opt(fd, 'sourceId'),
    });
  } catch (error) {
    return toState(error);
  }
  revalidatePath('/dashboard/analytics/studies');
  redirect(`/dashboard/analytics/studies/${id}`);
}

export async function importFileAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const studyId = s(fd, 'studyId');
  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, message: 'Selecciona un archivo.' };
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsm') || name.endsWith('.xls'))
    return { ok: false, message: 'Formato no admitido. Usa CSV o XLSX (sin macros).' };
  const isXlsx = name.endsWith('.xlsx');
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataset = await parseUpload(isXlsx ? 'xlsx' : 'csv', {
      buffer: isXlsx ? buffer : undefined,
      text: isXlsx ? undefined : buffer.toString('utf8'),
    });
    await importDataset(session.organizationId, session.userId, studyId, {
      sourceKind: isXlsx ? 'xlsx' : 'csv',
      name: file.name,
      fileName: file.name,
      bytes: file.size,
      dataset,
    });
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/dashboard/analytics/studies/${studyId}`);
  return { ok: true, message: 'Datos importados.' };
}

export async function importPasteAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const studyId = s(fd, 'studyId');
  const text = String(fd.get('data') ?? '');
  try {
    const dataset = await parseUpload('paste', { text });
    await importDataset(session.organizationId, session.userId, studyId, {
      sourceKind: 'paste',
      name: 'Datos pegados',
      bytes: Buffer.byteLength(text, 'utf8'),
      dataset,
    });
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/dashboard/analytics/studies/${studyId}`);
  return { ok: true, message: 'Datos importados.' };
}

export async function setVariableTypeAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const studyId = s(fd, 'studyId');
  try {
    await updateVariableType(
      session.organizationId,
      session.userId,
      s(fd, 'variableId'),
      s(fd, 'varType') as VariableType,
    );
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/dashboard/analytics/studies/${studyId}`);
  return { ok: true, message: 'Tipo actualizado.' };
}

export async function addDeviationVariableAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const studyId = s(fd, 'studyId');
  const real = s(fd, 'realColumn');
  const nominal = s(fd, 'nominalColumn');
  if (!real || !nominal) return { ok: false, message: 'Selecciona ambas columnas.' };
  try {
    await addCalculatedVariable(session.organizationId, session.userId, s(fd, 'datasetId'), {
      label: s(fd, 'label') || 'Desviación %',
      formula: deviationPercentFormula(real, nominal),
    });
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/dashboard/analytics/studies/${studyId}`);
  return { ok: true, message: 'Variable calculada creada.' };
}

const METHODS = new Set<StudyMethod>([
  'descriptive',
  'pareto',
  'trend',
  'correlation',
  'regression',
  'group_compare',
  'anova',
  'chi_square',
]);

export async function runAnalysisAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const studyId = s(fd, 'studyId');
  const method = s(fd, 'method') as StudyMethod;
  if (!METHODS.has(method)) return { ok: false, message: 'Selecciona un método válido.' };
  const config: AnalysisConfig = {
    variable: opt(fd, 'variable') ?? undefined,
    category: opt(fd, 'category') ?? undefined,
    weight: opt(fd, 'weight') ?? undefined,
    value: opt(fd, 'value') ?? undefined,
    date: opt(fd, 'date') ?? undefined,
    period: (opt(fd, 'period') as AnalysisConfig['period']) ?? undefined,
    x: opt(fd, 'x') ?? undefined,
    y: opt(fd, 'y') ?? undefined,
  };
  try {
    await runStudyAnalysis(session.organizationId, session.userId, studyId, {
      datasetId: s(fd, 'datasetId'),
      method,
      config,
      title: opt(fd, 'title'),
    });
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/dashboard/analytics/studies/${studyId}`);
  return { ok: true, message: 'Análisis ejecutado.' };
}

export async function deleteAnalysisAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const studyId = s(fd, 'studyId');
  try {
    await deleteStudyAnalysis(session.organizationId, session.userId, s(fd, 'analysisId'));
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/dashboard/analytics/studies/${studyId}`);
  return { ok: true, message: 'Análisis eliminado.' };
}

export async function saveConclusionAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const studyId = s(fd, 'studyId');
  try {
    await setStudyConclusion(
      session.organizationId,
      session.userId,
      studyId,
      s(fd, 'conclusion'),
      s(fd, 'markConcluded') === 'on',
    );
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/dashboard/analytics/studies/${studyId}`);
  return { ok: true, message: 'Conclusión guardada.' };
}
