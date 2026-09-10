-- DOC-UX-001 — Presentación documental: tema por organización.
--
-- Tabla mínima `document_themes` (un tema por organización, colores HEX validados
-- en la app) aplicada solo al render de documentos. Sin DROP. Reutiliza
-- fn_current_org (TASK-002) para el aislamiento por organización.

-- CreateTable
CREATE TABLE "document_themes" (
    "organization_id" UUID NOT NULL,
    "primary_color" TEXT NOT NULL,
    "secondary_color" TEXT NOT NULL,
    "accent_color" TEXT NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "document_themes_pkey" PRIMARY KEY ("organization_id")
);

-- =====================================================================
-- DOC-UX-001 — SQL complementario (FK org, RLS, grants).
-- =====================================================================

-- FK de organización.
ALTER TABLE "document_themes"
  ADD CONSTRAINT "dth_org_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE RESTRICT;

-- RLS por organización + permisos a gapsi_app (config mutable: SELECT/INSERT/UPDATE).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['document_themes'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;
