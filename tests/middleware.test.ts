import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { SESSION_COOKIE_NAME } from '@/features/auth';
import { encodeDevToken } from '@/features/auth/dev-provider';

function requestFor(path: string): NextRequest {
  return new NextRequest(new URL(`http://localhost${path}`));
}

describe('middleware (acceso protegido)', () => {
  it('redirige a /login a un usuario anónimo que pide /dashboard', () => {
    const response = middleware(requestFor('/dashboard'));

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).not.toBeNull();
    expect(new URL(location as string).pathname).toBe('/login');
  });

  it('deja pasar a un usuario con sesión válida', () => {
    const request = requestFor('/dashboard');
    request.cookies.set(
      SESSION_COOKIE_NAME,
      encodeDevToken({ userId: 'u1', organizationId: 'org-1', role: 'owner' }),
    );

    const response = middleware(request);

    expect(response.headers.get('location')).toBeNull();
    // NextResponse.next() marca la respuesta para continuar la cadena.
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('rechaza una cookie de sesión con formato inválido', () => {
    const request = requestFor('/dashboard');
    request.cookies.set(SESSION_COOKIE_NAME, 'no-es-un-token-valido');

    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location') as string).pathname).toBe('/login');
  });
});
