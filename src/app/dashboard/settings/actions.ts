'use server';

/** Server Action de configuración general del negocio (DOC-UX-003 §12). */
import { revalidatePath } from 'next/cache';
import { requireServerSession } from '@/server/session';
import { setOrganizationProfile, profileFromForm } from '@/server/organization';

export interface ProfileState {
  ok: boolean;
  message: string;
}

export async function saveOrganizationProfileAction(
  _prev: ProfileState | null,
  formData: FormData,
): Promise<ProfileState> {
  const session = await requireServerSession();
  try {
    await setOrganizationProfile(session.organizationId, session.userId, profileFromForm(formData));
  } catch {
    return { ok: false, message: 'No se pudo guardar la configuración del negocio.' };
  }
  revalidatePath('/dashboard/settings');
  return { ok: true, message: 'Configuración del negocio guardada.' };
}
