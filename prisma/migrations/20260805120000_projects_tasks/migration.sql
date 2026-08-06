-- DropForeignKey
ALTER TABLE "capa_actions" DROP CONSTRAINT "cac_capa_fkey";

-- DropForeignKey
ALTER TABLE "capa_actions" DROP CONSTRAINT "cac_dep_fkey";

-- DropForeignKey
ALTER TABLE "capa_actions" DROP CONSTRAINT "cac_doc_fkey";

-- DropForeignKey
ALTER TABLE "capa_actions" DROP CONSTRAINT "cac_org_fkey";

-- DropForeignKey
ALTER TABLE "capa_actions" DROP CONSTRAINT "cac_resp_fkey";

-- DropForeignKey
ALTER TABLE "capa_actions" DROP CONSTRAINT "cac_ver_fkey";

-- DropForeignKey
ALTER TABLE "capa_comments" DROP CONSTRAINT "cco_author_fkey";

-- DropForeignKey
ALTER TABLE "capa_comments" DROP CONSTRAINT "cco_capa_fkey";

-- DropForeignKey
ALTER TABLE "capa_comments" DROP CONSTRAINT "cco_org_fkey";

-- DropForeignKey
ALTER TABLE "capa_effectiveness_reviews" DROP CONSTRAINT "cer_capa_fkey";

-- DropForeignKey
ALTER TABLE "capa_effectiveness_reviews" DROP CONSTRAINT "cer_org_fkey";

-- DropForeignKey
ALTER TABLE "capa_effectiveness_reviews" DROP CONSTRAINT "cer_verifier_fkey";

-- DropForeignKey
ALTER TABLE "capa_files" DROP CONSTRAINT "cfl_action_fkey";

-- DropForeignKey
ALTER TABLE "capa_files" DROP CONSTRAINT "cfl_capa_fkey";

-- DropForeignKey
ALTER TABLE "capa_files" DROP CONSTRAINT "cfl_immediate_fkey";

-- DropForeignKey
ALTER TABLE "capa_files" DROP CONSTRAINT "cfl_org_fkey";

-- DropForeignKey
ALTER TABLE "capa_files" DROP CONSTRAINT "cfl_uploader_fkey";

-- DropForeignKey
ALTER TABLE "capa_folio_counters" DROP CONSTRAINT "cfc_org_fkey";

-- DropForeignKey
ALTER TABLE "capa_immediate_actions" DROP CONSTRAINT "cia_capa_fkey";

-- DropForeignKey
ALTER TABLE "capa_immediate_actions" DROP CONSTRAINT "cia_org_fkey";

-- DropForeignKey
ALTER TABLE "capa_immediate_actions" DROP CONSTRAINT "cia_resp_fkey";

-- DropForeignKey
ALTER TABLE "capa_relations" DROP CONSTRAINT "crl_capa_fkey";

-- DropForeignKey
ALTER TABLE "capa_relations" DROP CONSTRAINT "crl_diag_fkey";

-- DropForeignKey
ALTER TABLE "capa_relations" DROP CONSTRAINT "crl_doc_fkey";

-- DropForeignKey
ALTER TABLE "capa_relations" DROP CONSTRAINT "crl_org_fkey";

-- DropForeignKey
ALTER TABLE "capa_relations" DROP CONSTRAINT "crl_req_fkey";

-- DropForeignKey
ALTER TABLE "capa_relations" DROP CONSTRAINT "crl_site_fkey";

-- DropForeignKey
ALTER TABLE "capa_relations" DROP CONSTRAINT "crl_ver_fkey";

-- DropForeignKey
ALTER TABLE "capa_root_cause_analyses" DROP CONSTRAINT "crca_capa_fkey";

-- DropForeignKey
ALTER TABLE "capa_root_cause_analyses" DROP CONSTRAINT "crca_investigator_fkey";

-- DropForeignKey
ALTER TABLE "capa_root_cause_analyses" DROP CONSTRAINT "crca_org_fkey";

-- DropForeignKey
ALTER TABLE "capa_status_history" DROP CONSTRAINT "csh_actor_fkey";

-- DropForeignKey
ALTER TABLE "capa_status_history" DROP CONSTRAINT "csh_capa_fkey";

-- DropForeignKey
ALTER TABLE "capa_status_history" DROP CONSTRAINT "csh_org_fkey";

-- DropForeignKey
ALTER TABLE "capa_why_steps" DROP CONSTRAINT "cws_capa_fkey";

-- DropForeignKey
ALTER TABLE "capa_why_steps" DROP CONSTRAINT "cws_org_fkey";

-- DropForeignKey
ALTER TABLE "capa_why_steps" DROP CONSTRAINT "cws_rca_fkey";

-- DropForeignKey
ALTER TABLE "capas" DROP CONSTRAINT "capa_closed_fkey";

-- DropForeignKey
ALTER TABLE "capas" DROP CONSTRAINT "capa_createdby_fkey";

-- DropForeignKey
ALTER TABLE "capas" DROP CONSTRAINT "capa_diag_fkey";

-- DropForeignKey
ALTER TABLE "capas" DROP CONSTRAINT "capa_doc_fkey";

-- DropForeignKey
ALTER TABLE "capas" DROP CONSTRAINT "capa_org_fkey";

-- DropForeignKey
ALTER TABLE "capas" DROP CONSTRAINT "capa_reported_fkey";

-- DropForeignKey
ALTER TABLE "capas" DROP CONSTRAINT "capa_req_fkey";

-- DropForeignKey
ALTER TABLE "capas" DROP CONSTRAINT "capa_responsible_fkey";

-- DropForeignKey
ALTER TABLE "capas" DROP CONSTRAINT "capa_site_fkey";

-- DropForeignKey
ALTER TABLE "capas" DROP CONSTRAINT "capa_ver_fkey";

-- DropForeignKey
ALTER TABLE "cause_tree_edges" DROP CONSTRAINT "cte_analysis_fkey";

-- DropForeignKey
ALTER TABLE "cause_tree_edges" DROP CONSTRAINT "cte_from_fkey";

-- DropForeignKey
ALTER TABLE "cause_tree_edges" DROP CONSTRAINT "cte_org_fkey";

-- DropForeignKey
ALTER TABLE "cause_tree_edges" DROP CONSTRAINT "cte_to_fkey";

-- DropForeignKey
ALTER TABLE "cause_tree_nodes" DROP CONSTRAINT "ctn_analysis_fkey";

-- DropForeignKey
ALTER TABLE "cause_tree_nodes" DROP CONSTRAINT "ctn_org_fkey";

-- DropForeignKey
ALTER TABLE "comparative_cases" DROP CONSTRAINT "cc_analysis_fkey";

-- DropForeignKey
ALTER TABLE "comparative_cases" DROP CONSTRAINT "cc_capa_fkey";

-- DropForeignKey
ALTER TABLE "comparative_cases" DROP CONSTRAINT "cc_org_fkey";

-- DropForeignKey
ALTER TABLE "document_approvals" DROP CONSTRAINT "dap_org_fkey";

-- DropForeignKey
ALTER TABLE "document_approvals" DROP CONSTRAINT "dap_user_fkey";

-- DropForeignKey
ALTER TABLE "document_approvals" DROP CONSTRAINT "dap_version_fkey";

-- DropForeignKey
ALTER TABLE "document_comments" DROP CONSTRAINT "dc_org_fkey";

-- DropForeignKey
ALTER TABLE "document_comments" DROP CONSTRAINT "dc_version_fkey";

-- DropForeignKey
ALTER TABLE "document_controlled_copies" DROP CONSTRAINT "dcc_org_fkey";

-- DropForeignKey
ALTER TABLE "document_controlled_copies" DROP CONSTRAINT "dcc_version_fkey";

-- DropForeignKey
ALTER TABLE "document_distributions" DROP CONSTRAINT "dd_org_fkey";

-- DropForeignKey
ALTER TABLE "document_distributions" DROP CONSTRAINT "dd_site_fkey";

-- DropForeignKey
ALTER TABLE "document_distributions" DROP CONSTRAINT "dd_user_fkey";

-- DropForeignKey
ALTER TABLE "document_distributions" DROP CONSTRAINT "dd_version_fkey";

-- DropForeignKey
ALTER TABLE "document_files" DROP CONSTRAINT "document_files_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "document_files" DROP CONSTRAINT "document_files_uploaded_by_fkey";

-- DropForeignKey
ALTER TABLE "document_history" DROP CONSTRAINT "document_history_actor_user_id_fkey";

-- DropForeignKey
ALTER TABLE "document_history" DROP CONSTRAINT "document_history_document_fkey";

-- DropForeignKey
ALTER TABLE "document_history" DROP CONSTRAINT "document_history_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "document_read_acknowledgements" DROP CONSTRAINT "dra_org_fkey";

-- DropForeignKey
ALTER TABLE "document_read_acknowledgements" DROP CONSTRAINT "dra_user_fkey";

-- DropForeignKey
ALTER TABLE "document_read_acknowledgements" DROP CONSTRAINT "dra_version_fkey";

-- DropForeignKey
ALTER TABLE "document_relations" DROP CONSTRAINT "document_relations_diagnostic_fkey";

-- DropForeignKey
ALTER TABLE "document_relations" DROP CONSTRAINT "document_relations_framework_fkey";

-- DropForeignKey
ALTER TABLE "document_relations" DROP CONSTRAINT "document_relations_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "document_relations" DROP CONSTRAINT "document_relations_related_document_fkey";

-- DropForeignKey
ALTER TABLE "document_relations" DROP CONSTRAINT "document_relations_requirement_fkey";

-- DropForeignKey
ALTER TABLE "document_relations" DROP CONSTRAINT "document_relations_site_fkey";

-- DropForeignKey
ALTER TABLE "document_status_history" DROP CONSTRAINT "dsh_org_fkey";

-- DropForeignKey
ALTER TABLE "document_status_history" DROP CONSTRAINT "dsh_version_fkey";

-- DropForeignKey
ALTER TABLE "document_versions" DROP CONSTRAINT "document_versions_author_fkey";

-- DropForeignKey
ALTER TABLE "document_versions" DROP CONSTRAINT "document_versions_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "document_versions" DROP CONSTRAINT "document_versions_updated_by_fkey";

-- DropForeignKey
ALTER TABLE "document_workflow_steps" DROP CONSTRAINT "dws_org_fkey";

-- DropForeignKey
ALTER TABLE "document_workflow_steps" DROP CONSTRAINT "dws_user_fkey";

-- DropForeignKey
ALTER TABLE "document_workflow_steps" DROP CONSTRAINT "dws_version_fkey";

-- DropForeignKey
ALTER TABLE "document_workflow_steps" DROP CONSTRAINT "dws_wf_fkey";

-- DropForeignKey
ALTER TABLE "document_workflows" DROP CONSTRAINT "dw_doc_fkey";

-- DropForeignKey
ALTER TABLE "document_workflows" DROP CONSTRAINT "dw_org_fkey";

-- DropForeignKey
ALTER TABLE "document_workflows" DROP CONSTRAINT "dw_version_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_created_by_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_responsible_user_id_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_site_id_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "fmea_rows" DROP CONSTRAINT "fr_analysis_fkey";

-- DropForeignKey
ALTER TABLE "fmea_rows" DROP CONSTRAINT "fr_org_fkey";

-- DropForeignKey
ALTER TABLE "fmea_rows" DROP CONSTRAINT "fr_resp_fkey";

-- DropForeignKey
ALTER TABLE "ishikawa_categories" DROP CONSTRAINT "ic_analysis_fkey";

-- DropForeignKey
ALTER TABLE "ishikawa_categories" DROP CONSTRAINT "ic_org_fkey";

-- DropForeignKey
ALTER TABLE "pareto_items" DROP CONSTRAINT "pi_analysis_fkey";

-- DropForeignKey
ALTER TABLE "pareto_items" DROP CONSTRAINT "pi_org_fkey";

-- DropForeignKey
ALTER TABLE "quality_analyses" DROP CONSTRAINT "qa_approver_fkey";

-- DropForeignKey
ALTER TABLE "quality_analyses" DROP CONSTRAINT "qa_capa_fkey";

-- DropForeignKey
ALTER TABLE "quality_analyses" DROP CONSTRAINT "qa_createdby_fkey";

-- DropForeignKey
ALTER TABLE "quality_analyses" DROP CONSTRAINT "qa_org_fkey";

-- DropForeignKey
ALTER TABLE "quality_analyses" DROP CONSTRAINT "qa_parent_fkey";

-- DropForeignKey
ALTER TABLE "quality_analyses" DROP CONSTRAINT "qa_resp_fkey";

-- DropForeignKey
ALTER TABLE "quality_analyses" DROP CONSTRAINT "qa_reviewer_fkey";

-- DropForeignKey
ALTER TABLE "quality_analysis_action_links" DROP CONSTRAINT "qal_action_fkey";

-- DropForeignKey
ALTER TABLE "quality_analysis_action_links" DROP CONSTRAINT "qal_analysis_fkey";

-- DropForeignKey
ALTER TABLE "quality_analysis_action_links" DROP CONSTRAINT "qal_org_fkey";

-- DropForeignKey
ALTER TABLE "quality_analysis_comments" DROP CONSTRAINT "qcm_analysis_fkey";

-- DropForeignKey
ALTER TABLE "quality_analysis_comments" DROP CONSTRAINT "qcm_org_fkey";

-- DropForeignKey
ALTER TABLE "quality_analysis_conclusions" DROP CONSTRAINT "qac_analysis_fkey";

-- DropForeignKey
ALTER TABLE "quality_analysis_conclusions" DROP CONSTRAINT "qac_org_fkey";

-- DropForeignKey
ALTER TABLE "quality_analysis_history" DROP CONSTRAINT "qah_actor_fkey";

-- DropForeignKey
ALTER TABLE "quality_analysis_history" DROP CONSTRAINT "qah_analysis_fkey";

-- DropForeignKey
ALTER TABLE "quality_analysis_history" DROP CONSTRAINT "qah_org_fkey";

-- DropForeignKey
ALTER TABLE "quality_analysis_participants" DROP CONSTRAINT "qap_analysis_fkey";

-- DropForeignKey
ALTER TABLE "quality_analysis_participants" DROP CONSTRAINT "qap_org_fkey";

-- DropForeignKey
ALTER TABLE "quality_analysis_participants" DROP CONSTRAINT "qap_user_fkey";

-- DropForeignKey
ALTER TABLE "quality_analysis_versions" DROP CONSTRAINT "qav_analysis_fkey";

-- DropForeignKey
ALTER TABLE "quality_analysis_versions" DROP CONSTRAINT "qav_org_fkey";

-- DropForeignKey
ALTER TABLE "quality_evidence" DROP CONSTRAINT "qe_analysis_fkey";

-- DropForeignKey
ALTER TABLE "quality_evidence" DROP CONSTRAINT "qe_capa_fkey";

-- DropForeignKey
ALTER TABLE "quality_evidence" DROP CONSTRAINT "qe_org_fkey";

-- DropForeignKey
ALTER TABLE "quality_evidence" DROP CONSTRAINT "qe_uploader_fkey";

-- DropForeignKey
ALTER TABLE "quality_hypotheses" DROP CONSTRAINT "qh_analysis_fkey";

-- DropForeignKey
ALTER TABLE "quality_hypotheses" DROP CONSTRAINT "qh_cat_fkey";

-- DropForeignKey
ALTER TABLE "quality_hypotheses" DROP CONSTRAINT "qh_org_fkey";

-- DropForeignKey
ALTER TABLE "quality_hypotheses" DROP CONSTRAINT "qh_parent_fkey";

-- DropForeignKey
ALTER TABLE "quality_hypotheses" DROP CONSTRAINT "qh_resp_fkey";

-- DropForeignKey
ALTER TABLE "recurrence_matches" DROP CONSTRAINT "rm_analysis_fkey";

-- DropForeignKey
ALTER TABLE "recurrence_matches" DROP CONSTRAINT "rm_capa_fkey";

-- DropForeignKey
ALTER TABLE "recurrence_matches" DROP CONSTRAINT "rm_confirmed_fkey";

-- DropForeignKey
ALTER TABLE "recurrence_matches" DROP CONSTRAINT "rm_org_fkey";

-- DropIndex
DROP INDEX "assessment_frameworks_id_organization_id_key";

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "folio" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "objective" TEXT,
    "scope" TEXT,
    "project_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "responsible_user_id" UUID,
    "sponsor_user_id" UUID,
    "start_date" DATE,
    "target_date" DATE,
    "closed_at" TIMESTAMPTZ(6),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "budget_estimated" DECIMAL(14,2),
    "actual_cost" DECIMAL(14,2),
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "risks_summary" TEXT,
    "expected_outcome" TEXT,
    "actual_outcome" TEXT,
    "tags" JSONB,
    "metadata" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_folio_counters" (
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_folio_counters_pkey" PRIMARY KEY ("organization_id","year")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "added_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_milestones" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target_date" DATE,
    "actual_date" DATE,
    "responsible_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "acceptance_criteria" TEXT,
    "depends_on_milestone_id" UUID,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_relations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "relation_type" TEXT NOT NULL,
    "target_id" UUID,
    "external_ref" TEXT,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_comments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "author" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_files" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'attachment',
    "original_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "extension" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "checksum" TEXT,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_status_history" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "actor_user_id" UUID,
    "detail" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "folio" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "task_type" TEXT NOT NULL DEFAULT 'manual',
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "project_id" UUID,
    "milestone_id" UUID,
    "responsible_user_id" UUID,
    "created_by" UUID,
    "start_date" DATE,
    "target_date" DATE,
    "closed_at" TIMESTAMPTZ(6),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "estimated_hours" DECIMAL(8,2),
    "actual_hours" DECIMAL(8,2),
    "blocked_reason" TEXT,
    "result" TEXT,
    "source_type" TEXT,
    "source_id" UUID,
    "tags" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_folio_counters" (
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "task_folio_counters_pkey" PRIMARY KEY ("organization_id","year")
);

-- CreateTable
CREATE TABLE "task_assignments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'participant',
    "added_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_relations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "relation_type" TEXT NOT NULL,
    "target_id" UUID,
    "external_ref" TEXT,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "from_task_id" UUID NOT NULL,
    "to_task_id" UUID NOT NULL,
    "dep_type" TEXT NOT NULL DEFAULT 'finish_to_start',
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "lag_days" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "author" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_files" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'attachment',
    "original_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "extension" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "checksum" TEXT,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_status_history" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "actor_user_id" UUID,
    "detail" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_organization_id_status_idx" ON "projects"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "projects_organization_id_folio_key" ON "projects"("organization_id", "folio");

-- CreateIndex
CREATE UNIQUE INDEX "projects_id_organization_id_key" ON "projects"("id", "organization_id");

-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_id_organization_id_key" ON "project_members"("id", "organization_id");

-- CreateIndex
CREATE INDEX "project_milestones_project_id_idx" ON "project_milestones"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_milestones_id_organization_id_key" ON "project_milestones"("id", "organization_id");

-- CreateIndex
CREATE INDEX "project_relations_project_id_idx" ON "project_relations"("project_id");

-- CreateIndex
CREATE INDEX "project_comments_project_id_created_at_idx" ON "project_comments"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "project_files_project_id_idx" ON "project_files"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_files_id_organization_id_key" ON "project_files"("id", "organization_id");

-- CreateIndex
CREATE INDEX "project_status_history_project_id_created_at_idx" ON "project_status_history"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "tasks_organization_id_status_idx" ON "tasks"("organization_id", "status");

-- CreateIndex
CREATE INDEX "tasks_responsible_user_id_status_idx" ON "tasks"("responsible_user_id", "status");

-- CreateIndex
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_organization_id_folio_key" ON "tasks"("organization_id", "folio");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_id_organization_id_key" ON "tasks"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_organization_id_source_type_source_id_key" ON "tasks"("organization_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "task_assignments_user_id_idx" ON "task_assignments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignments_task_id_user_id_key" ON "task_assignments"("task_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignments_id_organization_id_key" ON "task_assignments"("id", "organization_id");

-- CreateIndex
CREATE INDEX "task_relations_task_id_idx" ON "task_relations"("task_id");

-- CreateIndex
CREATE INDEX "task_dependencies_to_task_id_idx" ON "task_dependencies"("to_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_from_task_id_to_task_id_key" ON "task_dependencies"("from_task_id", "to_task_id");

-- CreateIndex
CREATE INDEX "task_comments_task_id_created_at_idx" ON "task_comments"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "task_files_task_id_idx" ON "task_files"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_files_id_organization_id_key" ON "task_files"("id", "organization_id");

-- CreateIndex
CREATE INDEX "task_status_history_task_id_created_at_idx" ON "task_status_history"("task_id", "created_at");

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_organization_id_fkey" FOREIGN KEY ("project_id", "organization_id") REFERENCES "projects"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_organization_id_fkey" FOREIGN KEY ("project_id", "organization_id") REFERENCES "projects"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_relations" ADD CONSTRAINT "project_relations_project_id_organization_id_fkey" FOREIGN KEY ("project_id", "organization_id") REFERENCES "projects"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_project_id_organization_id_fkey" FOREIGN KEY ("project_id", "organization_id") REFERENCES "projects"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_project_id_organization_id_fkey" FOREIGN KEY ("project_id", "organization_id") REFERENCES "projects"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_organization_id_fkey" FOREIGN KEY ("project_id", "organization_id") REFERENCES "projects"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_id_organization_id_fkey" FOREIGN KEY ("milestone_id", "organization_id") REFERENCES "project_milestones"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_organization_id_fkey" FOREIGN KEY ("task_id", "organization_id") REFERENCES "tasks"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_task_id_organization_id_fkey" FOREIGN KEY ("task_id", "organization_id") REFERENCES "tasks"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_from_task_id_organization_id_fkey" FOREIGN KEY ("from_task_id", "organization_id") REFERENCES "tasks"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_to_task_id_organization_id_fkey" FOREIGN KEY ("to_task_id", "organization_id") REFERENCES "tasks"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_organization_id_fkey" FOREIGN KEY ("task_id", "organization_id") REFERENCES "tasks"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_files" ADD CONSTRAINT "task_files_task_id_organization_id_fkey" FOREIGN KEY ("task_id", "organization_id") REFERENCES "tasks"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- =====================================================================
-- TASK-009 — SQL complementario (FKs org/usuario/sitio, CHECK, RLS,
-- append-only, no-borrado y grants). Reutiliza fn_current_org,
-- fn_block_update_delete y fn_block_delete definidas en TASK-002.
-- =====================================================================

-- FK a organización (todas las tablas nuevas).
ALTER TABLE "projects"                ADD CONSTRAINT "prj_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "project_folio_counters"  ADD CONSTRAINT "pfc_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "project_members"         ADD CONSTRAINT "pmb_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "project_milestones"      ADD CONSTRAINT "pms_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "project_relations"       ADD CONSTRAINT "prl_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "project_comments"        ADD CONSTRAINT "pco_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "project_files"           ADD CONSTRAINT "pfl_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "project_status_history"  ADD CONSTRAINT "psh_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "tasks"                   ADD CONSTRAINT "tsk_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "task_folio_counters"     ADD CONSTRAINT "tfc_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "task_assignments"        ADD CONSTRAINT "tas_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "task_relations"          ADD CONSTRAINT "trl_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "task_dependencies"       ADD CONSTRAINT "tdp_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "task_comments"           ADD CONSTRAINT "tco_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "task_files"              ADD CONSTRAINT "tfl_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "task_status_history"     ADD CONSTRAINT "tsh_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;

-- FK compuesta anti-cruce a sitio (proyecto/tarea).
ALTER TABLE "projects" ADD CONSTRAINT "prj_site_fkey" FOREIGN KEY ("site_id","organization_id") REFERENCES "sites"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "tasks"    ADD CONSTRAINT "tsk_site_fkey" FOREIGN KEY ("site_id","organization_id") REFERENCES "sites"("id","organization_id") ON DELETE RESTRICT;

-- FK a usuarios (actor/responsable/participante). RESTRICT: los usuarios no se borran físicamente.
ALTER TABLE "projects"               ADD CONSTRAINT "prj_resp_fkey"    FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "projects"               ADD CONSTRAINT "prj_sponsor_fkey" FOREIGN KEY ("sponsor_user_id")     REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "projects"               ADD CONSTRAINT "prj_creator_fkey" FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "project_members"        ADD CONSTRAINT "pmb_user_fkey"    FOREIGN KEY ("user_id")             REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "project_members"        ADD CONSTRAINT "pmb_addedby_fkey" FOREIGN KEY ("added_by")            REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "project_milestones"     ADD CONSTRAINT "pms_resp_fkey"    FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "project_milestones"     ADD CONSTRAINT "pms_creator_fkey" FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "project_relations"      ADD CONSTRAINT "prl_creator_fkey" FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "project_comments"       ADD CONSTRAINT "pco_author_fkey"  FOREIGN KEY ("author")              REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "project_files"          ADD CONSTRAINT "pfl_uploader_fkey" FOREIGN KEY ("uploaded_by")        REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "project_status_history" ADD CONSTRAINT "psh_actor_fkey"   FOREIGN KEY ("actor_user_id")       REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "tasks"                  ADD CONSTRAINT "tsk_resp_fkey"    FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "tasks"                  ADD CONSTRAINT "tsk_creator_fkey" FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "task_assignments"       ADD CONSTRAINT "tas_user_fkey"    FOREIGN KEY ("user_id")             REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "task_assignments"       ADD CONSTRAINT "tas_addedby_fkey" FOREIGN KEY ("added_by")            REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "task_relations"         ADD CONSTRAINT "trl_creator_fkey" FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "task_dependencies"      ADD CONSTRAINT "tdp_creator_fkey" FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "task_comments"          ADD CONSTRAINT "tco_author_fkey"  FOREIGN KEY ("author")              REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "task_files"             ADD CONSTRAINT "tfl_uploader_fkey" FOREIGN KEY ("uploaded_by")        REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "task_status_history"    ADD CONSTRAINT "tsh_actor_fkey"   FOREIGN KEY ("actor_user_id")       REFERENCES "users"("id") ON DELETE RESTRICT;

-- CHECK de enums (text + CHECK).
ALTER TABLE "projects" ADD CONSTRAINT "prj_type_check"     CHECK ("project_type" IN ('continuous_improvement','capa','implementation','compliance','certification','infrastructure','training','risk_reduction','documentation','other'));
ALTER TABLE "projects" ADD CONSTRAINT "prj_status_check"   CHECK ("status" IN ('draft','planned','active','on_hold','under_review','completed','cancelled'));
ALTER TABLE "projects" ADD CONSTRAINT "prj_priority_check" CHECK ("priority" IN ('low','normal','high','urgent'));
ALTER TABLE "projects" ADD CONSTRAINT "prj_origin_check"   CHECK ("origin" IN ('manual','capa','analysis','document','other'));
ALTER TABLE "projects" ADD CONSTRAINT "prj_progress_check" CHECK ("progress" BETWEEN 0 AND 100);
ALTER TABLE "project_members"    ADD CONSTRAINT "pmb_role_check"     CHECK ("role" IN ('lead','member','viewer'));
ALTER TABLE "project_milestones" ADD CONSTRAINT "pms_status_check"   CHECK ("status" IN ('pending','at_risk','reached','overdue','cancelled'));
ALTER TABLE "project_milestones" ADD CONSTRAINT "pms_sequence_check" CHECK ("sequence" >= 1);
ALTER TABLE "project_relations"  ADD CONSTRAINT "prl_type_check"     CHECK ("relation_type" IN ('capa','analysis','document','document_version','external'));
ALTER TABLE "project_files"      ADD CONSTRAINT "pfl_kind_check"     CHECK ("kind" IN ('attachment','evidence'));
ALTER TABLE "tasks" ADD CONSTRAINT "tsk_type_check"     CHECK ("task_type" IN ('manual','doc_review','doc_approval','doc_read','capa_action','effectiveness_review','analysis','fmea_action','project','follow_up','other'));
ALTER TABLE "tasks" ADD CONSTRAINT "tsk_origin_check"   CHECK ("origin" IN ('manual','project','capa','analysis','document','fmea','other'));
ALTER TABLE "tasks" ADD CONSTRAINT "tsk_status_check"   CHECK ("status" IN ('draft','pending','in_progress','blocked','under_review','completed','cancelled'));
ALTER TABLE "tasks" ADD CONSTRAINT "tsk_priority_check" CHECK ("priority" IN ('low','normal','high','urgent'));
ALTER TABLE "tasks" ADD CONSTRAINT "tsk_progress_check" CHECK ("progress" BETWEEN 0 AND 100);
ALTER TABLE "task_assignments"  ADD CONSTRAINT "tas_role_check" CHECK ("role" IN ('assignee','participant','watcher'));
ALTER TABLE "task_relations"    ADD CONSTRAINT "trl_type_check" CHECK ("relation_type" IN ('document','document_version','capa','capa_action','analysis','fmea_row','project','milestone','parent_task','external'));
ALTER TABLE "task_dependencies" ADD CONSTRAINT "tdp_type_check" CHECK ("dep_type" IN ('finish_to_start'));
ALTER TABLE "task_dependencies" ADD CONSTRAINT "tdp_lag_check"  CHECK ("lag_days" >= 0);
ALTER TABLE "task_dependencies" ADD CONSTRAINT "tdp_noself_check" CHECK ("from_task_id" <> "to_task_id");
ALTER TABLE "task_files"        ADD CONSTRAINT "tfl_kind_check" CHECK ("kind" IN ('attachment','evidence'));

-- Append-only: los historiales de estado son inmutables.
CREATE TRIGGER trg_psh_append BEFORE UPDATE OR DELETE ON "project_status_history" FOR EACH ROW EXECUTE FUNCTION fn_block_update_delete();
CREATE TRIGGER trg_tsh_append BEFORE UPDATE OR DELETE ON "task_status_history"    FOR EACH ROW EXECUTE FUNCTION fn_block_update_delete();

-- Prohibir borrado físico (usar borrado lógico / cancelación).
CREATE TRIGGER trg_prj_nodel BEFORE DELETE ON "projects"           FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_pmb_nodel BEFORE DELETE ON "project_members"    FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_pms_nodel BEFORE DELETE ON "project_milestones" FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_prl_nodel BEFORE DELETE ON "project_relations"  FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_pco_nodel BEFORE DELETE ON "project_comments"   FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_pfl_nodel BEFORE DELETE ON "project_files"      FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_tsk_nodel BEFORE DELETE ON "tasks"              FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_tas_nodel BEFORE DELETE ON "task_assignments"   FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_trl_nodel BEFORE DELETE ON "task_relations"     FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_tdp_nodel BEFORE DELETE ON "task_dependencies"  FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_tco_nodel BEFORE DELETE ON "task_comments"      FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_tfl_nodel BEFORE DELETE ON "task_files"         FOR EACH ROW EXECUTE FUNCTION fn_block_delete();

-- RLS por organización (reutiliza fn_current_org) + permisos a gapsi_app.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'projects','project_folio_counters','project_members','project_milestones',
    'project_relations','project_comments','project_files','project_status_history',
    'tasks','task_folio_counters','task_assignments','task_relations',
    'task_dependencies','task_comments','task_files','task_status_history'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;

GRANT USAGE, SELECT ON SEQUENCE "project_status_history_id_seq" TO gapsi_app;
GRANT USAGE, SELECT ON SEQUENCE "task_status_history_id_seq" TO gapsi_app;
