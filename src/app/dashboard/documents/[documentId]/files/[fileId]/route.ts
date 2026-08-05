/**
 * Descarga protegida de archivos documentales (TASK-004).
 *
 * Ruta bajo `/dashboard` (protegida por el middleware). El archivo se resuelve
 * con scoping por organización: un archivo de otra organización devuelve 404.
 * No expone URLs públicas ni sirve por nombre original.
 */
import type { NextRequest } from 'next/server';
import { requireServerSession } from '@/server/session';
import { DocumentNotFoundError, getFileForDownload } from '@/server/documents';
import { readDocumentFile } from '@/server/document-storage';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string; fileId: string }> },
) {
  const session = await requireServerSession();
  const { fileId } = await params;

  let file;
  try {
    file = await getFileForDownload(session.organizationId, fileId);
  } catch (error) {
    if (error instanceof DocumentNotFoundError) {
      return new Response('Archivo no encontrado.', { status: 404 });
    }
    throw error;
  }

  const data = await readDocumentFile(session.organizationId, file.storageKey);
  const safeName = file.originalName.replace(/["\\\r\n]/g, '_');
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
