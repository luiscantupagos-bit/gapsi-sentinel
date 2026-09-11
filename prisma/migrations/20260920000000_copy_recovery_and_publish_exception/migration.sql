-- DOC-OUTPUT-FOLLOWUP §I/§J — recuperación completa de copias controladas + excepción
-- de publicación auditada. ADITIVO: ADD COLUMN + CREATE TABLE + FK + CHECK + RLS + grants.
-- 0 DROP TABLE, 0 DROP COLUMN. Columnas nullables (compatibles con datos existentes).

-- §I — columnas de recuperación en las copias controladas.
ALTER TABLE "document_controlled_copies" ADD COLUMN "recovered_at" TIMESTAMPTZ(6);
ALTER TABLE "document_controlled_copies" ADD COLUMN "recovered_by" UUID;
ALTER TABLE "document_controlled_copies" ADD COLUMN "confirmed_by" UUID;
ALTER TABLE "document_controlled_copies" ADD COLUMN "disposition" TEXT;
ALTER TABLE "document_controlled_copies" ADD COLUMN "replaced_by_copy_id" UUID;
ALTER TABLE "document_controlled_copies" ADD COLUMN "recovery_notes" TEXT;

-- Disposición controlada (autoridad DB además del servidor).
ALTER TABLE "document_controlled_copies"
  ADD CONSTRAINT "dcc_disposition_check" CHECK (
    "disposition" IS NULL
    OR "disposition" IN ('destroyed', 'archived_obsolete', 'replaced', 'other')
  );

-- FKs: actores (SET NULL al borrar usuario) y auto-FK de reemplazo (SET NULL).
ALTER TABLE "document_controlled_copies"
  ADD CONSTRAINT "dcc_recovered_by_fkey" FOREIGN KEY ("recovered_by")
  REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "document_controlled_copies"
  ADD CONSTRAINT "dcc_confirmed_by_fkey" FOREIGN KEY ("confirmed_by")
  REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "document_controlled_copies"
  ADD CONSTRAINT "dcc_replaced_by_fkey" FOREIGN KEY ("replaced_by_copy_id")
  REFERENCES "document_controlled_copies"("id") ON DELETE SET NULL;

-- §J — excepciones de publicación (evento auditado).
CREATE TABLE "document_publish_exceptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "new_version_id" UUID NOT NULL,
    "previous_version_id" UUID,
    "authorized_by" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "pending_copies" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_publish_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dpe_org_document_idx"
  ON "document_publish_exceptions" ("organization_id", "document_id");

ALTER TABLE "document_publish_exceptions"
  ADD CONSTRAINT "dpe_org_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "document_publish_exceptions"
  ADD CONSTRAINT "dpe_document_fkey" FOREIGN KEY ("document_id")
  REFERENCES "documents"("id") ON DELETE RESTRICT;

-- RLS + grants (aislamiento por organización).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['document_publish_exceptions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;
