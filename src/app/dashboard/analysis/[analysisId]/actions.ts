'use server';

/**
 * Server Actions del workspace transversal de análisis (Fase 5). Cubre el Árbol
 * de Fallas (FTA), los 5 Porqués, la conclusión humana y las relaciones con
 * otros orígenes. Organización y usuario desde la sesión; permisos y existencia
 * validados en la capa de datos.
 */
import { revalidatePath } from 'next/cache';
import { requireServerSession } from '@/server/session';
import {
  AnalysisPermissionError,
  AnalysisValidationError,
  addFtaNode,
  attachAnalysisRelation,
  createHypothesis,
  deleteFtaNode,
  detachAnalysisRelation,
  saveConclusion,
  updateFtaNode,
  updateHypothesis,
  type RelationType,
} from '@/server/quality-analysis';
import type { FtaNodeType, GateType } from '@/features/analysis/fta';

export interface FormState {
  ok: boolean;
  message: string;
  errors?: string[];
}

function toState(error: unknown): FormState {
  if (error instanceof AnalysisValidationError)
    return { ok: false, message: 'Revisa los datos.', errors: error.errors };
  if (error instanceof AnalysisPermissionError) return { ok: false, message: error.message };
  return { ok: false, message: 'Ocurrió un error al procesar la solicitud.' };
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const opt = (fd: FormData, k: string) => s(fd, k) || null;
const revalidate = (analysisId: string) => revalidatePath(`/dashboard/analysis/${analysisId}`);

// --- FTA ---------------------------------------------------------------------

export async function addFtaNodeAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const analysisId = s(fd, 'analysisId');
  try {
    await addFtaNode(session.organizationId, session.userId, analysisId, {
      parentId: opt(fd, 'parentId'),
      nodeType: s(fd, 'nodeType') as FtaNodeType,
      gateType: (opt(fd, 'gateType') as GateType | null) ?? null,
      label: s(fd, 'label'),
      description: opt(fd, 'description'),
      notes: opt(fd, 'notes'),
    });
  } catch (error) {
    return toState(error);
  }
  revalidate(analysisId);
  return { ok: true, message: 'Nodo agregado.' };
}

export async function updateFtaNodeAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const analysisId = s(fd, 'analysisId');
  try {
    await updateFtaNode(session.organizationId, session.userId, s(fd, 'nodeId'), {
      label: fd.has('label') ? s(fd, 'label') : undefined,
      description: fd.has('description') ? opt(fd, 'description') : undefined,
      notes: fd.has('notes') ? opt(fd, 'notes') : undefined,
      gateType: fd.has('gateType') ? ((opt(fd, 'gateType') as GateType | null) ?? null) : undefined,
    });
  } catch (error) {
    return toState(error);
  }
  revalidate(analysisId);
  return { ok: true, message: 'Nodo actualizado.' };
}

export async function deleteFtaNodeAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const analysisId = s(fd, 'analysisId');
  try {
    await deleteFtaNode(session.organizationId, session.userId, s(fd, 'nodeId'));
  } catch (error) {
    return toState(error);
  }
  revalidate(analysisId);
  return { ok: true, message: 'Nodo eliminado.' };
}

// --- 5 Porqués (reutiliza hipótesis encadenadas) -----------------------------

export async function addWhyAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const analysisId = s(fd, 'analysisId');
  try {
    await createHypothesis(session.organizationId, session.userId, analysisId, {
      description: s(fd, 'statement'),
      parentHypothesisId: opt(fd, 'parentHypothesisId'),
      sourceTool: '5whys',
      evidenceFor: opt(fd, 'evidence'),
    });
  } catch (error) {
    return toState(error);
  }
  revalidate(analysisId);
  return { ok: true, message: 'Nivel agregado.' };
}

export async function updateWhyAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const analysisId = s(fd, 'analysisId');
  try {
    await updateHypothesis(session.organizationId, session.userId, s(fd, 'hypothesisId'), {
      evidenceFor: fd.has('evidence') ? opt(fd, 'evidence') : undefined,
      conclusion: fd.has('note') ? opt(fd, 'note') : undefined,
    });
  } catch (error) {
    return toState(error);
  }
  revalidate(analysisId);
  return { ok: true, message: 'Nivel actualizado.' };
}

export async function discardWhyAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const analysisId = s(fd, 'analysisId');
  try {
    await updateHypothesis(session.organizationId, session.userId, s(fd, 'hypothesisId'), {
      status: 'discarded',
    });
  } catch (error) {
    return toState(error);
  }
  revalidate(analysisId);
  return { ok: true, message: 'Nivel retirado.' };
}

// --- Conclusión humana -------------------------------------------------------

export async function saveConclusionAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const analysisId = s(fd, 'analysisId');
  try {
    await saveConclusion(session.organizationId, session.userId, analysisId, {
      summary: opt(fd, 'summary'),
      proposedRootCause: opt(fd, 'proposedRootCause'),
      recommendations: opt(fd, 'recommendations'),
    });
  } catch (error) {
    return toState(error);
  }
  revalidate(analysisId);
  return { ok: true, message: 'Conclusión guardada.' };
}

// --- Relaciones --------------------------------------------------------------

export async function attachRelationAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const analysisId = s(fd, 'analysisId');
  try {
    await attachAnalysisRelation(session.organizationId, session.userId, analysisId, {
      relationType: s(fd, 'relationType') as RelationType,
      targetId: s(fd, 'targetId'),
      note: opt(fd, 'note'),
    });
  } catch (error) {
    return toState(error);
  }
  revalidate(analysisId);
  return { ok: true, message: 'Relación agregada.' };
}

export async function detachRelationAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const analysisId = s(fd, 'analysisId');
  try {
    await detachAnalysisRelation(session.organizationId, session.userId, s(fd, 'relationId'));
  } catch (error) {
    return toState(error);
  }
  revalidate(analysisId);
  return { ok: true, message: 'Relación quitada.' };
}
