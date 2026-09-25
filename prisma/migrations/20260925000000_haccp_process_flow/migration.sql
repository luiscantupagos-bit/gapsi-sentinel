-- HACCP-002 — Diagrama de flujo. Migración ADITIVA (0 DROP TABLE / 0 DROP COLUMN).
-- Etapas (process steps) con identidad LÓGICA estable (process_step_id) y conexiones
-- dirigidas, version-owned. Verificación in situ por VERSIÓN completa (columnas en
-- haccp_plan_versions). Ver docs/platform/HACCP-002-DESIGN.md.

-- Verificación in situ del flujo (por versión, §E18).
ALTER TABLE "haccp_plan_versions"
  ADD COLUMN "flow_verified_on_site" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "flow_verified_at" TIMESTAMPTZ(6),
  ADD COLUMN "flow_verified_by" UUID,
  ADD COLUMN "flow_verification_notes" TEXT;

ALTER TABLE "haccp_plan_versions"
  ADD CONSTRAINT "haccp_plan_versions_flow_verified_by_fkey" FOREIGN KEY ("flow_verified_by")
  REFERENCES "users"("id") ON DELETE SET NULL;

-- Etapas del flujo.
CREATE TABLE "haccp_process_steps" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "process_step_id" UUID NOT NULL,
    "step_type" TEXT NOT NULL DEFAULT 'process',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "area" TEXT,
    "responsible_user_id" UUID,
    "responsible_role" TEXT,
    "equipment" TEXT,
    "inputs" TEXT,
    "outputs" TEXT,
    "parameters" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "haccp_process_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "haccp_process_steps_version_logical_key"
  ON "haccp_process_steps" ("plan_version_id", "process_step_id");
CREATE UNIQUE INDEX "haccp_process_steps_id_org_key"
  ON "haccp_process_steps" ("id", "organization_id");
CREATE INDEX "haccp_process_steps_version_idx"
  ON "haccp_process_steps" ("plan_version_id");

ALTER TABLE "haccp_process_steps" ADD CONSTRAINT "haccp_process_steps_type_check"
  CHECK ("step_type" IN ('process', 'inspection', 'storage', 'transport', 'decision', 'rework', 'output'));

ALTER TABLE "haccp_process_steps"
  ADD CONSTRAINT "haccp_process_steps_version_fkey" FOREIGN KEY ("plan_version_id", "organization_id")
  REFERENCES "haccp_plan_versions"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "haccp_process_steps"
  ADD CONSTRAINT "haccp_process_steps_responsible_fkey" FOREIGN KEY ("responsible_user_id")
  REFERENCES "users"("id") ON DELETE SET NULL;

-- Conexiones dirigidas entre etapas (por identidad lógica process_step_id).
CREATE TABLE "haccp_process_connections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "from_step_id" UUID NOT NULL,
    "to_step_id" UUID NOT NULL,
    "connection_type" TEXT NOT NULL DEFAULT 'sequence',
    "label" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "haccp_process_connections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "haccp_process_connections_version_idx"
  ON "haccp_process_connections" ("plan_version_id");

ALTER TABLE "haccp_process_connections" ADD CONSTRAINT "haccp_process_connections_type_check"
  CHECK ("connection_type" IN ('sequence', 'conditional', 'rework', 'reject'));

ALTER TABLE "haccp_process_connections"
  ADD CONSTRAINT "haccp_process_connections_version_fkey" FOREIGN KEY ("plan_version_id", "organization_id")
  REFERENCES "haccp_plan_versions"("id", "organization_id") ON DELETE RESTRICT;

-- RLS + grants (aislamiento por organización).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['haccp_process_steps', 'haccp_process_connections'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;
