# CORE-ALIGN-001 — Revisión visual

Verificación funcional/visual de la consolidación. **Nota de entorno:** en esta
sesión el panel del navegador no compone frames (no fue posible generar capturas
PNG); la verificación se realizó con la app corriendo (`next dev`, sesión demo)
mediante extracción de DOM/texto real de cada pantalla y revisión de consola. El
`npm run build` compila las 33 rutas y la suite (348 pruebas) pasa.

Los mockups de referencia (`docs/ui-references`, `docs/ui/screenshots/final/*`)
guían jerarquía, densidad y ubicación; los datos siempre son reales del sistema.

## Pantallas revisadas (viewport 1440 y 390)

### Panel (`/dashboard`)

- **Referencia:** `dashboard-ejecutivo-final` (tema oscuro) adaptado a tema claro.
- **Corrección:** se eliminaron Sentinel Score, "Estado de auditoría —
  Próximamente" (duplicado), IA Insights, certificación, tendencia y Gantt/
  "TASK-009", y la tira con "Hace un momento".
- **Estado real observado:** fila de 6 indicadores reales (Diagnósticos en
  progreso 0 · Tareas vencidas 1 · CAPA abiertas 7 · Hallazgos abiertos 2 ·
  Documentos por revisar 3 · Auditorías en seguimiento 1); alertas prioritarias y
  próximas acciones con folios clickeables; auditorías; trabajo y documentos; CAPA
  por estado/prioridad (estados en español). Sin overlay de errores.

### Diagnósticos (`/dashboard/diagnostics`, `/[id]`, `/results`)

- **Corrección P0:** no existía listado. Ahora hay listado con resumen, búsqueda,
  filtro y columnas humanas (nombre/esquema/sitio/responsable/progreso/estado/
  fecha objetivo/actualizado). Nombre y fila clickeables; sin UUID.
- **Detalle:** encabezado + siguiente acción por estado + progreso de captura.
- **Resultado:** "Resultado de evaluación" (sin "preliminar/demostración"), con
  cumplimiento, nivel de riesgo, críticos, conformes/no conformes/no aplica,
  resumen por sección, brechas y escala de riesgo documentada. Verificado: la
  fila del diagnóstico abre su detalle (progreso 33%, estado "Borrador").

### Documentos (`/dashboard/documents`, `/[id]`)

- **Corrección:** código (CTL-01) y título ahora son enlaces; **0 botones "Ver"**
  (verificado en DOM). Versionado automático menor/mayor con motivo obligatorio
  (sin captura manual de etiqueta). Estados de flujo/decisión/distribución/copia
  en español; "Recuperar" → "Registrar recuperación"; archivar en "Más acciones".

### CAPA (`/dashboard/capa/[id]`)

- **Corrección:** progreso por etapas (Registro→Contención→Investigación→Plan→
  Implementación→Eficacia→Cierre, verificado) + siguiente acción contextual
  ("Registra la contención inmediata…"). **Sin "Checksum de cierre"** en pantalla
  (verificado). Estados en español.

### Análisis (`/dashboard/capa/analysis`)

- **Corrección:** se eliminó el fragmento de UUID como identificador; el título
  abre el análisis y el folio la CAPA (tabla enlazable).

### Indicadores y Analítica (`/dashboard/kpis`, `/dashboard/analytics`)

- **Corrección:** subtítulos con lenguaje de usuario (sin "servidor/determinista/
  sin IA"); Analítica conserva "la correlación no implica causalidad"; Relaciones
  y distribuciones muestran estado en español; accesos "Ver eventos"/"Ver
  indicadores".

### Navegación y topbar (todas las pantallas)

- **Sidebar** agrupado (Panel · Cumplimiento · Mejora · Trabajo · Desempeño) con
  solo rutas reales; Diagnósticos presente; Bandeja CAPA y Eventos fuera del nivel
  principal; sin módulos deshabilitados. Verificado en DOM.
- **Topbar** sin selectores falsos ni campana; organización/sitio como contexto.

## Diferencias aceptadas respecto a los mockups

- Tema claro (los mockups del panel eran oscuros); se conservan acentos de color.
- Se prioriza el dato real sobre la maqueta: cuando un módulo del mockup no existe
  (Sentinel Score, riesgos), **no** se muestra como "Próximamente".

## Consola

En cargas limpias no se observan errores de hidratación ni de runtime en Panel,
Diagnósticos, Documentos ni CAPA (los avisos transitorios vistos durante la
edición provenían de Fast Refresh al recompilar).

## Pendiente

- Generación de capturas PNG a 1920/1440/390 (bloqueada por el entorno; repetir en
  un entorno con panel de navegador visible).
