-- HACCP-006 — Verificación operacional. Migración ADITIVA (0 DROP TABLE / 0 DROP COLUMN).
-- Reutiliza el motor de recurrencia de Programas, la Task nativa, los Records (DOC-004) y el
-- Gantt existentes; NO crea un segundo scheduler. Solo agrega el almacenamiento de las
-- definiciones de verificación y sus ocurrencias. Ver docs/platform/HACCP-006-DESIGN.md.

-- 1) Definiciones de verificación (version-owned).
CREATE TABLE "haccp_verification_definitions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "verification_logical_id" UUID NOT NULL,
    "scope_type" TEXT NOT NULL,
    "control_measure_logical_id" UUID,
    "hazard_logical_id" UUID,
    "process_step_id" UUID,
    "title" TEXT NOT NULL,
    "purpose" TEXT,
    "method" TEXT,
    "responsible_user_id" UUID,
    "responsible_role" TEXT,
    "frequency_type" TEXT NOT NULL,
    "frequency_config" JSONB,
    "record_strategy" TEXT NOT NULL DEFAULT 'none',
    "required_document_id" UUID,
    "required_document_version_id" UUID,
    "evidence_required" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "start_at" DATE,
    "notify_before_days" INTEGER NOT NULL DEFAULT 7,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "haccp_verification_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "haccp_verification_definitions_id_org_key" ON "haccp_verification_definitions" ("id", "organization_id");
CREATE UNIQUE INDEX "haccp_verification_definitions_version_logical_key" ON "haccp_verification_definitions" ("plan_version_id", "verification_logical_id");
CREATE INDEX "haccp_verification_definitions_version_idx" ON "haccp_verification_definitions" ("plan_version_id");

ALTER TABLE "haccp_verification_definitions" ADD CONSTRAINT "haccp_verification_definitions_scope_check"
  CHECK ("scope_type" IN ('plan', 'pcc', 'ppro', 'hazard', 'control_measure'));
ALTER TABLE "haccp_verification_definitions" ADD CONSTRAINT "haccp_verification_definitions_status_check"
  CHECK ("status" IN ('active', 'paused', 'archived'));
ALTER TABLE "haccp_verification_definitions" ADD CONSTRAINT "haccp_verification_definitions_strategy_check"
  CHECK ("record_strategy" IN ('none', 'latest_published', 'pinned_version'));
ALTER TABLE "haccp_verification_definitions"
  ADD CONSTRAINT "haccp_verification_definitions_version_fkey" FOREIGN KEY ("plan_version_id", "organization_id")
  REFERENCES "haccp_plan_versions"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "haccp_verification_definitions"
  ADD CONSTRAINT "haccp_verification_definitions_responsible_fkey" FOREIGN KEY ("responsible_user_id")
  REFERENCES "users"("id") ON DELETE SET NULL;

-- 2) Ocurrencias de verificación (histórico de ejecución; siguen la identidad lógica).
CREATE TABLE "haccp_verification_occurrences" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "verification_logical_id" UUID NOT NULL,
    "occurrence_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "planned_start" DATE,
    "due_at" DATE,
    "responsible_user_id" UUID,
    "task_id" UUID,
    "record_id" UUID,
    "record_document_version_id" UUID,
    "result" TEXT,
    "conclusion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "completed_at" TIMESTAMPTZ(6),
    "closed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "haccp_verification_occurrences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "haccp_verification_occurrences_id_org_key" ON "haccp_verification_occurrences" ("id", "organization_id");
CREATE UNIQUE INDEX "haccp_verification_occurrences_idem_key" ON "haccp_verification_occurrences" ("organization_id", "verification_logical_id", "occurrence_key");
CREATE INDEX "haccp_verification_occurrences_plan_idx" ON "haccp_verification_occurrences" ("organization_id", "plan_id");
CREATE INDEX "haccp_verification_occurrences_task_idx" ON "haccp_verification_occurrences" ("task_id");

ALTER TABLE "haccp_verification_occurrences" ADD CONSTRAINT "haccp_verification_occurrences_result_check"
  CHECK ("result" IS NULL OR "result" IN ('conforme', 'no_conforme', 'no_concluyente'));
ALTER TABLE "haccp_verification_occurrences" ADD CONSTRAINT "haccp_verification_occurrences_status_check"
  CHECK ("status" IN ('scheduled', 'superseded', 'cancelled'));

-- 3) RLS + grants para las 2 tablas nuevas.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['haccp_verification_definitions', 'haccp_verification_occurrences'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;
