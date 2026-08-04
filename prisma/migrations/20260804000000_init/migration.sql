-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "external_id" TEXT,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_frameworks" (
    "id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "organization_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "assessment_frameworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_versions" (
    "id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "organization_id" UUID,
    "framework_id" UUID NOT NULL,
    "source_master_version_id" UUID,
    "version_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "content_hash" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_sections" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "template_version_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "weight" DECIMAL(6,3),

    CONSTRAINT "template_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_requirements" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "template_version_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,

    CONSTRAINT "template_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_questions" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "template_version_id" UUID NOT NULL,
    "requirement_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "question_type" TEXT NOT NULL,
    "weight" DECIMAL(6,3) NOT NULL DEFAULT 1,
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "allows_not_applicable" BOOLEAN NOT NULL DEFAULT false,
    "is_scored" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL,

    CONSTRAINT "template_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_answer_options" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "template_version_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "score_fraction" DECIMAL(4,3) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "template_answer_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostics" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "template_version_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "responsible_user_id" UUID,
    "target_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by" UUID,
    "submitted_by" UUID,
    "submitted_at" TIMESTAMPTZ(6),
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "diagnostics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_answers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "diagnostic_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "answer_status" TEXT NOT NULL DEFAULT 'pending',
    "selected_option_id" UUID,
    "value_text" TEXT,
    "na_justification" TEXT,
    "answered_by" UUID,
    "answered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "diagnostic_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidences" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "diagnostic_id" UUID NOT NULL,
    "answer_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "note_text" TEXT,
    "reference_url" TEXT,
    "storage_backend" TEXT,
    "file_object_key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_provided',
    "created_by" UUID,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_results" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "diagnostic_id" UUID NOT NULL,
    "numerator" DECIMAL(12,4) NOT NULL,
    "denominator" DECIMAL(12,4) NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "risk_level" TEXT NOT NULL,
    "critical_unmet" INTEGER NOT NULL DEFAULT 0,
    "excluded_count" INTEGER NOT NULL DEFAULT 0,
    "engine_version" TEXT NOT NULL,
    "inputs_hash" TEXT NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computed_by" UUID,
    "invalidated_at" TIMESTAMPTZ(6),
    "invalidated_by" UUID,
    "invalidated_reason" TEXT,

    CONSTRAINT "diagnostic_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_section_results" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "diagnostic_result_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "numerator" DECIMAL(12,4) NOT NULL,
    "denominator" DECIMAL(12,4) NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "excluded_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "diagnostic_section_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_findings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "diagnostic_result_id" UUID NOT NULL,
    "requirement_id" UUID NOT NULL,
    "question_id" UUID,
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "gap_score" DECIMAL(12,4) NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "diagnostic_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_state_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "diagnostic_id" UUID NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "changed_by" UUID,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "diagnostic_state_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" UUID,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_external_id_key" ON "users"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE INDEX "memberships_organization_id_role_idx" ON "memberships"("organization_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_organization_id_user_id_key" ON "memberships"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "sites_organization_id_idx" ON "sites"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "sites_id_organization_id_key" ON "sites"("id", "organization_id");

-- CreateIndex
CREATE INDEX "assessment_frameworks_scope_idx" ON "assessment_frameworks"("scope");

-- CreateIndex
CREATE INDEX "assessment_frameworks_organization_id_idx" ON "assessment_frameworks"("organization_id");

-- CreateIndex
CREATE INDEX "template_versions_scope_idx" ON "template_versions"("scope");

-- CreateIndex
CREATE INDEX "template_versions_organization_id_framework_id_status_idx" ON "template_versions"("organization_id", "framework_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "template_versions_framework_id_version_number_key" ON "template_versions"("framework_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "template_versions_id_organization_id_key" ON "template_versions"("id", "organization_id");

-- CreateIndex
CREATE INDEX "template_sections_template_version_id_position_idx" ON "template_sections"("template_version_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "template_sections_template_version_id_code_key" ON "template_sections"("template_version_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "template_sections_id_organization_id_key" ON "template_sections"("id", "organization_id");

-- CreateIndex
CREATE INDEX "template_requirements_section_id_position_idx" ON "template_requirements"("section_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "template_requirements_template_version_id_code_key" ON "template_requirements"("template_version_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "template_requirements_id_organization_id_key" ON "template_requirements"("id", "organization_id");

-- CreateIndex
CREATE INDEX "template_questions_requirement_id_position_idx" ON "template_questions"("requirement_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "template_questions_template_version_id_code_key" ON "template_questions"("template_version_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "template_questions_id_organization_id_key" ON "template_questions"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "template_answer_options_question_id_code_key" ON "template_answer_options"("question_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "template_answer_options_id_organization_id_key" ON "template_answer_options"("id", "organization_id");

-- CreateIndex
CREATE INDEX "diagnostics_organization_id_status_idx" ON "diagnostics"("organization_id", "status");

-- CreateIndex
CREATE INDEX "diagnostics_organization_id_site_id_idx" ON "diagnostics"("organization_id", "site_id");

-- CreateIndex
CREATE INDEX "diagnostics_template_version_id_idx" ON "diagnostics"("template_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostics_id_organization_id_key" ON "diagnostics"("id", "organization_id");

-- CreateIndex
CREATE INDEX "diagnostic_answers_diagnostic_id_idx" ON "diagnostic_answers"("diagnostic_id");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_answers_diagnostic_id_question_id_key" ON "diagnostic_answers"("diagnostic_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_answers_id_organization_id_key" ON "diagnostic_answers"("id", "organization_id");

-- CreateIndex
CREATE INDEX "evidences_diagnostic_id_idx" ON "evidences"("diagnostic_id");

-- CreateIndex
CREATE INDEX "evidences_answer_id_idx" ON "evidences"("answer_id");

-- CreateIndex
CREATE INDEX "diagnostic_results_diagnostic_id_idx" ON "diagnostic_results"("diagnostic_id");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_results_id_organization_id_key" ON "diagnostic_results"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_section_results_diagnostic_result_id_section_id_key" ON "diagnostic_section_results"("diagnostic_result_id", "section_id");

-- CreateIndex
CREATE INDEX "diagnostic_findings_diagnostic_result_id_rank_idx" ON "diagnostic_findings"("diagnostic_result_id", "rank");

-- CreateIndex
CREATE INDEX "diagnostic_state_history_diagnostic_id_changed_at_idx" ON "diagnostic_state_history"("diagnostic_id", "changed_at");

-- CreateIndex
CREATE INDEX "audit_log_organization_id_created_at_idx" ON "audit_log"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "assessment_frameworks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_source_master_version_id_fkey" FOREIGN KEY ("source_master_version_id") REFERENCES "template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_sections" ADD CONSTRAINT "template_sections_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_requirements" ADD CONSTRAINT "template_requirements_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "template_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_questions" ADD CONSTRAINT "template_questions_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "template_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_answer_options" ADD CONSTRAINT "template_answer_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "template_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_site_id_organization_id_fkey" FOREIGN KEY ("site_id", "organization_id") REFERENCES "sites"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_template_version_id_organization_id_fkey" FOREIGN KEY ("template_version_id", "organization_id") REFERENCES "template_versions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_answers" ADD CONSTRAINT "diagnostic_answers_diagnostic_id_organization_id_fkey" FOREIGN KEY ("diagnostic_id", "organization_id") REFERENCES "diagnostics"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_answers" ADD CONSTRAINT "diagnostic_answers_question_id_organization_id_fkey" FOREIGN KEY ("question_id", "organization_id") REFERENCES "template_questions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_answers" ADD CONSTRAINT "diagnostic_answers_selected_option_id_organization_id_fkey" FOREIGN KEY ("selected_option_id", "organization_id") REFERENCES "template_answer_options"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_diagnostic_id_organization_id_fkey" FOREIGN KEY ("diagnostic_id", "organization_id") REFERENCES "diagnostics"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_answer_id_organization_id_fkey" FOREIGN KEY ("answer_id", "organization_id") REFERENCES "diagnostic_answers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_results" ADD CONSTRAINT "diagnostic_results_diagnostic_id_organization_id_fkey" FOREIGN KEY ("diagnostic_id", "organization_id") REFERENCES "diagnostics"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_section_results" ADD CONSTRAINT "diagnostic_section_results_diagnostic_result_id_organizati_fkey" FOREIGN KEY ("diagnostic_result_id", "organization_id") REFERENCES "diagnostic_results"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_section_results" ADD CONSTRAINT "diagnostic_section_results_section_id_organization_id_fkey" FOREIGN KEY ("section_id", "organization_id") REFERENCES "template_sections"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_findings" ADD CONSTRAINT "diagnostic_findings_diagnostic_result_id_organization_id_fkey" FOREIGN KEY ("diagnostic_result_id", "organization_id") REFERENCES "diagnostic_results"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_findings" ADD CONSTRAINT "diagnostic_findings_requirement_id_organization_id_fkey" FOREIGN KEY ("requirement_id", "organization_id") REFERENCES "template_requirements"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_state_history" ADD CONSTRAINT "diagnostic_state_history_diagnostic_id_organization_id_fkey" FOREIGN KEY ("diagnostic_id", "organization_id") REFERENCES "diagnostics"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

