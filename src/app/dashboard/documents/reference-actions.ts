'use server';

/**
 * Server Actions de referencias inteligentes (DOC-002).
 * La organización y el usuario provienen de la sesión; documentId/versionId se
 * validan contra la organización en la capa de datos.
 */
import { revalidatePath } from 'next/cache';
import { requireServerSession } from '@/server/session';
import {
  DocumentNotEditableError,
  DocumentNotFoundError,
  DocumentValidationError,
  issueFormFromDocument,
  searchDocumentsForMention,
  type MentionResult,
} from '@/server/documents';

/** Busca documentos para el autocompletado de `@` (§7/§32). */
export async function searchMentionsAction(input: {
  query: string;
  excludeDocumentId?: string;
}): Promise<MentionResult[]> {
  const session = await requireServerSession();
  return searchDocumentsForMention(session.organizationId, input.query ?? '', {
    excludeDocumentId: input.excludeDocumentId,
    limit: 12,
  });
}

export interface IssueFormResult {
  ok: boolean;
  message: string;
  errors?: string[];
  form?: { documentId: string; code: string; title: string; relationId: string };
}

/** Emite un formato (`//`) desde un documento origen y devuelve sus datos. */
export async function issueFormAction(input: {
  sourceDocumentId: string;
  sourceVersionId: string;
  title: string;
  areaCode?: string | null;
  areaName?: string | null;
  proposito?: string | null;
  code?: string | null;
  codeIsCustom?: boolean;
}): Promise<IssueFormResult> {
  const session = await requireServerSession();
  try {
    const form = await issueFormFromDocument(
      session.organizationId,
      session.userId,
      input.sourceDocumentId,
      input.sourceVersionId,
      {
        title: input.title,
        areaCode: input.areaCode,
        areaName: input.areaName,
        proposito: input.proposito,
        code: input.code,
        codeIsCustom: input.codeIsCustom,
      },
    );
    revalidatePath(`/dashboard/documents/${input.sourceDocumentId}`);
    return { ok: true, message: `Formato ${form.code} creado como borrador.`, form };
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return { ok: false, message: 'Corrige los errores.', errors: error.errors };
    }
    if (error instanceof DocumentNotEditableError || error instanceof DocumentNotFoundError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: 'No se pudo emitir el formato.' };
  }
}
