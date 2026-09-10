-- CORE-UX-005 — Semáforo global de cumplimiento: política por organización.
-- Aditivo: CREATE TABLE. Sin DROP. FK a organizations + RLS + grants + CHECK.
-- Sin fila = defaults 90/80/70 (fallback en servidor); compatible con tenants existentes.

-- CreateTable
CREATE TABLE "organization_compliance_policies" (
    "organization_id" UUID NOT NULL,
    "green_min" DECIMAL(5,2) NOT NULL DEFAULT 90,
    "yellow_min" DECIMAL(5,2) NOT NULL DEFAULT 80,
    "orange_min" DECIMAL(5,2) NOT NULL DEFAULT 70,
    "green_color" TEXT NOT NULL DEFAULT '#1f9d55',
    "yellow_color" TEXT NOT NULL DEFAULT '#c9a227',
    "orange_color" TEXT NOT NULL DEFAULT '#d97706',
    "red_color" TEXT NOT NULL DEFAULT '#c0392b',
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_compliance_policies_pkey" PRIMARY KEY ("organization_id")
);

-- CHECK: 100 >= green_min > yellow_min > orange_min >= 0 (autoridad DB además de app).
ALTER TABLE "organization_compliance_policies"
  ADD CONSTRAINT "ocp_thresholds_check" CHECK (
    "green_min" <= 100 AND "orange_min" >= 0
    AND "green_min" > "yellow_min" AND "yellow_min" > "orange_min"
  );

-- =====================================================================
-- CORE-UX-005 — SQL complementario (FK org, RLS, grants).
-- =====================================================================

ALTER TABLE "organization_compliance_policies"
  ADD CONSTRAINT "ocp_org_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE RESTRICT;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organization_compliance_policies'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;
