'use server';

/**
 * Acciones de servidor del adaptador de desarrollo.
 *
 * Permiten iniciar y cerrar una sesión SIMULADA para demostrar el acceso
 * protegido en local. No representan autenticación real y se reemplazarán por
 * un proveedor verdadero en una tarea futura.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { encodeDevToken, SESSION_COOKIE_NAME, type Session } from '@/features/auth';

/** Sesión de demostración usada por el flujo de desarrollo. */
const DEMO_SESSION: Session = {
  userId: 'dev-user',
  organizationId: 'demo-org',
  role: 'owner',
};

export async function devSignIn(formData: FormData): Promise<void> {
  const target = (formData.get('from') as string | null) ?? '/dashboard';
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, encodeDevToken(DEMO_SESSION), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
  // Solo permite redirecciones internas para evitar open-redirect.
  redirect(target.startsWith('/') ? target : '/dashboard');
}

export async function devSignOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect('/');
}
