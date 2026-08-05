# TASK-004 — Notas de implementación (gestión documental básica)

Primer módulo documental visible y conectado a PostgreSQL. **No** incluye editor
tipo Word, generación de documentos, firmas, aprobación multinivel ni exportación
a PDF (fuera de alcance).

## Alcance implementado

Listado maestro, registro de documentos (internos/externos), carga local de
archivos y anexos, detalle, control de código/versión/responsable/estado/vigencia,
relaciones opcionales con sitio/marco/requisito/diagnóstico/otro documento,
historial append-only, versión vigente única, descarga protegida y resumen
documental en el dashboard.

## Modelo documental

- `documents` — código, título, tipo, origen, estado, versión vigente, sitio,
  responsable, confidencialidad, fechas (emisión/vigor/próxima revisión/
  obsolescencia), `archived_at`.
- `document_versions` — etiqueta, notas, estado, `is_current` (única vigente por
  documento), autor, publicación.
- `document_files` — metadatos del archivo (nombre original/almacenado, MIME,
  tamaño, extensión, `storage_key`, checksum, `main`/`attachment`). Los binarios
  **no** se guardan en PostgreSQL.
- `document_relations` — relación opcional con sitio/marco/requisito/diagnóstico/
  otro documento (FK compuestas anti-cruce por relación).
- `document_history` — append-only (documento creado, metadatos, archivo,
  versión, estado, archivado).

## Migración creada

`prisma/migrations/20260805022844_documents/` (nueva; **no** se modificaron
migraciones anteriores). Incluye: tablas + FK compuestas padre-hijo (Prisma) y
SQL complementario (FKs a organizations/users, FK compuestas anti-cruce a
sites/frameworks/requirements/diagnostics/documents, CHECK de enums y de fechas,
único parcial de versión vigente, trigger de versión publicada, append-only del
historial, prohibición de borrado físico, y RLS + grants para `gapsi_app`).

## Rutas

- `/dashboard/documents` — listado maestro (búsqueda + filtros por tipo/estado/
  sitio/origen + orden).
- `/dashboard/documents/new` — registro.
- `/dashboard/documents/[documentId]` — detalle (archivos, versiones, historial,
  acciones).
- `/dashboard/documents/[documentId]/edit` — edición de metadatos.
- `/dashboard/documents/[documentId]/files/[fileId]` — descarga protegida (GET).

## Almacenamiento local

`src/server/document-storage.ts`: carpeta **no versionada** `storage/documents/`
(configurable con `DOCUMENTS_STORAGE_DIR`), nombre almacenado seguro (UUID +
extensión), validación de extensión/MIME/tamaño, checksum SHA-256, aislamiento
por organización y protección contra path traversal. Nunca ejecuta el contenido.
No usa S3/Supabase/Azure/GCP.

- **Formatos permitidos:** PDF, DOC, DOCX, XLS, XLSX, PNG, JPG/JPEG.
- **Tamaño máximo:** 10 MB por defecto, configurable con
  `DOCUMENTS_MAX_UPLOAD_BYTES`.

## Seguridad y RLS

- `organization_id` en todas las tablas documentales; la organización se resuelve
  desde la sesión (nunca del navegador).
- FK compuestas anti-cruce impiden relacionar con sitio/diagnóstico/requisito/
  archivo/documento de otra organización (error saneado a mensaje claro).
- RLS por organización (política `organization_id = fn_current_org()`); la app
  debe conectar como `gapsi_app`. Escrituras dentro de `withOrgContext`.
- Descarga protegida bajo `/dashboard` (middleware) con scoping por organización.

## Pruebas

- Unitarias `tests/documents-catalog.test.ts`: validación de metadatos, fechas,
  extensión/MIME/tamaño, vencimiento.
- Integración `tests/db/document-access.test.ts` (15): creación válida, código
  único por organización, mismo código en organizaciones distintas, rechazo de
  sitio/diagnóstico/archivo/versión de otra organización, **RLS**, creación de
  versión, versión vigente única, historial append-only, borrado físico
  bloqueado, validación de fechas, extensión no permitida, archivado no editable,
  apertura y descarga cruzadas rechazadas.

## Pasos de prueba manual

1. `npm run db:up && npm run db:migrate && npm run db:seed`.
2. `npm run dev` → `http://localhost:3000`, entrar con el usuario demo.
3. Menú lateral → **Documentos**: ver el listado del seed; usar búsqueda/filtros.
4. **Nuevo documento**: capturar, subir un PDF (permitido) y probar un `.exe`
   (rechazado).
5. Abrir el detalle, **Descargar** el archivo, **Agregar anexo**, **Crear
   versión**, revisar **Historial**.
6. Ver el resumen documental en el dashboard.

## Limitaciones

- Estados administrados de forma básica (sin flujo formal de revisión/aprobación).
- "Documento archivado no editable" se aplica en la capa de servidor.
- La app conecta como owner de la BD; RLS se prueba con `SET ROLE gapsi_app`.

## Pendientes para TASK-005 / TASK-006

- Flujo de revisión y aprobación (multinivel, firmas, confirmación de lectura).
- Comparación entre versiones y distribución controlada.
- Editor en línea / generación y exportación a PDF.
- Relaciones documentales enriquecidas desde la interfaz.
