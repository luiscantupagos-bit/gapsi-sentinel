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
