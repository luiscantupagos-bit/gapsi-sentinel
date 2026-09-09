# DOC-002 — Notas de implementación

Referencias inteligentes (`@`) y formatos emitidos (`//`). Arquitectura en
`docs/documents/SMART-REFERENCES.md`.

## Resumen

Las referencias se persisten como relaciones reales en `document_relations`
(reutilizada, no una tabla nueva), versionadas por `source_version_id`. El
contenido estructurado gana una representación `RichValue` (texto + segmentos de
referencia) retrocompatible con DOC-001. El servidor sincroniza contenido↔
relaciones al guardar, resuelve las referencias por id para el render y expone la
emisión atómica de formatos.

## Archivos

**Pure (`src/features/documents/`)**: `references.ts` (RichValue, saneo,
extracción), `reference-commands.ts` (detección `@`/`//`), `structured-content.ts`
(RichValue en campos/ítems + `extractReferences`), `structured-render.ts` (chips +
secciones de referencias resueltas).

**Servidor (`src/server/documents.ts`)**: `resolveReferences`,
`syncVersionRelations`, `searchDocumentsForMention`, `issueFormFromDocument`,
`getDocumentRelations`, `getIssuedFromSources`; `createStructuredDocument`,
`getStructuredContent`, `saveStructuredContent` y `createEditorVersion` integran
resolución/sincronización/copia de relaciones.

**UI (`src/app/dashboard/documents/`)**: `reference-actions.ts`,
`_editor/ReferenceTextEditor.tsx` (contenteditable con `@`/`//`),
`_editor/IssuedFormDialog.tsx`, `_editor/StructuredEditor.tsx` (integra ambos),
`[documentId]/page.tsx` (sección de relaciones), `[documentId]/structured/page.tsx`
(pasa referencias resueltas). Estilos en `globals.css` (bloque DOC-002).

**Datos**: `prisma/schema.prisma` (columnas DOC-002 en `DocumentRelation`),
`prisma/migrations/20260910000000_smart_references/`, `prisma/seed.ts`
(`seedSmartReferences`, PR-CA-001 → PO-DG-001 y FO-CA-001).

**Pruebas**: `tests/documents-references.test.ts` (13),
`tests/db/document-references.test.ts` (8, casos A–L).

## Decisiones

- **Reutilizar `document_relations`** (§4): se añaden columnas
  `source_version_id/target_version_id/label/active/created_by` y se amplía el
  CHECK. El único DROP de la migración es re-anclar ese CHECK (widen, **no
  destructivo, sin pérdida de datos**); 0 DROP de tablas/columnas.
- **Baja lógica (`active`)** en vez de borrado: la tabla tiene trigger de
  no-borrado físico y el requisito es conservar la relación histórica (§13/§23).
- **`RichValue` retrocompatible** (§28/§29): `string | { segments }`. Los docs
  DOC-001 sin referencias siguen siendo strings; sin migración de contenido.
- **Referencia por id, no por código** (§13): `code`/`title` son snapshot; el
  render resuelve datos actuales por `targetDocumentId`.
- **Inmutabilidad por trigger** (`trg_docrel_published`, §25) además del guard de
  app (sync solo en versión editable).
- **`//` crea el formato + relación en una transacción** (§18); el token lo
  inserta el editor tras confirmar (evita sobrescribir ediciones no guardadas).
- **Referencias colgantes/cross-tenant**: se conservan en el texto ("no
  disponible") pero no crean fila (destino no válido en el tenant).

## Migración

`20260910000000_smart_references`: `ALTER TABLE document_relations ADD COLUMN`
(5 columnas) + índices + amplía `document_relations_type_check` (drop+re-add) +
FK compuestas de versión (source/target) + índice único de deduplicación + trigger
de inmutabilidad `trg_docrel_published`. **Inventario: 1 DROP CONSTRAINT
(no destructivo, widen CHECK); 0 DROP de tabla/columna. No CREATE TABLE (la tabla
ya existe).** No modifica migraciones previas.

## Validaciones

- `format:check` ✅ · `lint` ✅ (solo un warning preexistente ajeno) · `typecheck` ✅
- `npm test` ✅ 479/479 (incluye 21 nuevas) · `test:db` ✅ 165/165 (estable) · `build` ✅
- `db:reset:local` desde cero ✅ · seed 2× idempotente ✅

## Pruebas manuales (UI) — verificado

El editor estructurado de `PR-CA-001` renderiza la referencia inline como chip
(`@ PO-DG-001 — Política de calidad`) y el render/preview del seed contiene los
chips (PO-DG-001, FO-CA-001) y las secciones "Documentos referenciados" y
"Formatos y registros relacionados" pobladas.

## Pendientes / notas

- **Popover `@` en vivo**: la detección (`detectMentionQuery`/`detectFormCommand`)
  está cubierta por pruebas unitarias y el pipeline de chips verificado en
  pantalla, pero el harness del agente no inyecta escritura en el `contenteditable`
  para capturar el popover en vivo; queda como verificación manual.
- **Capturas** de `docs/ui/screenshots/`: pendiente manual (el navegador del agente
  no escribe PNG al repo).
- FOLLOW-UP de DOC-001 **no** se tocaron (§52): schemaVersion estricto, unicidad
  `area.code`, title versionado, edge de código custom, lock del contador,
  cobertura extra de concurrencia.
