# DOC-001 — Notas de implementación

Motor de plantillas documentales estructuradas. Ver arquitectura en
`docs/documents/DOCUMENT-ENGINE.md`.

## Resumen

Se transforma el módulo de Documentos en un motor **estructurado por tipo**
reutilizando toda la infraestructura existente (Document/DocumentVersion,
versionado automático, flujo de aprobación, permisos, almacenamiento). Los
documentos nativos estructurados guardan **datos** (`structured_content` JSONB) y
un renderer normalizado deriva la presentación. Se conservan el editor
enriquecido (Documento libre) y el registro de documentos externos.

## Archivos

**Módulos puros nuevos** (`src/features/documents/`): `template-registry.ts`,
`structured-content.ts`, `structured-checksum.ts` (solo servidor), `code.ts`,
`dates.ts`, `structured-render.ts`.

**Servidor**: `src/server/documents.ts` — `createStructuredDocument`,
`getStructuredContent`, `saveStructuredContent`, `proposeDocumentCode`,
`listDocumentAreas`, reserva atómica del código; `createEditorVersion` arrastra
`structured_content`. `src/server/document-workflow.ts` — `submitForReview`
acepta contenido estructurado y valida obligatorios del tipo.

**UI** (`src/app/dashboard/documents/`): `new/editor/page.tsx` (asistente),
`_editor/StructuredCreateWizard.tsx` (pasos 1–2), `_editor/StructuredEditor.tsx`
(editor por tipo), `[documentId]/structured/page.tsx`,
`[documentId]/structured/preview/page.tsx`, `[documentId]/page.tsx` (rutas por
tipo + tarjeta de externo), `editor-actions.ts` (acciones estructuradas).
Estilos en `src/app/globals.css` (bloque DOC-001).

**Datos**: `prisma/schema.prisma` (`DocumentVersion.structuredContent`,
`DocumentCodeCounter`), `prisma/migrations/20260909000000_document_engine/`,
`prisma/seed.ts` (`seedStructuredDocuments`).

**Pruebas**: `tests/documents-structured.test.ts` (26 unit),
`tests/db/document-structured.test.ts` (9 BD).

## Decisiones

- **Columna nueva `structured_content`** en `document_versions` en vez de reutilizar
  `content_json`: éste pasa por el saneador ProseMirror (`sanitizeContent`) y no
  representa datos por tipo. Añadir columna es una migración limpia (0 DROP).
- **Zod no existe** en el repo (§26): se usa el patrón de validadores a mano
  (allowlist), como `validateDocumentMetadata`/`sanitizeContent`. No se agrega
  dependencia.
- **Áreas**: se reutiliza `quality_catalog_values kind='area'` (§6); no se crea un
  módulo de áreas.
- **`structured-checksum.ts` separado**: `structured-content.ts` lo importa el
  editor (cliente); aislar `node:crypto`/`Buffer` evita que el bundle de cliente
  intente resolver builtins de Node (fallaba el build).
- **Editor y renderer guiados por esquema**: un solo componente/renderer para los 9
  tipos estructurados; añadir un tipo es declarar su definición en el registro.
- **Identificación fuera de `structured_content`**: código, área, fechas y versión
  viven en la entidad; el renderer los toma de ahí (sin doble fuente de verdad).

## Migración

`20260909000000_document_engine` — `ALTER TABLE document_versions ADD COLUMN
structured_content JSONB` + `CREATE TABLE document_code_counters` (PK
`org+prefix+area`). SQL complementario: FK de organización, RLS + política
tenant + grants (SELECT/INSERT/UPDATE para el contador atómico), y ampliación de
`fn_guard_published_docversion` para sellar también `structured_content`.
**Inventario: 1 ALTER, 1 CREATE TABLE, 1 CREATE FUNCTION (OR REPLACE), 0 DROP.**
`db:reset:local` reconstruye desde cero y el seed es idempotente (verificado 2×).

## Validaciones

- `format:check` ✅ · `lint` ✅ (solo un warning preexistente ajeno) · `typecheck` ✅
- `npm test` ✅ 455/455 (incluye 35 nuevas) · `test:db` ✅ 155/155 · `build` ✅
- Migración desde cero (`db:reset:local`) ✅ · seed 2× idempotente ✅

## Pruebas manuales (UI)

Verificado en el navegador: asistente Paso 1 (10 tipos) → Paso 2 (código
propuesto `PR-CA-002` tras el seed `PR-CA-001`, periodo 12 meses) → creación →
editor estructurado (Objetivo/Alcance, repetibles con Subir/Bajar/Eliminar y
numeración automática); vista previa normalizada del `PR-CA-001` sembrado
(encabezado C3 Sentinel, identificación, tablas, secciones futuras §10);
documento externo con su tarjeta y acción "Próximamente"; el Documento libre
conserva el editor enriquecido.

## Pendientes / notas

- **Capturas (§41)**: las pantallas se verificaron en vivo, pero el navegador de la
  herramienta no escribe PNG al repositorio; las capturas de
  `docs/ui/screenshots/doc-001/` quedan como paso manual (ver el README de esa
  carpeta con rutas y checklist).
- El guardado por UI puede abortarse bajo Fast Refresh del dev server (HMR); no es
  un defecto del producto: `saveStructuredContent` está cubierto por pruebas de BD.
