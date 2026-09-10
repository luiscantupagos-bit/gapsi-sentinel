/**
 * Health check (PLATFORM-001 §32). Indica que la aplicación está viva y, de forma
 * segura, si hay conectividad con la BD y si la configuración mínima del entorno
 * está presente. NO revela stack traces, credenciales, versiones sensibles ni
 * información de tenant.
 */
import { NextResponse } from 'next/server';
import { getPrisma } from '@/server/db';
import { envReport } from '@/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let db = false;
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false; // no se expone el detalle del error
  }

  const env = envReport();
  const status = db ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      status,
      app: 'alive',
      db,
      env: { scope: env.scope, configOk: env.ok, missingRequired: env.missingRequired.length },
      time: new Date().toISOString(),
    },
    { status: db ? 200 : 503 },
  );
}
