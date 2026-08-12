'use server';

/**
 * Server Actions de las herramientas de análisis de calidad (TASK-008).
 * Organización y usuario desde la sesión; permisos validados en la capa de datos.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import { UnsupportedFileError } from '@/server/document-storage';
import {
  AnalysisNotFoundError,
  AnalysisPermissionError,
  AnalysisValidationError,
  addAnalysisComment,
  addAnalysisEvidence,
  addCauseEdge,
  addCauseNode,
  addFmeaRow,
  addIshikawaCategory,
  addParticipant,
  buildParetoFromCapa,
  confirmRecurrence,
  createAnalysis,
  createCapaActionFromAnalysis,
  createHypothesis,
  createNewVersion,
  markNodeRootCause,
  saveConclusion,
  sendRootCauseToCapa,
  setComparativeCases,
  setParetoItems,
  transitionAnalysis,
  updateFmeaRow,
  updateHypothesis,
  updateIshikawaCategory,
} from '@/server/quality-analysis';
import type {
  AnalysisEvidenceEntity,
  AnalysisStatus,
  AnalysisType,
  CauseEdgeRelation,
  CauseNodeType,
  HypothesisStatus,
  QualProbability,
  RecurrenceConfirmation,
} from '@/features/capa/analysis-state';
import type { ActionType, CapaPriority } from '@/features/capa/capa-state';

export interface FormState {
  ok: boolean;
  message: string;
  errors?: string[];
}

function toState(error: unknown): FormState {
  if (error instanceof AnalysisValidationError)
    return { ok: false, message: 'Revisa los datos.', errors: error.errors };
  if (error instanceof AnalysisPermissionError) return { ok: false, message: error.message };
  if (error instanceof AnalysisNotFoundError) return { ok: false, message: error.message };
  if (error instanceof UnsupportedFileError) return { ok: false, message: error.message };
  return { ok: false, message: 'Ocurrió un error al procesar la solicitud.' };
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const opt = (fd: FormData, k: string): string | null => {
  const v = s(fd, k);
  return v === '' ? null : v;
};
const num = (fd: FormData, k: string): number => Number(s(fd, k));

/**
 * Revalida las rutas afectadas. `capaId` es OPCIONAL: los análisis transversales
 * (sin CAPA) se editan en `/dashboard/analysis/[id]`. Siempre se revalida la
 * biblioteca global y, si hay analysisId, el workspace transversal.
 */
function revalidate(capaId: string, analysisId?: string) {
  if (capaId) {
    revalidatePath(`/dashboard/capa/${capaId}/analysis`);
    if (analysisId) revalidatePath(`/dashboard/capa/${capaId}/analysis/${analysisId}`);
    revalidatePath(`/dashboard/capa/${capaId}`);
  }
  if (analysisId) revalidatePath(`/dashboard/analysis/${analysisId}`);
  revalidatePath('/dashboard/capa/analysis');
}

export async function createAnalysisAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  let id: string;
  try {
    id = await createAnalysis(session.organizationId, session.userId, capaId, {
      type: s(fd, 'type') as AnalysisType,
      title: s(fd, 'title'),
      objective: opt(fd, 'objective'),
      scope: opt(fd, 'scope'),
      responsibleUserId: opt(fd, 'responsibleUserId'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId);
  const type = s(fd, 'type');
  // 5 Porqués y FTA se editan en el workspace transversal.
  if (type === '5whys' || type === 'fta') redirect(`/dashboard/analysis/${id}`);
  redirect(`/dashboard/capa/${capaId}/analysis/${id}`);
}

export async function transitionAnalysisAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  try {
    await transitionAnalysis(
      session.organizationId,
      session.userId,
      analysisId,
      s(fd, 'to') as AnalysisStatus,
      {
        comment: opt(fd, 'comment') ?? undefined,
      },
    );
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Estado actualizado.' };
}

export async function addParticipantAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  try {
    await addParticipant(session.organizationId, session.userId, analysisId, s(fd, 'userId'));
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Participante agregado.' };
}

export async function addCategoryAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  try {
    await addIshikawaCategory(session.organizationId, session.userId, analysisId, s(fd, 'name'));
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Categoría agregada.' };
}

export async function updateCategoryAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  try {
    await updateIshikawaCategory(session.organizationId, session.userId, s(fd, 'categoryId'), {
      name: opt(fd, 'name') ?? undefined,
      active: fd.get('active') === null ? undefined : fd.get('active') === 'true',
    });
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Categoría actualizada.' };
}

export async function addHypothesisAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  try {
    await createHypothesis(session.organizationId, session.userId, analysisId, {
      description: s(fd, 'description'),
      ishikawaCategoryId: opt(fd, 'ishikawaCategoryId'),
      category: opt(fd, 'category'),
      probability: (opt(fd, 'probability') as QualProbability) ?? undefined,
      impact: opt(fd, 'impact'),
      evidenceFor: opt(fd, 'evidenceFor'),
      evidenceAgainst: opt(fd, 'evidenceAgainst'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Hipótesis agregada.' };
}

export async function updateHypothesisAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  try {
    await updateHypothesis(session.organizationId, session.userId, s(fd, 'hypothesisId'), {
      status: (opt(fd, 'status') as HypothesisStatus) ?? undefined,
      probability: (opt(fd, 'probability') as QualProbability) ?? undefined,
      conclusion: opt(fd, 'conclusion'),
      justification: opt(fd, 'justification'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Hipótesis actualizada.' };
}

export async function addNodeAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  try {
    await addCauseNode(session.organizationId, session.userId, analysisId, {
      type: s(fd, 'type') as CauseNodeType,
      description: s(fd, 'description'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Nodo agregado.' };
}

export async function addEdgeAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  try {
    await addCauseEdge(session.organizationId, session.userId, analysisId, {
      fromNodeId: s(fd, 'fromNodeId'),
      toNodeId: s(fd, 'toNodeId'),
      relation: s(fd, 'relation') as CauseEdgeRelation,
    });
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Relación agregada.' };
}

export async function markRootCauseAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  try {
    await markNodeRootCause(
      session.organizationId,
      session.userId,
      s(fd, 'nodeId'),
      s(fd, 'justification'),
    );
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Causa raíz propuesta.' };
}

export async function setParetoAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  // Filas: categorias[] y cantidades[] paralelos.
  const cats = fd.getAll('category').map(String);
  const counts = fd.getAll('count').map((v) => Number(v));
  const items = cats
    .map((category, i) => ({ category: category.trim(), count: counts[i] ?? 0 }))
    .filter((it) => it.category !== '');
  try {
    await setParetoItems(session.organizationId, session.userId, analysisId, items);
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Datos de Pareto guardados.' };
}

export async function generateParetoAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  const dimension = s(fd, 'dimension') as
    | 'sourceType'
    | 'severity'
    | 'priority'
    | 'siteId'
    | 'area'
    | 'process';
  try {
    const items = await buildParetoFromCapa(session.organizationId, dimension);
    await setParetoItems(session.organizationId, session.userId, analysisId, items);
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Pareto generado desde CAPA.' };
}

export async function addFmeaRowAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  try {
    await addFmeaRow(session.organizationId, session.userId, analysisId, {
      processStep: opt(fd, 'processStep'),
      failureMode: s(fd, 'failureMode'),
      effect: opt(fd, 'effect'),
      severity: num(fd, 'severity'),
      causePotential: opt(fd, 'causePotential'),
      occurrence: num(fd, 'occurrence'),
      preventionControls: opt(fd, 'preventionControls'),
      detectionControls: opt(fd, 'detectionControls'),
      detection: num(fd, 'detection'),
      recommendedAction: opt(fd, 'recommendedAction'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Fila AMEF agregada.' };
}

export async function updateFmeaRowAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  const numOpt = (k: string) => (s(fd, k) === '' ? undefined : Number(s(fd, k)));
  try {
    await updateFmeaRow(session.organizationId, session.userId, s(fd, 'rowId'), {
      severityPost: numOpt('severityPost'),
      occurrencePost: numOpt('occurrencePost'),
      detectionPost: numOpt('detectionPost'),
      executedAction: opt(fd, 'executedAction'),
      status: opt(fd, 'status'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Fila AMEF actualizada.' };
}

export async function confirmRecurrenceAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  try {
    await confirmRecurrence(session.organizationId, session.userId, analysisId, {
      matchedCapaId: s(fd, 'matchedCapaId'),
      confirmation: s(fd, 'confirmation') as RecurrenceConfirmation,
      justification: s(fd, 'justification'),
      matchReason: opt(fd, 'matchReason'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Recurrencia registrada.' };
}

export async function setComparativeAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  try {
    await setComparativeCases(
      session.organizationId,
      session.userId,
      analysisId,
      fd.getAll('capaIds').map(String),
    );
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Casos comparados actualizados.' };
}

export async function saveConclusionAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  try {
    await saveConclusion(session.organizationId, session.userId, analysisId, {
      summary: opt(fd, 'summary'),
      immediateCause: opt(fd, 'immediateCause'),
      contributingCauses: opt(fd, 'contributingCauses'),
      proposedRootCause: opt(fd, 'proposedRootCause'),
      confirmedRootCause: opt(fd, 'confirmedRootCause'),
      mainEvidence: opt(fd, 'mainEvidence'),
      contradictoryEvidence: opt(fd, 'contradictoryEvidence'),
      limitations: opt(fd, 'limitations'),
      pendingInfo: opt(fd, 'pendingInfo'),
      recurrenceRisk: opt(fd, 'recurrenceRisk'),
      recommendations: opt(fd, 'recommendations'),
    });
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Conclusión guardada.' };
}

export async function createActionFromAnalysisAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  try {
    await createCapaActionFromAnalysis(session.organizationId, session.userId, analysisId, {
      sourceEntity: s(fd, 'sourceEntity'),
      sourceId: opt(fd, 'sourceId'),
      description: s(fd, 'description'),
      actionType: (opt(fd, 'actionType') as ActionType) ?? undefined,
      priority: (opt(fd, 'priority') as CapaPriority) ?? undefined,
    });
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Acción CAPA creada.' };
}

export async function sendRootCauseAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  try {
    await sendRootCauseToCapa(session.organizationId, session.userId, analysisId);
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Causa raíz enviada a la CAPA.' };
}

export async function newVersionAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  let newId: string;
  try {
    newId = await createNewVersion(session.organizationId, session.userId, analysisId);
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  redirect(`/dashboard/capa/${capaId}/analysis/${newId}`);
}

export async function addAnalysisCommentAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  try {
    await addAnalysisComment(session.organizationId, session.userId, analysisId, s(fd, 'body'));
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Comentario agregado.' };
}

export async function uploadAnalysisEvidenceAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  const capaId = s(fd, 'capaId');
  const analysisId = s(fd, 'analysisId');
  const f = fd.get('file');
  if (!(f instanceof File) || f.size === 0) return { ok: false, message: 'Selecciona un archivo.' };
  try {
    await addAnalysisEvidence(session.organizationId, session.userId, analysisId, {
      entityType: (s(fd, 'entityType') as AnalysisEvidenceEntity) || 'analysis',
      evidenceType: opt(fd, 'evidenceType'),
      originalName: f.name,
      mimeType: f.type || 'application/octet-stream',
      data: Buffer.from(await f.arrayBuffer()),
    });
  } catch (e) {
    return toState(e);
  }
  revalidate(capaId, analysisId);
  return { ok: true, message: 'Evidencia adjuntada.' };
}
