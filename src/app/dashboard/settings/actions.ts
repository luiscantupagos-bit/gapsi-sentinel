'use server';

/** Server Action de configuración general del negocio (DOC-UX-003 §12). */
import { revalidatePath } from 'next/cache';
import { requireServerSession } from '@/server/session';
import { setOrganizationProfile, profileFromForm } from '@/server/organization';
import { updateOrganizationCompliancePolicy, CompliancePolicyError } from '@/server/compliance';

export interface ProfileState {
  ok: boolean;
  message: string;
}

export interface CompliancePolicyState {
  ok: boolean;
  message: string;
}

/** CORE-UX-005: guarda el semáforo global de cumplimiento de la organización. */
export async function saveCompliancePolicyAction(
  _prev: CompliancePolicyState | null,
  formData: FormData,
): Promise<CompliancePolicyState> {
  const session = await requireServerSession();
  const num = (k: string) => Number(String(formData.get(k) ?? ''));
  const str = (k: string) => String(formData.get(k) ?? '').trim();
  try {
    await updateOrganizationCompliancePolicy(session.organizationId, session.userId, {
      greenMin: num('greenMin'),
      yellowMin: num('yellowMin'),
      orangeMin: num('orangeMin'),
      green: str('greenColor'),
      yellow: str('yellowColor'),
      orange: str('orangeColor'),
      red: str('redColor'),
    });
  } catch (error) {
    if (error instanceof CompliancePolicyError) {
      return { ok: false, message: error.errors.join(' ') };
    }
    return { ok: false, message: 'No se pudo guardar el semáforo de cumplimiento.' };
  }
  // Revalida las vistas que consumen la política (§21).
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard/diagnostics');
  return { ok: true, message: 'Semáforo de cumplimiento guardado.' };
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
