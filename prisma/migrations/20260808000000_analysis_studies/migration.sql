-- CORE-ALIGN-003 — Análisis transversal + Estudios de Datos
-- datamodel↔datamodel (solo ALTER nullable intencional en capa_id, 0 DROP heredado) + SQL complementario.

-- AlterTable
ALTER TABLE "quality_analyses" ALTER COLUMN "capa_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "analysis_relations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "relation_type" TEXT NOT NULL,
    "target_id" UUID,
    "external_ref" TEXT,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fta_nodes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "parent_id" UUID,
    "node_type" TEXT NOT NULL,
    "gate_type" TEXT,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "fta_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_studies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "folio" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT,
    "question" TEXT,
    "responsible_user_id" UUID,
    "source_type" TEXT,
    "source_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "conclusion" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "data_studies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_study_folio_counters" (
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "data_study_folio_counters_pkey" PRIMARY KEY ("organization_id","year")
);

-- CreateTable
CREATE TABLE "study_datasets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "study_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "source_kind" TEXT NOT NULL,
    "file_name" TEXT,
    "file_checksum" TEXT,
    "file_size" INTEGER,
    "storage_key" TEXT,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "column_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_variables" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "column_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "var_type" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "calculated" BOOLEAN NOT NULL DEFAULT false,
    "formula" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_rows" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "row_index" INTEGER NOT NULL,
    "values" JSONB NOT NULL,
    "excluded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "study_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_analyses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "study_id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "title" TEXT,
    "config" JSONB NOT NULL,
    "result" JSONB,
    "interpretation" JSONB,
    "status" TEXT NOT NULL DEFAULT 'done',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_study_history" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" UUID NOT NULL,
    "study_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "detail" TEXT,
    "actor_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_study_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analysis_relations_organization_id_relation_type_target_id_idx" ON "analysis_relations"("organization_id", "relation_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_relations_analysis_id_relation_type_target_id_key" ON "analysis_relations"("analysis_id", "relation_type", "target_id");

-- CreateIndex
CREATE INDEX "fta_nodes_analysis_id_position_idx" ON "fta_nodes"("analysis_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "fta_nodes_id_organization_id_key" ON "fta_nodes"("id", "organization_id");

-- CreateIndex
CREATE INDEX "data_studies_organization_id_status_idx" ON "data_studies"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "data_studies_organization_id_folio_key" ON "data_studies"("organization_id", "folio");

-- CreateIndex
CREATE UNIQUE INDEX "data_studies_id_organization_id_key" ON "data_studies"("id", "organization_id");

-- CreateIndex
CREATE INDEX "study_datasets_study_id_idx" ON "study_datasets"("study_id");

-- CreateIndex
CREATE UNIQUE INDEX "study_datasets_id_organization_id_key" ON "study_datasets"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "study_datasets_study_id_version_key" ON "study_datasets"("study_id", "version");

-- CreateIndex
CREATE INDEX "study_variables_dataset_id_position_idx" ON "study_variables"("dataset_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "study_variables_dataset_id_column_key_key" ON "study_variables"("dataset_id", "column_key");

-- CreateIndex
CREATE UNIQUE INDEX "study_variables_id_organization_id_key" ON "study_variables"("id", "organization_id");

-- CreateIndex
CREATE INDEX "study_rows_dataset_id_row_index_idx" ON "study_rows"("dataset_id", "row_index");

-- CreateIndex
CREATE INDEX "study_analyses_study_id_idx" ON "study_analyses"("study_id");

-- CreateIndex
CREATE INDEX "study_analyses_dataset_id_idx" ON "study_analyses"("dataset_id");

-- CreateIndex
CREATE UNIQUE INDEX "study_analyses_id_organization_id_key" ON "study_analyses"("id", "organization_id");

-- CreateIndex
CREATE INDEX "data_study_history_study_id_created_at_idx" ON "data_study_history"("study_id", "created_at");

-- AddForeignKey
ALTER TABLE "analysis_relations" ADD CONSTRAINT "analysis_relations_analysis_id_organization_id_fkey" FOREIGN KEY ("analysis_id", "organization_id") REFERENCES "quality_analyses"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fta_nodes" ADD CONSTRAINT "fta_nodes_analysis_id_organization_id_fkey" FOREIGN KEY ("analysis_id", "organization_id") REFERENCES "quality_analyses"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fta_nodes" ADD CONSTRAINT "fta_nodes_parent_id_organization_id_fkey" FOREIGN KEY ("parent_id", "organization_id") REFERENCES "fta_nodes"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_datasets" ADD CONSTRAINT "study_datasets_study_id_organization_id_fkey" FOREIGN KEY ("study_id", "organization_id") REFERENCES "data_studies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_variables" ADD CONSTRAINT "study_variables_dataset_id_organization_id_fkey" FOREIGN KEY ("dataset_id", "organization_id") REFERENCES "study_datasets"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_analyses" ADD CONSTRAINT "study_analyses_study_id_organization_id_fkey" FOREIGN KEY ("study_id", "organization_id") REFERENCES "data_studies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- =====================================================================
-- CORE-ALIGN-003 — SQL complementario (FK org/sitio/usuario, CHECK, RLS,
-- append-only, no-borrado, grants). Reutiliza fn_current_org,
-- fn_block_update_delete y fn_block_delete (TASK-002).
-- =====================================================================

-- Ampliar el CHECK de tipo de análisis para 5 Porqués y FTA.
ALTER TABLE "quality_analyses" DROP CONSTRAINT IF EXISTS "qa_type_check";
ALTER TABLE "quality_analyses" ADD CONSTRAINT "qa_type_check" CHECK ("type" IN ('ishikawa','cause_tree','pareto','fmea','recurrence','comparative','freeform','5whys','fta'));

-- FK a organización.
ALTER TABLE "analysis_relations"        ADD CONSTRAINT "anr_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "fta_nodes"                 ADD CONSTRAINT "fta_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "data_studies"              ADD CONSTRAINT "dst_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "data_study_folio_counters" ADD CONSTRAINT "dsfc_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "study_datasets"            ADD CONSTRAINT "sds_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "study_variables"           ADD CONSTRAINT "svar_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "study_rows"                ADD CONSTRAINT "srow_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "study_analyses"            ADD CONSTRAINT "sana_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "data_study_history"        ADD CONSTRAINT "dshist_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;

-- FK compuesta anti-cruce a sitio.
ALTER TABLE "data_studies" ADD CONSTRAINT "dst_site_fkey" FOREIGN KEY ("site_id","organization_id") REFERENCES "sites"("id","organization_id") ON DELETE RESTRICT;

-- FK compuesta anti-cruce de study_rows a su dataset (no la genera Prisma).
ALTER TABLE "study_rows" ADD CONSTRAINT "srow_dataset_fkey" FOREIGN KEY ("dataset_id","organization_id") REFERENCES "study_datasets"("id","organization_id") ON DELETE RESTRICT;

-- FK a usuarios (RESTRICT).
ALTER TABLE "analysis_relations" ADD CONSTRAINT "anr_creator_fkey"  FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "fta_nodes"          ADD CONSTRAINT "fta_creator_fkey"  FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "data_studies"       ADD CONSTRAINT "dst_resp_fkey"     FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "data_studies"       ADD CONSTRAINT "dst_creator_fkey"  FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "study_datasets"     ADD CONSTRAINT "sds_creator_fkey"  FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "study_analyses"     ADD CONSTRAINT "sana_creator_fkey" FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "data_study_history" ADD CONSTRAINT "dshist_actor_fkey" FOREIGN KEY ("actor_user_id")       REFERENCES "users"("id") ON DELETE RESTRICT;

-- CHECK de enums.
ALTER TABLE "analysis_relations" ADD CONSTRAINT "anr_type_check"  CHECK ("relation_type" IN ('capa','project','audit_finding','audit','quality_event','data_study'));
ALTER TABLE "fta_nodes"          ADD CONSTRAINT "fta_node_check"  CHECK ("node_type" IN ('top','intermediate','basic','gate'));
ALTER TABLE "fta_nodes"          ADD CONSTRAINT "fta_gate_check"  CHECK ("gate_type" IS NULL OR "gate_type" IN ('and','or'));
ALTER TABLE "data_studies"       ADD CONSTRAINT "dst_status_check" CHECK ("status" IN ('draft','data_loaded','analyzing','review','concluded','archived'));
ALTER TABLE "data_studies"       ADD CONSTRAINT "dst_source_check" CHECK ("source_type" IS NULL OR "source_type" IN ('capa','project','audit_finding','quality_event','independent'));
ALTER TABLE "study_datasets"     ADD CONSTRAINT "sds_kind_check"   CHECK ("source_kind" IN ('csv','xlsx','paste'));
ALTER TABLE "study_variables"    ADD CONSTRAINT "svar_type_check"  CHECK ("var_type" IN ('numeric','categorical','temporal','text'));
ALTER TABLE "study_analyses"     ADD CONSTRAINT "sana_method_check" CHECK ("method" IN ('descriptive','pareto','trend','correlation','regression','group_compare','anova','chi_square'));
ALTER TABLE "study_analyses"     ADD CONSTRAINT "sana_status_check" CHECK ("status" IN ('draft','done'));

-- Historial append-only.
CREATE TRIGGER trg_dshist_append BEFORE UPDATE OR DELETE ON "data_study_history" FOR EACH ROW EXECUTE FUNCTION fn_block_update_delete();

-- No-borrado físico de estudios y de sus corridas de análisis (reproducibilidad).
CREATE TRIGGER trg_dst_nodel  BEFORE DELETE ON "data_studies"   FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_sana_nodel BEFORE DELETE ON "study_analyses" FOR EACH ROW EXECUTE FUNCTION fn_block_delete();

-- RLS por organización + permisos a gapsi_app.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'analysis_relations','fta_nodes','data_studies','data_study_folio_counters',
    'study_datasets','study_variables','study_rows','study_analyses','data_study_history'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;

-- DELETE permitido en tablas editables/reemplazables (no en estudios/corridas).
GRANT DELETE ON "analysis_relations" TO gapsi_app;
GRANT DELETE ON "fta_nodes"          TO gapsi_app;
GRANT DELETE ON "study_datasets"     TO gapsi_app;
GRANT DELETE ON "study_variables"    TO gapsi_app;
GRANT DELETE ON "study_rows"         TO gapsi_app;

-- Secuencias BIGSERIAL.
GRANT USAGE, SELECT ON SEQUENCE "study_rows_id_seq" TO gapsi_app;
GRANT USAGE, SELECT ON SEQUENCE "data_study_history_id_seq" TO gapsi_app;
