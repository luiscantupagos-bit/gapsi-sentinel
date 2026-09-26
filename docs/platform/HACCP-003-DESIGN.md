# HACCP-003 — Análisis de peligros · diseño e implementación

Rama `feat/haccp-003-hazard-analysis` (desde `main` tras integrar HACCP-002 = 374e648). Análisis
estructurado de peligros para MATERIAS PRIMAS y ETAPAS del proceso, consumiendo las fuentes ya
existentes (no recaptura nombres). Termina en peligro + riesgo + significancia + medida
existente. La clasificación PCC/PPRO es HACCP-004.

## Modelo

- **`haccp_hazards`** (version-owned): `hazard_logical_id` (identidad LÓGICA estable entre
  versiones, como process_step_id). `source_type` = `material` (→ `source_reference_id`, fila de
  `haccp_source_references`) | `process_step` (→ `process_step_id`, identidad lógica de la etapa).
  `hazard_type` (biological/chemical/physical/allergen/radiological/other), name, description,
  origin_or_cause, probability, severity, risk_score, is_significant, significance_source
  (calculated/override), significance_reason, existing_control_measure.
- **`haccp_risk_matrix_configs`** (version-owned, **SNAPSHOT** de metodología, §22): escalas de
  probabilidad/severidad en JSON, `score_formula` (multiply/sum), `significance_threshold`. Una
  por versión; la publicada recuerda su matriz exacta.

Escala por defecto 1-5 (Remota..Muy alta / Menor..Crítica), umbral 8, fórmula multiply. NO se
limita a B/Q/F (soporta alérgeno/radiológico/otros, §6/§7).

## Reglas

- **Score y significancia CENTRALIZADOS** (`features/haccp/haccp-hazards.ts`): score =
  P×S (configurable a suma); significativo si score ≥ umbral. **Override** manual (§21) con
  justificación obligatoria (actor implícito, `significance_source='override'`). Guardar la
  matriz recalcula los peligros no-override.
- **Matriz de riesgo ≠ semáforo de cumplimiento** (§25): banda de riesgo propia (bajo/medio/alto)
  con score visible en cada celda (no solo color, §24).
- **Version ownership / inmutabilidad** (§5/§32): publicado read-only; nueva versión clona matriz
  - peligros preservando `hazard_logical_id` y las referencias lógicas (process_step_id, y la MP
    se remapea a la fila clonada). Peligro nuevo = id lógico nuevo; peligro borrado en draft no
    toca el histórico publicado.
- **Aviso de cambio de flujo** (§33): si el flujo del draft difiere del publicado (`flowChanged`),
  se muestra alerta en el análisis; NO borra ni recalcula peligros automáticamente.
- **Materias sin ficha** (§11): si el plan no tiene fuentes `material`, el análisis de MP muestra
  un estado que indica la dependencia; NO se crea material temporal ni se inventan fichas.

## UI

- Tab **«Análisis de peligros»** habilitado, con subtabs **Materias primas / Proceso / Criterios
  de riesgo**. Resumen (cards §37): materias/etapas analizadas, peligros, significativos.
- Vistas reutilizables (read-only, para HACCP-007): `HaccpHazardAnalysisView` (grupos colapsables
  por MP/etapa con contadores) y `RiskMatrixView` (grid N×N con score+banda).
- Editor en borrador: agregar/editar/eliminar peligros (score calculado server-side), editor de
  criterios de riesgo. Filtros básicos (todos/significativos/por tipo). Fuentes clickeables.
  Responsive, sin dependencia de hover.

## Migración

`20260926000000_haccp_hazard_analysis` (aditiva; 0 DROP): 2 tablas con RLS + políticas tenant +
grants a `gapsi_app` + FKs tenant-safe.

## Seed

`PL-HACCP-001` con matriz por defecto y **7 peligros de PROCESO** demo (Salmonella, contaminación
cruzada, fragmentos de cascarón, contaminación física/química…) vinculados a etapas reales del
flujo; 4 significativos. **Sin peligros de materia prima** (no hay fichas de MP; §54, no se
inventan).

## Fuera de alcance

HACCP-004 (PCC/PPRO, árbol de decisión, límites críticos, monitoreo); DOC-004 (Records); Tasks/
Gantt. La salida documental del análisis (HaccpHazardAnalysisView/RiskMatrixView en PDF) es
HACCP-007. `hazardAnalysisCompleteness` y el aviso `flowChanged` quedan como base para el impact
assessment futuro (no bloqueo duro).
