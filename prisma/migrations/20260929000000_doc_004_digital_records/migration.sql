-- DOC-004 — Registros digitales. Migración ADITIVA (0 DROP TABLE / 0 DROP COLUMN).
-- Un documento tipo `form` define un `form_schema` en su DocumentVersion; cada llenado
-- produce un record_instance ligado a la VERSIÓN EXACTA. La evidencia (foto/archivo)
-- reutiliza file_relations (entity_type='record'); no se crea storage nuevo. La
-- inmutabilidad de la versión publicada la garantiza el servidor (solo se edita el
-- borrador). Ver docs/platform/DOC-004-DESIGN.md.

-- 1) Esquema de formulario en la versión documental (aditivo).
ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "form_schema" JSONB;

-- 2) Instancias de registro.
CREATE TABLE "record_instances" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "record_number" TEXT NOT NULL,
    "document_id" UUID NOT NULL,
    "document_version_id" UUID NOT NULL,
    "form_code" TEXT NOT NULL,
    "form_title" TEXT NOT NULL,
    "form_version_label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "data" JSONB,
    "assigned_to_user_id" UUID,
    "site_id" UUID,
    "source_type" TEXT,
    "source_id" UUID,
    "client_generated_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6),
    "submitted_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewed_by" UUID,
    "closed_at" TIMESTAMPTZ(6),
    "closed_by" UUID,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "record_instances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "record_instances_id_org_key" ON "record_instances" ("id", "organization_id");
CREATE UNIQUE INDEX "record_instances_org_number_key" ON "record_instances" ("organization_id", "record_number");
CREATE UNIQUE INDEX "record_instances_org_client_key"
  ON "record_instances" ("organization_id", "client_generated_id")
  WHERE "client_generated_id" IS NOT NULL;
CREATE INDEX "record_instances_org_status_idx" ON "record_instances" ("organization_id", "status");
CREATE INDEX "record_instances_org_document_idx" ON "record_instances" ("organization_id", "document_id");
CREATE INDEX "record_instances_org_source_idx" ON "record_instances" ("organization_id", "source_type", "source_id");

ALTER TABLE "record_instances" ADD CONSTRAINT "record_instances_status_check"
  CHECK ("status" IN ('draft', 'in_progress', 'submitted', 'reviewed', 'closed', 'cancelled'));

-- FK tenant-safe a la versión documental EXACTA (§35): misma organización, RESTRICT.
ALTER TABLE "record_instances"
  ADD CONSTRAINT "record_instances_version_fkey" FOREIGN KEY ("document_version_id", "organization_id")
  REFERENCES "document_versions"("id", "organization_id") ON DELETE RESTRICT;
-- FK tenant-safe al sitio (opcional).
ALTER TABLE "record_instances"
  ADD CONSTRAINT "record_instances_site_fkey" FOREIGN KEY ("site_id", "organization_id")
  REFERENCES "sites"("id", "organization_id") ON DELETE SET NULL;
-- Actores → users (SET NULL si el usuario desaparece).
ALTER TABLE "record_instances"
  ADD CONSTRAINT "record_instances_assigned_fkey" FOREIGN KEY ("assigned_to_user_id")
  REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "record_instances"
  ADD CONSTRAINT "record_instances_reviewed_by_fkey" FOREIGN KEY ("reviewed_by")
  REFERENCES "users"("id") ON DELETE SET NULL;

-- 3) Contador de folios por organización + año.
CREATE TABLE "record_code_counters" (
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "record_code_counters_pkey" PRIMARY KEY ("organization_id", "year")
);

-- RLS + grants (aislamiento por organización) para ambas tablas nuevas.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['record_instances', 'record_code_counters'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;
