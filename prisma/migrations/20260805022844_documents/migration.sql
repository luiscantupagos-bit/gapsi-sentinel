-- DropForeignKey
ALTER TABLE "assessment_frameworks" DROP CONSTRAINT "assessment_frameworks_created_by_fkey";

-- DropForeignKey
ALTER TABLE "assessment_frameworks" DROP CONSTRAINT "assessment_frameworks_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_actor_user_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "diagnostic_answers" DROP CONSTRAINT "diagnostic_answers_answered_by_fkey";

-- DropForeignKey
ALTER TABLE "diagnostic_answers" DROP CONSTRAINT "diagnostic_answers_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "diagnostic_findings" DROP CONSTRAINT "diagnostic_findings_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "diagnostic_results" DROP CONSTRAINT "diagnostic_results_computed_by_fkey";

-- DropForeignKey
ALTER TABLE "diagnostic_results" DROP CONSTRAINT "diagnostic_results_invalidated_by_fkey";

-- DropForeignKey
ALTER TABLE "diagnostic_results" DROP CONSTRAINT "diagnostic_results_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "diagnostic_section_results" DROP CONSTRAINT "diagnostic_section_results_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "diagnostic_state_history" DROP CONSTRAINT "diagnostic_state_history_changed_by_fkey";

-- DropForeignKey
ALTER TABLE "diagnostic_state_history" DROP CONSTRAINT "diagnostic_state_history_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "diagnostics" DROP CONSTRAINT "diagnostics_created_by_fkey";

-- DropForeignKey
ALTER TABLE "diagnostics" DROP CONSTRAINT "diagnostics_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "diagnostics" DROP CONSTRAINT "diagnostics_responsible_user_id_fkey";

-- DropForeignKey
ALTER TABLE "diagnostics" DROP CONSTRAINT "diagnostics_reviewed_by_fkey";

-- DropForeignKey
ALTER TABLE "diagnostics" DROP CONSTRAINT "diagnostics_submitted_by_fkey";

-- DropForeignKey
ALTER TABLE "evidences" DROP CONSTRAINT "evidences_created_by_fkey";

-- DropForeignKey
ALTER TABLE "evidences" DROP CONSTRAINT "evidences_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "evidences" DROP CONSTRAINT "evidences_reviewed_by_fkey";

-- DropForeignKey
ALTER TABLE "sites" DROP CONSTRAINT "sites_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "template_answer_options" DROP CONSTRAINT "template_answer_options_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "template_questions" DROP CONSTRAINT "template_questions_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "template_requirements" DROP CONSTRAINT "template_requirements_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "template_sections" DROP CONSTRAINT "template_sections_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "template_versions" DROP CONSTRAINT "template_versions_created_by_fkey";

-- DropForeignKey
ALTER TABLE "template_versions" DROP CONSTRAINT "template_versions_organization_id_fkey";

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "document_type" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "current_version_label" TEXT,
    "site_id" UUID,
    "responsible_user_id" UUID,
    "owner_area" TEXT,
    "confidentiality" TEXT NOT NULL DEFAULT 'internal',
    "issued_at" DATE,
    "effective_at" DATE,
    "next_review_at" DATE,
    "obsolete_at" DATE,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "change_notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "author" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_files" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_version_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "extension" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "checksum" TEXT,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_relations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "relation_type" TEXT NOT NULL,
    "site_id" UUID,
    "framework_id" UUID,
    "requirement_id" UUID,
    "diagnostic_id" UUID,
    "related_document_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_history" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_organization_id_status_idx" ON "documents"("organization_id", "status");

-- CreateIndex
CREATE INDEX "documents_organization_id_document_type_idx" ON "documents"("organization_id", "document_type");

-- CreateIndex
CREATE UNIQUE INDEX "documents_organization_id_code_key" ON "documents"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "documents_id_organization_id_key" ON "documents"("id", "organization_id");

-- CreateIndex
CREATE INDEX "document_versions_document_id_idx" ON "document_versions"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_label_key" ON "document_versions"("document_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_id_organization_id_key" ON "document_versions"("id", "organization_id");

-- CreateIndex
CREATE INDEX "document_files_document_version_id_idx" ON "document_files"("document_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_files_id_organization_id_key" ON "document_files"("id", "organization_id");

-- CreateIndex
CREATE INDEX "document_relations_document_id_idx" ON "document_relations"("document_id");

-- CreateIndex
CREATE INDEX "document_history_document_id_created_at_idx" ON "document_history"("document_id", "created_at");

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_organization_id_fkey" FOREIGN KEY ("document_id", "organization_id") REFERENCES "documents"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_document_version_id_organization_id_fkey" FOREIGN KEY ("document_version_id", "organization_id") REFERENCES "document_versions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_document_id_organization_id_fkey" FOREIGN KEY ("document_id", "organization_id") REFERENCES "documents"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================================
-- TASK-004 — SQL complementario (Prisma no lo expresa en el schema)
-- =====================================================================

-- FKs a organizations (organization_id NOT NULL en todas las tablas documentales)
ALTER TABLE "documents"          ADD CONSTRAINT "documents_organization_id_fkey"          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "document_versions"  ADD CONSTRAINT "document_versions_organization_id_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "document_files"     ADD CONSTRAINT "document_files_organization_id_fkey"     FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "document_history"   ADD CONSTRAINT "document_history_organization_id_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;

-- FKs a users (actores)
ALTER TABLE "documents"         ADD CONSTRAINT "documents_responsible_user_id_fkey"  FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "documents"         ADD CONSTRAINT "documents_created_by_fkey"           FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_author_fkey"       FOREIGN KEY ("author")              REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "document_files"    ADD CONSTRAINT "document_files_uploaded_by_fkey"     FOREIGN KEY ("uploaded_by")         REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "document_history"  ADD CONSTRAINT "document_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id")       REFERENCES "users"("id") ON DELETE RESTRICT;

-- Unique necesario para la FK compuesta hacia marcos (no existía en TASK-002).
CREATE UNIQUE INDEX "assessment_frameworks_id_organization_id_key" ON "assessment_frameworks" ("id", "organization_id");

-- FK compuesta anti-cruce: documento -> sitio (mismo organization_id).
ALTER TABLE "documents" ADD CONSTRAINT "documents_site_id_organization_id_fkey"
  FOREIGN KEY ("site_id", "organization_id") REFERENCES "sites"("id", "organization_id") ON DELETE RESTRICT;

-- FKs compuestas anti-cruce de las relaciones documentales.
ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_site_fkey"
  FOREIGN KEY ("site_id", "organization_id") REFERENCES "sites"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_framework_fkey"
  FOREIGN KEY ("framework_id", "organization_id") REFERENCES "assessment_frameworks"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_requirement_fkey"
  FOREIGN KEY ("requirement_id", "organization_id") REFERENCES "template_requirements"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_diagnostic_fkey"
  FOREIGN KEY ("diagnostic_id", "organization_id") REFERENCES "diagnostics"("id", "organization_id") ON DELETE RESTRICT;
ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_related_document_fkey"
  FOREIGN KEY ("related_document_id", "organization_id") REFERENCES "documents"("id", "organization_id") ON DELETE RESTRICT;

-- FK compuesta del historial hacia el documento.
ALTER TABLE "document_history" ADD CONSTRAINT "document_history_document_fkey"
  FOREIGN KEY ("document_id", "organization_id") REFERENCES "documents"("id", "organization_id") ON DELETE RESTRICT;

-- CHECK de enums y reglas.
ALTER TABLE "documents" ADD CONSTRAINT "documents_type_check" CHECK ("document_type" IN
  ('policy','manual','procedure','instruction','program','plan','form','record','specification','matrix','external','annex','other'));
ALTER TABLE "documents" ADD CONSTRAINT "documents_origin_check" CHECK ("origin" IN ('internal','external'));
ALTER TABLE "documents" ADD CONSTRAINT "documents_status_check" CHECK ("status" IN ('draft','in_review','effective','obsolete','archived'));
ALTER TABLE "documents" ADD CONSTRAINT "documents_confidentiality_check" CHECK ("confidentiality" IN ('public','internal','confidential'));
ALTER TABLE "documents" ADD CONSTRAINT "documents_review_date_check" CHECK ("next_review_at" IS NULL OR "issued_at" IS NULL OR "next_review_at" >= "issued_at");

ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_status_check" CHECK ("status" IN ('draft','published','obsolete'));
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_kind_check" CHECK ("kind" IN ('main','attachment'));
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_size_check" CHECK ("size_bytes" >= 0);
ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_type_check" CHECK ("relation_type" IN ('site','framework','requirement','diagnostic','document'));

-- A lo sumo una versión vigente por documento.
CREATE UNIQUE INDEX "document_versions_current_key" ON "document_versions" ("document_id") WHERE "is_current";

-- No sobrescribir silenciosamente una versión publicada (label/notas selladas).
CREATE OR REPLACE FUNCTION fn_guard_published_docversion() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'published' AND (NEW.label <> OLD.label OR NEW.change_notes IS DISTINCT FROM OLD.change_notes) THEN
    RAISE EXCEPTION 'No se puede reescribir el contenido de una version documental publicada (%).', OLD.id USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_docversion_published BEFORE UPDATE ON "document_versions" FOR EACH ROW EXECUTE FUNCTION fn_guard_published_docversion();

-- Historial append-only y prohibicion de borrado fisico (reutiliza funciones de TASK-002).
CREATE TRIGGER trg_document_history_append_only BEFORE UPDATE OR DELETE ON "document_history"   FOR EACH ROW EXECUTE FUNCTION fn_block_update_delete();
CREATE TRIGGER trg_no_delete_documents          BEFORE DELETE ON "documents"          FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_no_delete_document_versions  BEFORE DELETE ON "document_versions"  FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_no_delete_document_files     BEFORE DELETE ON "document_files"     FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_no_delete_document_relations BEFORE DELETE ON "document_relations" FOR EACH ROW EXECUTE FUNCTION fn_block_delete();

-- RLS por organizacion (reutiliza fn_current_org de TASK-002).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['documents','document_versions','document_files','document_relations','document_history'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
  END LOOP;
END
$$;

-- Permisos para el rol de aplicacion.
GRANT SELECT, INSERT, UPDATE ON "documents", "document_versions", "document_files", "document_relations", "document_history" TO gapsi_app;
GRANT USAGE, SELECT ON SEQUENCE "document_history_id_seq" TO gapsi_app;
