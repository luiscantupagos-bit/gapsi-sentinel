'use server';

/** Server Action de configuración documental (DOC-UX-001/002). */
import { revalidatePath } from 'next/cache';
import { requireServerSession } from '@/server/session';
import { DocumentValidationError, setDocumentTheme } from '@/server/documents';

export interface ThemeState {
  ok: boolean;
  message: string;
  errors?: string[];
}

export async function saveDocumentThemeAction(
  _prev: ThemeState | null,
  formData: FormData,
): Promise<ThemeState> {
  const session = await requireServerSession();
  try {
    // La atribución solo puede ocultarse si el entitlement lo permite; el guard
    // real está en setDocumentTheme (server-side §84/§110). El checkbox marca
    // "mostrar": ausente = false.
    await setDocumentTheme(session.organizationId, session.userId, {
      primary: String(formData.get('primary') ?? '').trim(),
      secondary: String(formData.get('secondary') ?? '').trim(),
      accent: String(formData.get('accent') ?? '').trim(),
      text: String(formData.get('text') ?? '').trim(),
      heading: String(formData.get('heading') ?? '').trim(),
      designId: String(formData.get('designId') ?? '').trim(),
      showC3Attribution: formData.get('showC3Attribution') === 'on',
      dateFormat: String(formData.get('dateFormat') ?? '').trim(),
    });
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return { ok: false, message: 'Corrige los colores.', errors: error.errors };
    }
    return { ok: false, message: 'No se pudo guardar la apariencia documental.' };
  }
  revalidatePath('/dashboard/documents/settings');
  return { ok: true, message: 'Apariencia documental guardada.' };
}
