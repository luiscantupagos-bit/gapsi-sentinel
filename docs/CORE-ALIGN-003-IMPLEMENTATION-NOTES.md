# CORE-ALIGN-003 — Notas de implementación

Herramientas transversales de análisis y Estudios de Datos. Sin TASK-012, sin IA,
sin SPC avanzado (diferido). Sin push automático; commits pequeños; sin modificar
migraciones previas.

## Fases

1. **Gráficos interactivos** (`_components/exec.tsx`, `globals.css`): puntos de
   tendencia enfocables (`tabIndex`, `role="img"`, `<title>`), tooltips en barras,
   Gantt y gauge; `prefers-reduced-motion`.
2. **Modelo + migración** `20260808000000_analysis_studies` (datamodel↔datamodel,
   0 DROP heredado): `QualityAnalysis.capaId` nullable; tipos `5whys`/`fta`; 9
   modelos nuevos (AnalysisRelation, FtaNode, DataStudy + estudios). FKs compuestas,
   CHECK, RLS, triggers append-only/no-borrado, grants por SQL complementario.
3. **Estudios: importación** — parser CSV/TSV propio + XLSX (`exceljs`, sin macros),
   clasificación, calidad, variables calculadas (AST sin `eval`). Ver
   [DATA-STUDIES-ARCHITECTURE](analytics/DATA-STUDIES-ARCHITECTURE.md).
4. **Estudios: análisis + interpretación** — DatasetAdapter que reutiliza los
   motores (statistics.ts, computePareto); `StudyAnalysis` congelado y reproducible;
   interpretación determinista de 3 niveles; conclusión humana separada.
5. **Herramientas transversales**:
   - **5 Porqués** (formal, ≠ 5W2H): cadena de longitud variable sobre
     `QualityHypothesis` encadenada (`parentHypothesisId`, `sourceTool='5whys'`);
     evidencia/nota por nivel; causa raíz **solo** propuesta por el responsable.
   - **FTA** (`src/features/analysis/fta.ts` + tabla `fta_nodes`): evento
     superior/intermedio/básico, compuerta AND/OR por evento, SVG derivado del
     árbol, validación (único top, básicos sin hijos, compuerta al ramificar, sin
     ciclos), versión imprimible.
   - **Relaciones** (`analysis_relations`): `createLinkedAnalysis`, `attach/detach`,
     `listAnalysesForTarget`; `capaId` opcional; múltiples relaciones sin
     sobrescribir; validación de org/permisos/existencia en servidor.
   - **Entradas**: CAPA (Investigación), Proyecto (sección Análisis + avance
     derivado de tareas), Hallazgo (Investigar), Evento (Analizar). Biblioteca
     global en `/dashboard/capa/analysis` (herramienta/título/origen/estado/
     responsable/fecha/conclusión).
6. **Seed + docs + rebuild**: estudio demo `EST-2026-0001`; docs; rebuild‑from‑empty.

## Rutas de detalle de análisis

- `/dashboard/capa/[capaId]/analysis/[analysisId]` — editor existente para
  ishikawa/cause_tree/pareto/fmea/recurrence/comparative/freeform (CAPA-scoped).
- `/dashboard/analysis/[analysisId]` — **workspace transversal** (cualquier origen)
  con editor para **5 Porqués** y **FTA**, relaciones, conclusión humana e impresión.

## Reproducibilidad y prudencia

- Los análisis de estudio congelan dataset/config/resultado/interpretación.
- Ninguna herramienta infiere la causa raíz: la propone una persona.
- La interpretación automática nunca afirma causalidad ni inventa significancia.

## Validación

- Dominio: `tests/studies-dataset.test.ts`, `tests/studies-analysis.test.ts`,
  `tests/analysis-tools.test.ts`.
- DB: `tests/db/analysis-tools-access.test.ts` (5 Porqués, FTA AND/OR, validación de
  árbol, relaciones múltiples, permisos, aislamiento tenant).
- Rebuild‑from‑empty (`db:reset:local`) reconstruye esquema + seed; `test:db` 140/140
  serializado. Bajo alta concurrencia el `test:db` puede mostrar timeouts por
  contención de conexiones en la BD de desarrollo (ambiental, no lógico).

## Limitaciones conocidas (pendientes)

- El workspace transversal edita **solo** 5 Porqués y FTA; AMEF/Pareto/Ishikawa
  siguen siendo CAPA‑scoped (portar sus paneles al workspace es trabajo futuro).
- `createNewVersion`/snapshot de aprobación siguen exigiendo `capaId` y no copian
  nodos FTA ni la cadena de 5 Porqués: versionar/aprobar un análisis transversal o
  FTA/5whys no está soportado; el flujo draft→review→approved vive en la ruta CAPA.
- FTA modela la compuerta como propiedad del evento (no como nodo `gate` separado).
- SPC avanzado (Cp/Cpk, cartas de control, normalidad, DOE, ML) **diferido**.

## Entorno local

Los tests de BD requieren `DATABASE_URL` con host `127.0.0.1` (no `localhost`): en
Windows `localhost` resuelve a IPv6 `::1` y el contenedor solo publica IPv4.
