


















-- CreateTable
CREATE TABLE "document_workflows" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'elaboration',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_workflow_steps" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "due_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decided_at" TIMESTAMPTZ(6),
    "decided_by" UUID,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_approvals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "step_id" UUID,
    "actor_user_id" UUID NOT NULL,
    "stage" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "content_checksum" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_comments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "author" UUID,
    "stage" TEXT,
    "type" TEXT NOT NULL DEFAULT 'general',
    "body" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_distributions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "site_id" UUID,
    "user_id" UUID,
    "role" TEXT,
    "distributed_by" UUID,
    "distributed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_required" BOOLEAN NOT NULL DEFAULT true,
    "read_due_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "document_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_read_acknowledgements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content_checksum" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_read_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_controlled_copies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "copy_number" INTEGER NOT NULL,
    "recipient" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issued_by" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',
    "closed_at" TIMESTAMPTZ(6),
    "notes" TEXT,

    CONSTRAINT "document_controlled_copies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_status_history" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "actor_user_id" UUID,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_workflows_version_id_key" ON "document_workflows"("version_id");

-- CreateIndex
CREATE INDEX "document_workflows_organization_id_idx" ON "document_workflows"("organization_id");

-- CreateIndex
CREATE INDEX "document_workflow_steps_version_id_idx" ON "document_workflow_steps"("version_id");

-- CreateIndex
CREATE INDEX "document_workflow_steps_user_id_status_idx" ON "document_workflow_steps"("user_id", "status");

-- CreateIndex
CREATE INDEX "document_approvals_version_id_idx" ON "document_approvals"("version_id");

-- CreateIndex
CREATE INDEX "document_comments_version_id_idx" ON "document_comments"("version_id");

-- CreateIndex
CREATE INDEX "document_distributions_version_id_idx" ON "document_distributions"("version_id");

-- CreateIndex
CREATE INDEX "document_distributions_user_id_idx" ON "document_distributions"("user_id");

-- CreateIndex
CREATE INDEX "document_read_acknowledgements_user_id_idx" ON "document_read_acknowledgements"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_read_acknowledgements_version_id_user_id_key" ON "document_read_acknowledgements"("version_id", "user_id");

-- CreateIndex
CREATE INDEX "document_controlled_copies_document_id_idx" ON "document_controlled_copies"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_controlled_copies_version_id_copy_number_key" ON "document_controlled_copies"("version_id", "copy_number");

-- CreateIndex
CREATE INDEX "document_status_history_version_id_created_at_idx" ON "document_status_history"("version_id", "created_at");

-- =====================================================================
-- TASK-006 — SQL complementario (Prisma no lo expresa)
-- =====================================================================

-- Ampliar los estados de versión documental al ciclo formal.
ALTER TABLE "document_versions" DROP CONSTRAINT "document_versions_status_check";
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_status_check" CHECK ("status" IN
  ('draft','in_review','changes_requested','in_approval','approved','published','obsolete','archived'));

-- FKs a organizations (todas las tablas de TASK-006).
ALTER TABLE "document_workflows"              ADD CONSTRAINT "dw_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "document_workflow_steps"         ADD CONSTRAINT "dws_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "document_approvals"              ADD CONSTRAINT "dap_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "document_comments"               ADD CONSTRAINT "dc_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "document_distributions"          ADD CONSTRAINT "dd_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "document_read_acknowledgements"  ADD CONSTRAINT "dra_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "document_controlled_copies"      ADD CONSTRAINT "dcc_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "document_status_history"         ADD CONSTRAINT "dsh_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;

-- FKs compuestas anti-cruce hacia versión y documento (mismo organization_id).
ALTER TABLE "document_workflows"             ADD CONSTRAINT "dw_version_fkey"  FOREIGN KEY ("version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "document_workflows"             ADD CONSTRAINT "dw_doc_fkey"      FOREIGN KEY ("document_id","organization_id") REFERENCES "documents"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "document_workflow_steps"        ADD CONSTRAINT "dws_version_fkey" FOREIGN KEY ("version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "document_workflow_steps"        ADD CONSTRAINT "dws_wf_fkey"      FOREIGN KEY ("workflow_id") REFERENCES "document_workflows"("id") ON DELETE RESTRICT;
ALTER TABLE "document_workflow_steps"        ADD CONSTRAINT "dws_user_fkey"    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "document_approvals"             ADD CONSTRAINT "dap_version_fkey" FOREIGN KEY ("version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "document_approvals"             ADD CONSTRAINT "dap_user_fkey"    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "document_comments"             ADD CONSTRAINT "dc_version_fkey"   FOREIGN KEY ("version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "document_distributions"        ADD CONSTRAINT "dd_version_fkey"   FOREIGN KEY ("version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "document_distributions"        ADD CONSTRAINT "dd_site_fkey"      FOREIGN KEY ("site_id","organization_id") REFERENCES "sites"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "document_distributions"        ADD CONSTRAINT "dd_user_fkey"      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "document_read_acknowledgements" ADD CONSTRAINT "dra_version_fkey" FOREIGN KEY ("version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "document_read_acknowledgements" ADD CONSTRAINT "dra_user_fkey"    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "document_controlled_copies"    ADD CONSTRAINT "dcc_version_fkey"  FOREIGN KEY ("version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "document_status_history"       ADD CONSTRAINT "dsh_version_fkey"  FOREIGN KEY ("version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;

-- CHECK de enums.
ALTER TABLE "document_workflows"       ADD CONSTRAINT "dw_stage_check"   CHECK ("stage" IN ('elaboration','review','approval','published'));
ALTER TABLE "document_workflow_steps"  ADD CONSTRAINT "dws_role_check"   CHECK ("role" IN ('reviewer','approver'));
ALTER TABLE "document_workflow_steps"  ADD CONSTRAINT "dws_status_check" CHECK ("status" IN ('pending','approved','changes_requested','rejected','cancelled'));
ALTER TABLE "document_workflow_steps"  ADD CONSTRAINT "dws_seq_check"    CHECK ("sequence" >= 1);
ALTER TABLE "document_approvals"       ADD CONSTRAINT "dap_stage_check"  CHECK ("stage" IN ('review','approval'));
ALTER TABLE "document_approvals"       ADD CONSTRAINT "dap_dec_check"    CHECK ("decision" IN ('approved','changes_requested','rejected'));
ALTER TABLE "document_comments"        ADD CONSTRAINT "dc_type_check"    CHECK ("type" IN ('general','change_request','review','approval'));
ALTER TABLE "document_distributions"   ADD CONSTRAINT "dd_target_check"  CHECK ("target_type" IN ('organization','site','user','role'));
ALTER TABLE "document_distributions"   ADD CONSTRAINT "dd_status_check"  CHECK ("status" IN ('active','superseded','cancelled'));
ALTER TABLE "document_controlled_copies" ADD CONSTRAINT "dcc_format_check" CHECK ("format" IN ('digital','printed'));
ALTER TABLE "document_controlled_copies" ADD CONSTRAINT "dcc_status_check" CHECK ("status" IN ('active','replaced','recovered','destroyed','pending_recovery'));
ALTER TABLE "document_controlled_copies" ADD CONSTRAINT "dcc_num_check"    CHECK ("copy_number" >= 1);

-- Append-only (registros inmutables) reutilizando fn_block_update_delete de TASK-002.
CREATE TRIGGER trg_dap_append BEFORE UPDATE OR DELETE ON "document_approvals"             FOR EACH ROW EXECUTE FUNCTION fn_block_update_delete();
CREATE TRIGGER trg_dra_append BEFORE UPDATE OR DELETE ON "document_read_acknowledgements" FOR EACH ROW EXECUTE FUNCTION fn_block_update_delete();
CREATE TRIGGER trg_dsh_append BEFORE UPDATE OR DELETE ON "document_status_history"        FOR EACH ROW EXECUTE FUNCTION fn_block_update_delete();

-- Prohibir borrado físico en las tablas mutables restantes (fn_block_delete de TASK-002).
CREATE TRIGGER trg_dw_nodel  BEFORE DELETE ON "document_workflows"        FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_dws_nodel BEFORE DELETE ON "document_workflow_steps"   FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_dc_nodel  BEFORE DELETE ON "document_comments"         FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_dd_nodel  BEFORE DELETE ON "document_distributions"    FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_dcc_nodel BEFORE DELETE ON "document_controlled_copies" FOR EACH ROW EXECUTE FUNCTION fn_block_delete();

-- RLS por organización (reutiliza fn_current_org de TASK-002) + permisos.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'document_workflows','document_workflow_steps','document_approvals','document_comments',
    'document_distributions','document_read_acknowledgements','document_controlled_copies','document_status_history'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;

GRANT USAGE, SELECT ON SEQUENCE "document_status_history_id_seq" TO gapsi_app;
