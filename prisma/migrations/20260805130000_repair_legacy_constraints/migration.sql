-- Migración correctiva (TASK-009 follow-up): repara restricciones heredadas
-- que la migración 20260805120000_projects_tasks eliminó al haberse generado
-- con `prisma migrate diff --from-schema-datasource` (introspección de la BD).
-- Las FK compuestas anti-cruce / de organización / de usuario de documentos y
-- CAPA son SQL crudo no declarado en schema.prisma, por lo que el diff las trató
-- como "drift" y emitió DROPs. Aquí se RE-CREAN de forma IDEMPOTENTE (guardas por
-- nombre + tabla; sin try/catch). No modifica ninguna migración previa ni la de
-- TASK-009. Reejecutable sin duplicar. No cambia el modelo funcional.

-- 1) Índice único requerido por FK compuestas (recrear antes de las FK).
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_frameworks_id_organization_id_key" ON "assessment_frameworks" ("id", "organization_id");

-- 2) Foreign keys heredadas (recreadas solo si no existen).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cac_capa_fkey' AND conrelid = '"capa_actions"'::regclass) THEN
    ALTER TABLE "capa_actions"               ADD CONSTRAINT "cac_capa_fkey" FOREIGN KEY ("capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cac_dep_fkey' AND conrelid = '"capa_actions"'::regclass) THEN
    ALTER TABLE "capa_actions"   ADD CONSTRAINT "cac_dep_fkey" FOREIGN KEY ("depends_on_action_id") REFERENCES "capa_actions"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cac_doc_fkey' AND conrelid = '"capa_actions"'::regclass) THEN
    ALTER TABLE "capa_actions"   ADD CONSTRAINT "cac_doc_fkey" FOREIGN KEY ("document_id","organization_id")         REFERENCES "documents"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cac_org_fkey' AND conrelid = '"capa_actions"'::regclass) THEN
    ALTER TABLE "capa_actions"               ADD CONSTRAINT "cac_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cac_resp_fkey' AND conrelid = '"capa_actions"'::regclass) THEN
    ALTER TABLE "capa_actions"               ADD CONSTRAINT "cac_resp_fkey"         FOREIGN KEY ("responsible_user_id")  REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cac_ver_fkey' AND conrelid = '"capa_actions"'::regclass) THEN
    ALTER TABLE "capa_actions"   ADD CONSTRAINT "cac_ver_fkey" FOREIGN KEY ("document_version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cco_author_fkey' AND conrelid = '"capa_comments"'::regclass) THEN
    ALTER TABLE "capa_comments"              ADD CONSTRAINT "cco_author_fkey"       FOREIGN KEY ("author")               REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cco_capa_fkey' AND conrelid = '"capa_comments"'::regclass) THEN
    ALTER TABLE "capa_comments"              ADD CONSTRAINT "cco_capa_fkey" FOREIGN KEY ("capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cco_org_fkey' AND conrelid = '"capa_comments"'::regclass) THEN
    ALTER TABLE "capa_comments"              ADD CONSTRAINT "cco_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cer_capa_fkey' AND conrelid = '"capa_effectiveness_reviews"'::regclass) THEN
    ALTER TABLE "capa_effectiveness_reviews" ADD CONSTRAINT "cer_capa_fkey" FOREIGN KEY ("capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cer_org_fkey' AND conrelid = '"capa_effectiveness_reviews"'::regclass) THEN
    ALTER TABLE "capa_effectiveness_reviews" ADD CONSTRAINT "cer_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cer_verifier_fkey' AND conrelid = '"capa_effectiveness_reviews"'::regclass) THEN
    ALTER TABLE "capa_effectiveness_reviews" ADD CONSTRAINT "cer_verifier_fkey"     FOREIGN KEY ("verifier_user_id")     REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cfl_action_fkey' AND conrelid = '"capa_files"'::regclass) THEN
    ALTER TABLE "capa_files"     ADD CONSTRAINT "cfl_action_fkey"    FOREIGN KEY ("action_id") REFERENCES "capa_actions"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cfl_capa_fkey' AND conrelid = '"capa_files"'::regclass) THEN
    ALTER TABLE "capa_files"                 ADD CONSTRAINT "cfl_capa_fkey" FOREIGN KEY ("capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cfl_immediate_fkey' AND conrelid = '"capa_files"'::regclass) THEN
    ALTER TABLE "capa_files"     ADD CONSTRAINT "cfl_immediate_fkey" FOREIGN KEY ("immediate_action_id") REFERENCES "capa_immediate_actions"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cfl_org_fkey' AND conrelid = '"capa_files"'::regclass) THEN
    ALTER TABLE "capa_files"                 ADD CONSTRAINT "cfl_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cfl_uploader_fkey' AND conrelid = '"capa_files"'::regclass) THEN
    ALTER TABLE "capa_files"                 ADD CONSTRAINT "cfl_uploader_fkey"     FOREIGN KEY ("uploaded_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cfc_org_fkey' AND conrelid = '"capa_folio_counters"'::regclass) THEN
    ALTER TABLE "capa_folio_counters"        ADD CONSTRAINT "cfc_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cia_capa_fkey' AND conrelid = '"capa_immediate_actions"'::regclass) THEN
    ALTER TABLE "capa_immediate_actions"     ADD CONSTRAINT "cia_capa_fkey" FOREIGN KEY ("capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cia_org_fkey' AND conrelid = '"capa_immediate_actions"'::regclass) THEN
    ALTER TABLE "capa_immediate_actions"     ADD CONSTRAINT "cia_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cia_resp_fkey' AND conrelid = '"capa_immediate_actions"'::regclass) THEN
    ALTER TABLE "capa_immediate_actions"     ADD CONSTRAINT "cia_resp_fkey"         FOREIGN KEY ("responsible_user_id")  REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crl_capa_fkey' AND conrelid = '"capa_relations"'::regclass) THEN
    ALTER TABLE "capa_relations"             ADD CONSTRAINT "crl_capa_fkey" FOREIGN KEY ("capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crl_diag_fkey' AND conrelid = '"capa_relations"'::regclass) THEN
    ALTER TABLE "capa_relations" ADD CONSTRAINT "crl_diag_fkey" FOREIGN KEY ("diagnostic_id","organization_id")       REFERENCES "diagnostics"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crl_doc_fkey' AND conrelid = '"capa_relations"'::regclass) THEN
    ALTER TABLE "capa_relations" ADD CONSTRAINT "crl_doc_fkey"  FOREIGN KEY ("document_id","organization_id")         REFERENCES "documents"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crl_org_fkey' AND conrelid = '"capa_relations"'::regclass) THEN
    ALTER TABLE "capa_relations"             ADD CONSTRAINT "crl_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crl_req_fkey' AND conrelid = '"capa_relations"'::regclass) THEN
    ALTER TABLE "capa_relations" ADD CONSTRAINT "crl_req_fkey"  FOREIGN KEY ("requirement_id","organization_id")      REFERENCES "template_requirements"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crl_site_fkey' AND conrelid = '"capa_relations"'::regclass) THEN
    ALTER TABLE "capa_relations" ADD CONSTRAINT "crl_site_fkey" FOREIGN KEY ("site_id","organization_id")             REFERENCES "sites"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crl_ver_fkey' AND conrelid = '"capa_relations"'::regclass) THEN
    ALTER TABLE "capa_relations" ADD CONSTRAINT "crl_ver_fkey"  FOREIGN KEY ("document_version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crca_capa_fkey' AND conrelid = '"capa_root_cause_analyses"'::regclass) THEN
    ALTER TABLE "capa_root_cause_analyses"   ADD CONSTRAINT "crca_capa_fkey" FOREIGN KEY ("capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crca_investigator_fkey' AND conrelid = '"capa_root_cause_analyses"'::regclass) THEN
    ALTER TABLE "capa_root_cause_analyses"   ADD CONSTRAINT "crca_investigator_fkey" FOREIGN KEY ("investigator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crca_org_fkey' AND conrelid = '"capa_root_cause_analyses"'::regclass) THEN
    ALTER TABLE "capa_root_cause_analyses"   ADD CONSTRAINT "crca_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'csh_actor_fkey' AND conrelid = '"capa_status_history"'::regclass) THEN
    ALTER TABLE "capa_status_history"        ADD CONSTRAINT "csh_actor_fkey"        FOREIGN KEY ("actor_user_id")        REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'csh_capa_fkey' AND conrelid = '"capa_status_history"'::regclass) THEN
    ALTER TABLE "capa_status_history"        ADD CONSTRAINT "csh_capa_fkey" FOREIGN KEY ("capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'csh_org_fkey' AND conrelid = '"capa_status_history"'::regclass) THEN
    ALTER TABLE "capa_status_history"        ADD CONSTRAINT "csh_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cws_capa_fkey' AND conrelid = '"capa_why_steps"'::regclass) THEN
    ALTER TABLE "capa_why_steps"             ADD CONSTRAINT "cws_capa_fkey" FOREIGN KEY ("capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cws_org_fkey' AND conrelid = '"capa_why_steps"'::regclass) THEN
    ALTER TABLE "capa_why_steps"             ADD CONSTRAINT "cws_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cws_rca_fkey' AND conrelid = '"capa_why_steps"'::regclass) THEN
    ALTER TABLE "capa_why_steps" ADD CONSTRAINT "cws_rca_fkey" FOREIGN KEY ("rca_id") REFERENCES "capa_root_cause_analyses"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capa_closed_fkey' AND conrelid = '"capas"'::regclass) THEN
    ALTER TABLE "capas"                      ADD CONSTRAINT "capa_closed_fkey"      FOREIGN KEY ("closed_by")            REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capa_createdby_fkey' AND conrelid = '"capas"'::regclass) THEN
    ALTER TABLE "capas"                      ADD CONSTRAINT "capa_createdby_fkey"   FOREIGN KEY ("created_by")           REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capa_diag_fkey' AND conrelid = '"capas"'::regclass) THEN
    ALTER TABLE "capas" ADD CONSTRAINT "capa_diag_fkey"    FOREIGN KEY ("diagnostic_id","organization_id")       REFERENCES "diagnostics"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capa_doc_fkey' AND conrelid = '"capas"'::regclass) THEN
    ALTER TABLE "capas" ADD CONSTRAINT "capa_doc_fkey"     FOREIGN KEY ("document_id","organization_id")         REFERENCES "documents"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capa_org_fkey' AND conrelid = '"capas"'::regclass) THEN
    ALTER TABLE "capas"                      ADD CONSTRAINT "capa_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capa_reported_fkey' AND conrelid = '"capas"'::regclass) THEN
    ALTER TABLE "capas"                      ADD CONSTRAINT "capa_reported_fkey"    FOREIGN KEY ("reported_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capa_req_fkey' AND conrelid = '"capas"'::regclass) THEN
    ALTER TABLE "capas" ADD CONSTRAINT "capa_req_fkey"     FOREIGN KEY ("requirement_id","organization_id")      REFERENCES "template_requirements"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capa_responsible_fkey' AND conrelid = '"capas"'::regclass) THEN
    ALTER TABLE "capas"                      ADD CONSTRAINT "capa_responsible_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capa_site_fkey' AND conrelid = '"capas"'::regclass) THEN
    ALTER TABLE "capas" ADD CONSTRAINT "capa_site_fkey"    FOREIGN KEY ("site_id","organization_id")             REFERENCES "sites"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capa_ver_fkey' AND conrelid = '"capas"'::regclass) THEN
    ALTER TABLE "capas" ADD CONSTRAINT "capa_ver_fkey"     FOREIGN KEY ("document_version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cte_analysis_fkey' AND conrelid = '"cause_tree_edges"'::regclass) THEN
    ALTER TABLE "cause_tree_edges"              ADD CONSTRAINT "cte_analysis_fkey" FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cte_from_fkey' AND conrelid = '"cause_tree_edges"'::regclass) THEN
    ALTER TABLE "cause_tree_edges"   ADD CONSTRAINT "cte_from_fkey"   FOREIGN KEY ("from_node_id","organization_id") REFERENCES "cause_tree_nodes"("id","organization_id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cte_org_fkey' AND conrelid = '"cause_tree_edges"'::regclass) THEN
    ALTER TABLE "cause_tree_edges"                 ADD CONSTRAINT "cte_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cte_to_fkey' AND conrelid = '"cause_tree_edges"'::regclass) THEN
    ALTER TABLE "cause_tree_edges"   ADD CONSTRAINT "cte_to_fkey"     FOREIGN KEY ("to_node_id","organization_id")   REFERENCES "cause_tree_nodes"("id","organization_id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ctn_analysis_fkey' AND conrelid = '"cause_tree_nodes"'::regclass) THEN
    ALTER TABLE "cause_tree_nodes"              ADD CONSTRAINT "ctn_analysis_fkey" FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ctn_org_fkey' AND conrelid = '"cause_tree_nodes"'::regclass) THEN
    ALTER TABLE "cause_tree_nodes"                 ADD CONSTRAINT "ctn_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cc_analysis_fkey' AND conrelid = '"comparative_cases"'::regclass) THEN
    ALTER TABLE "comparative_cases"             ADD CONSTRAINT "cc_analysis_fkey"  FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cc_capa_fkey' AND conrelid = '"comparative_cases"'::regclass) THEN
    ALTER TABLE "comparative_cases"  ADD CONSTRAINT "cc_capa_fkey" FOREIGN KEY ("capa_id","organization_id")         REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cc_org_fkey' AND conrelid = '"comparative_cases"'::regclass) THEN
    ALTER TABLE "comparative_cases"                ADD CONSTRAINT "cc_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dap_org_fkey' AND conrelid = '"document_approvals"'::regclass) THEN
    ALTER TABLE "document_approvals"              ADD CONSTRAINT "dap_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dap_user_fkey' AND conrelid = '"document_approvals"'::regclass) THEN
    ALTER TABLE "document_approvals"             ADD CONSTRAINT "dap_user_fkey"    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dap_version_fkey' AND conrelid = '"document_approvals"'::regclass) THEN
    ALTER TABLE "document_approvals"             ADD CONSTRAINT "dap_version_fkey" FOREIGN KEY ("version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dc_org_fkey' AND conrelid = '"document_comments"'::regclass) THEN
    ALTER TABLE "document_comments"               ADD CONSTRAINT "dc_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dc_version_fkey' AND conrelid = '"document_comments"'::regclass) THEN
    ALTER TABLE "document_comments"             ADD CONSTRAINT "dc_version_fkey"   FOREIGN KEY ("version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dcc_org_fkey' AND conrelid = '"document_controlled_copies"'::regclass) THEN
    ALTER TABLE "document_controlled_copies"      ADD CONSTRAINT "dcc_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dcc_version_fkey' AND conrelid = '"document_controlled_copies"'::regclass) THEN
    ALTER TABLE "document_controlled_copies"    ADD CONSTRAINT "dcc_version_fkey"  FOREIGN KEY ("version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dd_org_fkey' AND conrelid = '"document_distributions"'::regclass) THEN
    ALTER TABLE "document_distributions"          ADD CONSTRAINT "dd_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dd_site_fkey' AND conrelid = '"document_distributions"'::regclass) THEN
    ALTER TABLE "document_distributions"        ADD CONSTRAINT "dd_site_fkey"      FOREIGN KEY ("site_id","organization_id") REFERENCES "sites"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dd_user_fkey' AND conrelid = '"document_distributions"'::regclass) THEN
    ALTER TABLE "document_distributions"        ADD CONSTRAINT "dd_user_fkey"      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dd_version_fkey' AND conrelid = '"document_distributions"'::regclass) THEN
    ALTER TABLE "document_distributions"        ADD CONSTRAINT "dd_version_fkey"   FOREIGN KEY ("version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_files_organization_id_fkey' AND conrelid = '"document_files"'::regclass) THEN
    ALTER TABLE "document_files"     ADD CONSTRAINT "document_files_organization_id_fkey"     FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_files_uploaded_by_fkey' AND conrelid = '"document_files"'::regclass) THEN
    ALTER TABLE "document_files"    ADD CONSTRAINT "document_files_uploaded_by_fkey"     FOREIGN KEY ("uploaded_by")         REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_history_actor_user_id_fkey' AND conrelid = '"document_history"'::regclass) THEN
    ALTER TABLE "document_history"  ADD CONSTRAINT "document_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id")       REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_history_document_fkey' AND conrelid = '"document_history"'::regclass) THEN
    ALTER TABLE "document_history" ADD CONSTRAINT "document_history_document_fkey"
  FOREIGN KEY ("document_id", "organization_id") REFERENCES "documents"("id", "organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_history_organization_id_fkey' AND conrelid = '"document_history"'::regclass) THEN
    ALTER TABLE "document_history"   ADD CONSTRAINT "document_history_organization_id_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dra_org_fkey' AND conrelid = '"document_read_acknowledgements"'::regclass) THEN
    ALTER TABLE "document_read_acknowledgements"  ADD CONSTRAINT "dra_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dra_user_fkey' AND conrelid = '"document_read_acknowledgements"'::regclass) THEN
    ALTER TABLE "document_read_acknowledgements" ADD CONSTRAINT "dra_user_fkey"    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dra_version_fkey' AND conrelid = '"document_read_acknowledgements"'::regclass) THEN
    ALTER TABLE "document_read_acknowledgements" ADD CONSTRAINT "dra_version_fkey" FOREIGN KEY ("version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_relations_diagnostic_fkey' AND conrelid = '"document_relations"'::regclass) THEN
    ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_diagnostic_fkey"
  FOREIGN KEY ("diagnostic_id", "organization_id") REFERENCES "diagnostics"("id", "organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_relations_framework_fkey' AND conrelid = '"document_relations"'::regclass) THEN
    ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_framework_fkey"
  FOREIGN KEY ("framework_id", "organization_id") REFERENCES "assessment_frameworks"("id", "organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_relations_organization_id_fkey' AND conrelid = '"document_relations"'::regclass) THEN
    ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_relations_related_document_fkey' AND conrelid = '"document_relations"'::regclass) THEN
    ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_related_document_fkey"
  FOREIGN KEY ("related_document_id", "organization_id") REFERENCES "documents"("id", "organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_relations_requirement_fkey' AND conrelid = '"document_relations"'::regclass) THEN
    ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_requirement_fkey"
  FOREIGN KEY ("requirement_id", "organization_id") REFERENCES "template_requirements"("id", "organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_relations_site_fkey' AND conrelid = '"document_relations"'::regclass) THEN
    ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_site_fkey"
  FOREIGN KEY ("site_id", "organization_id") REFERENCES "sites"("id", "organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dsh_org_fkey' AND conrelid = '"document_status_history"'::regclass) THEN
    ALTER TABLE "document_status_history"         ADD CONSTRAINT "dsh_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dsh_version_fkey' AND conrelid = '"document_status_history"'::regclass) THEN
    ALTER TABLE "document_status_history"       ADD CONSTRAINT "dsh_version_fkey"  FOREIGN KEY ("version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_versions_author_fkey' AND conrelid = '"document_versions"'::regclass) THEN
    ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_author_fkey"       FOREIGN KEY ("author")              REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_versions_organization_id_fkey' AND conrelid = '"document_versions"'::regclass) THEN
    ALTER TABLE "document_versions"  ADD CONSTRAINT "document_versions_organization_id_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_versions_updated_by_fkey' AND conrelid = '"document_versions"'::regclass) THEN
    ALTER TABLE "document_versions"
  ADD CONSTRAINT "document_versions_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dws_org_fkey' AND conrelid = '"document_workflow_steps"'::regclass) THEN
    ALTER TABLE "document_workflow_steps"         ADD CONSTRAINT "dws_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dws_user_fkey' AND conrelid = '"document_workflow_steps"'::regclass) THEN
    ALTER TABLE "document_workflow_steps"        ADD CONSTRAINT "dws_user_fkey"    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dws_version_fkey' AND conrelid = '"document_workflow_steps"'::regclass) THEN
    ALTER TABLE "document_workflow_steps"        ADD CONSTRAINT "dws_version_fkey" FOREIGN KEY ("version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dws_wf_fkey' AND conrelid = '"document_workflow_steps"'::regclass) THEN
    ALTER TABLE "document_workflow_steps"        ADD CONSTRAINT "dws_wf_fkey"      FOREIGN KEY ("workflow_id") REFERENCES "document_workflows"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dw_doc_fkey' AND conrelid = '"document_workflows"'::regclass) THEN
    ALTER TABLE "document_workflows"             ADD CONSTRAINT "dw_doc_fkey"      FOREIGN KEY ("document_id","organization_id") REFERENCES "documents"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dw_org_fkey' AND conrelid = '"document_workflows"'::regclass) THEN
    ALTER TABLE "document_workflows"              ADD CONSTRAINT "dw_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dw_version_fkey' AND conrelid = '"document_workflows"'::regclass) THEN
    ALTER TABLE "document_workflows"             ADD CONSTRAINT "dw_version_fkey"  FOREIGN KEY ("version_id","organization_id") REFERENCES "document_versions"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_created_by_fkey' AND conrelid = '"documents"'::regclass) THEN
    ALTER TABLE "documents"         ADD CONSTRAINT "documents_created_by_fkey"           FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_organization_id_fkey' AND conrelid = '"documents"'::regclass) THEN
    ALTER TABLE "documents"          ADD CONSTRAINT "documents_organization_id_fkey"          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_responsible_user_id_fkey' AND conrelid = '"documents"'::regclass) THEN
    ALTER TABLE "documents"         ADD CONSTRAINT "documents_responsible_user_id_fkey"  FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_site_id_organization_id_fkey' AND conrelid = '"documents"'::regclass) THEN
    ALTER TABLE "documents" ADD CONSTRAINT "documents_site_id_organization_id_fkey"
  FOREIGN KEY ("site_id", "organization_id") REFERENCES "sites"("id", "organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fr_analysis_fkey' AND conrelid = '"fmea_rows"'::regclass) THEN
    ALTER TABLE "fmea_rows"                     ADD CONSTRAINT "fr_analysis_fkey"  FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fr_org_fkey' AND conrelid = '"fmea_rows"'::regclass) THEN
    ALTER TABLE "fmea_rows"                        ADD CONSTRAINT "fr_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fr_resp_fkey' AND conrelid = '"fmea_rows"'::regclass) THEN
    ALTER TABLE "fmea_rows"                     ADD CONSTRAINT "fr_resp_fkey"     FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ic_analysis_fkey' AND conrelid = '"ishikawa_categories"'::regclass) THEN
    ALTER TABLE "ishikawa_categories"           ADD CONSTRAINT "ic_analysis_fkey"  FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ic_org_fkey' AND conrelid = '"ishikawa_categories"'::regclass) THEN
    ALTER TABLE "ishikawa_categories"              ADD CONSTRAINT "ic_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pi_analysis_fkey' AND conrelid = '"pareto_items"'::regclass) THEN
    ALTER TABLE "pareto_items"                  ADD CONSTRAINT "pi_analysis_fkey"  FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pi_org_fkey' AND conrelid = '"pareto_items"'::regclass) THEN
    ALTER TABLE "pareto_items"                     ADD CONSTRAINT "pi_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qa_approver_fkey' AND conrelid = '"quality_analyses"'::regclass) THEN
    ALTER TABLE "quality_analyses"              ADD CONSTRAINT "qa_approver_fkey" FOREIGN KEY ("approver_user_id")    REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qa_capa_fkey' AND conrelid = '"quality_analyses"'::regclass) THEN
    ALTER TABLE "quality_analyses"   ADD CONSTRAINT "qa_capa_fkey" FOREIGN KEY ("capa_id","organization_id")         REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qa_createdby_fkey' AND conrelid = '"quality_analyses"'::regclass) THEN
    ALTER TABLE "quality_analyses"              ADD CONSTRAINT "qa_createdby_fkey" FOREIGN KEY ("created_by")         REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qa_org_fkey' AND conrelid = '"quality_analyses"'::regclass) THEN
    ALTER TABLE "quality_analyses"                 ADD CONSTRAINT "qa_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qa_parent_fkey' AND conrelid = '"quality_analyses"'::regclass) THEN
    ALTER TABLE "quality_analyses"   ADD CONSTRAINT "qa_parent_fkey"  FOREIGN KEY ("parent_analysis_id") REFERENCES "quality_analyses"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qa_resp_fkey' AND conrelid = '"quality_analyses"'::regclass) THEN
    ALTER TABLE "quality_analyses"              ADD CONSTRAINT "qa_resp_fkey"     FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qa_reviewer_fkey' AND conrelid = '"quality_analyses"'::regclass) THEN
    ALTER TABLE "quality_analyses"              ADD CONSTRAINT "qa_reviewer_fkey" FOREIGN KEY ("reviewer_user_id")    REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qal_action_fkey' AND conrelid = '"quality_analysis_action_links"'::regclass) THEN
    ALTER TABLE "quality_analysis_action_links" ADD CONSTRAINT "qal_action_fkey" FOREIGN KEY ("capa_action_id") REFERENCES "capa_actions"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qal_analysis_fkey' AND conrelid = '"quality_analysis_action_links"'::regclass) THEN
    ALTER TABLE "quality_analysis_action_links" ADD CONSTRAINT "qal_analysis_fkey" FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qal_org_fkey' AND conrelid = '"quality_analysis_action_links"'::regclass) THEN
    ALTER TABLE "quality_analysis_action_links"    ADD CONSTRAINT "qal_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qcm_analysis_fkey' AND conrelid = '"quality_analysis_comments"'::regclass) THEN
    ALTER TABLE "quality_analysis_comments"     ADD CONSTRAINT "qcm_analysis_fkey" FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qcm_org_fkey' AND conrelid = '"quality_analysis_comments"'::regclass) THEN
    ALTER TABLE "quality_analysis_comments"        ADD CONSTRAINT "qcm_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qac_analysis_fkey' AND conrelid = '"quality_analysis_conclusions"'::regclass) THEN
    ALTER TABLE "quality_analysis_conclusions"  ADD CONSTRAINT "qac_analysis_fkey" FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qac_org_fkey' AND conrelid = '"quality_analysis_conclusions"'::regclass) THEN
    ALTER TABLE "quality_analysis_conclusions"     ADD CONSTRAINT "qac_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qah_actor_fkey' AND conrelid = '"quality_analysis_history"'::regclass) THEN
    ALTER TABLE "quality_analysis_history"      ADD CONSTRAINT "qah_actor_fkey"   FOREIGN KEY ("actor_user_id")       REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qah_analysis_fkey' AND conrelid = '"quality_analysis_history"'::regclass) THEN
    ALTER TABLE "quality_analysis_history"      ADD CONSTRAINT "qah_analysis_fkey" FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qah_org_fkey' AND conrelid = '"quality_analysis_history"'::regclass) THEN
    ALTER TABLE "quality_analysis_history"         ADD CONSTRAINT "qah_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qap_analysis_fkey' AND conrelid = '"quality_analysis_participants"'::regclass) THEN
    ALTER TABLE "quality_analysis_participants" ADD CONSTRAINT "qap_analysis_fkey" FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qap_org_fkey' AND conrelid = '"quality_analysis_participants"'::regclass) THEN
    ALTER TABLE "quality_analysis_participants"    ADD CONSTRAINT "qap_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qap_user_fkey' AND conrelid = '"quality_analysis_participants"'::regclass) THEN
    ALTER TABLE "quality_analysis_participants" ADD CONSTRAINT "qap_user_fkey"    FOREIGN KEY ("user_id")             REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qav_analysis_fkey' AND conrelid = '"quality_analysis_versions"'::regclass) THEN
    ALTER TABLE "quality_analysis_versions"     ADD CONSTRAINT "qav_analysis_fkey" FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qav_org_fkey' AND conrelid = '"quality_analysis_versions"'::regclass) THEN
    ALTER TABLE "quality_analysis_versions"        ADD CONSTRAINT "qav_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qe_analysis_fkey' AND conrelid = '"quality_evidence"'::regclass) THEN
    ALTER TABLE "quality_evidence"              ADD CONSTRAINT "qe_analysis_fkey"  FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qe_capa_fkey' AND conrelid = '"quality_evidence"'::regclass) THEN
    ALTER TABLE "quality_evidence"   ADD CONSTRAINT "qe_capa_fkey" FOREIGN KEY ("capa_id","organization_id")         REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qe_org_fkey' AND conrelid = '"quality_evidence"'::regclass) THEN
    ALTER TABLE "quality_evidence"                 ADD CONSTRAINT "qe_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qe_uploader_fkey' AND conrelid = '"quality_evidence"'::regclass) THEN
    ALTER TABLE "quality_evidence"              ADD CONSTRAINT "qe_uploader_fkey" FOREIGN KEY ("uploaded_by")         REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qh_analysis_fkey' AND conrelid = '"quality_hypotheses"'::regclass) THEN
    ALTER TABLE "quality_hypotheses"            ADD CONSTRAINT "qh_analysis_fkey"  FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qh_cat_fkey' AND conrelid = '"quality_hypotheses"'::regclass) THEN
    ALTER TABLE "quality_hypotheses" ADD CONSTRAINT "qh_cat_fkey"     FOREIGN KEY ("ishikawa_category_id","organization_id") REFERENCES "ishikawa_categories"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qh_org_fkey' AND conrelid = '"quality_hypotheses"'::regclass) THEN
    ALTER TABLE "quality_hypotheses"               ADD CONSTRAINT "qh_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qh_parent_fkey' AND conrelid = '"quality_hypotheses"'::regclass) THEN
    ALTER TABLE "quality_hypotheses" ADD CONSTRAINT "qh_parent_fkey"  FOREIGN KEY ("parent_hypothesis_id") REFERENCES "quality_hypotheses"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qh_resp_fkey' AND conrelid = '"quality_hypotheses"'::regclass) THEN
    ALTER TABLE "quality_hypotheses"            ADD CONSTRAINT "qh_resp_fkey"     FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rm_analysis_fkey' AND conrelid = '"recurrence_matches"'::regclass) THEN
    ALTER TABLE "recurrence_matches"            ADD CONSTRAINT "rm_analysis_fkey"  FOREIGN KEY ("analysis_id","organization_id") REFERENCES "quality_analyses"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rm_capa_fkey' AND conrelid = '"recurrence_matches"'::regclass) THEN
    ALTER TABLE "recurrence_matches" ADD CONSTRAINT "rm_capa_fkey" FOREIGN KEY ("matched_capa_id","organization_id") REFERENCES "capas"("id","organization_id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rm_confirmed_fkey' AND conrelid = '"recurrence_matches"'::regclass) THEN
    ALTER TABLE "recurrence_matches"            ADD CONSTRAINT "rm_confirmed_fkey" FOREIGN KEY ("confirmed_by")       REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rm_org_fkey' AND conrelid = '"recurrence_matches"'::regclass) THEN
    ALTER TABLE "recurrence_matches"               ADD CONSTRAINT "rm_org_fkey"    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
  END IF;
END $$;
