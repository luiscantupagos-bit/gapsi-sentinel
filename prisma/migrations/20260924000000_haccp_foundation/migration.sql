-- HACCP-001 — Fundación del módulo HACCP. Migración ADITIVA (0 DROP TABLE / 0 DROP COLUMN).
-- El módulo HACCP es la fuente de verdad operativa; el Plan HACCP formal será una salida
-- documental (HACCP-007). Referencias unificadas (producto/MP/PPR/documentos) en una tabla
-- version-owned con snapshot inline. Ver docs/platform/HACCP-001-DESIGN.md.

-- ===========================================================================
-- Tablas
-- ===========================================================================

CREATE TABLE "haccp_plans" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scope" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "current_version_id" UUID,
    "responsible_user_id" UUID,
    "next_review_at" DATE,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "haccp_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "haccp_plan_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "major" INTEGER NOT NULL DEFAULT 1,
    "minor" INTEGER NOT NULL DEFAULT 0,
    "version_label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scope" TEXT,
    "product_process" TEXT,
    "change_notes" TEXT,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "haccp_plan_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "haccp_team_members" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "user_id" UUID,
    "external_name" TEXT,
    "area" TEXT,
    "job_title" TEXT,
    "haccp_role" TEXT,
    "responsibility" TEXT,
    "training_summary" TEXT,
    "is_leader" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "haccp_team_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "haccp_source_references" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "reference_kind" TEXT NOT NULL,
    "source_type" TEXT NOT NULL DEFAULT 'document',
    "source_document_id" UUID NOT NULL,
    "source_version_id" UUID,
    "category" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "source_code_snapshot" TEXT,
    "source_title_snapshot" TEXT,
    "source_version_label_snapshot" TEXT,
    "source_status_snapshot" TEXT,
    "source_published_at_snapshot" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "haccp_source_references_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "haccp_plan_code_counters" (
    "organization_id" UUID NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "haccp_plan_code_counters_pkey" PRIMARY KEY ("organization_id")
);

-- ===========================================================================
-- Índices y unicidad
-- ===========================================================================

CREATE UNIQUE INDEX "haccp_plans_org_code_key" ON "haccp_plans" ("organization_id", "code");
CREATE UNIQUE INDEX "haccp_plans_id_org_key" ON "haccp_plans" ("id", "organization_id");
CREATE INDEX "haccp_plans_org_status_idx" ON "haccp_plans" ("organization_id", "status");

CREATE UNIQUE INDEX "haccp_plan_versions_plan_label_key" ON "haccp_plan_versions" ("plan_id", "version_label");
CREATE UNIQUE INDEX "haccp_plan_versions_id_org_key" ON "haccp_plan_versions" ("id", "organization_id");
CREATE INDEX "haccp_plan_versions_plan_idx" ON "haccp_plan_versions" ("plan_id");

CREATE INDEX "haccp_team_members_version_idx" ON "haccp_team_members" ("plan_version_id");
-- §11: máximo 1 líder por versión.
CREATE UNIQUE INDEX "haccp_team_one_leader_per_version" ON "haccp_team_members" ("plan_version_id") WHERE "is_leader";

CREATE INDEX "haccp_source_references_version_idx" ON "haccp_source_references" ("plan_version_id");
CREATE INDEX "haccp_source_references_org_kind_idx" ON "haccp_source_references" ("organization_id", "reference_kind");
CREATE INDEX "haccp_source_references_source_doc_idx" ON "haccp_source_references" ("source_document_id");
-- §12: máximo 1 producto terminado por versión.
CREATE UNIQUE INDEX "haccp_source_one_product_per_version" ON "haccp_source_references" ("plan_version_id") WHERE "reference_kind" = 'product';

-- ===========================================================================
-- CHECK constraints (dominios)
-- ===========================================================================

ALTER TABLE "haccp_plans" ADD CONSTRAINT "haccp_plans_status_check"
  CHECK ("status" IN ('draft', 'in_review', 'published', 'reevaluation_required', 'obsolete'));
ALTER TABLE "haccp_plan_versions" ADD CONSTRAINT "haccp_plan_versions_status_check"
  CHECK ("status" IN ('draft', 'in_review', 'published', 'obsolete'));
ALTER TABLE "haccp_source_references" ADD CONSTRAINT "haccp_source_references_kind_check"
  CHECK ("reference_kind" IN ('product', 'material', 'prerequisite', 'document'));
ALTER TABLE "haccp_source_references" ADD CONSTRAINT "haccp_source_references_type_check"
  CHECK ("source_type" IN ('document', 'program'));

-- ===========================================================================
-- Claves foráneas tenant-safe (§43: cross-tenant DENY vía referencia compuesta a
-- (id, organization_id)). Referencias a otros módulos no llevan @relation en Prisma.
-- ===========================================================================

ALTER TABLE "haccp_plans"
  ADD CONSTRAINT "haccp_plans_org_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "haccp_plans"
  ADD CONSTRAINT "haccp_plans_site_fkey" FOREIGN KEY ("site_id", "organization_id")
  REFERENCES "sites"("id", "organization_id") ON DELETE SET NULL;
ALTER TABLE "haccp_plans"
  ADD CONSTRAINT "haccp_plans_current_version_fkey" FOREIGN KEY ("current_version_id", "organization_id")
  REFERENCES "haccp_plan_versions"("id", "organization_id") ON DELETE SET NULL;
ALTER TABLE "haccp_plans"
  ADD CONSTRAINT "haccp_plans_responsible_fkey" FOREIGN KEY ("responsible_user_id")
  REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "haccp_plan_versions"
  ADD CONSTRAINT "haccp_plan_versions_plan_fkey" FOREIGN KEY ("plan_id", "organization_id")
  REFERENCES "haccp_plans"("id", "organization_id") ON DELETE RESTRICT;

ALTER TABLE "haccp_team_members"
  ADD CONSTRAINT "haccp_team_members_version_fkey" FOREIGN KEY ("plan_version_id", "organization_id")
  REFERENCES "haccp_plan_versions"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "haccp_team_members"
  ADD CONSTRAINT "haccp_team_members_user_fkey" FOREIGN KEY ("user_id")
  REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "haccp_source_references"
  ADD CONSTRAINT "haccp_source_references_version_fkey" FOREIGN KEY ("plan_version_id", "organization_id")
  REFERENCES "haccp_plan_versions"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "haccp_source_references"
  ADD CONSTRAINT "haccp_source_references_document_fkey" FOREIGN KEY ("source_document_id", "organization_id")
  REFERENCES "documents"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "haccp_source_references"
  ADD CONSTRAINT "haccp_source_references_version_doc_fkey" FOREIGN KEY ("source_version_id", "organization_id")
  REFERENCES "document_versions"("id", "organization_id") ON DELETE RESTRICT;

ALTER TABLE "haccp_plan_code_counters"
  ADD CONSTRAINT "haccp_plan_code_counters_org_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE RESTRICT;

-- ===========================================================================
-- RLS + grants (aislamiento por organización). App conecta como gapsi_app.
-- ===========================================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'haccp_plans',
    'haccp_plan_versions',
    'haccp_team_members',
    'haccp_source_references',
    'haccp_plan_code_counters'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
  END LOOP;
  -- Tablas de dominio: CRUD completo.
  FOREACH t IN ARRAY ARRAY[
    'haccp_plans',
    'haccp_plan_versions',
    'haccp_team_members',
    'haccp_source_references'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO gapsi_app;', t);
  END LOOP;
  -- Contador: solo lectura/escritura del consecutivo.
  EXECUTE 'GRANT SELECT, INSERT, UPDATE ON "haccp_plan_code_counters" TO gapsi_app;';
END
$$;
