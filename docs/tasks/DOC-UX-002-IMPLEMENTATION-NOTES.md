# DOC-UX-002 — Notas de implementación

Toolbar documental, copias controladas de salida (impresión/PDF), diseños
documentales y entitlement de atribución C3. Amplía DOC-UX-001
(`DOCUMENT-PRESENTATION.md`).

## Resumen

Cuatro frentes sobre la capa de presentación/salida (sin tocar el motor de datos
DOC-001 ni las referencias DOC-002):

1. **Toolbar state-aware** en la vista del documento (Edición / Salida /
   Administración); el workflow se **reutiliza** (no se reinventa, §64).
2. **Copias controladas de salida**: Imprimir y Guardar como PDF generan un
   registro con **folio**, marca de agua "COPIA CONTROLADA" y destino/motivo.
3. **Diseños documentales** (4 predeterminados) ortogonales al **tema** de colores.
4. **Entitlement de atribución C3**: la atribución del pie solo puede ocultarse
   según la suscripción (regla comercial provisional), con guard en servidor.

## Archivos

**Pure (`src/features/documents/`)**:

- `entitlements.ts` (nuevo): `computeEntitlements`, `resolveShowC3Attribution`,
  planes/modalidades, `SubscriptionEntitlements`.
- `document-design.ts` (nuevo): `DOCUMENT_DESIGNS` (4), `sanitizeDesignId`,
  `getDocumentDesign`, `DEFAULT_DESIGN_ID`.
- `document-theme.ts`: tema con 5 colores (`text`/`heading` añadidos).
- `structured-render.ts`: `RenderMode` gana `controlled_copy`; `RenderOptions`
  gana `design`, `showC3Attribution`, `copyMark`; `CopyMark`; watermark + bloque
  de copia; footer con atribución condicional (§90); `themeStyle` emite
  `--doc-text`/`--doc-heading`; clase de diseño en la raíz.

**Servidor (`src/server/documents.ts`)**: `getDocumentPresentation`,
`setDocumentTheme` (extendida: 5 colores + diseño + atribución con guard),
`getOrganizationSubscription`, `getOrganizationEntitlements`,
`resolveShowC3AttributionForOrg`, `createControlledCopyOutput` (folio atómico),
`getControlledCopyHistory`, `getControlledCopyForRender`,
`renderDocumentControlledCopy`. `getStructuredContent` pasa diseño + atribución.

**UI (`src/app/dashboard/documents/`)**: `[documentId]/DocumentToolbar.tsx`
(toolbar + diálogos print/PDF), `[documentId]/copy-actions.ts`,
`[documentId]/copy/page.tsx` (+ `_components/PrintControls.tsx`),
`[documentId]/CopyHistory.tsx`, `[documentId]/page.tsx` (integra toolbar +
historial + ancla del panel), `settings/page.tsx`, `settings-actions.ts`,
`_components/DocumentThemeForm.tsx` (diseño + 5 colores + toggle atribución).
Estilos en `globals.css` (diseños, watermark, toolbar, cards de diseño).

**Datos**: `prisma/schema.prisma` (`DocumentTheme` +text/heading/design/attribution;
`OrganizationSubscription`; `DocumentCopyCounter`; `DocumentControlledCopy`
+copyType/folio/destino/motivo), migración
`20260912000000_document_output_designs`, `prisma/seed.ts` (suscripción demo
ORG_A intermedio/anual).

**Pruebas**: `tests/documents-output.test.ts` (entitlements, diseños, composición
tema+diseño, atribución, watermark/folio/draft/obsolete), `tests/db/documents-output.test.ts`
(folio consecutivo, aislamiento, cross-tenant rechazado, motivo persiste, versión
exacta, diseño/atribución persisten, guard de entitlement).

## Decisiones

- **Toolbar no reinventa el workflow** (§64): agrupa Edición + Salida +
  Administración. Las transiciones (revisión/aprobación/publicación) siguen en el
  panel «Control documental» (`WorkflowPanel`), enlazado con «Panel del documento».
- **Reutilizar `document_controlled_copies`** (§68): se añaden columnas nullables
  (`copy_type`, `folio`, `destination_area_code`, `reason`); las copias de
  distribución previas no se afectan. 0 DROP.
- **Folio por documento** `CC-<código>-####` con contador atómico
  `document_copy_counters` (patrón `document_code_counters`). No recicla folios.
- **Registro = generación, no impresión física** (§78): estado `active`; el
  navegador no informa si se imprimió, así que no se falsea confirmación. Solo
  versiones **publicadas** generan copia formal; borrador/obsoleto van marcados
  NO CONTROLADO **sin** folio ni registro (§80-82).
- **Watermark con estilo propio** (§104): no usa el tema del cliente, para
  garantizar contraste; el documento almacenado no se altera (§73).
- **Diseño ≠ tema** (§95): un solo renderer; el diseño aplica una clase raíz
  `doc-render--design-<id>` (fallback seguro §98); el tema aporta variables de
  color. Diseño/tema son **preferencia de la organización, no snapshot por
  versión** (§102): cambiar diseño reestiliza documentos históricos en pantalla.
- **Entitlement desacoplado del billing** (§86): `computeEntitlements(plan,
cadence)` centraliza la regla (anual **o** plan superior). Sin suscripción →
  sin capacidad (§87). El servidor fuerza `showC3Attribution=true` si la org no es
  elegible, ignorando lo que envíe el cliente (§84/§110). Ocultar la atribución
  **nunca** oculta la confidencialidad/copia/folio (§90).
- **Export "PDF" = `window.print`** (§76): no se instaló infraestructura PDF. La
  ruta `/copy` renderiza en modo `controlled_copy` y abre el diálogo del navegador;
  la UX indica «Selecciona "Guardar como PDF"». Limitación documentada.

## Migración

`20260912000000_document_output_designs`: `ALTER TABLE document_themes ADD`
(4 columnas con default) + `ALTER TABLE document_controlled_copies ADD`
(4 columnas nullables) + `CREATE TABLE organization_subscriptions` +
`CREATE TABLE document_copy_counters`, ambas con FK a `organizations`, RLS
(DO-loop con `fn_current_org`) y grants SELECT/INSERT/UPDATE a `gapsi_app`.
**Inventario: 0 DROP de tabla/columna.** Verificada con `db:reset:local` desde
cero + seed 2× idempotente.

## Validaciones

- `format:check` ✅ · `lint` ✅ (solo el warning preexistente ajeno en
  `analytics/actions.ts:130`) · `typecheck` ✅
- `npm test` ✅ 528/528 · `test:db` ✅ 179/179 (rebuild desde cero) · `build` ✅

## Pruebas manuales (UI) — pendientes de captura

Toolbar por estado; impresión (pide área, genera folio, COPIA CONTROLADA); PDF
(pide motivo); borrador (BORRADOR — NO CONTROLADO, sin folio); panel con historial
de copias; toggle de atribución bloqueado sin entitlement; cambio de diseño
(C3 Moderno → Corporativo → Técnico → Minimalista); cambio de colores conservando
legibilidad. Capturas a `docs/ui/screenshots/` quedan como verificación manual.

## Fuera de alcance (no implementado)

Billing real, personalización avanzada de diseño (drag/drop, subir CSS, fuentes
externas §99-100), DOC-003 (congelado), notificaciones, IA, OCR, Microsoft/Google,
DOC-004, TASK-012.
