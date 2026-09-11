/**
 * Descarga autorizada de archivos (PLATFORM-002 §21). Nunca expone `storageKey` ni
 * el proveedor: valida la sesión/organización y, según el proveedor, hace streaming
 * (local) o redirige a una URL firmada corta (S3/R2). No revela detalles internos.
 */
import { NextResponse } from 'next/server';
import { requireServerSession } from '@/server/session';
import { getDownloadTarget, FileNotFoundError, FileAccessError } from '@/server/files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await ctx.params;
  let session;
  try {
    session = await requireServerSession();
  } catch {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  try {
    const target = await getDownloadTarget(session.organizationId, fileId);
    if (target.kind === 'redirect') {
      return NextResponse.redirect(target.url);
    }
    const body = new Uint8Array(target.bytes);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': target.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(target.filename)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if (error instanceof FileNotFoundError || error instanceof FileAccessError) {
      // No distinguir «no existe» de «sin acceso» (no filtrar existencia, §53).
      return NextResponse.json({ error: 'Archivo no disponible.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'No fue posible obtener el archivo.' }, { status: 500 });
  }
}
