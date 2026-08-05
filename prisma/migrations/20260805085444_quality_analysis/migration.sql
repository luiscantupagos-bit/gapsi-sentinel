-- CreateTable
CREATE TABLE "quality_analyses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "capa_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT,
    "scope" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_analysis_id" UUID,
    "responsible_user_id" UUID,
    "reviewer_user_id" UUID,
    "approver_user_id" UUID,
    "started_at" TIMESTAMPTZ(6),
    "reviewed_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "config" JSONB,
    "snapshot" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "quality_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_analysis_participants" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'participant',
    "added_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_analysis_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_hypotheses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "ishikawa_category_id" UUID,
    "parent_hypothesis_id" UUID,
    "source_tool" TEXT,
    "responsible_user_id" UUID,
    "evidence_for" TEXT,
    "evidence_against" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "probability" TEXT NOT NULL DEFAULT 'undetermined',
    "impact" TEXT,
    "conclusion" TEXT,
    "justification" TEXT,
    "evaluated_at" TIMESTAMPTZ(6),
    "evaluator_user_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "quality_hypotheses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ishikawa_categories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ishikawa_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cause_tree_nodes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "validation_status" TEXT NOT NULL DEFAULT 'hypothesis',
    "responsible_user_id" UUID,
    "comment" TEXT,
    "is_proposed_root_cause" BOOLEAN NOT NULL DEFAULT false,
    "root_cause_justification" TEXT,
    "pos_x" INTEGER NOT NULL DEFAULT 0,
    "pos_y" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "cause_tree_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cause_tree_edges" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "from_node_id" UUID NOT NULL,
    "to_node_id" UUID NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'caused',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cause_tree_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pareto_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(14,2),
    "impact" TEXT,
    "period" TEXT,
    "source" TEXT,
    "comment" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pareto_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fmea_rows" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "process_step" TEXT,
    "function_text" TEXT,
    "requirement" TEXT,
    "failure_mode" TEXT NOT NULL,
    "effect" TEXT,
    "severity" INTEGER NOT NULL DEFAULT 1,
    "cause_potential" TEXT,
    "occurrence" INTEGER NOT NULL DEFAULT 1,
    "prevention_controls" TEXT,
    "detection_controls" TEXT,
    "detection" INTEGER NOT NULL DEFAULT 1,
    "npr" INTEGER NOT NULL DEFAULT 1,
    "action_priority" TEXT NOT NULL DEFAULT 'low',
    "recommended_action" TEXT,
    "responsible_user_id" UUID,
    "due_date" DATE,
    "executed_action" TEXT,
    "severity_post" INTEGER,
    "occurrence_post" INTEGER,
    "detection_post" INTEGER,
    "npr_post" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'open',
    "comment" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "fmea_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurrence_matches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "matched_capa_id" UUID NOT NULL,
    "match_reason" TEXT,
    "confirmation" TEXT NOT NULL DEFAULT 'insufficient_evidence',
    "justification" TEXT,
    "confirmed_by" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurrence_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparative_cases" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "capa_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparative_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_analysis_conclusions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "summary" TEXT,
    "immediate_cause" TEXT,
    "contributing_causes" TEXT,
    "proposed_root_cause" TEXT,
    "confirmed_root_cause" TEXT,
    "main_evidence" TEXT,
    "contradictory_evidence" TEXT,
    "limitations" TEXT,
    "pending_info" TEXT,
    "recurrence_risk" TEXT,
    "recommendations" TEXT,
    "responsible_user_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "quality_analysis_conclusions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_analysis_action_links" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "capa_action_id" UUID NOT NULL,
    "source_entity" TEXT NOT NULL,
    "source_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_analysis_action_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_evidence" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "capa_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "evidence_type" TEXT,
    "original_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "extension" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "checksum" TEXT,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_analysis_comments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "section" TEXT,
    "author" UUID,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_analysis_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_analysis_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_analysis_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_analysis_history" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "actor_user_id" UUID,
    "entity" TEXT,
    "summary" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_analysis_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quality_analyses_organization_id_capa_id_idx" ON "quality_analyses"("organization_id", "capa_id");

-- CreateIndex
CREATE INDEX "quality_analyses_organization_id_status_idx" ON "quality_analyses"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quality_analyses_id_organization_id_key" ON "quality_analyses"("id", "organization_id");

-- CreateIndex
CREATE INDEX "quality_analysis_participants_analysis_id_idx" ON "quality_analysis_participants"("analysis_id");

-- CreateIndex
CREATE UNIQUE INDEX "quality_analysis_participants_analysis_id_user_id_role_key" ON "quality_analysis_participants"("analysis_id", "user_id", "role");

-- CreateIndex
CREATE INDEX "quality_hypotheses_analysis_id_idx" ON "quality_hypotheses"("analysis_id");

-- CreateIndex
CREATE INDEX "ishikawa_categories_analysis_id_idx" ON "ishikawa_categories"("analysis_id");

-- CreateIndex
CREATE UNIQUE INDEX "ishikawa_categories_id_organization_id_key" ON "ishikawa_categories"("id", "organization_id");

-- CreateIndex
CREATE INDEX "cause_tree_nodes_analysis_id_idx" ON "cause_tree_nodes"("analysis_id");

-- CreateIndex
CREATE UNIQUE INDEX "cause_tree_nodes_id_organization_id_key" ON "cause_tree_nodes"("id", "organization_id");

-- CreateIndex
CREATE INDEX "cause_tree_edges_analysis_id_idx" ON "cause_tree_edges"("analysis_id");

-- CreateIndex
CREATE INDEX "pareto_items_analysis_id_idx" ON "pareto_items"("analysis_id");

-- CreateIndex
CREATE INDEX "fmea_rows_analysis_id_idx" ON "fmea_rows"("analysis_id");

-- CreateIndex
CREATE UNIQUE INDEX "fmea_rows_id_organization_id_key" ON "fmea_rows"("id", "organization_id");

-- CreateIndex
CREATE INDEX "recurrence_matches_analysis_id_idx" ON "recurrence_matches"("analysis_id");

-- CreateIndex
CREATE UNIQUE INDEX "recurrence_matches_analysis_id_matched_capa_id_key" ON "recurrence_matches"("analysis_id", "matched_capa_id");

-- CreateIndex
CREATE INDEX "comparative_cases_analysis_id_idx" ON "comparative_cases"("analysis_id");

-- CreateIndex
CREATE UNIQUE INDEX "comparative_cases_analysis_id_capa_id_key" ON "comparative_cases"("analysis_id", "capa_id");

-- CreateIndex
CREATE UNIQUE INDEX "quality_analysis_conclusions_analysis_id_key" ON "quality_analysis_conclusions"("analysis_id");

-- CreateIndex
CREATE INDEX "quality_analysis_conclusions_analysis_id_idx" ON "quality_analysis_conclusions"("analysis_id");

-- CreateIndex
CREATE INDEX "quality_analysis_action_links_analysis_id_idx" ON "quality_analysis_action_links"("analysis_id");

-- CreateIndex
CREATE INDEX "quality_analysis_action_links_capa_action_id_idx" ON "quality_analysis_action_links"("capa_action_id");

-- CreateIndex
CREATE UNIQUE INDEX "quality_analysis_action_links_analysis_id_capa_action_id_key" ON "quality_analysis_action_links"("analysis_id", "capa_action_id");

-- CreateIndex
CREATE INDEX "quality_evidence_analysis_id_idx" ON "quality_evidence"("analysis_id");

-- CreateIndex
CREATE INDEX "quality_analysis_comments_analysis_id_created_at_idx" ON "quality_analysis_comments"("analysis_id", "created_at");

-- CreateIndex
CREATE INDEX "quality_analysis_versions_analysis_id_idx" ON "quality_analysis_versions"("analysis_id");

-- CreateIndex
CREATE UNIQUE INDEX "quality_analysis_versions_analysis_id_version_key" ON "quality_analysis_versions"("analysis_id", "version");

-- CreateIndex
CREATE INDEX "quality_analysis_history_analysis_id_created_at_idx" ON "quality_analysis_history"("analysis_id", "created_at");

-- =====================================================================
-- TASK-008 — SQL complementario (Prisma no lo expresa)
-- FKs a organizations/users, FKs compuestas anti-cruce, CHECK de enums,
-- RLS por organización, append-only (historial/versiones) y no-borrado.
-- Reutiliza fn_current_org / fn_block_update_delete / fn_block_delete (TASK-002).
--
-- Política de borrado: las tablas de trabajo de grano fino de un análisis
-- (participantes, categorías Ishikawa, nodos/aristas, ítems Pareto, filas AMEF,
-- coincidencias, casos comparados) pueden borrarse físicamente MIENTRAS el
-- análisis es editable (el servidor lo valida); al aprobar se conserva un
-- snapshot inmutable. Las tablas de agregado/auditoría no admiten borrado.
-- =====================================================================

-- FKs a organizations (todas las tablas).
ALTER TABLE "quality_analyses"                 ADD CONSTRAINT "qa_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_analysis_participants"    ADD CONSTRAINT "qap_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_hypotheses"               ADD CONSTRAINT "qh_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "ishikawa_categories"              ADD CONSTRAINT "ic_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "cause_tree_nodes"                 ADD CONSTRAINT "ctn_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "cause_tree_edges"                 ADD CONSTRAINT "cte_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "pareto_items"                     ADD CONSTRAINT "pi_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "fmea_rows"                        ADD CONSTRAINT "fr_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "recurrence_matches"               ADD CONSTRAINT "rm_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "comparative_cases"                ADD CONSTRAINT "cc_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_analysis_conclusions"     ADD CONSTRAINT "qac_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_analysis_action_links"    ADD CONSTRAINT "qal_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_evidence"                 ADD CONSTRAINT "qe_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_analysis_comments"        ADD CONSTRAINT "qcm_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_analysis_versions"        ADD CONSTRAINT "qav_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_analysis_history"         ADD CONSTRAINT "qah_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;

-- FKs compuestas anti-cruce hacia quality_analyses (mismo organization_id).
ALTER TABLE "quality_analysis_participants" ADD CONSTRAINT "qap_analysis_fkey" FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "quality_hypotheses"            ADD CONSTRAINT "qh_analysis_fkey"  FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "ishikawa_categories"           ADD CONSTRAINT "ic_analysis_fkey"  FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "cause_tree_nodes"              ADD CONSTRAINT "ctn_analysis_fkey" FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "cause_tree_edges"              ADD CONSTRAINT "cte_analysis_fkey" FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "pareto_items"                  ADD CONSTRAINT "pi_analysis_fkey"  FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "fmea_rows"                     ADD CONSTRAINT "fr_analysis_fkey"  FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "recurrence_matches"            ADD CONSTRAINT "rm_analysis_fkey"  FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "comparative_cases"             ADD CONSTRAINT "cc_analysis_fkey"  FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "quality_analysis_conclusions"  ADD CONSTRAINT "qac_analysis_fkey" FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "quality_analysis_action_links" ADD CONSTRAINT "qal_analysis_fkey" FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "quality_evidence"              ADD CONSTRAINT "qe_analysis_fkey"  FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "quality_analysis_comments"     ADD CONSTRAINT "qcm_analysis_fkey" FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "quality_analysis_versions"     ADD CONSTRAINT "qav_analysis_fkey" FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "quality_analysis_history"      ADD CONSTRAINT "qah_analysis_fkey" FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;

-- FKs compuestas anti-cruce hacia capas.
ALTER TABLE "quality_analyses"   ADD CONSTRAINT "qa_capa_fkey" FOREIGN KEY ("capa_id","organization_id")         REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "recurrence_matches" ADD CONSTRAINT "rm_capa_fkey" FOREIGN KEY ("matched_capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "comparative_cases"  ADD CONSTRAINT "cc_capa_fkey" FOREIGN KEY ("capa_id","organization_id")         REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "quality_evidence"   ADD CONSTRAINT "qe_capa_fkey" FOREIGN KEY ("capa_id","organization_id")         REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;

-- FKs internas del módulo.
ALTER TABLE "quality_analyses"   ADD CONSTRAINT "qa_parent_fkey"  FOREIGN KEY ("parent_analysis_id") REFERENCES "quality_analyses"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_hypotheses" ADD CONSTRAINT "qh_cat_fkey"     FOREIGN KEY ("ishikawa_category_id","organization_id") REFERENCES "ishikawa_categories"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "quality_hypotheses" ADD CONSTRAINT "qh_parent_fkey"  FOREIGN KEY ("parent_hypothesis_id") REFERENCES "quality_hypotheses"("id") ON DELETE RESTRICT;
ALTER TABLE "cause_tree_edges"   ADD CONSTRAINT "cte_from_fkey"   FOREIGN KEY ("from_node_id","organization_id") REFERENCES "cause_tree_nodes"("id","organization_id") ON DELETE CASCADE;
ALTER TABLE "cause_tree_edges"   ADD CONSTRAINT "cte_to_fkey"     FOREIGN KEY ("to_node_id","organization_id")   REFERENCES "cause_tree_nodes"("id","organization_id") ON DELETE CASCADE;
ALTER TABLE "quality_analysis_action_links" ADD CONSTRAINT "qal_action_fkey" FOREIGN KEY ("capa_action_id") REFERENCES "capa_actions"("id") ON DELETE RESTRICT;

-- FKs a users (actor/responsable/revisor/aprobador).
ALTER TABLE "quality_analyses"              ADD CONSTRAINT "qa_resp_fkey"     FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_analyses"              ADD CONSTRAINT "qa_reviewer_fkey" FOREIGN KEY ("reviewer_user_id")    REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_analyses"              ADD CONSTRAINT "qa_approver_fkey" FOREIGN KEY ("approver_user_id")    REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_analyses"              ADD CONSTRAINT "qa_createdby_fkey" FOREIGN KEY ("created_by")         REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_analysis_participants" ADD CONSTRAINT "qap_user_fkey"    FOREIGN KEY ("user_id")             REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_hypotheses"            ADD CONSTRAINT "qh_resp_fkey"     FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "fmea_rows"                     ADD CONSTRAINT "fr_resp_fkey"     FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "recurrence_matches"            ADD CONSTRAINT "rm_confirmed_fkey" FOREIGN KEY ("confirmed_by")       REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_evidence"              ADD CONSTRAINT "qe_uploader_fkey" FOREIGN KEY ("uploaded_by")         REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_analysis_history"      ADD CONSTRAINT "qah_actor_fkey"   FOREIGN KEY ("actor_user_id")       REFERENCES "users"("id") ON DELETE RESTRICT;

-- CHECK de enums (text + CHECK, D5).
ALTER TABLE "quality_analyses" ADD CONSTRAINT "qa_type_check"   CHECK ("type" IN ('ishikawa','cause_tree','pareto','fmea','recurrence','comparative','freeform'));
ALTER TABLE "quality_analyses" ADD CONSTRAINT "qa_status_check" CHECK ("status" IN ('draft','in_progress','under_review','changes_requested','approved','cancelled'));
ALTER TABLE "quality_analyses" ADD CONSTRAINT "qa_version_check" CHECK ("version" >= 1);
ALTER TABLE "quality_analysis_participants" ADD CONSTRAINT "qap_role_check" CHECK ("role" IN ('participant','reviewer','approver'));
ALTER TABLE "quality_hypotheses" ADD CONSTRAINT "qh_status_check" CHECK ("status" IN ('pending','evaluating','discarded','contributing','probable','confirmed'));
ALTER TABLE "quality_hypotheses" ADD CONSTRAINT "qh_prob_check"   CHECK ("probability" IN ('low','medium','high','undetermined'));
ALTER TABLE "quality_hypotheses" ADD CONSTRAINT "qh_impact_check" CHECK ("impact" IS NULL OR "impact" IN ('low','medium','high'));
ALTER TABLE "cause_tree_nodes" ADD CONSTRAINT "ctn_type_check" CHECK ("type" IN ('event','consequence','immediate_cause','contributing_cause','systemic_cause','failed_control','missing_barrier','human_factor','organizational_factor','evidence','other'));
ALTER TABLE "cause_tree_nodes" ADD CONSTRAINT "ctn_val_check"  CHECK ("validation_status" IN ('hypothesis','confirmed_fact','discarded'));
ALTER TABLE "cause_tree_edges" ADD CONSTRAINT "cte_rel_check"  CHECK ("relation" IN ('caused','contributed','enabled','aggravated','evidence','contradicts'));
ALTER TABLE "cause_tree_edges" ADD CONSTRAINT "cte_noself_check" CHECK ("from_node_id" <> "to_node_id");
ALTER TABLE "pareto_items" ADD CONSTRAINT "pi_count_check" CHECK ("count" >= 0);
ALTER TABLE "fmea_rows" ADD CONSTRAINT "fr_sev_check" CHECK ("severity" >= 1);
ALTER TABLE "fmea_rows" ADD CONSTRAINT "fr_occ_check" CHECK ("occurrence" >= 1);
ALTER TABLE "fmea_rows" ADD CONSTRAINT "fr_det_check" CHECK ("detection" >= 1);
ALTER TABLE "fmea_rows" ADD CONSTRAINT "fr_npr_check" CHECK ("npr" >= 1);
ALTER TABLE "fmea_rows" ADD CONSTRAINT "fr_sevp_check" CHECK ("severity_post" IS NULL OR "severity_post" >= 1);
ALTER TABLE "fmea_rows" ADD CONSTRAINT "fr_occp_check" CHECK ("occurrence_post" IS NULL OR "occurrence_post" >= 1);
ALTER TABLE "fmea_rows" ADD CONSTRAINT "fr_detp_check" CHECK ("detection_post" IS NULL OR "detection_post" >= 1);
ALTER TABLE "fmea_rows" ADD CONSTRAINT "fr_prio_check" CHECK ("action_priority" IN ('low','medium','high','critical'));
ALTER TABLE "recurrence_matches" ADD CONSTRAINT "rm_conf_check" CHECK ("confirmation" IN ('recurrent','possibly_recurrent','not_recurrent','insufficient_evidence'));
ALTER TABLE "quality_evidence" ADD CONSTRAINT "qe_entity_check" CHECK ("entity_type" IN ('analysis','ishikawa_category','hypothesis','cause_tree_node','fmea_row','recurrence','conclusion'));
ALTER TABLE "quality_analysis_action_links" ADD CONSTRAINT "qal_src_check" CHECK ("source_entity" IN ('hypothesis','cause_tree_node','fmea_row','pareto','recurrence','comparative','conclusion'));

-- Append-only: historial y snapshots de versión son inmutables.
CREATE TRIGGER trg_qah_append BEFORE UPDATE OR DELETE ON "quality_analysis_history"  FOR EACH ROW EXECUTE FUNCTION fn_block_update_delete();
CREATE TRIGGER trg_qav_append BEFORE UPDATE OR DELETE ON "quality_analysis_versions" FOR EACH ROW EXECUTE FUNCTION fn_block_update_delete();

-- No-borrado físico de las tablas de agregado / conclusión / evidencia.
CREATE TRIGGER trg_qa_nodel  BEFORE DELETE ON "quality_analyses"              FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_qh_nodel  BEFORE DELETE ON "quality_hypotheses"           FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_qac_nodel BEFORE DELETE ON "quality_analysis_conclusions" FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_qal_nodel BEFORE DELETE ON "quality_analysis_action_links" FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_qe_nodel  BEFORE DELETE ON "quality_evidence"             FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_qcm_nodel BEFORE DELETE ON "quality_analysis_comments"    FOR EACH ROW EXECUTE FUNCTION fn_block_delete();

-- RLS por organización (reutiliza fn_current_org) + permisos.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'quality_analyses','quality_analysis_participants','quality_hypotheses','ishikawa_categories',
    'cause_tree_nodes','cause_tree_edges','pareto_items','fmea_rows','recurrence_matches',
    'comparative_cases','quality_analysis_conclusions','quality_analysis_action_links',
    'quality_evidence','quality_analysis_comments','quality_analysis_versions','quality_analysis_history'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;

-- DELETE permitido en las tablas de trabajo de grano fino (el servidor lo acota
-- a análisis editables). Las tablas de agregado/auditoría lo bloquean por trigger.
GRANT DELETE ON "quality_analysis_participants" TO gapsi_app;
GRANT DELETE ON "ishikawa_categories"           TO gapsi_app;
GRANT DELETE ON "cause_tree_nodes"              TO gapsi_app;
GRANT DELETE ON "cause_tree_edges"              TO gapsi_app;
GRANT DELETE ON "pareto_items"                  TO gapsi_app;
GRANT DELETE ON "fmea_rows"                     TO gapsi_app;
GRANT DELETE ON "recurrence_matches"            TO gapsi_app;
GRANT DELETE ON "comparative_cases"             TO gapsi_app;

GRANT USAGE, SELECT ON SEQUENCE "quality_analysis_history_id_seq" TO gapsi_app;
