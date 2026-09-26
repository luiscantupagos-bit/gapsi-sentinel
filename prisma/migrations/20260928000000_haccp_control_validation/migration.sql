-- HACCP-005 — Validación de medidas de control. Migración ADITIVA (0 DROP TABLE / 0 DROP COLUMN).
-- La evidencia por archivo reutiliza file_relations (entity_type='haccp_control_validation'); no
-- se crea storage nuevo. Ver docs/platform/HACCP-005-DESIGN.md.

CREATE TABLE "haccp_control_validations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "validation_logical_id" UUID NOT NULL,
    "control_measure_logical_id" UUID NOT NULL,
    "hazard_logical_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "objective" TEXT,
    "scope" TEXT,
    "method_type" TEXT,
    "method_description" TEXT,
    "evidence_summary" TEXT,
    "technical_basis" TEXT,
    "acceptance_criteria" TEXT,
    "conclusion" TEXT,
    "evidence_document_id" UUID,
    "evidence_document_version_id" UUID,
    "performed_at" DATE,
    "performed_by_user_id" UUID,
    "performed_by_external_name" TEXT,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "next_validation_at" DATE,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "haccp_control_validations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "haccp_control_validations_version_measure_key"
  ON "haccp_control_validations" ("plan_version_id", "control_measure_logical_id");
CREATE UNIQUE INDEX "haccp_control_validations_id_org_key"
  ON "haccp_control_validations" ("id", "organization_id");
CREATE INDEX "haccp_control_validations_version_idx"
  ON "haccp_control_validations" ("plan_version_id");

ALTER TABLE "haccp_control_validations" ADD CONSTRAINT "haccp_control_validations_status_check"
  CHECK ("status" IN ('pending', 'in_progress', 'satisfactory', 'unsatisfactory', 'expired', 'needs_review'));
ALTER TABLE "haccp_control_validations" ADD CONSTRAINT "haccp_control_validations_result_check"
  CHECK ("result" IS NULL OR "result" IN ('satisfactory', 'unsatisfactory', 'inconclusive'));

ALTER TABLE "haccp_control_validations"
  ADD CONSTRAINT "haccp_control_validations_version_fkey" FOREIGN KEY ("plan_version_id", "organization_id")
  REFERENCES "haccp_plan_versions"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "haccp_control_validations"
  ADD CONSTRAINT "haccp_control_validations_performed_by_fkey" FOREIGN KEY ("performed_by_user_id")
  REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "haccp_control_validations"
  ADD CONSTRAINT "haccp_control_validations_reviewed_by_fkey" FOREIGN KEY ("reviewed_by_user_id")
  REFERENCES "users"("id") ON DELETE SET NULL;

-- RLS + grants (aislamiento por organización).
DO $$
DECLARE t text := 'haccp_control_validations';
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
  EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO gapsi_app;', t);
END
$$;
