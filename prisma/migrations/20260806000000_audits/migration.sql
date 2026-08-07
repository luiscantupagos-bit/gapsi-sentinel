-- CreateTable
CREATE TABLE "audit_programs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "folio" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "objective" TEXT,
    "scope" TEXT,
    "criteria" TEXT,
    "year" INTEGER NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'annual',
    "responsible_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "start_date" DATE,
    "end_date" DATE,
    "tags" JSONB,
    "metadata" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "audit_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_program_folio_counters" (
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "audit_program_folio_counters_pkey" PRIMARY KEY ("organization_id","year")
);

-- CreateTable
CREATE TABLE "audit_program_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "planned_date" DATE,
    "site_id" UUID,
    "framework_id" UUID,
    "audit_type" TEXT NOT NULL DEFAULT 'internal',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "audit_id" UUID,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_program_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_program_files" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "original_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "extension" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "checksum" TEXT,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_program_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_program_status_history" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "actor_user_id" UUID,
    "detail" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_program_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audits" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "folio" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "audit_type" TEXT NOT NULL DEFAULT 'internal',
    "program_id" UUID,
    "program_item_id" UUID,
    "site_id" UUID,
    "area" TEXT,
    "process" TEXT,
    "objective" TEXT,
    "scope" TEXT,
    "criteria" TEXT,
    "framework_id" UUID,
    "template_version_id" UUID,
    "norm_version_label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "planned_date" DATE,
    "started_at" DATE,
    "ended_at" DATE,
    "lead_auditor_user_id" UUID,
    "executive_summary" TEXT,
    "conclusion" TEXT,
    "follow_up_required" BOOLEAN NOT NULL DEFAULT false,
    "project_id" UUID,
    "notes" TEXT,
    "tags" JSONB,
    "metadata" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_folio_counters" (
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "audit_folio_counters_pkey" PRIMARY KEY ("organization_id","year")
);

-- CreateTable
CREATE TABLE "audit_team_members" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "audit_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'auditor',
    "area" TEXT,
    "potential_conflict" BOOLEAN NOT NULL DEFAULT false,
    "conflict_justification" TEXT,
    "added_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_agenda_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "audit_id" UUID NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "process_area" TEXT,
    "requirement_ref" TEXT,
    "auditor_user_id" UUID,
    "auditee_user_id" UUID,
    "location" TEXT,
    "notes" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_agenda_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_scope_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "audit_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "site_id" UUID,
    "framework_id" UUID,
    "label" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_scope_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_requirement_snapshots" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "audit_id" UUID NOT NULL,
    "framework_id" UUID,
    "framework_code" TEXT,
    "framework_name" TEXT,
    "template_version_id" UUID,
    "version_number" INTEGER,
    "section_id" UUID,
    "section_code" TEXT,
    "section_title" TEXT,
    "requirement_id" UUID,
    "requirement_code" TEXT NOT NULL,
    "requirement_title" TEXT NOT NULL,
    "requirement_text" TEXT,
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "criteria" TEXT,
    "questions" JSONB,
    "config" JSONB,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "captured_by" UUID,
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_requirement_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_checklist_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "audit_id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "assigned_auditor_user_id" UUID,
    "expected_evidence" TEXT,
    "found_evidence" TEXT,
    "result" TEXT NOT NULL DEFAULT 'no_evaluado',
    "comment" TEXT,
    "field_verification_required" BOOLEAN NOT NULL DEFAULT false,
    "private_notes" TEXT,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_evidences" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "audit_id" UUID NOT NULL,
    "checklist_item_id" UUID,
    "snapshot_id" UUID,
    "evidence_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT,
    "evidence_date" DATE,
    "document_id" UUID,
    "document_version_id" UUID,
    "interview_id" UUID,
    "file_id" UUID,
    "external_ref" TEXT,
    "reliability" TEXT,
    "comment" TEXT,
    "captured_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_interviews" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "audit_id" UUID NOT NULL,
    "checklist_item_id" UUID,
    "person_role" TEXT,
    "area" TEXT,
    "topic" TEXT,
    "questions" TEXT,
    "answers" TEXT,
    "auditor_notes" TEXT,
    "interview_date" DATE,
    "auditor_user_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_files" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "audit_id" UUID NOT NULL,
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

    CONSTRAINT "audit_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_comments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "audit_id" UUID NOT NULL,
    "author" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_status_history" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" UUID NOT NULL,
    "audit_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "actor_user_id" UUID,
    "detail" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_requirement_history" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" UUID NOT NULL,
    "audit_id" UUID NOT NULL,
    "checklist_item_id" UUID,
    "snapshot_id" UUID,
    "event" TEXT NOT NULL,
    "from_result" TEXT,
    "to_result" TEXT,
    "actor_user_id" UUID,
    "detail" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_requirement_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_findings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "folio" TEXT NOT NULL,
    "audit_id" UUID NOT NULL,
    "snapshot_id" UUID,
    "site_id" UUID,
    "process" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "objective_evidence" TEXT,
    "requirement_breached" TEXT,
    "classification" TEXT NOT NULL DEFAULT 'observation',
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "responsible_user_id" UUID,
    "detected_at" DATE,
    "committed_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'open',
    "immediate_correction" TEXT,
    "capa_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "audit_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_finding_folio_counters" (
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "audit_finding_folio_counters_pkey" PRIMARY KEY ("organization_id","year")
);

-- CreateTable
CREATE TABLE "audit_finding_relations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "finding_id" UUID NOT NULL,
    "relation_type" TEXT NOT NULL,
    "target_id" UUID,
    "external_ref" TEXT,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_finding_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_follow_ups" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "finding_id" UUID NOT NULL,
    "correction" TEXT,
    "capa_id" UUID,
    "responsible_user_id" UUID,
    "target_date" DATE,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "verifier_user_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "result" TEXT,
    "comment" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "audit_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_certifications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "framework_id" UUID,
    "scheme_name" TEXT NOT NULL,
    "version" TEXT,
    "scope" TEXT,
    "certifier_name" TEXT,
    "last_audit_date" DATE,
    "next_audit_date" DATE,
    "expiry_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'preparation',
    "certificate_file_id" UUID,
    "comment" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "organization_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_programs_organization_id_status_idx" ON "audit_programs"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "audit_programs_organization_id_folio_key" ON "audit_programs"("organization_id", "folio");

-- CreateIndex
CREATE UNIQUE INDEX "audit_programs_id_organization_id_key" ON "audit_programs"("id", "organization_id");

-- CreateIndex
CREATE INDEX "audit_program_items_program_id_idx" ON "audit_program_items"("program_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_program_items_id_organization_id_key" ON "audit_program_items"("id", "organization_id");

-- CreateIndex
CREATE INDEX "audit_program_files_program_id_idx" ON "audit_program_files"("program_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_program_files_id_organization_id_key" ON "audit_program_files"("id", "organization_id");

-- CreateIndex
CREATE INDEX "audit_program_status_history_program_id_created_at_idx" ON "audit_program_status_history"("program_id", "created_at");

-- CreateIndex
CREATE INDEX "audits_organization_id_status_idx" ON "audits"("organization_id", "status");

-- CreateIndex
CREATE INDEX "audits_organization_id_program_id_idx" ON "audits"("organization_id", "program_id");

-- CreateIndex
CREATE UNIQUE INDEX "audits_organization_id_folio_key" ON "audits"("organization_id", "folio");

-- CreateIndex
CREATE UNIQUE INDEX "audits_id_organization_id_key" ON "audits"("id", "organization_id");

-- CreateIndex
CREATE INDEX "audit_team_members_user_id_idx" ON "audit_team_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_team_members_audit_id_user_id_key" ON "audit_team_members"("audit_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_team_members_id_organization_id_key" ON "audit_team_members"("id", "organization_id");

-- CreateIndex
CREATE INDEX "audit_agenda_items_audit_id_sequence_idx" ON "audit_agenda_items"("audit_id", "sequence");

-- CreateIndex
CREATE INDEX "audit_scope_items_audit_id_idx" ON "audit_scope_items"("audit_id");

-- CreateIndex
CREATE INDEX "audit_requirement_snapshots_audit_id_sequence_idx" ON "audit_requirement_snapshots"("audit_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "audit_requirement_snapshots_id_organization_id_key" ON "audit_requirement_snapshots"("id", "organization_id");

-- CreateIndex
CREATE INDEX "audit_checklist_items_audit_id_result_idx" ON "audit_checklist_items"("audit_id", "result");

-- CreateIndex
CREATE UNIQUE INDEX "audit_checklist_items_audit_id_snapshot_id_key" ON "audit_checklist_items"("audit_id", "snapshot_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_checklist_items_snapshot_id_organization_id_key" ON "audit_checklist_items"("snapshot_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_checklist_items_id_organization_id_key" ON "audit_checklist_items"("id", "organization_id");

-- CreateIndex
CREATE INDEX "audit_evidences_audit_id_idx" ON "audit_evidences"("audit_id");

-- CreateIndex
CREATE INDEX "audit_evidences_checklist_item_id_idx" ON "audit_evidences"("checklist_item_id");

-- CreateIndex
CREATE INDEX "audit_interviews_audit_id_idx" ON "audit_interviews"("audit_id");

-- CreateIndex
CREATE INDEX "audit_files_audit_id_idx" ON "audit_files"("audit_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_files_id_organization_id_key" ON "audit_files"("id", "organization_id");

-- CreateIndex
CREATE INDEX "audit_comments_audit_id_created_at_idx" ON "audit_comments"("audit_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_status_history_audit_id_created_at_idx" ON "audit_status_history"("audit_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_requirement_history_audit_id_created_at_idx" ON "audit_requirement_history"("audit_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_findings_organization_id_status_idx" ON "audit_findings"("organization_id", "status");

-- CreateIndex
CREATE INDEX "audit_findings_audit_id_idx" ON "audit_findings"("audit_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_findings_organization_id_folio_key" ON "audit_findings"("organization_id", "folio");

-- CreateIndex
CREATE UNIQUE INDEX "audit_findings_id_organization_id_key" ON "audit_findings"("id", "organization_id");

-- CreateIndex
CREATE INDEX "audit_finding_relations_finding_id_idx" ON "audit_finding_relations"("finding_id");

-- CreateIndex
CREATE INDEX "audit_follow_ups_finding_id_idx" ON "audit_follow_ups"("finding_id");

-- CreateIndex
CREATE INDEX "organization_certifications_organization_id_status_idx" ON "organization_certifications"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_certifications_id_organization_id_key" ON "organization_certifications"("id", "organization_id");

-- AddForeignKey
ALTER TABLE "audit_program_items" ADD CONSTRAINT "audit_program_items_program_id_organization_id_fkey" FOREIGN KEY ("program_id", "organization_id") REFERENCES "audit_programs"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_program_files" ADD CONSTRAINT "audit_program_files_program_id_organization_id_fkey" FOREIGN KEY ("program_id", "organization_id") REFERENCES "audit_programs"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_program_id_organization_id_fkey" FOREIGN KEY ("program_id", "organization_id") REFERENCES "audit_programs"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_team_members" ADD CONSTRAINT "audit_team_members_audit_id_organization_id_fkey" FOREIGN KEY ("audit_id", "organization_id") REFERENCES "audits"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_agenda_items" ADD CONSTRAINT "audit_agenda_items_audit_id_organization_id_fkey" FOREIGN KEY ("audit_id", "organization_id") REFERENCES "audits"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_scope_items" ADD CONSTRAINT "audit_scope_items_audit_id_organization_id_fkey" FOREIGN KEY ("audit_id", "organization_id") REFERENCES "audits"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_requirement_snapshots" ADD CONSTRAINT "audit_requirement_snapshots_audit_id_organization_id_fkey" FOREIGN KEY ("audit_id", "organization_id") REFERENCES "audits"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_checklist_items" ADD CONSTRAINT "audit_checklist_items_audit_id_organization_id_fkey" FOREIGN KEY ("audit_id", "organization_id") REFERENCES "audits"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_checklist_items" ADD CONSTRAINT "audit_checklist_items_snapshot_id_organization_id_fkey" FOREIGN KEY ("snapshot_id", "organization_id") REFERENCES "audit_requirement_snapshots"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_evidences" ADD CONSTRAINT "audit_evidences_audit_id_organization_id_fkey" FOREIGN KEY ("audit_id", "organization_id") REFERENCES "audits"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_interviews" ADD CONSTRAINT "audit_interviews_audit_id_organization_id_fkey" FOREIGN KEY ("audit_id", "organization_id") REFERENCES "audits"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_files" ADD CONSTRAINT "audit_files_audit_id_organization_id_fkey" FOREIGN KEY ("audit_id", "organization_id") REFERENCES "audits"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_comments" ADD CONSTRAINT "audit_comments_audit_id_organization_id_fkey" FOREIGN KEY ("audit_id", "organization_id") REFERENCES "audits"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_audit_id_organization_id_fkey" FOREIGN KEY ("audit_id", "organization_id") REFERENCES "audits"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_finding_relations" ADD CONSTRAINT "audit_finding_relations_finding_id_organization_id_fkey" FOREIGN KEY ("finding_id", "organization_id") REFERENCES "audit_findings"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_follow_ups" ADD CONSTRAINT "audit_follow_ups_finding_id_organization_id_fkey" FOREIGN KEY ("finding_id", "organization_id") REFERENCES "audit_findings"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- =====================================================================
-- TASK-010 — SQL complementario (FKs org/sitio/usuario, CHECK, RLS,
-- append-only, no-borrado, grants). Reutiliza fn_current_org,
-- fn_block_update_delete y fn_block_delete (TASK-002).
-- =====================================================================

-- FK a organización.
ALTER TABLE "audit_programs"                 ADD CONSTRAINT "aprg_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_program_folio_counters"   ADD CONSTRAINT "apfc_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_program_items"            ADD CONSTRAINT "apit_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_program_files"            ADD CONSTRAINT "apfl_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_program_status_history"   ADD CONSTRAINT "apsh_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audits"                         ADD CONSTRAINT "aud_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_folio_counters"           ADD CONSTRAINT "afc_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_team_members"             ADD CONSTRAINT "atm_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_agenda_items"             ADD CONSTRAINT "aag_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_scope_items"              ADD CONSTRAINT "asc_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_requirement_snapshots"    ADD CONSTRAINT "ars_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_checklist_items"          ADD CONSTRAINT "aci_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_evidences"                ADD CONSTRAINT "aev_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_interviews"               ADD CONSTRAINT "ain_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_files"                    ADD CONSTRAINT "afl_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_comments"                 ADD CONSTRAINT "aco_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_status_history"           ADD CONSTRAINT "ash_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_requirement_history"      ADD CONSTRAINT "arh_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_findings"                 ADD CONSTRAINT "afd_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_finding_folio_counters"   ADD CONSTRAINT "affc_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_finding_relations"        ADD CONSTRAINT "afr_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_follow_ups"               ADD CONSTRAINT "afu_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "organization_certifications"    ADD CONSTRAINT "ocert_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;

-- FK compuesta anti-cruce a sitio.
ALTER TABLE "audit_programs"              ADD CONSTRAINT "aprg_site_fkey"  FOREIGN KEY ("site_id","organization_id") REFERENCES "sites"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "audit_program_items"         ADD CONSTRAINT "apit_site_fkey"  FOREIGN KEY ("site_id","organization_id") REFERENCES "sites"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "audits"                      ADD CONSTRAINT "aud_site_fkey"   FOREIGN KEY ("site_id","organization_id") REFERENCES "sites"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "audit_scope_items"           ADD CONSTRAINT "asc_site_fkey"   FOREIGN KEY ("site_id","organization_id") REFERENCES "sites"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "audit_findings"              ADD CONSTRAINT "afd_site_fkey"   FOREIGN KEY ("site_id","organization_id") REFERENCES "sites"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "organization_certifications" ADD CONSTRAINT "ocert_site_fkey" FOREIGN KEY ("site_id","organization_id") REFERENCES "sites"("id","organization_id") ON DELETE RESTRICT;

-- FK a usuarios (RESTRICT: los usuarios no se borran físicamente).
ALTER TABLE "audit_programs"            ADD CONSTRAINT "aprg_resp_fkey"    FOREIGN KEY ("responsible_user_id")     REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_programs"            ADD CONSTRAINT "aprg_creator_fkey" FOREIGN KEY ("created_by")              REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_program_items"       ADD CONSTRAINT "apit_creator_fkey" FOREIGN KEY ("created_by")              REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_program_files"       ADD CONSTRAINT "apfl_uploader_fkey" FOREIGN KEY ("uploaded_by")            REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_program_status_history" ADD CONSTRAINT "apsh_actor_fkey" FOREIGN KEY ("actor_user_id")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audits"                    ADD CONSTRAINT "aud_lead_fkey"     FOREIGN KEY ("lead_auditor_user_id")    REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audits"                    ADD CONSTRAINT "aud_creator_fkey"  FOREIGN KEY ("created_by")              REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_team_members"        ADD CONSTRAINT "atm_user_fkey"     FOREIGN KEY ("user_id")                 REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_team_members"        ADD CONSTRAINT "atm_addedby_fkey"  FOREIGN KEY ("added_by")                REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_agenda_items"        ADD CONSTRAINT "aag_auditor_fkey"  FOREIGN KEY ("auditor_user_id")         REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_agenda_items"        ADD CONSTRAINT "aag_auditee_fkey"  FOREIGN KEY ("auditee_user_id")         REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_agenda_items"        ADD CONSTRAINT "aag_creator_fkey"  FOREIGN KEY ("created_by")              REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_scope_items"         ADD CONSTRAINT "asc_creator_fkey"  FOREIGN KEY ("created_by")              REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_requirement_snapshots" ADD CONSTRAINT "ars_captured_fkey" FOREIGN KEY ("captured_by")           REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_checklist_items"     ADD CONSTRAINT "aci_assigned_fkey" FOREIGN KEY ("assigned_auditor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_checklist_items"     ADD CONSTRAINT "aci_updatedby_fkey" FOREIGN KEY ("updated_by")             REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_evidences"           ADD CONSTRAINT "aev_captured_fkey" FOREIGN KEY ("captured_by")             REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_interviews"          ADD CONSTRAINT "ain_auditor_fkey"  FOREIGN KEY ("auditor_user_id")         REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_interviews"          ADD CONSTRAINT "ain_creator_fkey"  FOREIGN KEY ("created_by")              REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_files"               ADD CONSTRAINT "afl_uploader_fkey" FOREIGN KEY ("uploaded_by")             REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_comments"            ADD CONSTRAINT "aco_author_fkey"   FOREIGN KEY ("author")                  REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_status_history"      ADD CONSTRAINT "ash_actor_fkey"    FOREIGN KEY ("actor_user_id")           REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_requirement_history" ADD CONSTRAINT "arh_actor_fkey"    FOREIGN KEY ("actor_user_id")           REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_findings"            ADD CONSTRAINT "afd_resp_fkey"     FOREIGN KEY ("responsible_user_id")     REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_findings"            ADD CONSTRAINT "afd_creator_fkey"  FOREIGN KEY ("created_by")              REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_finding_relations"   ADD CONSTRAINT "afr_creator_fkey"  FOREIGN KEY ("created_by")              REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_follow_ups"          ADD CONSTRAINT "afu_resp_fkey"     FOREIGN KEY ("responsible_user_id")     REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_follow_ups"          ADD CONSTRAINT "afu_verifier_fkey" FOREIGN KEY ("verifier_user_id")        REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_follow_ups"          ADD CONSTRAINT "afu_creator_fkey"  FOREIGN KEY ("created_by")              REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "organization_certifications" ADD CONSTRAINT "ocert_creator_fkey" FOREIGN KEY ("created_by")           REFERENCES "users"("id") ON DELETE RESTRICT;

-- CHECK de enums.
ALTER TABLE "audit_programs" ADD CONSTRAINT "aprg_freq_check"   CHECK ("frequency" IN ('annual','semiannual','quarterly','custom'));
ALTER TABLE "audit_programs" ADD CONSTRAINT "aprg_status_check" CHECK ("status" IN ('draft','approved','active','completed','cancelled'));
ALTER TABLE "audit_program_items" ADD CONSTRAINT "apit_type_check"   CHECK ("audit_type" IN ('internal','process','system','product','supplier','readiness','follow_up','extraordinary','second_party','certification_drill','other'));
ALTER TABLE "audit_program_items" ADD CONSTRAINT "apit_status_check" CHECK ("status" IN ('planned','scheduled','executed','overdue','rescheduled','cancelled'));
ALTER TABLE "audits" ADD CONSTRAINT "aud_type_check"     CHECK ("audit_type" IN ('internal','process','system','product','supplier','readiness','follow_up','extraordinary','second_party','certification_drill','other'));
ALTER TABLE "audits" ADD CONSTRAINT "aud_status_check"   CHECK ("status" IN ('draft','planned','ready','in_progress','report_drafting','under_review','completed','follow_up','closed','cancelled'));
ALTER TABLE "audits" ADD CONSTRAINT "aud_priority_check" CHECK ("priority" IN ('low','normal','high','urgent'));
ALTER TABLE "audit_team_members" ADD CONSTRAINT "atm_role_check" CHECK ("role" IN ('lead','auditor','technical_expert','observer','auditee'));
ALTER TABLE "audit_scope_items"  ADD CONSTRAINT "asc_kind_check" CHECK ("kind" IN ('site','process','framework'));
ALTER TABLE "audit_checklist_items" ADD CONSTRAINT "aci_result_check" CHECK ("result" IN ('conforme','parcial','no_conforme','no_aplica','no_evaluado','evidencia_insuficiente','verificacion_campo'));
ALTER TABLE "audit_evidences" ADD CONSTRAINT "aev_type_check" CHECK ("evidence_type" IN ('document','record','interview','observation','photo','measurement','system','sample','other'));
ALTER TABLE "audit_files" ADD CONSTRAINT "afl_kind_check" CHECK ("kind" IN ('attachment','evidence','report','photo','certificate'));
ALTER TABLE "audit_findings" ADD CONSTRAINT "afd_class_check"    CHECK ("classification" IN ('major_nc','minor_nc','observation','improvement','strength','insufficient_evidence'));
ALTER TABLE "audit_findings" ADD CONSTRAINT "afd_severity_check" CHECK ("severity" IN ('low','medium','high','critical'));
ALTER TABLE "audit_findings" ADD CONSTRAINT "afd_status_check"   CHECK ("status" IN ('open','correction_in_progress','capa_open','pending_verification','effective','not_effective','closed'));
ALTER TABLE "audit_finding_relations" ADD CONSTRAINT "afr_type_check" CHECK ("relation_type" IN ('requirement','document','document_version','capa','task','external'));
ALTER TABLE "audit_follow_ups" ADD CONSTRAINT "afu_status_check" CHECK ("status" IN ('open','correction_in_progress','capa_open','pending_verification','effective','not_effective','closed'));
ALTER TABLE "organization_certifications" ADD CONSTRAINT "ocert_status_check" CHECK ("status" IN ('preparation','active','next_audit','follow_up','suspended','expired'));

-- Append-only: historiales inmutables.
CREATE TRIGGER trg_apsh_append BEFORE UPDATE OR DELETE ON "audit_program_status_history" FOR EACH ROW EXECUTE FUNCTION fn_block_update_delete();
CREATE TRIGGER trg_ash_append  BEFORE UPDATE OR DELETE ON "audit_status_history"         FOR EACH ROW EXECUTE FUNCTION fn_block_update_delete();
CREATE TRIGGER trg_arh_append  BEFORE UPDATE OR DELETE ON "audit_requirement_history"    FOR EACH ROW EXECUTE FUNCTION fn_block_update_delete();

-- Prohibir borrado físico.
CREATE TRIGGER trg_aprg_nodel BEFORE DELETE ON "audit_programs"              FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_apit_nodel BEFORE DELETE ON "audit_program_items"         FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_apfl_nodel BEFORE DELETE ON "audit_program_files"         FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_aud_nodel  BEFORE DELETE ON "audits"                      FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_atm_nodel  BEFORE DELETE ON "audit_team_members"          FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_aag_nodel  BEFORE DELETE ON "audit_agenda_items"          FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_asc_nodel  BEFORE DELETE ON "audit_scope_items"           FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_ars_nodel  BEFORE DELETE ON "audit_requirement_snapshots" FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_aci_nodel  BEFORE DELETE ON "audit_checklist_items"       FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_aev_nodel  BEFORE DELETE ON "audit_evidences"             FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_ain_nodel  BEFORE DELETE ON "audit_interviews"            FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_afl_nodel  BEFORE DELETE ON "audit_files"                 FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_aco_nodel  BEFORE DELETE ON "audit_comments"              FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_afd_nodel  BEFORE DELETE ON "audit_findings"              FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_afr_nodel  BEFORE DELETE ON "audit_finding_relations"     FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_afu_nodel  BEFORE DELETE ON "audit_follow_ups"            FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_ocert_nodel BEFORE DELETE ON "organization_certifications" FOR EACH ROW EXECUTE FUNCTION fn_block_delete();

-- RLS por organización + permisos a gapsi_app.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'audit_programs','audit_program_folio_counters','audit_program_items','audit_program_files',
    'audit_program_status_history','audits','audit_folio_counters','audit_team_members',
    'audit_agenda_items','audit_scope_items','audit_requirement_snapshots','audit_checklist_items',
    'audit_evidences','audit_interviews','audit_files','audit_comments','audit_status_history',
    'audit_requirement_history','audit_findings','audit_finding_folio_counters',
    'audit_finding_relations','audit_follow_ups','organization_certifications'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;

GRANT USAGE, SELECT ON SEQUENCE "audit_program_status_history_id_seq" TO gapsi_app;
GRANT USAGE, SELECT ON SEQUENCE "audit_status_history_id_seq" TO gapsi_app;
GRANT USAGE, SELECT ON SEQUENCE "audit_requirement_history_id_seq" TO gapsi_app;
