# GAPSI Sentinel — Estándar visual (UI)

Sistema visual compartido del área privada. Todos los tokens viven en
`src/app/globals.css` (`:root`). Las páginas nuevas deben reutilizar estos
tokens y componentes en lugar de estilos ad-hoc.

## Paleta

| Token                    | Valor     | Uso                            |
| ------------------------ | --------- | ------------------------------ |
| `--color-bg`             | `#eef1f6` | Fondo general (gris muy claro) |
| `--color-surface`        | `#ffffff` | Tarjetas y superficies         |
| `--color-surface-2`      | `#f7f9fb` | Encabezados de tabla, hovers   |
| `--color-text`           | `#16202b` | Texto principal                |
| `--color-muted`          | `#64748b` | Texto secundario               |
| `--color-primary`        | `#2563eb` | Acción principal (azul)        |
| `--color-primary-hover`  | `#1d4ed8` | Hover de acción                |
| `--color-primary-soft`   | `#e8f0fe` | Fondos suaves / avatar         |
| `--color-success`        | `#16a34a` | Éxito                          |
| `--color-warning`        | `#d97706` | Advertencia                    |
| `--color-danger`         | `#dc2626` | Crítico                        |
| `--color-border`         | `#e3e8ef` | Bordes                         |
| `--color-sidebar`        | `#0f2440` | Sidebar (azul marino)          |
| `--color-sidebar-active` | `#1d4ed8` | Ítem activo del sidebar        |

No usar degradados. Los estados no dependen solo del color: se acompañan de
texto (badges con etiqueta, leyendas de gráficos con valor).

## Tipografía

- Familia sans-serif del sistema (`system-ui`).
- Títulos de página `h1` ~1.45rem, semibold; secciones `h2` ~1.1rem.
- Cuerpo compacto (line-height 1.55); tablas ~0.9rem; etiquetas ~0.8rem.
- Evitar títulos excesivamente grandes.

## Espaciado, radios y sombras

- Escala: `--space-1..8` = 4, 8, 12, 16, 20, 24, 32 px. Usar siempre la escala.
- Radios: `--radius` 10px (tarjetas), `--radius-sm` 6px (botones/campos), pill 999px (badges).
- Sombras sutiles: `--shadow-sm` en tarjetas/tablas; `--shadow-md` en flotantes.

## Iconos

- Una sola familia: iconos SVG de línea en `src/app/dashboard/_components/icons.tsx`
  (20×20, trazo 1.6, `currentColor`, `aria-hidden`). Cada ítem del menú tiene icono.

## Layout (chrome)

- **Sidebar** (`AppSidebar`): azul marino, logo arriba, navegación **agrupada**
  (CORE-ALIGN-001) por secciones con títulos discretos: **Panel · Cumplimiento**
  (Diagnósticos, Auditorías, Documentos) **· Mejora** (Acciones correctivas,
  Análisis) **· Trabajo** (Tareas, Proyectos) **· Desempeño** (Indicadores,
  Analítica). Solo se listan **rutas reales**: no hay módulos futuros
  deshabilitados ni "Configuración" sin ruta. Estado activo (`is-active`), cerrar
  sesión al pie. Fijo en escritorio; en móvil (≤720px) franja horizontal con la
  etiqueta del ítem activo visible.
- **Topbar** (`AppTopbar`): organización y sitio como **contexto** (texto, no
  selectores interactivos mientras no exista cambio real), avatar con iniciales,
  nombre y rol. Sin campana decorativa. Sticky.
- **Contenido**: fondo gris; cada página usa `<main className="container">`
  (ancho amplio hasta `--max-width-wide`, padding equilibrado). El editor
  documental conserva su hoja tipo carta (816px).

## Componentes compartidos

- `PageHeader` — título + subtítulo + acciones a la derecha.
- `StatCard` / `.statcard-row` — indicadores (con `tone` opcional danger/warning/success).
- `SectionCard` — tarjeta con encabezado (título + acción) y cuerpo.
- `DonutChart` / `BarChart` — gráficos SVG con leyenda/valor accesible.
- Badges: `.badge` + modificador (`badge--capa-*`, `badge--analysis-*`,
  `badge--sev-*`, `badge--doc-*`).
- Tablas: envolver en `.table-wrap` (scroll horizontal interno + tarjeta).
- `.filters` — barra de filtros; `.empty-state` — estado vacío.

## Estados

- Botones: `.button` (primario azul), `.button--ghost`, hover más oscuro,
  `:focus-visible` con contorno; deshabilitados con opacidad/`not-allowed`.
- Filas de tabla: hover con `--color-surface-2`.

## Responsive

Verificado sin desbordamiento horizontal global en 1920, 1440, 1280, 1024, 768,
390 y 375. Reglas: sidebar fijo en escritorio y franja superior en móvil; grids
de tarjetas con `auto-fit`/`minmax`; tablas anchas con scroll interno; formularios
a ancho completo.

## Reglas para páginas nuevas

1. Envolver el contenido en `<main className="container">`.
2. Usar `PageHeader` para el encabezado.
3. Indicadores con `StatCard`/`.statcard-row`; bloques con `SectionCard`.
4. Tablas siempre dentro de `.table-wrap`.
5. Reutilizar tokens (nada de colores/espaciados fijos ad-hoc).
6. Badges con etiqueta de texto (no solo color).

## Patrón de detalle (CORE-ALIGN-001)

Adoptado de Auditorías y disponible como componentes compartidos en
`src/app/dashboard/_components/detail.tsx`:

- `DetailHeader` — volver + título + estado (badge) + meta + una acción dominante.
- `NextActionCard` — "siguiente acción": qué falta y el botón para avanzar.
- `StageProgress` — progreso por etapas (stepper) según el ciclo de la entidad.
- `DetailTabs` — pestañas del detalle por `?tab=` para evitar el scroll infinito.

Orden: **encabezado → estado/responsable/contexto → siguiente acción → progreso →
pestañas → contenido**. Una sola acción primaria; secundarias como ghost;
administrativas/destructivas en "Más acciones". Aplicado en Diagnósticos,
Documentos y CAPA (Auditorías ya lo usaba).

## Panel (dashboard)

`src/app/dashboard/page.tsx`. **Solo datos reales; sin placeholders.** No se
inventan métricas (Sentinel Score, IA, certificación, tendencia sin históricos se
omiten hasta ser reales). Estructura: fila de 6 indicadores reales clickeables →
alertas prioritarias y próximas acciones → auditorías → trabajo y documentos →
CAPA por estado/prioridad. Cada tarjeta enlaza a su destino real. Los módulos que
no existen todavía **no** aparecen como "Próximamente".

## Pantalla de resultado analítico (patrón Pareto)

Para pantallas que capturan datos y muestran un resultado analítico, el orden es:
**capturar → ver resultado → interpretar → documentar conclusión → acciones →
evidencia/comentarios → historial**. El gráfico y su tabla aparecen juntos
inmediatamente después de la captura.

- **Resultado en dos paneles** (`.pareto-results`): gráfico ~60% + tabla ~40% en
  escritorio (`grid-template-columns: minmax(0,3fr) minmax(0,2fr)`), colapsan a
  una columna ≤1024px; la tabla usa `.table-wrap` (scroll interno en móvil).
- **Gráfico interactivo:** hover/foco resaltan el elemento activo y atenúan el
  resto (nunca solo por color); tooltip con el detalle completo; línea acumulada
  ámbar (`#d97706`) continua y línea de corte 80% azul marino discontinua
  (`stroke-dasharray`). Barras `role="button"` + `tabIndex` + `aria-label`.
- **Tabla = alternativa accesible** del gráfico, con estado de hover compartido
  (resaltar barra ↔ resaltar fila) y marca textual del grupo vital.
- **Interpretación:** tarjeta de lectura rápida que **solo** presenta valores ya
  calculados; se omite si no hay datos. Nunca inventa métricas nuevas.
- **Movimiento:** transiciones ligeras que se anulan con
  `@media (prefers-reduced-motion: reduce)`.

## Regla global de elementos clickeables

Toda tarjeta, fila de tabla, folio, código o título resumen debe navegar a su
detalle cuando exista una ruta real:

- tarjeta/fila completa clickeable, con `cursor: pointer` y estados `:hover` y
  `:focus-visible` visibles;
- el folio/código se mantiene como **enlace explícito** además del área
  clickeable;
- navegable por teclado y con atributos accesibles;
- los botones/enlaces internos no disparan la navegación del contenedor
  (`stopPropagation` o áreas separadas);
- nunca se crean enlaces sin destino real; se reutilizan las rutas existentes;
- se conservan permisos y visibilidad (si el usuario no puede ver el detalle, no
  se enlaza);
- se aplica de forma consistente en Panel, Documentos, Tareas, CAPA, Bandeja
  CAPA, Análisis y módulos futuros.

## Gestor de tareas y proyectos (TASK-009)

Patrón visual del módulo transversal:

- **Listas** con KPIs clickeables, pestañas de filtros rápidos, búsqueda y tablas
  cuyas **filas exponen código y título como enlaces** (`.tbl-linkable`): las
  tareas nativas abren su detalle; las agregadas (CAPA, documental, AMEF) abren su
  módulo de origen. Nunca se muestran UUID ni estados internos en inglés (se usan
  badges con etiqueta en español `badge--task-*`, `badge--prio-*`, `badge--proj-*`,
  `badge--ms-*`).
- **Kanban** (`.kanban`) por estado, con scroll horizontal interno y movimiento
  por selector accesible validado en servidor.
- **Calendario** (`.cal-grid`) mensual: color + texto (no solo color), celdas con
  ítems clickeables.
- **Gantt** propio (`.gantt`) con columna de nombres fija (`position: sticky`),
  scroll horizontal interno, barras/hitos clickeables, marcador de hoy y vencidos;
  sin librería externa.
- **Barra de progreso compacta** `.tprogress` (distinta de la barra `.progress`
  del diagnóstico).

Se reafirma la **regla global de elementos clickeables** (ver sección anterior):
tarjetas, códigos, folios y títulos navegan a su detalle real cuando existe, con
hover/focus visibles, navegación por teclado y sin enlaces falsos; los botones
internos no disparan la navegación del contenedor.

## Auditorías (TASK-010)

- Detalle de auditoría con **encabezado + siguiente acción + barra de progreso**
  (`.progressbar`, 6 etapas) + **pestañas** (Resumen/Plan/Checklist/Evidencia/
  Hallazgos/Informe/Seguimiento/Archivos/Historial), evitando la pantalla vertical
  interminable.
- **Modo ejecución** (`.exec-*`) enfocado: tarjetas por requisito, filtros
  pendiente/evaluado, progreso `N/M`, sin ruido administrativo.
- Badges en español: `badge--aud-*` (auditoría), `badge--prog-*` (programa),
  `badge--fcl-*`/`badge--fst-*` (hallazgo), `badge--res-*` (resultado),
  `badge--prep-*` (preparación), `badge--cert-*` (certificación). Sin UUID ni
  estados internos en inglés.
- Regla global de clickeables aplicada: folios (`PA/AUD/HAL`), títulos, códigos de
  requisito y tarjetas navegan a su detalle real; hover/focus visibles.

## Motor documental estructurado (DOC-001)

- **Creación por pasos** (`/dashboard/documents/new/editor`): **Paso 1** selección
  de tipo con tarjetas (`.type-grid`/`.type-card`, prefijo + etiqueta +
  descripción, `:hover`/`:focus-visible`); **Paso 2** identificación con el
  estándar de formulario CORE-UX-004 (`.field`, `.form-grid-2` máx. 2 columnas,
  `.field__help`); **Paso 3** editor por tipo. Evita las filas horizontales
  gigantes de campos.
- **Editor estructurado** (`.struct-editor`): barra fija con código/versión y
  acciones (Vista previa, Guardar); secciones como `fieldset`/`legend`
  (`.struct-section`); **bloques repetibles** (`.struct-repeat__item`) con botones
  accesibles **Subir/Bajar/Eliminar** (con `aria-label`) y numeración automática
  cuando aplica. Contenido a una columna.
- **Renderer normalizado** (`.doc-render`): encabezado **C3 Sentinel** +
  identificación (tipo, código, versión, área, fechas) + cuerpo por secciones;
  tablas para repetibles; estados vacíos textuales. Reutilizable para la vista
  previa (solo lectura) y exportación futura a PDF/DOCX.
- **Documento externo** (`.external-doc-card`): tarjeta "Documento externo
  registrado" con acciones reales (consultar/descargar) y "Convertir…
  (Próximamente)" deshabilitado, sin botones sin ruta.
- Marca visible: **C3 Sentinel** en todo texto nuevo.

## Referencias inteligentes documentales (DOC-002)

- **Editor con referencias** (`.ref-editor`, `contenteditable`): en campos de texto
  largo, `@` abre un **autocompletado** (`.ref-autocomplete`, `role="listbox"`,
  navegable por teclado con `aria-activedescendant`) y `//` abre un **modal**
  (`.modal`) para emitir un formato. Las referencias se muestran como **chips**
  (`.ref-chip`, `.ref-chip--form`).
- **Render/preview**: las referencias son enlaces (`.doc-ref`; `--missing` /
  `--obsolete`) al detalle del documento, y las secciones "Documentos
  referenciados" y "Formatos y registros relacionados" se llenan **solas** desde el
  contenido (no se capturan dos veces).
- **Detalle**: sección "Relaciones documentales" (y "Emitido desde" en formatos)
  con folios/títulos clickeables (regla global de clickeables).
- Marca visible: **C3 Sentinel** en todo texto nuevo.

## Presentación y biblioteca documental (DOC-UX-001)

- **Marca visible**: la app se identifica como **C3 Sentinel** (favicon, marca
  "S", sidebar, login, título, landing). No hay rename técnico: repo, tablas y
  variables internas conservan sus nombres.
- **Render del documento** (`.doc-render`): encabezado con la marca de la
  **organización** (`.doc-render__org-brand`: logo o nombre), no la de C3. Pie
  (`.doc-render__footer`) con la leyenda `DOCUMENTO CONTROLADO Y CONFIDENCIAL` y
  atribución discreta de C3 Sentinel + `www.c3digital.com.mx`. Imprimible
  (`@media print`: `thead` repetido, control de `page-break`); sin paginación
  falsa.
- **Tema documental**: colores por organización (`--doc-primary/-secondary/
-accent`), **solo HEX validado** (sin inyección CSS), aplicado **solo al render
  del documento**, no al tema global de la app. Se configura en
  `/dashboard/documents/settings` con vista previa en vivo.
- **Control de cambios**: sección automática (Versión/Fecha/Modificación
  realizada/Realizado por); v1.0 sin notas → "Documento nuevo".
- **Biblioteca** (`/dashboard/documents`): buscador, KPIs clickeables, **áreas
  como carpetas** (`.doc-lib__folder`) → tipos, y **listado maestro**
  (`/dashboard/documents/master`) con filtros. Enlaces a documentos como
  **CÓDIGO — Nombre** (regla global de clickeables).
- **Procedimiento**: la tabla formal muestra #/Actividad/Descripción/Responsable
  (sin Evidencia/Observaciones); la evidencia sigue viva en Tareas/CAPA/Auditorías.

## Toolbar, copias controladas y diseños documentales (DOC-UX-002)

- **Toolbar documental** (`.doc-toolbar`): barra state-aware en la vista del
  documento, con grupos **Edición** / **Salida** / **Administración**. Solo
  aparecen las acciones relevantes al estado/versión/permisos. Las transiciones de
  workflow se **reutilizan** en el panel «Control documental» (no se duplican).
- **Copias controladas** (`Imprimir` / `Guardar como PDF`): abren un diálogo
  (`.modal`) que pide **área destino** (impresión) o **motivo** (PDF), generan un
  **folio** `CC-<código>-####` y renderizan en modo copia controlada con **marca
  de agua** «COPIA CONTROLADA» (`.doc-copy__watermark`, estilo propio para
  contraste). Borrador → `BORRADOR — NO CONTROLADO` sin folio; obsoleto →
  advertencia + `DOCUMENTO OBSOLETO`. El diálogo del navegador exporta el PDF
  («Guardar como PDF»); la UX lo explica.
- **Historial de copias**: sección «Copias controladas (salidas)» en el panel del
  documento (folio/tipo/versión/destino-motivo/autor/fecha, datos reales).
- **Diseños documentales** (`.design-cards`): cards seleccionables con mini-preview
  real (C3 Moderno / Corporativo / Técnico / Minimalista). El diseño cambia la
  clase raíz `doc-render--design-<id>`; el tema (5 colores) es independiente.
- **Atribución C3** (`Configuración documental` → Marca): toggle «Mostrar
  atribución de C3 Sentinel»; **bloqueado** con badge «Función premium» si la
  organización no es elegible (facturación anual o planes superiores). El guard es
  server-side: nunca se oculta la confidencialidad ni las marcas de copia.

## Herramientas de análisis y Estudios de datos (CORE-ALIGN-003)

- **Gráficos interactivos**: los puntos/segmentos exponen su valor y contexto en
  hover/focus (`<title>`, `role="img"`, `tabIndex`), navegables por teclado y con
  `prefers-reduced-motion`. Aplica a tendencia, barras, Gantt y gauge.
- **Interpretación determinista** (`.interpretation`): bloque de 3 niveles
  (resultado principal / interpretación / siguiente paso). Nunca afirma causalidad
  ni inventa significancia; la conclusión humana se muestra por separado.
- **FTA** (`.fta__*`): árbol SVG derivado de la estructura (no drag-and-drop), con
  esquema textual accesible e imprimible; badges de compuerta Y/O; edición
  agregar/cambiar/eliminar en `<details>` con `no-print`.
- **5 Porqués** (`.fivewhys__*`): cadena vertical de longitud variable; evidencia y
  nota por nivel; la causa raíz la captura el responsable.
- **Estudios de datos**: workspace con pestañas (Resumen/Datos/Variables/Calidad/
  Análisis/Conclusión); tablas paginadas; `badge--study-*` en español.
- **Versión imprimible**: botón Imprimir + `.no-print` en controles; el reporte
  (`.analysis-report`/`.report-card`) queda limpio para PDF.
- Regla global de clickeables: folios (`EST`), títulos y orígenes navegan a su
  detalle real; la biblioteca de análisis enruta 5 Porqués/FTA al workspace
  transversal y el resto a la CAPA.
