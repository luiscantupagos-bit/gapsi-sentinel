-- HACCP-PROCESS-EXPANSION — entradas, salidas, destinos y contexto de peligro del proceso.
-- Migración ADITIVA (0 DROP TABLE / 0 DROP COLUMN). Enriquece HaccpProcessStep/Connection sin
-- sustituirlos; conserva las columnas de texto inputs/outputs existentes (compatibilidad §S1).
-- Ver docs/platform/HACCP-PROCESS-EXPANSION-DESIGN.md.

-- 1) Contexto del peligro (aditivo, §M): step|input|output + refs lógicas.
ALTER TABLE "haccp_hazards" ADD COLUMN IF NOT EXISTS "context_type" TEXT;
ALTER TABLE "haccp_hazards" ADD COLUMN IF NOT EXISTS "input_logical_id" UUID;
ALTER TABLE "haccp_hazards" ADD COLUMN IF NOT EXISTS "output_logical_id" UUID;
-- Backfill seguro (§M5): los peligros de etapa existentes quedan con contexto 'step'.
UPDATE "haccp_hazards" SET "context_type" = 'step'
  WHERE "context_type" IS NULL AND "source_type" = 'process_step';
ALTER TABLE "haccp_hazards" ADD CONSTRAINT "haccp_hazards_context_type_check"
  CHECK ("context_type" IS NULL OR "context_type" IN ('step', 'input', 'output'));

-- 2) Entradas del proceso.
CREATE TABLE "haccp_process_inputs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "process_step_id" UUID NOT NULL,
    "input_logical_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "input_type" TEXT NOT NULL,
    "source_type" TEXT NOT NULL DEFAULT 'supplier',
    "source_process_step_id" UUID,
    "source_reference_id" UUID,
    "supplier_name" TEXT,
    "external_source" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "haccp_process_inputs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "haccp_process_inputs_id_org_key" ON "haccp_process_inputs" ("id", "organization_id");
CREATE INDEX "haccp_process_inputs_version_idx" ON "haccp_process_inputs" ("plan_version_id");
CREATE INDEX "haccp_process_inputs_step_idx" ON "haccp_process_inputs" ("organization_id", "process_step_id");
ALTER TABLE "haccp_process_inputs"
  ADD CONSTRAINT "haccp_process_inputs_version_fkey" FOREIGN KEY ("plan_version_id", "organization_id")
  REFERENCES "haccp_plan_versions"("id", "organization_id") ON DELETE RESTRICT;

-- 3) Salidas del proceso.
CREATE TABLE "haccp_process_outputs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "process_step_id" UUID NOT NULL,
    "output_logical_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "output_type" TEXT NOT NULL,
    "condition_status" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "haccp_process_outputs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "haccp_process_outputs_id_org_key" ON "haccp_process_outputs" ("id", "organization_id");
CREATE UNIQUE INDEX "haccp_process_outputs_version_logical_key" ON "haccp_process_outputs" ("plan_version_id", "output_logical_id");
CREATE INDEX "haccp_process_outputs_version_idx" ON "haccp_process_outputs" ("plan_version_id");
CREATE INDEX "haccp_process_outputs_step_idx" ON "haccp_process_outputs" ("organization_id", "process_step_id");
ALTER TABLE "haccp_process_outputs"
  ADD CONSTRAINT "haccp_process_outputs_version_fkey" FOREIGN KEY ("plan_version_id", "organization_id")
  REFERENCES "haccp_plan_versions"("id", "organization_id") ON DELETE RESTRICT;

-- 4) Destinos de las salidas (normalizado; una salida puede tener múltiples rutas §E3).
CREATE TABLE "haccp_process_output_destinations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "output_logical_id" UUID NOT NULL,
    "destination_logical_id" UUID NOT NULL,
    "destination_type" TEXT NOT NULL,
    "destination_process_step_id" UUID,
    "destination_external_text" TEXT,
    "destination_source_reference_id" UUID,
    "label" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "haccp_process_output_destinations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "haccp_process_output_destinations_id_org_key" ON "haccp_process_output_destinations" ("id", "organization_id");
CREATE INDEX "haccp_process_output_destinations_version_idx" ON "haccp_process_output_destinations" ("plan_version_id");
CREATE INDEX "haccp_process_output_destinations_output_idx" ON "haccp_process_output_destinations" ("organization_id", "output_logical_id");
-- FK a la salida por (plan_version_id, output_logical_id); Cascade al borrar la salida.
ALTER TABLE "haccp_process_output_destinations"
  ADD CONSTRAINT "haccp_process_output_destinations_output_fkey" FOREIGN KEY ("plan_version_id", "output_logical_id")
  REFERENCES "haccp_process_outputs"("plan_version_id", "output_logical_id") ON DELETE CASCADE;

-- 5) RLS + grants para las 3 tablas nuevas.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['haccp_process_inputs', 'haccp_process_outputs', 'haccp_process_output_destinations'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;
