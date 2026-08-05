'use server';

/**
 * Server Actions del detalle del diagnóstico (TASK-003).
 *
 * La organización y el usuario se resuelven SIEMPRE desde la sesión de servidor;
 * el `diagnosticId` del formulario se valida contra la organización activa en la
 * capa de datos (un id de otra organización se resuelve como "no encontrado").
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  DiagnosticNotEditableError,
  DiagnosticNotFoundError,
  InvalidAnswerError,
  SubmitValidationError,
  saveAnswers,
  submitDiagnostic,
  type AnswerInput,
} from '@/server/diagnostics';

export interface ActionState {
  ok: boolean;
  message: string;
  errors?: string[];
}

function humanError(error: unknown): string {
  if (
    error instanceof DiagnosticNotFoundError ||
    error instanceof DiagnosticNotEditableError ||
    error instanceof InvalidAnswerError
  ) {
    return error.message;
  }
  return 'Ocurrió un error al procesar la solicitud.';
}

function parseAnswers(formData: FormData): AnswerInput[] {
  const inputs: AnswerInput[] = [];
  for (const [key, rawValue] of formData.entries()) {
    const value = String(rawValue);
    if (key.startsWith('answer_')) {
      const questionId = key.slice('answer_'.length);
      if (value === 'na') {
        inputs.push({
          questionId,
          status: 'not_applicable',
          naJustification: String(formData.get(`na_${questionId}`) ?? ''),
        });
      } else if (value.startsWith('opt:')) {
        inputs.push({
          questionId,
          status: 'answered',
          selectedOptionId: value.slice('opt:'.length),
        });
      }
    } else if (key.startsWith('text_')) {
      const questionId = key.slice('text_'.length);
      inputs.push({ questionId, status: 'answered', valueText: value });
    }
  }
  return inputs;
}

export async function saveAnswersAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireServerSession();
  const diagnosticId = String(formData.get('diagnosticId') ?? '');
  try {
    await saveAnswers(session.organizationId, session.userId, diagnosticId, parseAnswers(formData));
    revalidatePath(`/dashboard/diagnostics/${diagnosticId}`);
    return { ok: true, message: 'Avance guardado correctamente.' };
  } catch (error) {
    return { ok: false, message: humanError(error) };
  }
}

export async function submitDiagnosticAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireServerSession();
  const diagnosticId = String(formData.get('diagnosticId') ?? '');
  try {
    await submitDiagnostic(session.organizationId, session.userId, diagnosticId);
  } catch (error) {
    if (error instanceof SubmitValidationError) {
      return {
        ok: false,
        message: 'No se puede enviar: faltan respuestas obligatorias.',
        errors: error.missing,
      };
    }
    return { ok: false, message: humanError(error) };
  }
  revalidatePath(`/dashboard/diagnostics/${diagnosticId}`);
  redirect(`/dashboard/diagnostics/${diagnosticId}/results`);
}
