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
import type { AnalysisType } from '@/features/capa/analysis-state';

export interface FormState {
  ok: boolean;
  message: string;
  errors?: string[];
}

const INDEPENDENT_TYPES = new Set<AnalysisType>(['5whys', 'fta']);

export async function createIndependentAnalysisAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const type = String(fd.get('type') ?? '').trim() as AnalysisType;
  const title = String(fd.get('title') ?? '').trim();
  if (!INDEPENDENT_TYPES.has(type))
    return { ok: false, message: 'Selecciona 5 Porqués o Árbol de Fallas.' };
  let id: string;
  try {
    id = await createIndependentAnalysis(session.organizationId, session.userId, { type, title });
  } catch (error) {
    if (error instanceof AnalysisValidationError)
      return { ok: false, message: 'Revisa los datos.', errors: error.errors };
    if (error instanceof AnalysisPermissionError) return { ok: false, message: error.message };
    return { ok: false, message: 'Ocurrió un error.' };
  }
  revalidatePath('/dashboard/capa/analysis');
  redirect(`/dashboard/analysis/${id}`);
}
