# Referencias inteligentes de C3 Sentinel (DOC-002)

Convierte el contenido documental en una **red navegable y trazable** mediante dos
tokens dentro del texto estructurado:

- **`@`** — vincula un **documento existente** (relación `reference`).
- **`//`** — **emite un formato** nuevo (documentType `form`) y lo relaciona
  (`issued_form`).

Una referencia **no es texto**: es una relación real y persistida. El texto es
solo presentación.

## 1. Modelo de datos

Se reutiliza y extiende la tabla `document_relations` (DOC-002 no crea tabla
nueva):

- `document_id` = documento **origen**; `related_document_id` = documento **destino**.
- `source_version_id` = versión origen que **contiene** la referencia (§5). Las
  referencias son **versionadas**: `PR-CA-001 v1.0` puede tener referencias
  distintas de `v1.1`.
- `relation_type` ∈ `reference | issued_form` (+ heredados y reservados
  `supersedes|related|evidence|generated_record|attachment_reference`).
- `active` = **baja lógica** (respeta el trigger de no-borrado físico); al retirar
  un token la relación se desactiva pero **no se borra** (§13/§23).
- `label`, `created_by`, `target_version_id` (opcional para congelar una versión).

Índices por `organization_id+relation_type`, `source_version_id`,
`related_document_id`. **Unicidad**: una relación ACTIVA por
`(source_version_id, related_document_id, relation_type)`.

## 2. Representación en el contenido (§27/§28)

El valor de un campo pasa de `string` a `RichValue = string | { segments }`
(`src/features/documents/references.ts`):

- `string` → texto plano (retrocompatible con DOC-001; sin migración de datos §29).
- `{ segments: [...] }` → texto + **segmentos de referencia**
  `{ type:'ref', relationType, targetDocumentId, relationId?, code?, title? }`.

El identificador REAL es `targetDocumentId` (id estable, no el código). `code`/
`title` son snapshot visual: la UI y el renderer resuelven los datos **actuales
por id** (§13). Solo los campos `textarea` admiten referencias; los `text` se
mantienen planos. `schemaVersion` sigue en 1 (el `RichValue` es una ampliación
compatible, no un cambio de esquema).

## 3. Sincronización contenido ↔ relaciones (§26)

Al **guardar** el contenido de una versión editable
(`saveStructuredContent` → `syncVersionRelations`):

1. se extraen las referencias del contenido (`extractReferences`, deduplicadas);
2. se filtran a destinos **válidos del mismo tenant** (una referencia colgante se
   conserva en el texto pero no crea fila);
3. se **crean** las nuevas, se **reactivan** las que vuelven y se dan de **baja
   lógica** las retiradas;
4. no se tocan versiones anteriores ni otros tipos de relación.

## 4. `@` — vincular documento

Al escribir `@` en un campo con referencias se abre un **autocompletado** (listbox
accesible por teclado) que busca documentos del tenant por código/título
(`searchDocumentsForMention`, sin traer `structured_content`). Al elegir uno se
inserta un **chip** estructurado; en el render/preview es un enlace al detalle. Si
el destino deja de ser visible → "Referencia no disponible"; si es obsoleto →
indicador "Obsoleto". El vínculo se lee por id: cambiar el código/título del
destino **no lo rompe** (§13).

## 5. `//` — emitir formato

Al escribir `//` se abre un **diálogo** que crea un **formato** (§18) en UNA
transacción: reserva `FO-[ÁREA]-[###]` (hereda el área del origen), crea el
documento + versión 1.0 (**borrador**, sin autoaprobación §21) + contenido base +
la relación `issued_form`. El código del formato **no** se acopla físicamente al
procedimiento padre; la relación vive en `document_relations` (§16). Al eliminar
el token, la relación se desactiva pero **el formato sigue existiendo** (§23).

## 6. Versionado e inmutabilidad

- Al crear una versión nueva (`createEditorVersion`) se **copian** las relaciones
  activas a la nueva versión; la anterior conserva su snapshot (§24).
- Una versión **publicada** sella su contenido y sus relaciones: el trigger
  `trg_docrel_published` bloquea crear/modificar relaciones cuya `source_version_id`
  esté publicada (§25), y el guard de `document_versions` sella el contenido.

## 7. Render y detalle

- El renderer (`structured-render.ts`) muestra los chips inline (enlaces seguros,
  con escape) y puebla automáticamente **"Documentos referenciados"** (`reference`)
  y **"Formatos y registros relacionados"** (`issued_form`) desde el contenido
  resuelto (§12/§20/§49) — sin captura manual.
- El detalle documental muestra la sección **"Relaciones documentales"**
  (`getDocumentRelations`) y, en un formato, **"Emitido desde"**
  (`getIssuedFromSources`, §37).

## 8. Seguridad y permisos

- Todo el acceso está scoped por `organizationId` + RLS; las FK compuestas
  anti-cruce impiden relacionar documentos de otra organización.
- `@` requiere lectura del destino (cualquier miembro de la org); `//` requiere una
  versión origen **editable** (permiso de edición) y crea el formato como borrador.
- El renderer escapa todo texto (sin XSS); los ids se validan como uuid en el saneo.

## 9. Futuro (no en DOC-002)

Los tipos `supersedes|related|evidence|generated_record|attachment_reference` están
reservados en el CHECK pero sin flujo. Programas ejecutables (DOC-003), diseñador
de registros (DOC-004), importación inteligente (DOC-005), IA (DOC-006) y las
integraciones (DOC-007) se apoyarán en este modelo de relaciones.
