# DOC-UX-003 — Notas de implementación

Pulido de la UX documental: vista canónica = vista previa con toolbar arriba,
panel administrativo secundario, diálogo claro de copia controlada, watermark
por encima del contenido, formato de fecha configurable, contraste seguro,
códigos completos, configuración general del negocio y sidebar solo con logo.

## Resumen de cambios (§2 A–H)

- **A/B. Vista canónica = vista previa** con la toolbar ARRIBA del render. El
  dossier administrativo pasó a `./panel`; la vista y el panel se enlazan sin
  loops («Panel del documento» ↔ «Ver documento»).
- **C. Watermark** de copia controlada por ENCIMA del contenido (z-index alto,
  baja opacidad, legible).
- **D. Diálogo** «Registrar copia controlada» (imprimir → área; PDF → motivo);
  registro solo al confirmar.
- **E. Formato de fecha** configurable por organización; default **DD/MM/AAAA**.
- **F. Códigos completos** (nowrap + ancho mínimo en celdas de código).
- **G. Configuración general del negocio** en `/dashboard/settings`.
- **H. Sidebar** solo con el logotipo de Sentinel (sin texto).

## Archivos

**Pure (`src/features/documents/`)**: `date-format.ts` (nuevo; `formatIsoDate`,
`DATE_FORMATS`, default DD/MM/AAAA), `structured-render.ts` (`contrastText` para
cabeceras de tabla §10; watermark z-index/textos §8; celda `doc-render__code` §11).

**Servidor**: `documents.ts` (`getDocumentPresentation`/`setDocumentTheme` con
`dateFormat`; `buildChangeLog`, `getStructuredContent`, `renderDocumentControlledCopy`
y `getControlledCopyHistory` aplican el formato de fecha; `formatIdentityDates`).
`organization.ts` (nuevo: perfil del negocio, sitios y miembros).

**UI (`src/app/dashboard/`)**: `documents/[documentId]/page.tsx` (reescrita = vista
canónica), `documents/[documentId]/panel/page.tsx` (nuevo = dossier admin),
`documents/[documentId]/DocumentToolbar.tsx` (grupos Edición/Flujo/Salida/Admin;
«Enviar a revisión» reutiliza `submitReviewForm`; modal «Registrar copia
controlada»), `documents/_components/DocumentThemeForm.tsx` (selector de formato de
fecha), `settings/` (nuevo: página + form + acción de configuración general),
`_components/AppSidebar.tsx` (solo logo) + `nav-config.tsx` (grupo Administración).
`workflow-actions.ts` (`submitReviewForm`). Estilos en `globals.css`.

**Datos**: `prisma/schema.prisma` (`document_themes.date_format`;
`OrganizationProfile`; `sites.address/latitude/longitude`), migración
`20260913000000_document_dateformat_orgprofile`, `prisma/seed.ts` sin cambios de
contrato (defaults cubren las columnas nuevas).

**Pruebas**: `tests/documents-dateformat.test.ts` (formato de fecha + contraste),
`tests/db/documents-output.test.ts` (persistencia/aplicación del formato),
`tests/db/organization-profile.test.ts` (perfil scoping), `tests/navigation.test.ts`
(ruta de configuración).

## Decisiones

- **Vista canónica reutiliza el render** (`getStructuredContent().renderedHtml`
  para estructurados; `contentHtml` para rich_text; tarjeta para external). El
  panel conserva todo lo administrativo y ambos se enlazan; las rutas antiguas de
  preview siguen funcionando sin loop.
- **Toolbar no reinventa el workflow** (§4/§64): «Enviar a revisión» llama a
  `submitForReview`; «Nueva versión» abre el control existente del panel
  (`#nueva-version`); el resto del flujo permanece en el panel.
- **Formato de fecha** determinista y sin locale (`formatIsoDate`), aplicado
  server-side donde nacen las fechas del render/salida. Configurable en
  «Configuración documental».
- **Contraste server-side** (§10): `contrastText` calcula por luminancia el color
  de texto de las cabeceras de tabla, evitando texto ilegible con colores oscuros.
- **Watermark** con estilo propio, z-index alto y opacidad baja (§8/§104); no
  depende del tema del cliente ni altera el documento almacenado.
- **Configuración general** (§12): tabla aditiva `organization_profiles`
  (comercial/fiscal/logo) sin renombrar `organizations`; sitios y usuarios se
  listan (lectura) enlazando a sus módulos; el logo se referencia por URL (sin
  carga de archivos falsa; documentado).
- **Sidebar solo logo** (§13): el isotipo/wordmark de Sentinel se muestra sobre un
  azulejo blanco para contraste; el archivo vive en `public/logo.png`.

## Migración

`20260913000000_document_dateformat_orgprofile`: `ALTER document_themes ADD
date_format` (default), `ALTER sites ADD address/latitude/longitude` (nullable),
`CREATE TABLE organization_profiles` (FK org + RLS + grants). **0 DROP.** Verificada
con `db:reset:local` desde cero + seed 2× idempotente.

## Validaciones

- `format:check` ✅ · `lint` ✅ (solo el warning preexistente ajeno) · `typecheck` ✅
- `npm test` ✅ 539/539 · `test:db` ✅ 183/183 (rebuild desde cero; una flakiness
  transitoria conocida de Windows/Docker se confirmó con rerun) · `build` ✅

## Pendiente manual

Reemplazar `public/logo.png` por el logotipo definitivo de Sentinel (el agente no
puede escribir la imagen); el sidebar ya lo referencia. Capturas de UI a
`docs/ui/screenshots/` quedan como verificación manual.
