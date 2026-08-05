# TASK-005 — Notas de implementación (editor documental enriquecido)

Editor web para crear y editar documentos internos dentro de Sentinel, con
experiencia tipo procesador de textos (sin replicar Word). No incluye aprobación
multinivel, firmas, comparación de versiones, edición colaborativa ni exportación
PDF/DOCX (fuera de alcance).

## Editor elegido

**TipTap** (basado en ProseMirror). Motivos: integración nativa con React/Next,
contenido **estructurado en JSON**, extensible, soporte estable de tablas,
imágenes y estilos, sin servicios externos. Descartados: **Lexical**
(serialización propia más costosa, tablas menos maduras), **ProseMirror puro**
(demasiado bajo nivel), **Slate/Quill** (tablas «hazlo tú mismo», formato Delta
menos estructurado).

## Dependencias

`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit` y extensiones: underline,
text-align, text-style, color, highlight, link, image, table (+ row/header/cell),
font-family. Más dos extensiones propias: `FontSize` (atributo de textStyle) y
`PageBreak` (salto de página).

## Modelo de contenido

- Se almacena **JSON estructurado** (ProseMirror/TipTap) en `document_versions.content_json`
  (JSONB), más un **HTML sanitizado** (`content_html`) para la vista previa,
  `content_schema_version` (compatibilidad futura), `page_config` (JSONB:
  encabezado/pie/portada/márgenes), `content_checksum`, `template_key`,
  `updated_by`/`updated_at`.
- Seguridad sin DOM en servidor: `src/features/documents/content-schema.ts` aplica
  un **saneador allowlist** (descarta nodos/marcas desconocidos, valida `href` de
  enlaces y `src` de imágenes a la ruta interna) y un **serializador puro** a HTML
  seguro. El servidor no importa TipTap.

## Migración

Dos migraciones nuevas (sin tocar anteriores):

- `20260805030358_document_editor`: agrega las columnas de contenido a
  `document_versions` + FK `updated_by` + `CREATE OR REPLACE` del trigger de
  versión publicada para sellar también el contenido. **Se omitieron los `DROP`
  que `prisma migrate dev` propuso** sobre las constraints SQL de TASK-004.
- `20260805030359_document_files_image_kind`: amplía el CHECK de `document_files.kind`
  para permitir `image`.

## Rutas

- `/dashboard/documents/new/editor` — «Crear dentro de Sentinel» (elige plantilla).
- `/dashboard/documents/[id]/editor` — editor (soporta `?version=`).
- `/dashboard/documents/[id]/preview` — vista previa tipo hoja carta.
- Descarga protegida de imágenes reutiliza `/dashboard/documents/[id]/files/[fileId]`.

## Plantillas

Política, Manual, Procedimiento, Instructivo, Programa, Plan, Formato,
Especificación, Matriz y Documento libre (`src/features/documents/templates.ts`),
como datos estructurados editables (p. ej. Procedimiento: Objetivo, Alcance,
Responsabilidades, Definiciones, Desarrollo, Registros, Referencias, Control de
cambios, Anexos).

## Funciones de formato

Títulos H1–H3, negrita, cursiva, subrayado, tachado, color, resaltado, alineación
(izq/centro/der/justificado), listas con viñetas y numeradas, sangría de listas,
enlaces, citas, separador, salto de página, tablas (insertar/filas/columnas/
combinar), imágenes, limpiar formato, deshacer/rehacer. Fuentes web seguras
(Arial, Calibri, Times New Roman, Georgia, Verdana, Courier New) y tamaños 8–32.

## Seguridad y sanitización

- Contenido pertenece a la organización activa; scoping en servidor + RLS + FK
  compuestas; `organization_id`/`document_id`/`version_id` nunca se confían del
  cliente (se validan contra la sesión).
- Saneado allowlist: se eliminan scripts, iframes, nodos/marcas desconocidos;
  enlaces solo `http/https/mailto` o rutas internas; imágenes solo por ruta
  interna protegida (no URLs externas ni `data:`); colores/fuentes/tamaños
  restringidos a listas seguras.
- Límite de tamaño de contenido (`DOCUMENTS_MAX_CONTENT_BYTES`, 512 KB por
  defecto). Versión publicada sellada por trigger.

## Imágenes y tablas

- Imágenes PNG/JPG, validación de MIME/extensión/tamaño, almacenamiento local
  protegido (reutiliza `document_files` con `kind='image'`), descarga protegida,
  `alt` y ancho configurables; sin URLs externas.
- Tablas con encabezado, filas/columnas, combinación de celdas; se conservan al
  guardar y reabrir (verificado por prueba).

## Versiones

Editar una versión borrador, guardar (manual + autoguardado con retardo),
crear nueva versión borrador (copia el contenido), consultar versiones anteriores
en solo lectura, una sola versión vigente, historial conservado. Una versión
publicada no se edita: se crea una nueva.

## Guardado

Guardado manual e **autoguardado** (~4 s tras cambios), indicador de «cambios sin
guardar»/«guardado hh:mm», usuario del último guardado, guarda `beforeunload`
para evitar pérdida al salir, mensajes de error claros.

## Limitaciones

- Vista previa/paginación es una representación visual (no genera PDF real).
- «Elaboró/Revisó/Aprobó» de la portada son informativos (sin flujo formal).
- La app conecta como owner de la BD; RLS se prueba con `SET ROLE gapsi_app`.

## Prueba manual

Documentos → «Crear dentro de Sentinel» → plantilla Procedimiento → editar título
y contenido, cambiar fuente/tamaño/color, insertar tabla e imagen, Guardar,
recargar (persistencia), Vista previa, Crear nueva versión (la anterior queda solo
lectura), Historial, e intentar contenido peligroso (se sanea).

## Pendientes para TASK-006

- Flujo de revisión/aprobación multinivel, firma electrónica, confirmación de
  lectura, comparación visual entre versiones, distribución controlada,
  generación/exportación PDF/DOCX.
