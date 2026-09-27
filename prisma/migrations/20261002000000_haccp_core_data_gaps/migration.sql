-- HACCP-CORE-DATA-GAPS — cierra dos gaps detectados en la reorganización del workspace.
-- Migración ADITIVA (0 DROP TABLE / 0 DROP COLUMN). Sin tablas ni entidades nuevas: los datos
-- pertenecen a entidades existentes (HaccpPlanVersion y HaccpControlPlan), version-owned, por lo
-- que NO requieren RLS/FKs adicionales. Ver docs/platform/HACCP-CORE-DATA-GAPS-DESIGN.md.

-- Gap #1 — USO PREVISTO (paso 3), en la versión del plan (version-owned).
ALTER TABLE "haccp_plan_versions" ADD COLUMN IF NOT EXISTS "intended_use" TEXT;
ALTER TABLE "haccp_plan_versions" ADD COLUMN IF NOT EXISTS "intended_consumer" TEXT;
ALTER TABLE "haccp_plan_versions" ADD COLUMN IF NOT EXISTS "sensitive_groups" TEXT;
ALTER TABLE "haccp_plan_versions" ADD COLUMN IF NOT EXISTS "usage_conditions" TEXT;
ALTER TABLE "haccp_plan_versions" ADD COLUMN IF NOT EXISTS "distribution_conditions" TEXT;
ALTER TABLE "haccp_plan_versions" ADD COLUMN IF NOT EXISTS "preparation_or_handling" TEXT;
ALTER TABLE "haccp_plan_versions" ADD COLUMN IF NOT EXISTS "misuse_considerations" TEXT;
ALTER TABLE "haccp_plan_versions" ADD COLUMN IF NOT EXISTS "other_intended_use_notes" TEXT;

-- Gap #2 — DISPOSICIÓN del producto/material afectado (paso 10), en el plan de control.
ALTER TABLE "haccp_control_plans" ADD COLUMN IF NOT EXISTS "disposition" TEXT;
