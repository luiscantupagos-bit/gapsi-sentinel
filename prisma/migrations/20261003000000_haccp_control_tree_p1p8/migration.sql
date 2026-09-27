-- HACCP-CONTROL-TREE-P1-P8 — árbol de decisión real (P1..P8) con el desenlace «Controlado en otra
-- etapa». Migración ADITIVA (0 DROP TABLE / 0 DROP COLUMN): solo extiende el CHECK de clasificación
-- de las evaluaciones para admitir 'controlled_elsewhere'. Reemplazar (DROP + ADD) un CHECK no es
-- un DROP de tabla/columna. Ver docs/platform/HACCP-CONTROL-TREE-P1-P8-DESIGN.md.

ALTER TABLE "haccp_control_assessments"
  DROP CONSTRAINT IF EXISTS "haccp_control_assessments_classification_check";
ALTER TABLE "haccp_control_assessments"
  ADD CONSTRAINT "haccp_control_assessments_classification_check"
  CHECK ("classification" IN ('ppr', 'ppro', 'pcc', 'other', 'review_required', 'controlled_elsewhere'));
