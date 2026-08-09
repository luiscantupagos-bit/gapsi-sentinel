'use server';

/**
 * Acción transversal para iniciar un análisis desde cualquier origen
 * (proyecto/hallazgo/evento) creando la relación en analysis_relations. No
 * duplica el origen: solo crea el análisis y lo vincula. 5 Porqués y FTA abren
 * el workspace transversal; el resto (si el origen es CAPA) la vista de la CAPA.
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
import type { AnalysisType } from '@/features/capa/analysis-state';

export interface FormState {
  ok: boolean;
  message: string;
  errors?: string[];
}

const TRANSVERSAL_TYPES = new Set<AnalysisType>(['5whys', 'fta']);

export async function addLinkedAnalysisAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const relationType = String(fd.get('relationType') ?? '').trim() as RelationType;
  const targetId = String(fd.get('targetId') ?? '').trim();
  const type = String(fd.get('type') ?? '').trim() as AnalysisType;
  const title = String(fd.get('title') ?? '').trim();
  const revalidate = String(fd.get('revalidate') ?? '').trim();
  if (!TRANSVERSAL_TYPES.has(type))
    return { ok: false, message: 'Elige 5 Porqués o Árbol de Fallas.' };

  let id: string;
  try {
    id = await createLinkedAnalysis(
      session.organizationId,
      session.userId,
      { type, title },
      { relationType, targetId },
    );
  } catch (error) {
    if (error instanceof AnalysisValidationError)
      return { ok: false, message: 'Revisa los datos.', errors: error.errors };
    if (error instanceof AnalysisPermissionError) return { ok: false, message: error.message };
    return { ok: false, message: 'Ocurrió un error.' };
  }
  if (revalidate) revalidatePath(revalidate);
  redirect(`/dashboard/analysis/${id}`);
}
