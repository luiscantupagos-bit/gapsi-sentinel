-- HACCP-004 — Selección de medidas de control (PCC/PPRO/PPR). Migración ADITIVA (0 DROP).
-- Evaluación por árbol de decisión (snapshot de metodología + respuestas) + plan de control.
-- Ver docs/platform/HACCP-004-DESIGN.md.

-- Evaluación de la medida de control (clasificación via árbol de decisión).
CREATE TABLE "haccp_control_assessments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "control_measure_logical_id" UUID NOT NULL,
    "hazard_logical_id" UUID NOT NULL,
    "method_key" TEXT NOT NULL,
    "method_version" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "classification_source" TEXT NOT NULL DEFAULT 'calculated',
    "justification" TEXT,
    "override_reason" TEXT,
    "answers" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'complete',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "haccp_control_assessments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "haccp_control_assessments_version_hazard_key"
  ON "haccp_control_assessments" ("plan_version_id", "hazard_logical_id");
CREATE UNIQUE INDEX "haccp_control_assessments_id_org_key"
  ON "haccp_control_assessments" ("id", "organization_id");
CREATE INDEX "haccp_control_assessments_version_idx"
  ON "haccp_control_assessments" ("plan_version_id");

ALTER TABLE "haccp_control_assessments" ADD CONSTRAINT "haccp_control_assessments_classification_check"
  CHECK ("classification" IN ('ppr', 'ppro', 'pcc', 'other', 'review_required'));
ALTER TABLE "haccp_control_assessments" ADD CONSTRAINT "haccp_control_assessments_source_check"
  CHECK ("classification_source" IN ('calculated', 'override'));

ALTER TABLE "haccp_control_assessments"
  ADD CONSTRAINT "haccp_control_assessments_version_fkey" FOREIGN KEY ("plan_version_id", "organization_id")
  REFERENCES "haccp_plan_versions"("id", "organization_id") ON DELETE RESTRICT;

-- Plan de control (campos según clasificación).
CREATE TABLE "haccp_control_plans" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "control_measure_logical_id" UUID NOT NULL,
    "hazard_logical_id" UUID NOT NULL,
    "classification" TEXT NOT NULL,
    "process_step_id" UUID,
    "source_reference_id" UUID,
    "control_measure" TEXT,
    "justification" TEXT,
    "critical_limit" TEXT,
    "action_criterion" TEXT,
    "monitoring_what" TEXT,
    "monitoring_how" TEXT,
    "monitoring_who" TEXT,
    "monitoring_when" TEXT,
    "correction" TEXT,
    "corrective_action" TEXT,
    "record_reference" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "haccp_control_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "haccp_control_plans_version_measure_key"
  ON "haccp_control_plans" ("plan_version_id", "control_measure_logical_id");
CREATE UNIQUE INDEX "haccp_control_plans_id_org_key"
  ON "haccp_control_plans" ("id", "organization_id");
CREATE INDEX "haccp_control_plans_version_idx"
  ON "haccp_control_plans" ("plan_version_id");

ALTER TABLE "haccp_control_plans" ADD CONSTRAINT "haccp_control_plans_classification_check"
  CHECK ("classification" IN ('ppr', 'ppro', 'pcc', 'other'));

ALTER TABLE "haccp_control_plans"
  ADD CONSTRAINT "haccp_control_plans_version_fkey" FOREIGN KEY ("plan_version_id", "organization_id")
  REFERENCES "haccp_plan_versions"("id", "organization_id") ON DELETE RESTRICT;

-- RLS + grants (aislamiento por organización).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['haccp_control_assessments', 'haccp_control_plans'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;
