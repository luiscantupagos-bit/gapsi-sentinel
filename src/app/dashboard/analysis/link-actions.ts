'use server';

/**
 * Acción transversal para iniciar un análisis desde cualquier origen
 * (proyecto/hallazgo/evento) creando la relación canónica en analysis_relations.
 * No duplica el origen. Cubre TODAS las herramientas del catálogo (Obj 3): las de
 * `quality_analyses` abren el workspace transversal; el «Estudio de Datos» crea un
 * data_study con relación al origen y abre su workspace (Obj 6).
 */
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireServerSession } from '@/server/session';
import {
  AnalysisPermissionError,
  AnalysisValidationError,
  createLinkedAnalysis,
  type RelationType,
} from '@/server/quality-analysis';
import { StudyPermissionError, StudyValidationError, createStudy } from '@/server/studies';
import { ANALYSIS_TYPES, type AnalysisType } from '@/features/capa/analysis-state';
import { getTool } from '@/features/analysis/tool-catalog';

export interface FormState {
  ok: boolean;
  message: string;
  errors?: string[];
}

function toState(error: unknown): FormState {
  if (error instanceof AnalysisValidationError || error instanceof StudyValidationError)
    return { ok: false, message: 'Revisa los datos.', errors: error.errors };
  if (error instanceof AnalysisPermissionError || error instanceof StudyPermissionError)
    return { ok: false, message: error.message };
  return { ok: false, message: 'Ocurrió un error.' };
}

export async function addLinkedAnalysisAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const relationType = String(fd.get('relationType') ?? '').trim() as RelationType;
  const targetId = String(fd.get('targetId') ?? '').trim();
  const tool = String(fd.get('type') ?? '').trim();
  const title = String(fd.get('title') ?? '').trim();
  const revalidate = String(fd.get('revalidate') ?? '').trim();

  const def = getTool(tool);
  if (!def) return { ok: false, message: 'Selecciona una herramienta válida.' };

  // Estudio de Datos: crea un data_study vinculado al origen (Obj 6).
  if (tool === 'data_study') {
    let studyId: string;
    try {
      studyId = await createStudy(session.organizationId, session.userId, {
        title,
        sourceType: relationType,
        sourceId: targetId,
      });
    } catch (error) {
      return toState(error);
    }
    if (revalidate) revalidatePath(revalidate);
    redirect(`/dashboard/analytics/studies/${studyId}`);
  }

  // Resto: herramienta de quality_analyses.
  if (!ANALYSIS_TYPES.includes(tool as AnalysisType))
    return { ok: false, message: 'Herramienta no válida.' };
  let id: string;
  try {
    id = await createLinkedAnalysis(
      session.organizationId,
      session.userId,
      { type: tool as AnalysisType, title },
      { relationType, targetId },
    );
  } catch (error) {
    return toState(error);
  }
  if (revalidate) revalidatePath(revalidate);
  redirect(`/dashboard/analysis/${id}`);
}
