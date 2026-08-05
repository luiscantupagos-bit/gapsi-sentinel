-- CreateTable
CREATE TABLE "capa_folio_counters" (
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "capa_folio_counters_pkey" PRIMARY KEY ("organization_id","year")
);

-- CreateTable
CREATE TABLE "capas" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "folio" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "site_id" UUID,
    "area" TEXT,
    "process" TEXT,
    "product" TEXT,
    "diagnostic_id" UUID,
    "document_id" UUID,
    "document_version_id" UUID,
    "requirement_id" UUID,
    "finding_id" UUID,
    "external_reference" TEXT,
    "detected_at" TIMESTAMPTZ(6),
    "reported_by" UUID,
    "responsible_user_id" UUID,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "impacts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scope" TEXT NOT NULL DEFAULT 'point',
    "target_date" DATE,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "problem_what" TEXT,
    "problem_where" TEXT,
    "problem_when" TEXT,
    "problem_who_detect" TEXT,
    "problem_who_affect" TEXT,
    "problem_how_much" TEXT,
    "problem_how" TEXT,
    "condition_observed" TEXT,
    "requirement_breached" TEXT,
    "objective_evidence" TEXT,
    "known_scope" TEXT,
    "known_recurrence" TEXT,
    "related_refs" TEXT,
    "closed_by" UUID,
    "closed_at" TIMESTAMPTZ(6),
    "closure_summary" TEXT,
    "closure_checksum" TEXT,
    "closure_snapshot" JSONB,
    "reopen_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "capas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capa_immediate_actions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "capa_id" UUID NOT NULL,
    "action_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsible_user_id" UUID,
    "committed_at" DATE,
    "executed_at" DATE,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "estimated_cost" DECIMAL(12,2),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "capa_immediate_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capa_root_cause_analyses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "capa_id" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "immediate_cause" TEXT,
    "contributing_cause" TEXT,
    "root_cause" TEXT,
    "justification" TEXT,
    "investigator_user_id" UUID,
    "concluded_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "capa_root_cause_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capa_why_steps" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "capa_id" UUID NOT NULL,
    "rca_id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "question" TEXT,
    "answer" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capa_why_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capa_actions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "capa_id" UUID NOT NULL,
    "action_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsible_user_id" UUID,
    "start_date" DATE,
    "due_date" DATE,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "depends_on_action_id" UUID,
    "closed_at" DATE,
    "result" TEXT,
    "comment" TEXT,
    "document_id" UUID,
    "document_version_id" UUID,
    "doc_change_request" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "capa_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capa_effectiveness_reviews" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "capa_id" UUID NOT NULL,
    "criterion" TEXT NOT NULL,
    "method" TEXT,
    "planned_at" DATE,
    "executed_at" DATE,
    "verifier_user_id" UUID,
    "follow_up_period" TEXT,
    "observed_result" TEXT,
    "conclusion" TEXT NOT NULL,
    "comment" TEXT,
    "requires_new_action" BOOLEAN NOT NULL DEFAULT false,
    "requires_reopen" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capa_effectiveness_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capa_files" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "capa_id" UUID NOT NULL,
    "evidence_type" TEXT NOT NULL,
    "action_id" UUID,
    "immediate_action_id" UUID,
    "original_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "extension" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "checksum" TEXT,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capa_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capa_relations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "capa_id" UUID NOT NULL,
    "relation_type" TEXT NOT NULL,
    "site_id" UUID,
    "diagnostic_id" UUID,
    "document_id" UUID,
    "document_version_id" UUID,
    "requirement_id" UUID,
    "finding_id" UUID,
    "external_reference" TEXT,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capa_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capa_status_history" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" UUID NOT NULL,
    "capa_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "actor_user_id" UUID,
    "detail" TEXT,
    "related_entity" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capa_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capa_comments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "capa_id" UUID NOT NULL,
    "author" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capa_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capas_organization_id_status_idx" ON "capas"("organization_id", "status");

-- CreateIndex
CREATE INDEX "capas_organization_id_severity_idx" ON "capas"("organization_id", "severity");

-- CreateIndex
CREATE INDEX "capas_organization_id_responsible_user_id_idx" ON "capas"("organization_id", "responsible_user_id");

-- CreateIndex
CREATE INDEX "capas_organization_id_site_id_idx" ON "capas"("organization_id", "site_id");

-- CreateIndex
CREATE UNIQUE INDEX "capas_organization_id_folio_key" ON "capas"("organization_id", "folio");

-- CreateIndex
CREATE UNIQUE INDEX "capas_id_organization_id_key" ON "capas"("id", "organization_id");

-- CreateIndex
CREATE INDEX "capa_immediate_actions_capa_id_idx" ON "capa_immediate_actions"("capa_id");

-- CreateIndex
CREATE INDEX "capa_root_cause_analyses_organization_id_idx" ON "capa_root_cause_analyses"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "capa_root_cause_analyses_capa_id_key" ON "capa_root_cause_analyses"("capa_id");

-- CreateIndex
CREATE INDEX "capa_why_steps_capa_id_idx" ON "capa_why_steps"("capa_id");

-- CreateIndex
CREATE UNIQUE INDEX "capa_why_steps_rca_id_level_key" ON "capa_why_steps"("rca_id", "level");

-- CreateIndex
CREATE INDEX "capa_actions_capa_id_idx" ON "capa_actions"("capa_id");

-- CreateIndex
CREATE INDEX "capa_actions_organization_id_status_idx" ON "capa_actions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "capa_effectiveness_reviews_capa_id_idx" ON "capa_effectiveness_reviews"("capa_id");

-- CreateIndex
CREATE INDEX "capa_files_capa_id_idx" ON "capa_files"("capa_id");

-- CreateIndex
CREATE UNIQUE INDEX "capa_files_id_organization_id_key" ON "capa_files"("id", "organization_id");

-- CreateIndex
CREATE INDEX "capa_relations_capa_id_idx" ON "capa_relations"("capa_id");

-- CreateIndex
CREATE INDEX "capa_status_history_capa_id_created_at_idx" ON "capa_status_history"("capa_id", "created_at");

-- CreateIndex
CREATE INDEX "capa_comments_capa_id_created_at_idx" ON "capa_comments"("capa_id", "created_at");

-- =====================================================================
-- TASK-007 — SQL complementario (Prisma no lo expresa)
-- FKs a organizations/users, FKs compuestas anti-cruce, CHECK de enums,
-- RLS por organización, append-only y no-borrado. Reutiliza las funciones
-- fn_current_org / fn_block_update_delete / fn_block_delete de TASK-002.
-- =====================================================================

-- FKs a organizations (todas las tablas CAPA).
ALTER TABLE "capa_folio_counters"        ADD CONSTRAINT "cfc_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "capas"                      ADD CONSTRAINT "capa_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_immediate_actions"     ADD CONSTRAINT "cia_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_root_cause_analyses"   ADD CONSTRAINT "crca_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_why_steps"             ADD CONSTRAINT "cws_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_actions"               ADD CONSTRAINT "cac_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_effectiveness_reviews" ADD CONSTRAINT "cer_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_files"                 ADD CONSTRAINT "cfl_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_relations"             ADD CONSTRAINT "crl_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_status_history"        ADD CONSTRAINT "csh_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_comments"              ADD CONSTRAINT "cco_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;

-- FKs compuestas anti-cruce hacia capas (mismo organization_id).
ALTER TABLE "capa_immediate_actions"     ADD CONSTRAINT "cia_capa_fkey" FOREIGN KEY ("capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "capa_root_cause_analyses"   ADD CONSTRAINT "crca_capa_fkey" FOREIGN KEY ("capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "capa_why_steps"             ADD CONSTRAINT "cws_capa_fkey" FOREIGN KEY ("capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "capa_actions"               ADD CONSTRAINT "cac_capa_fkey" FOREIGN KEY ("capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "capa_effectiveness_reviews" ADD CONSTRAINT "cer_capa_fkey" FOREIGN KEY ("capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "capa_files"                 ADD CONSTRAINT "cfl_capa_fkey" FOREIGN KEY ("capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "capa_relations"             ADD CONSTRAINT "crl_capa_fkey" FOREIGN KEY ("capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "capa_status_history"        ADD CONSTRAINT "csh_capa_fkey" FOREIGN KEY ("capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "capa_comments"              ADD CONSTRAINT "cco_capa_fkey" FOREIGN KEY ("capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;

-- FKs compuestas anti-cruce de capas hacia otras entidades (opcionales).
ALTER TABLE "capas" ADD CONSTRAINT "capa_site_fkey"    FOREIGN KEY ("site_id","organization_id")             REFERENCES "sites"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "capas" ADD CONSTRAINT "capa_diag_fkey"    FOREIGN KEY ("diagnostic_id","organization_id")       REFERENCES "diagnostics"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "capas" ADD CONSTRAINT "capa_doc_fkey"     FOREIGN KEY ("document_id","organization_id")         REFERENCES "documents"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "capas" ADD CONSTRAINT "capa_ver_fkey"     FOREIGN KEY ("document_version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "capas" ADD CONSTRAINT "capa_req_fkey"     FOREIGN KEY ("requirement_id","organization_id")      REFERENCES "template_requirements"("id","organization_id") ON DELETE RESTRICT;

-- FKs compuestas de capa_actions y capa_relations hacia control documental / diagnóstico.
ALTER TABLE "capa_actions"   ADD CONSTRAINT "cac_doc_fkey" FOREIGN KEY ("document_id","organization_id")         REFERENCES "documents"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "capa_actions"   ADD CONSTRAINT "cac_ver_fkey" FOREIGN KEY ("document_version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "capa_relations" ADD CONSTRAINT "crl_site_fkey" FOREIGN KEY ("site_id","organization_id")             REFERENCES "sites"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "capa_relations" ADD CONSTRAINT "crl_diag_fkey" FOREIGN KEY ("diagnostic_id","organization_id")       REFERENCES "diagnostics"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "capa_relations" ADD CONSTRAINT "crl_doc_fkey"  FOREIGN KEY ("document_id","organization_id")         REFERENCES "documents"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "capa_relations" ADD CONSTRAINT "crl_ver_fkey"  FOREIGN KEY ("document_version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "capa_relations" ADD CONSTRAINT "crl_req_fkey"  FOREIGN KEY ("requirement_id","organization_id")      REFERENCES "template_requirements"("id","organization_id") ON DELETE RESTRICT;

-- FKs internas del módulo (rca, dependencias y evidencias).
ALTER TABLE "capa_why_steps" ADD CONSTRAINT "cws_rca_fkey" FOREIGN KEY ("rca_id") REFERENCES "capa_root_cause_analyses"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_actions"   ADD CONSTRAINT "cac_dep_fkey" FOREIGN KEY ("depends_on_action_id") REFERENCES "capa_actions"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_files"     ADD CONSTRAINT "cfl_action_fkey"    FOREIGN KEY ("action_id") REFERENCES "capa_actions"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_files"     ADD CONSTRAINT "cfl_immediate_fkey" FOREIGN KEY ("immediate_action_id") REFERENCES "capa_immediate_actions"("id") ON DELETE RESTRICT;

-- FKs a users (columnas escalares de actor/responsable).
ALTER TABLE "capas"                      ADD CONSTRAINT "capa_reported_fkey"    FOREIGN KEY ("reported_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "capas"                      ADD CONSTRAINT "capa_responsible_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "capas"                      ADD CONSTRAINT "capa_closed_fkey"      FOREIGN KEY ("closed_by")            REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "capas"                      ADD CONSTRAINT "capa_createdby_fkey"   FOREIGN KEY ("created_by")           REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_immediate_actions"     ADD CONSTRAINT "cia_resp_fkey"         FOREIGN KEY ("responsible_user_id")  REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_root_cause_analyses"   ADD CONSTRAINT "crca_investigator_fkey" FOREIGN KEY ("investigator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_actions"               ADD CONSTRAINT "cac_resp_fkey"         FOREIGN KEY ("responsible_user_id")  REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_effectiveness_reviews" ADD CONSTRAINT "cer_verifier_fkey"     FOREIGN KEY ("verifier_user_id")     REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_files"                 ADD CONSTRAINT "cfl_uploader_fkey"     FOREIGN KEY ("uploaded_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_status_history"        ADD CONSTRAINT "csh_actor_fkey"        FOREIGN KEY ("actor_user_id")        REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "capa_comments"              ADD CONSTRAINT "cco_author_fkey"       FOREIGN KEY ("author")               REFERENCES "users"("id") ON DELETE RESTRICT;

-- CHECK de enums (text + CHECK, D5).
ALTER TABLE "capas" ADD CONSTRAINT "capa_status_check"   CHECK ("status" IN ('draft','reported','containment','under_investigation','action_plan','in_implementation','effectiveness_review','closed','cancelled'));
ALTER TABLE "capas" ADD CONSTRAINT "capa_source_check"   CHECK ("source_type" IN ('internal_nc','audit_nc','deviation','customer_complaint','safety_incident','legal_noncompliance','documental_finding','out_of_spec','improvement','other'));
ALTER TABLE "capas" ADD CONSTRAINT "capa_priority_check" CHECK ("priority" IN ('low','normal','high','urgent'));
ALTER TABLE "capas" ADD CONSTRAINT "capa_severity_check" CHECK ("severity" IN ('low','medium','high','critical'));
ALTER TABLE "capas" ADD CONSTRAINT "capa_scope_check"    CHECK ("scope" IN ('point','batch','line','site','organization','customer','market'));
ALTER TABLE "capas" ADD CONSTRAINT "capa_impacts_check"  CHECK ("impacts" <@ ARRAY['quality','safety','legal','customer','product','process','personnel','environment','cost','reputation']::text[]);
ALTER TABLE "capa_immediate_actions" ADD CONSTRAINT "cia_type_check"   CHECK ("action_type" IN ('containment','correction'));
ALTER TABLE "capa_immediate_actions" ADD CONSTRAINT "cia_status_check" CHECK ("status" IN ('pending','in_progress','completed','cancelled'));
ALTER TABLE "capa_root_cause_analyses" ADD CONSTRAINT "crca_method_check" CHECK ("method" IN ('five_whys','free_analysis','process_review','document_review','other'));
ALTER TABLE "capa_why_steps" ADD CONSTRAINT "cws_level_check" CHECK ("level" BETWEEN 1 AND 5);
ALTER TABLE "capa_actions" ADD CONSTRAINT "cac_type_check"     CHECK ("action_type" IN ('correction','containment','corrective','preventive','training','document_change','process_change','maintenance','validation','follow_up','other'));
ALTER TABLE "capa_actions" ADD CONSTRAINT "cac_status_check"   CHECK ("status" IN ('pending','in_progress','blocked','completed','cancelled'));
ALTER TABLE "capa_actions" ADD CONSTRAINT "cac_priority_check" CHECK ("priority" IN ('low','normal','high','urgent'));
ALTER TABLE "capa_actions" ADD CONSTRAINT "cac_progress_check" CHECK ("progress" BETWEEN 0 AND 100);
ALTER TABLE "capa_effectiveness_reviews" ADD CONSTRAINT "cer_conclusion_check" CHECK ("conclusion" IN ('effective','partially_effective','not_effective'));
ALTER TABLE "capa_files" ADD CONSTRAINT "cfl_evidence_check" CHECK ("evidence_type" IN ('finding','containment','investigation','root_cause','implementation','effectiveness','closure'));
ALTER TABLE "capa_relations" ADD CONSTRAINT "crl_type_check" CHECK ("relation_type" IN ('site','diagnostic','document','document_version','requirement','finding','external'));

-- Append-only: el historial CAPA es inmutable (fn_block_update_delete de TASK-002).
CREATE TRIGGER trg_csh_append BEFORE UPDATE OR DELETE ON "capa_status_history" FOR EACH ROW EXECUTE FUNCTION fn_block_update_delete();

-- Prohibir borrado físico (usar borrado lógico / cancelación) — fn_block_delete de TASK-002.
CREATE TRIGGER trg_capa_nodel BEFORE DELETE ON "capas"                      FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_cia_nodel  BEFORE DELETE ON "capa_immediate_actions"     FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_crca_nodel BEFORE DELETE ON "capa_root_cause_analyses"   FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_cws_nodel  BEFORE DELETE ON "capa_why_steps"             FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_cac_nodel  BEFORE DELETE ON "capa_actions"               FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_cer_nodel  BEFORE DELETE ON "capa_effectiveness_reviews" FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_cfl_nodel  BEFORE DELETE ON "capa_files"                 FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_crl_nodel  BEFORE DELETE ON "capa_relations"             FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_cco_nodel  BEFORE DELETE ON "capa_comments"              FOR EACH ROW EXECUTE FUNCTION fn_block_delete();

-- RLS por organización (reutiliza fn_current_org de TASK-002) + permisos a gapsi_app.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'capa_folio_counters','capas','capa_immediate_actions','capa_root_cause_analyses',
    'capa_why_steps','capa_actions','capa_effectiveness_reviews','capa_files',
    'capa_relations','capa_status_history','capa_comments'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;

GRANT USAGE, SELECT ON SEQUENCE "capa_status_history_id_seq" TO gapsi_app;
