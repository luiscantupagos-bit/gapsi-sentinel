# DOC-UX-001 — Notas de implementación

Normalización documental, branding y biblioteca por áreas. Arquitectura en
`docs/documents/DOCUMENT-PRESENTATION.md` y `docs/documents/DOCUMENT-LIBRARY.md`.

## Resumen

Tres frentes sobre la capa de presentación (sin tocar el motor de datos DOC-001
ni las referencias DOC-002):

1. **Branding visible C3 Sentinel** — favicon, marca "S", sidebar, login, título y
   landing. Sin rename técnico masivo (repo/tablas/migraciones/vars internas
   permanecen).
2. **Normalización documental** — procedimiento sin Evidencia/Observaciones,
   encabezado con marca del cliente, pie de confidencialidad con atribución
   discreta de C3, tema documental por organización, control de cambios
   automático, modos editor/publicado.
3. **Biblioteca por áreas** — dashboard con KPIs, carpetas de área→tipo, listado
   maestro con filtros.

## Archivos

**Branding** (cherry-pick `26e0b51`, sin el wordmark): `src/app/favicon.ico`,
`public/logo.png`, `.gitattributes`, `AppSidebar.tsx`, `login/page.tsx`,
`layout.tsx` (title), `page.tsx` (landing). Commit `4940192`.

**Pure (`src/features/documents/`)**: `structured-render.ts` (reescrito:
`RenderOptions`, header con marca de organización, footer C3, modos
editor/publicado, `safeHex`, `themeStyle`, `renderChangeLog`),
`template-registry.ts` (PROCEDURE sin `evidencia`/`observaciones`),
`document-theme.ts` (nuevo: HEX-only).

**Servidor**: `documents.ts` (`getDocumentTheme`, `setDocumentTheme`,
`buildChangeLog`, `getDocumentLibrary`, `getAreaByCode`, `getAreaTypeCounts`;
`getStructuredContent` integra tema+changeLog+modo; `listDocuments` amplía
`DocumentFilters` con `statusGroup`/`area` y devuelve `ownerArea`),
`document-workflow.ts` (`change_notes` obligatorio solo si `label !==
INITIAL_VERSION_LABEL`).

**UI (`src/app/dashboard/documents/`)**: `page.tsx` (biblioteca),
`area/[areaCode]/page.tsx`, `area/[areaCode]/[type]/page.tsx`, `master/page.tsx`,
`_components/DocumentsTable.tsx`, `settings/page.tsx`, `settings-actions.ts`,
`_components/DocumentThemeForm.tsx`. Estilos en `globals.css` (bloque
DOC-UX-001).

**Datos**: `prisma/schema.prisma` (`model DocumentTheme` → `document_themes`),
`prisma/migrations/20260911000000_document_presentation/`, `prisma/seed.ts`
(upsert de tema para ORG_A).

**Pruebas**: `tests/documents-presentation.test.ts` (9),
`tests/db/document-presentation.test.ts` (5, casos A/B/F-G/control de cambios);
actualizadas `documents-structured.test.ts` y `documents-references.test.ts` por
la nueva firma del renderer.

## Decisiones

- **Marca del cliente en el header, C3 en el pie** (§11/§16): el documento es del
  cliente; C3 Sentinel aparece como atribución discreta, nunca como marca
  principal del documento.
- **Sin rename técnico masivo** (§2/§5): solo se cambia el nombre **visible** a
  "C3 Sentinel". Repo, tablas, migraciones y variables internas conservan
  `gapsi`/`sentinel` para no romper historia ni datos.
- **Tema en tabla dedicada** `document_themes` (PK `organization_id`): sigue el
  patrón de RLS/grants de la casa; se prefirió a una columna en `Organization`
  por certeza sobre grants.
- **Solo HEX validado** (§22): `safeHex`/`sanitizeDocumentTheme` evitan inyección
  CSS; un color inválido cae al default. El tema se aplica **solo al render del
  documento**, no al tema global de la app.
- **Retrocompat sin migración destructiva** (§7): el saneador descarta
  `evidencia`/`observaciones` al guardar, pero el dato legacy sobrevive en reposo;
  lector tolera, renderer no muestra. 0 DROP TABLE/COLUMN.
- **`change_notes` obligatorio solo > v1.0** (§44): se relaja el requisito
  siempre-obligatorio de DOC-001 para la versión inicial.
- **Modos de render** (§50-54): `published_document` omite opcionales vacíos;
  `editor_preview` muestra andamiaje de edición.
- **Áreas desde el catálogo** (§26): `quality_catalog_values` `kind='area'`,
  activas, tenant-scoped, se muestran con 0 documentos.

## Migración

`20260911000000_document_presentation`: `CREATE TABLE document_themes` + FK
`dth_org_fkey` + RLS (DO-loop con `fn_current_org`) + grants
SELECT/INSERT/UPDATE a `gapsi_app`. **Inventario: 0 DROP de tabla/columna.**
Aplicada y verificada con `db:reset:local` desde cero + seed 2× idempotente.

## Validaciones

- `format:check` ✅ · `lint` ✅ (solo el warning preexistente ajeno en
  `analytics/actions.ts:130`) · `typecheck` ✅
- `npm test` ✅ 495/495 (incluye 14 nuevas) · `test:db` ✅ 170/170 (2 reruns
  limpios) · `build` ✅
- `db:reset:local` desde cero ✅ · seed 2× idempotente ✅

### Nota sobre flakiness (§75)

En una corrida de `npm test` intermedia fallaron 2 pruebas **preexistentes y
ajenas** (`tests/db/capa-lifecycle.test.ts`, `tests/db/quality-analysis.test.ts`)
por la flakiness transitoria conocida de Windows/Docker (ráfaga del port-proxy —
ver `CORE-MAINT-001`). Se distinguió infraestructura de fallo lógico: 2 reruns de
`test:db` pasaron 170/170 y `npm test` completo pasó 495/495. Ninguna prueba de
DOC-UX-001 falló.

## Pruebas manuales (UI) — pendientes de captura

- Procedimiento químico: columnas Evidencia/Observaciones ausentes, control de
  cambios visible, header con marca de organización y pie C3.
- Biblioteca: KPIs, carpetas de área→tipo, listado maestro con filtros.
- Configuración documental: 3 colores + vista previa en vivo.

Las capturas a `docs/ui/screenshots/` quedan como verificación manual (el
navegador del agente no escribe PNG al repo).

## Fuera de alcance (no implementado)

DOC-003 (programas ejecutables — congelado aparte), notificaciones, IA, OCR,
Microsoft/Google, DOC-004, TASK-012.
