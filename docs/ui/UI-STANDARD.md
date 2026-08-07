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

- **Sidebar** (`AppSidebar`): azul marino, logo arriba, navegación con iconos y
  estado activo (`is-active`), sección "Módulos" con ítems futuros deshabilitados
  (no enlaces), cerrar sesión al pie. Fijo en escritorio; franja horizontal
  desplazable en móvil (≤720px).
- **Topbar** (`AppTopbar`): selector de organización y sitio (valor real de la
  sesión), campana decorativa (sin backend de notificaciones aún), avatar con
  iniciales, nombre y rol. Sticky.
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

## Dashboard Ejecutivo

Componentes en `src/app/dashboard/_components/exec.tsx` (tema claro):

- `KpiCard` — tarjeta KPI con anillo indicador (`ring` 0–100) y `tone`
  (green/amber/red/blue). Si el dato aún no existe, se pasa `placeholder`
  ("En configuración" / "Próximamente") en lugar de un valor.
- `SemiGauge` — medidor semicircular (0–100) con zonas de color; con `value={null}`
  muestra "En configuración" (componente preparado, sin cálculo aún).
- `Placeholder` — estado vacío para módulos sin datos ("Próximamente" /
  "En configuración").
- `.exec-strip` — tira de contexto (normas activas · última actualización ·
  próxima auditoría). `.kpi-row` — fila de KPIs (6→3→2→1 según viewport).

**Regla honesta:** el dashboard **no inventa métricas**. Solo se conectan datos
reales existentes (CAPA, documentos, marcos, diagnósticos); los módulos sin datos
(Sentinel Score, cumplimiento por norma, auditoría, Gantt, tendencia, IA,
certificación) se muestran como "En configuración" o "Próximamente".

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
