# Biblioteca documental (DOC-UX-001)

`/dashboard/documents` deja de ser una lista plana y pasa a ser una **biblioteca
por áreas**: buscador, KPIs clickeables, carpetas de área → tipo, y un listado
maestro con filtros. Todo tenant-scoped vía RLS.

## 1. Dashboard de biblioteca (§24-38)

`src/app/dashboard/documents/page.tsx`:

- **Buscador** que envía a `/dashboard/documents/master` (por código, nombre,
  tipo o área).
- **KPIs** (`getDocumentLibrary().summary`), cada uno enlaza al maestro filtrado:
  - Vigentes → `?status=effective`
  - En revisión/aprobación → `?status=in_review`
  - Próximos a revisión → `?due=soon`
  - Vencidos → `?due=overdue`
- **Áreas como carpetas**: provienen de `quality_catalog_values` con `kind='area'`
  activas y tenant-scoped; se muestran aunque tengan 0 documentos.
- **Acciones**: Listado maestro · Configuración documental · Registrar externo ·
  Crear documento.

## 2. Navegación por carpetas (§30-34)

- `area/[areaCode]/page.tsx` — carpetas de **tipo** dentro del área
  (`getAreaByCode` + `getAreaTypeCounts`).
- `area/[areaCode]/[type]/page.tsx` — `DocumentsTable` (variant `type`) filtrada
  por área + tipo.

Las áreas sin `code` enlazan al maestro por nombre (`?area=<nombre>`).

## 3. Listado maestro (§35-38)

`master/page.tsx` — filtros completos: búsqueda, tipo, área, estatus (por defecto
`active`), sitio, origen. `due=soon|overdue` se resuelve como post-filtro sobre la
fecha de próxima revisión. Render con `DocumentsTable` (variant `master`).

`DocumentFilters` en `src/server/documents.ts` se amplía con `statusGroup`
(`'active' | 'all'`) y `area` (igualdad sobre `ownerArea`); `listDocuments`
devuelve `ownerArea`.

## 4. Componente de tabla

`_components/DocumentsTable.tsx` — tabla reutilizable con variantes `type` y
`master`. Los enlaces a documentos muestran **CÓDIGO — Nombre** (§57).

## 5. Datos

`getDocumentLibrary(orgId)` devuelve:

- `summary = { effective, inReview, dueSoon, overdue }`.
- `areas` = carpetas por área (nombre, code, count), agrupadas por **nombre** de
  área del catálogo, incluyendo áreas con 0 documentos.

Todo se ejecuta bajo `withOrgContext`; los conteos y las áreas están aislados por
organización (cubierto por `tests/db/document-presentation.test.ts` caso B).
