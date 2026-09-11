-- PLATFORM-002 — Almacenamiento de archivos transversal (stored_files + file_relations).
-- Aditivo: CREATE TABLE + índices + FK. Sin DROP. FK org + RLS + grants + CHECK.
-- PostgreSQL es la fuente de verdad; el binario vive en Object Storage.

-- CreateTable
CREATE TABLE "stored_files" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "storage_provider" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "client_upload_id" UUID,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_relations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "relation_type" TEXT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_relations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stored_files_organization_id_idx" ON "stored_files"("organization_id");
CREATE INDEX "stored_files_organization_id_sha256_idx" ON "stored_files"("organization_id", "sha256");
CREATE UNIQUE INDEX "stored_files_id_organization_id_key" ON "stored_files"("id", "organization_id");
CREATE UNIQUE INDEX "stored_files_storage_provider_bucket_storage_key_key" ON "stored_files"("storage_provider", "bucket", "storage_key");
CREATE UNIQUE INDEX "stored_files_organization_id_client_upload_id_key" ON "stored_files"("organization_id", "client_upload_id");

-- CreateIndex
CREATE INDEX "file_relations_organization_id_entity_type_entity_id_idx" ON "file_relations"("organization_id", "entity_type", "entity_id");
CREATE INDEX "file_relations_file_id_idx" ON "file_relations"("file_id");
CREATE UNIQUE INDEX "file_relations_organization_id_file_id_entity_type_entity_i_key" ON "file_relations"("organization_id", "file_id", "entity_type", "entity_id", "relation_type");

-- AddForeignKey: relación → archivo en la MISMA organización (integridad de tenant §40).
ALTER TABLE "file_relations" ADD CONSTRAINT "file_relations_file_id_organization_id_fkey" FOREIGN KEY ("file_id", "organization_id") REFERENCES "stored_files"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK (§42)
ALTER TABLE "stored_files"
  ADD CONSTRAINT "sf_size_nonneg_check" CHECK ("size_bytes" >= 0),
  ADD CONSTRAINT "sf_sha256_format_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "sf_storage_key_notblank_check" CHECK (length(btrim("storage_key")) > 0),
  ADD CONSTRAINT "sf_filename_notblank_check" CHECK (length(btrim("original_filename")) > 0);

ALTER TABLE "file_relations"
  ADD CONSTRAINT "fr_entity_type_check" CHECK ("entity_type" IN (
    'organization','document','document_version','record','audit','finding',
    'capa','task','program','project','meeting','user_profile')),
  ADD CONSTRAINT "fr_relation_type_check" CHECK ("relation_type" IN (
    'attachment','evidence','source','generated_output','logo','photo',
    'signature','certificate','report'));

-- =====================================================================
-- PLATFORM-002 — SQL complementario (FK org, RLS, grants).
-- =====================================================================

ALTER TABLE "stored_files"
  ADD CONSTRAINT "sf_org_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE RESTRICT;

ALTER TABLE "file_relations"
  ADD CONSTRAINT "fr_org_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE RESTRICT;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['stored_files','file_relations'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
  END LOOP;
  -- stored_files: soft delete (UPDATE deleted_at), no DELETE físico.
  EXECUTE 'GRANT SELECT, INSERT, UPDATE ON stored_files TO gapsi_app;';
  -- file_relations: unlink borra la relación → DELETE.
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON file_relations TO gapsi_app;';
END
$$;
