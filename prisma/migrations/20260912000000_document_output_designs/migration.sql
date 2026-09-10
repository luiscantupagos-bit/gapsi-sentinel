-- DOC-UX-002 — Diseños documentales, copias controladas de salida y entitlement
-- de atribución C3.
--
-- Todo aditivo: ADD COLUMN con defaults (compatibles con filas existentes) y dos
-- tablas nuevas (config demo de suscripción + consecutivo de folio). Sin DROP.
-- Reutiliza fn_current_org (TASK-002) para el aislamiento por organización.

-- AlterTable: tema documental gana texto/encabezado, diseño y preferencia de atribución.
ALTER TABLE "document_themes" ADD COLUMN     "design_id" TEXT NOT NULL DEFAULT 'c3-modern',
ADD COLUMN     "heading_color" TEXT NOT NULL DEFAULT '#0f2440',
ADD COLUMN     "show_c3_attribution" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "text_color" TEXT NOT NULL DEFAULT '#1f2937';

-- AlterTable: copias controladas ganan folio/tipo/destino/motivo para las salidas
-- (impresión / PDF). Columnas nullable: no afectan las copias de distribución previas.
ALTER TABLE "document_controlled_copies" ADD COLUMN     "copy_type" TEXT,
ADD COLUMN     "destination_area_code" TEXT,
ADD COLUMN     "folio" TEXT,
ADD COLUMN     "reason" TEXT;

-- CreateTable: suscripción comercial (provisional, sin billing real).
CREATE TABLE "organization_subscriptions" (
    "organization_id" UUID NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'entrepreneur',
    "billing_cadence" TEXT NOT NULL DEFAULT 'monthly',
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable: consecutivo de folio de copias controladas por documento.
CREATE TABLE "document_copy_counters" (
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_copy_counters_pkey" PRIMARY KEY ("organization_id","document_id")
);

-- =====================================================================
-- DOC-UX-002 — SQL complementario (FK org, RLS, grants) para tablas nuevas.
-- =====================================================================

ALTER TABLE "organization_subscriptions"
  ADD CONSTRAINT "orgsub_org_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE RESTRICT;

ALTER TABLE "document_copy_counters"
  ADD CONSTRAINT "doccopyctr_org_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE RESTRICT;

-- RLS por organización + permisos a gapsi_app.
-- organization_subscriptions: config mutable (SELECT/INSERT/UPDATE).
-- document_copy_counters: consecutivo atómico (SELECT/INSERT/UPDATE).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organization_subscriptions', 'document_copy_counters'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;
