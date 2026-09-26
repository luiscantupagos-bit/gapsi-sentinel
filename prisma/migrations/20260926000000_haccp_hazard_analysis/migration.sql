-- HACCP-003 — Análisis de peligros. Migración ADITIVA (0 DROP TABLE / 0 DROP COLUMN).
-- Peligros (MP/etapa) con identidad LÓGICA estable + matriz de riesgo versionada (snapshot de
-- la metodología usada). Ver docs/platform/HACCP-003-DESIGN.md.

-- Configuración de la matriz de riesgo (una por versión; snapshot de la metodología).
CREATE TABLE "haccp_risk_matrix_configs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "probability_scale" JSONB NOT NULL,
    "severity_scale" JSONB NOT NULL,
    "score_formula" TEXT NOT NULL DEFAULT 'multiply',
    "significance_threshold" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "haccp_risk_matrix_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "haccp_risk_matrix_configs_version_key"
  ON "haccp_risk_matrix_configs" ("plan_version_id");
CREATE UNIQUE INDEX "haccp_risk_matrix_configs_id_org_key"
  ON "haccp_risk_matrix_configs" ("id", "organization_id");
CREATE UNIQUE INDEX "haccp_risk_matrix_configs_version_org_key"
  ON "haccp_risk_matrix_configs" ("plan_version_id", "organization_id");

ALTER TABLE "haccp_risk_matrix_configs"
  ADD CONSTRAINT "haccp_risk_matrix_configs_version_fkey" FOREIGN KEY ("plan_version_id", "organization_id")
  REFERENCES "haccp_plan_versions"("id", "organization_id") ON DELETE RESTRICT;

-- Peligros identificados (sobre materia prima o etapa del proceso).
CREATE TABLE "haccp_hazards" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "hazard_logical_id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_reference_id" UUID,
    "process_step_id" UUID,
    "hazard_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "origin_or_cause" TEXT,
    "probability" INTEGER NOT NULL,
    "severity" INTEGER NOT NULL,
    "risk_score" INTEGER NOT NULL,
    "is_significant" BOOLEAN NOT NULL DEFAULT false,
    "significance_source" TEXT NOT NULL DEFAULT 'calculated',
    "significance_reason" TEXT,
    "existing_control_measure" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "haccp_hazards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "haccp_hazards_id_org_key" ON "haccp_hazards" ("id", "organization_id");
CREATE INDEX "haccp_hazards_version_idx" ON "haccp_hazards" ("plan_version_id");
CREATE INDEX "haccp_hazards_org_type_idx" ON "haccp_hazards" ("organization_id", "hazard_type");

ALTER TABLE "haccp_hazards" ADD CONSTRAINT "haccp_hazards_source_type_check"
  CHECK ("source_type" IN ('material', 'process_step'));
ALTER TABLE "haccp_hazards" ADD CONSTRAINT "haccp_hazards_type_check"
  CHECK ("hazard_type" IN ('biological', 'chemical', 'physical', 'allergen', 'radiological', 'other'));
ALTER TABLE "haccp_hazards" ADD CONSTRAINT "haccp_hazards_significance_source_check"
  CHECK ("significance_source" IN ('calculated', 'override'));

ALTER TABLE "haccp_hazards"
  ADD CONSTRAINT "haccp_hazards_version_fkey" FOREIGN KEY ("plan_version_id", "organization_id")
  REFERENCES "haccp_plan_versions"("id", "organization_id") ON DELETE RESTRICT;

-- RLS + grants (aislamiento por organización).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['haccp_risk_matrix_configs', 'haccp_hazards'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;
