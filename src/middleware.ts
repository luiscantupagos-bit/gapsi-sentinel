/**
 * Guard de autorización ejecutado EN SERVIDOR (edge runtime).
 *
 * Protege las rutas privadas: si un usuario anónimo intenta acceder a
 * `/dashboard`, se le redirige a `/login`. La validación nunca depende del
 * cliente (ver AGENTS.md §5).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authProvider, SESSION_COOKIE_NAME } from '@/features/auth';

/** Prefijos de ruta que requieren sesión válida. */
const PROTECTED_PREFIXES = ['/dashboard'];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = authProvider.getSession(token);

  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
