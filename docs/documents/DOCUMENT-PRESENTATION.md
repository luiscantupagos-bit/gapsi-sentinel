# Presentación documental (DOC-UX-001)

Normaliza cómo se **muestra** un documento: encabezado con marca del cliente, pie
de confidencialidad con atribución discreta de C3 Sentinel, tema documental por
organización, control de cambios automático y modos de render (editor vs.
publicado). No cambia el motor de datos (DOC-001) ni las referencias (DOC-002):
solo la capa de presentación.

## 1. Renderer

`src/features/documents/structured-render.ts` — puro, escapa todo el HTML, sin
DOM. Firma:

```ts
renderStructuredHtml(templateType, content, identity, options: RenderOptions = {})
```

- `RenderOptions = { resolved?, mode?, theme?, changeLog? }`.
- `RenderMode = 'editor_preview' | 'published_document'` (por defecto
  `published_document`).
- `resolved` = referencias DOC-002 ya resueltas por id.
- `theme` = `DocumentTheme | null` (colores validados HEX).
- `changeLog` = filas de control de cambios (`ChangeLogRow[]`).

El servidor elige el modo en `getStructuredContent`: `published_document` si la
versión está publicada, `editor_preview` en cualquier otro caso.

### Encabezado (§11-15)

`renderHeader` muestra la marca de la **organización** (`.doc-render__org-brand`):
logo si existe, si no el nombre de la organización escapado, más
nombre/código/versión/área/fechas del documento. **Nunca** muestra "C3 Sentinel"
como marca principal.

### Pie (§16-17)

`renderFooter` (`.doc-render__footer`) contiene:

- La leyenda de confidencialidad `DOCUMENTO CONTROLADO Y CONFIDENCIAL` (con el
  nombre de la organización escapado).
- La atribución discreta: `Documento administrado mediante C3 Sentinel — Sistema
inteligente de gestión, cumplimiento y mejora continua.` +
  `www.c3digital.com.mx` (`CONFIDENTIAL_URL`).

No se emite una paginación falsa "Página X de Y"; la paginación real la aporta el
navegador al imprimir.

### Modos de render (§50-54)

- **`editor_preview`**: muestra secciones opcionales vacías, el diagrama de flujo
  y las secciones de referencias aunque estén vacías (ayuda a editar).
- **`published_document`**: `renderFields` **omite** los campos opcionales
  (no requeridos) vacíos; no muestra andamiaje de edición.

## 2. Tema documental (§18-24)

`src/features/documents/document-theme.ts` — validación **solo HEX** (previene
inyección CSS, §22):

- `DEFAULT_DOCUMENT_THEME = { primary:'#0f2440', secondary:'#e3e8ef', accent:'#2563eb' }`.
- `isHexColor`, `sanitizeDocumentTheme` (minúsculas + fallback por color),
  `validateDocumentTheme` (lista de inválidos).

El tema se aplica **solo al render del documento** (encabezados, títulos,
encabezados de tabla, acentos) vía variables CSS `--doc-primary/--doc-secondary/
--doc-accent`, **no** al tema global de la app. En el renderer, `safeHex()` valida
cada color antes de emitir la variable; un color malicioso cae al default.

Persistencia: tabla dedicada `document_themes` (PK `organization_id`, RLS y grants
estándar), leída/escrita por `getDocumentTheme` / `setDocumentTheme` bajo
`withOrgContext`. Configuración en `/dashboard/documents/settings`
("Apariencia documental": 3 colores + vista previa en vivo).

## 3. Control de cambios (§39-49)

Sección automática construida desde `DocumentVersion` por `buildChangeLog`:

- Columnas: **Versión / Fecha / Modificación realizada / Realizado por**.
- v1.0 con `change_notes` vacío → "Documento nuevo".
- Versiones posteriores → `change_notes` o "Cambio sin descripción registrada".
- **Corte histórico (§48)**: al ver la versión v1.1 el control de cambios llega
  solo hasta v1.1 (`buildChangeLog(..., uptoCreatedAt)`).

`change_notes` es **obligatorio para publicar versiones > v1.0** (no para la
inicial), validado en `src/server/document-workflow.ts`.

## 4. Procedimiento simplificado (§6-8)

La tabla del procedimiento formal conserva **#/Actividad/Descripción/Responsable**
y elimina las columnas **Evidencia** y **Observaciones**.

Retrocompatibilidad (§7/§14): **sin migración destructiva**. Evidencia y
Observaciones ya **no forman parte** del Procedimiento actual (no se editan, no se
renderizan, no se crean en documentos nuevos). Los datos legacy existentes se
**preservan silenciosamente** para compatibilidad: al guardar, el servidor sanea
el contenido nuevo con el registry vigente y luego re-inyecta, **solo desde el
contenido previo almacenado**, las claves legacy conocidas
(`evidencia`/`observaciones`) en las actividades que siguen existiendo. La lista
de claves preservadas es explícita y acotada (`KNOWN_LEGACY_REPEATABLE_FIELDS`);
**no** se debilita el allowlist (cualquier otra clave desconocida se descarta y el
cliente no puede inyectarlas). El emparejamiento es por **nombre de actividad**
(DOC-001 no tiene `activityId`): una actividad eliminada no reaparece y una nueva
no hereda legacy ajeno. Los valores se guardan como texto plano — el renderer no
los muestra y no participan de referencias `@`/`//`. Una futura migración podrá
retirarlos explícitamente. El concepto de evidencia sigue vivo globalmente en
Tareas/CAPA/Auditorías.

## 5. Impresión (§16/§50)

CSS `@media print` en `globals.css`: repetición de `thead`, control de
`page-break`, encabezado/pie legibles. Sin dependencia de JS para imprimir.
