/**
 * Cliente Prisma y contexto de organización para RLS.
 *
 * La construcción es diferida (`getPrisma()`) para que importar este módulo no
 * abra conexión ni exija `DATABASE_URL` (necesario para que las pruebas que no
 * usan BD no fallen al importar).
 */
import { PrismaClient, type Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Ejecuta `fn` dentro de una transacción con el **contexto de organización**
 * fijado para las políticas RLS. Establece `app.current_org` como variable LOCAL
 * (válida solo en la transacción) mediante `set_config(..., true)`, de forma
 * parametrizada (sin interpolar el id en el SQL).
 *
 * La aplicación debe conectarse con el rol NO propietario `gapsi_app` para que
 * RLS aplique (el propietario del esquema la omite). Ver IMPLEMENTATION-NOTES.
 */
export async function withOrgContext<T>(
  organizationId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org', ${organizationId}, true)`;
    return fn(tx);
  });
}
