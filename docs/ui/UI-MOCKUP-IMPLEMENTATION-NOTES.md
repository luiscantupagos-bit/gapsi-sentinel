# Normalización visual según mockups — notas de implementación

Actualización visual integral del área privada para acercar las páginas a los
mockups provistos, **sin cambiar lógica de negocio, permisos, estados, base de
datos ni migraciones**. Es una tarea de presentación y consolidación de interfaz.

## Referencias

Los mockups se proporcionaron como imágenes (Panel, Documentos, Tareas, Acciones
correctivas, Bandeja CAPA, Análisis TASK-008). **No estaban versionados** como
`docs/ui-references/*.png` en el repositorio; la comparación se hizo contra esas
imágenes y con verificación de estilos/estructura en el navegador. Si se desea la
comparación por archivo (PASO 13 con capturas lado a lado), subir los 6 PNG a
`docs/ui-references/`.

## Alcance y decisiones

- **Sistema visual** (`globals.css`): paleta azul de acción + sidebar azul marino,
  fondo gris, escala de espaciado, radios y sombras sutiles. Ver
  `docs/ui/UI-STANDARD.md`.
- **Chrome**: `AppSidebar` (logo, iconos SVG, estado activo, sección "Módulos",
  cerrar sesión) y `AppTopbar` (organización/sitio reales, campana, avatar+rol).
- **Componentes compartidos**: `PageHeader`, `StatCard`, `SectionCard`,
  `DonutChart`, `BarChart`, iconos. Reutilizables por todas las páginas.
- **Panel**: statcards, donut "CAPA por estado", barras "Abiertas por prioridad",
  "Actividad reciente" y "Próximas tareas" — con **datos reales** (consulta de
  solo lectura `getCapaDashboard`). Documentos y Diagnósticos como secciones.
- **Listados** (Documentos, Tareas, Acciones correctivas, Bandeja CAPA, Análisis):
  heredan la normalización de tablas (tarjeta + encabezado gris + hover), badges,
  filtros y botones azules a través de los tokens/clases compartidas.

## Diferencias inevitables / deliberadas

- **Módulos futuros** (Auditorías, Proyectos, Riesgos, Proveedores, Capacitación,
  Reportes, Configuración): aparecen en el sidebar **deshabilitados** (no son
  enlaces funcionales) porque esas rutas no existen aún. No se muestran como
  navegación operativa para no inventar funciones.
- **Selectores de organización/sitio y campana** de la topbar son de solo
  presentación: muestran el valor **real** de la sesión; no cambian de
  organización (el adaptador de desarrollo usa una sesión fija) ni hay backend de
  notificaciones todavía.
- **Datos**: se conservan los datos reales del sistema; no se sustituyeron por los
  nombres/cifras ficticios de los mockups (p. ej. el usuario es "Evaluador A /
  Propietario", no "María González"). No se inventan tendencias históricas (los
  statcards no muestran deltas porque el sistema aún no los calcula).
- **Gráficos**: SVG propios (donut/barras) sin librerías pesadas; incluyen leyenda
  con valores (accesibles, no dependen solo del color).

## Páginas y archivos

- Nuevos: `src/app/dashboard/_components/{icons,AppSidebar,AppTopbar,PageHeader/StatCard/SectionCard (ui),Charts}.tsx`.
- Modificados: `src/app/globals.css` (tokens + chrome + componentes),
  `src/app/dashboard/layout.tsx` (nuevo shell), `src/app/dashboard/page.tsx`
  (Panel), `src/server/capa.ts` (solo `getCapaDashboard`, lectura),
  `tests/layout.test.ts` (ajuste del sidebar móvil).
- Sin migraciones, sin cambios de esquema, sin cambios de lógica CAPA/TASK-008.

## Validaciones

`format:check`, `lint`, `typecheck`, `npm test` (169) y `npm run build` en verde.
Responsive verificado sin desbordamiento horizontal en 1920/768/390 (y por diseño
fluido en 1440/1280/1024/375). El editor documental conserva su hoja (816px).

## Comparación por página (resumen)

| Página               | Ajuste principal                              | Estado      |
| -------------------- | --------------------------------------------- | ----------- |
| Panel                | Statcards + donut + barras + actividad/tareas | ✔          |
| Documentos           | Chrome + tabla-tarjeta + badges + botón azul  | ✔ (hereda) |
| Tareas               | Chrome + tablas normalizadas                  | ✔ (hereda) |
| Acciones correctivas | Chrome + tabla-tarjeta + badges               | ✔ (hereda) |
| Bandeja CAPA         | Chrome + tarjetas/tablas                      | ✔ (hereda) |
| Análisis             | Chrome + tarjetas de herramienta + tabla      | ✔ (hereda) |

## Pendientes

- Comparación por archivo (capturas lado a lado) cuando los PNG estén en el repo.
- Pruebas de captura (Playwright) opcionales; no se añadió la dependencia para no
  desbalancear el proyecto — la verificación se hizo con inspección de estilos y
  estructura en el navegador.
- Refinamiento fino por página (densidad exacta, paginación visual) si se requiere
  mayor fidelidad.
