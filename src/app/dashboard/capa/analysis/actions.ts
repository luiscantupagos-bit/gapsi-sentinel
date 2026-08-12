'use server';

/** Crear un análisis independiente (sin origen) desde la biblioteca global. */
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireServerSession } from '@/server/session';
import {
  AnalysisPermissionError,
  AnalysisValidationError,
  createIndependentAnalysis,
} from '@/server/quality-analysis';
import { StudyPermissionError, StudyValidationError, createStudy } from '@/server/studies';
import { ANALYSIS_TYPES, type AnalysisType } from '@/features/capa/analysis-state';
import { getTool } from '@/features/analysis/tool-catalog';

export interface FormState {
  ok: boolean;
  message: string;
  errors?: string[];
}

export async function createIndependentAnalysisAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const tool = String(fd.get('type') ?? '').trim();
  const title = String(fd.get('title') ?? '').trim();
  const def = getTool(tool);
  if (!def) return { ok: false, message: 'Selecciona una herramienta válida.' };

  // Estudio de Datos independiente.
  if (tool === 'data_study') {
    let studyId: string;
    try {
      studyId = await createStudy(session.organizationId, session.userId, {
        title,
        sourceType: 'independent',
      });
    } catch (error) {
      if (error instanceof StudyValidationError)
        return { ok: false, message: 'Revisa los datos.', errors: error.errors };
      if (error instanceof StudyPermissionError) return { ok: false, message: error.message };
      return { ok: false, message: 'Ocurrió un error.' };
    }
    revalidatePath('/dashboard/capa/analysis');
    redirect(`/dashboard/analytics/studies/${studyId}`);
  }

  if (!ANALYSIS_TYPES.includes(tool as AnalysisType))
    return { ok: false, message: 'Herramienta no válida.' };
  let id: string;
  try {
    id = await createIndependentAnalysis(session.organizationId, session.userId, {
      type: tool as AnalysisType,
      title,
    });
  } catch (error) {
    if (error instanceof AnalysisValidationError)
      return { ok: false, message: 'Revisa los datos.', errors: error.errors };
    if (error instanceof AnalysisPermissionError) return { ok: false, message: error.message };
    return { ok: false, message: 'Ocurrió un error.' };
  }
  revalidatePath('/dashboard/capa/analysis');
  redirect(`/dashboard/analysis/${id}`);
}
