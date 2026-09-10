-- DOC-UX-003 — Formato de fecha documental + perfil general del negocio.
--
-- Aditivo: ADD COLUMN con defaults/nullables (compatibles con filas existentes) y
-- una tabla nueva de perfil de organización. Sin DROP. Reutiliza fn_current_org.

-- AlterTable: formato de fecha documental por organización (default DD/MM/AAAA).
ALTER TABLE "document_themes" ADD COLUMN     "date_format" TEXT NOT NULL DEFAULT 'DD/MM/YYYY';

-- AlterTable: dirección y coordenadas del sitio (opcionales).
ALTER TABLE "sites" ADD COLUMN     "address" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateTable: perfil general del negocio por organización.
CREATE TABLE "organization_profiles" (
    "organization_id" UUID NOT NULL,
    "commercial_name" TEXT,
    "legal_name" TEXT,
    "tax_id" TEXT,
    "tax_regime" TEXT,
    "tax_address" TEXT,
    "logo_url" TEXT,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "organization_profiles_pkey" PRIMARY KEY ("organization_id")
);

-- =====================================================================
-- DOC-UX-003 — SQL complementario (FK org, RLS, grants) para la tabla nueva.
-- =====================================================================

ALTER TABLE "organization_profiles"
  ADD CONSTRAINT "orgprofile_org_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE RESTRICT;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organization_profiles'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;
