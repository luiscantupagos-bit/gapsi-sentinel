'use server';

/**
 * Server Action de copias controladas de salida (DOC-UX-002 §67-78). Genera el
 * registro de copia (folio, destino/motivo) ANTES de abrir el diálogo de
 * impresión y devuelve la ruta de la salida controlada. Solo versiones publicadas.
 */
import { requireServerSession } from '@/server/session';
import { createControlledCopyOutput, DocumentValidationError } from '@/server/documents';

export interface CopyActionState {
  ok: boolean;
  message: string;
  redirectTo?: string;
  errors?: string[];
}

export async function prepareControlledCopyAction(
  _prev: CopyActionState | null,
  formData: FormData,
): Promise<CopyActionState> {
  const session = await requireServerSession();
  const documentId = String(formData.get('documentId') ?? '');
  const versionId = String(formData.get('versionId') ?? '');
  const copyType = String(formData.get('copyType') ?? '') === 'pdf' ? 'pdf' : 'print';
  try {
    const res = await createControlledCopyOutput(session.organizationId, session.userId, {
      documentId,
      versionId,
      copyType,
      destinationAreaCode: formData.get('destinationAreaCode')?.toString() ?? null,
      reason: formData.get('reason')?.toString() ?? null,
    });
    return {
      ok: true,
      message: `Copia controlada ${res.folio} generada.`,
      redirectTo: `/dashboard/documents/${encodeURIComponent(documentId)}/copy?copyId=${encodeURIComponent(res.id)}`,
    };
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return {
        ok: false,
        message: 'No se pudo generar la copia controlada.',
        errors: error.errors,
      };
    }
    return { ok: false, message: 'No se pudo generar la copia controlada.' };
  }
}
