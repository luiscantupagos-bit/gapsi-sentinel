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

---

# Validación visual final (capturas reales vs. mockups)

## Método de captura

El navegador integrado no compone frames (no permite `screenshot`). Alternativa
usada **sin agregar dependencias**: **Microsoft Edge del sistema en modo
`--headless=new`** controlado por el **Chrome DevTools Protocol** vía las APIs
globales `fetch` y `WebSocket` de Node 24 (script `scratchpad/shoot.mjs`). Se
inyecta la cookie de sesión de desarrollo (`gapsi_session`) con `Network.setCookie`
y se captura cada ruta a **1920×1080** con `Page.captureScreenshot`.

Capturas generadas en `docs/ui/screenshots/final/`:

- `01_panel.png` · `02_documentos.png` · `03_tareas.png`
- `04_acciones_correctivas.png` · `05_bandeja_capa.png` · `06_analisis.png`

> Nota: los mockups de referencia se recibieron como imágenes en la conversación;
> **no existen** como `docs/ui-references/*.png` en el repo, por lo que la
> comparación se hizo contra esas imágenes. El recuadro rojo "1 Issue" que aparece
> abajo-izquierda en algunas capturas es el **indicador de desarrollo de Next.js**,
> no forma parte de la interfaz (no aparece en producción).

## Comparación por página

| Aspecto    | Panel       | Documentos | Tareas | Acciones corr. | Bandeja CAPA         | Análisis |
| ---------- | ----------- | ---------- | ------ | -------------- | -------------------- | -------- |
| Estructura | ✔          | ✔         | ~      | ✔             | ✔ (tras corrección) | ✔       |
| Sidebar    | ✔          | ✔         | ✔     | ✔             | ✔                   | ✔       |
| Topbar     | ✔          | ✔         | ✔     | ✔             | ✔                   | ✔       |
| Títulos    | Dashboard\* | ✔         | ~      | ✔             | ✔                   | ✔       |
| Tarjetas   | ✔          | —          | —      | —              | ✔                   | ✔       |
| Filtros    | —           | ✔         | —      | ✔             | —                    | ✔       |
| Tablas     | ✔          | ✔         | ✔     | ✔             | ✔                   | ✔       |
| Botones    | ✔          | ✔ (2)     | —      | ✔             | ✔                   | ~        |
| Badges     | ✔          | ✔         | ✔     | ✔             | ✔                   | ✔       |
| Espaciado  | ✔          | ✔         | ✔     | ✔             | ✔                   | ✔       |
| Tipografía | ✔          | ✔         | ✔     | ✔             | ✔                   | ✔       |
| Responsive | ✔          | ✔         | ✔     | ✔             | ✔                   | ✔       |

`*` Título "Dashboard" por solicitud explícita del usuario (el mockup dice "Panel").

## Estimación honesta de similitud

| Página               | Similitud | Comentario                                                                                                                                                                                                                                                                                                                                   |
| -------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel                | ~90%      | Coincide en sidebar, topbar, statcards, donut, barras, actividad y próximas tareas. Diferencias **intencionales**: título "Dashboard" (petición del usuario), sin deltas de tendencia (el sistema no calcula históricos), datos reales en lugar de los ficticios del mockup.                                                                 |
| Documentos           | ~88%      | Chrome, filtros, tabla y badges equivalentes. Título ajustado a "Documentos" + subtítulo. Mantiene 2 botones (registrar externo / crear interno) y columnas más ricas por funcionalidad real.                                                                                                                                                |
| Tareas               | ~60%      | Divergencia **conceptual**: la ruta actual es la bandeja de **tareas documentales**; el mockup plantea un **gestor de tareas global** con pestañas (Mis tareas/Todas/Vencidas/Próximas/Completadas) y tabla unificada, que sería **funcionalidad nueva** (fuera de alcance de una normalización visual). El chrome y el estilo sí coinciden. |
| Acciones correctivas | ~90%      | Muy cercano. Se añadió subtítulo y se renombró el botón a "Nueva CAPA". La tabla real incluye columnas adicionales (Sitio, Severidad, Fecha objetivo, Avance).                                                                                                                                                                               |
| Bandeja CAPA         | ~82%      | Se añadieron las **4 tarjetas resumen** (Por atender/Vencidas/Próximas/En revisión) y subtítulo, alineando el encabezado con el mockup. Se conservan las secciones por tipo de tarea (más informativas) en lugar de las pestañas + tabla única del mockup.                                                                                   |
| Análisis             | ~92%      | Prácticamente idéntico (7 tarjetas de herramienta, filtros, tabla, badges). Sin botón "+ Nuevo análisis" porque los análisis se crean **dentro de una CAPA**; las tarjetas de herramienta filtran por tipo. Iconos con emoji en lugar de iconos de línea.                                                                                    |

## Correcciones aplicadas (solo diferencias visuales claras y seguras)

- **Bandeja CAPA**: 4 tarjetas resumen (datos existentes de `getCapaTasks`) + subtítulo.
- **Acciones correctivas**: subtítulo descriptivo + botón "Nueva CAPA".
- **Documentos**: título "Documentos" + subtítulo "Gestiona los documentos del sistema".

No se modificó lógica, datos, base de datos, migraciones ni funcionalidades.

## Diferencias remanentes (justificadas, no corregidas)

- **Datos reales** en vez de los ficticios del mockup (usuario "Evaluador A /
  Propietario", organización "Alimentos Demo A", cifras reales); sin tendencias
  históricas inventadas.
- **Módulos futuros** deshabilitados en el sidebar (rutas inexistentes).
- **Tareas**: gestor global de tareas = funcionalidad futura (no se inventa).
- **Análisis**: creación desde la CAPA (no botón global); iconos emoji.
- **Documentos/Acciones**: columnas adicionales por mayor funcionalidad real.
