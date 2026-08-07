-- TASK-011 — Modelo común de eventos de calidad, KPI y análisis estadístico
-- Generado con: prisma migrate diff --from-schema-datamodel <HEAD> --to-schema-datamodel <schema> (0 DROP)
-- + SQL complementario (FK org/sitio/usuario, CHECK, RLS, append-only, no-borrado, grants).

-- CreateTable
CREATE TABLE "quality_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "folio" TEXT NOT NULL,
    "event_date" DATE NOT NULL,
    "event_at" TIMESTAMPTZ(6),
    "event_type" TEXT NOT NULL,
    "category_id" UUID,
    "subcategory_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "area" TEXT,
    "process" TEXT,
    "product_text" TEXT,
    "machine_text" TEXT,
    "shift_text" TEXT,
    "supplier_text" TEXT,
    "lot_text" TEXT,
    "quantity_affected" DECIMAL(16,4),
    "units_produced" DECIMAL(16,4),
    "cost" DECIMAL(16,2),
    "duration_hours" DECIMAL(12,2),
    "responsible_user_id" UUID,
    "created_by" UUID,
    "source_type" TEXT,
    "source_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "quality_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_event_folio_counters" (
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quality_event_folio_counters_pkey" PRIMARY KEY ("organization_id","year")
);

-- CreateTable
CREATE TABLE "quality_event_categories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_type" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_event_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_event_subcategories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_event_subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_catalog_values" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "aliases" TEXT,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_catalog_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_event_relations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "relation_type" TEXT NOT NULL,
    "target_id" UUID,
    "external_ref" TEXT,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_event_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_event_history" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "actor_user_id" UUID,
    "detail" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_event_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_definitions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "source" TEXT NOT NULL,
    "measure" TEXT NOT NULL,
    "measure_field" TEXT,
    "rate_multiplier" DECIMAL(16,4),
    "filters" JSONB,
    "numerator_filter" JSONB,
    "denominator_filter" JSONB,
    "dimensions" JSONB,
    "period" TEXT NOT NULL DEFAULT 'monthly',
    "unit" TEXT,
    "target" DECIMAL(16,4),
    "warning_threshold" DECIMAL(16,4),
    "critical_threshold" DECIMAL(16,4),
    "desired_direction" TEXT NOT NULL DEFAULT 'lower',
    "responsible_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',
    "calc_frequency" TEXT,
    "start_date" DATE,
    "definition_version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "kpi_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_folio_counters" (
    "organization_id" UUID NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "kpi_folio_counters_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "kpi_results" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "kpi_id" UUID NOT NULL,
    "period_label" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "value" DECIMAL(18,4),
    "numerator" DECIMAL(18,4),
    "denominator" DECIMAL(18,4),
    "target" DECIMAL(18,4),
    "status" TEXT NOT NULL DEFAULT 'no_data',
    "computation" JSONB,
    "definition_version" INTEGER NOT NULL DEFAULT 1,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_alert_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rule_type" TEXT NOT NULL,
    "kpi_id" UUID,
    "config" JSONB NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "quality_alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_alerts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "rule_id" UUID,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "status" TEXT NOT NULL DEFAULT 'open',
    "kpi_id" UUID,
    "entity_ref" TEXT,
    "href" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "detected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_saved_views" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "view_type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quality_events_organization_id_event_type_idx" ON "quality_events"("organization_id", "event_type");

-- CreateIndex
CREATE INDEX "quality_events_organization_id_event_date_idx" ON "quality_events"("organization_id", "event_date");

-- CreateIndex
CREATE UNIQUE INDEX "quality_events_organization_id_folio_key" ON "quality_events"("organization_id", "folio");

-- CreateIndex
CREATE UNIQUE INDEX "quality_events_id_organization_id_key" ON "quality_events"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "quality_events_organization_id_source_type_source_id_key" ON "quality_events"("organization_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "quality_event_categories_organization_id_active_idx" ON "quality_event_categories"("organization_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "quality_event_categories_organization_id_code_key" ON "quality_event_categories"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "quality_event_categories_id_organization_id_key" ON "quality_event_categories"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "quality_event_subcategories_category_id_code_key" ON "quality_event_subcategories"("category_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "quality_event_subcategories_id_organization_id_key" ON "quality_event_subcategories"("id", "organization_id");

-- CreateIndex
CREATE INDEX "quality_catalog_values_organization_id_kind_active_idx" ON "quality_catalog_values"("organization_id", "kind", "active");

-- CreateIndex
CREATE UNIQUE INDEX "quality_catalog_values_organization_id_kind_name_key" ON "quality_catalog_values"("organization_id", "kind", "name");

-- CreateIndex
CREATE UNIQUE INDEX "quality_catalog_values_id_organization_id_key" ON "quality_catalog_values"("id", "organization_id");

-- CreateIndex
CREATE INDEX "quality_event_relations_event_id_idx" ON "quality_event_relations"("event_id");

-- CreateIndex
CREATE INDEX "quality_event_history_event_id_created_at_idx" ON "quality_event_history"("event_id", "created_at");

-- CreateIndex
CREATE INDEX "kpi_definitions_organization_id_status_idx" ON "kpi_definitions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_definitions_organization_id_code_key" ON "kpi_definitions"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_definitions_id_organization_id_key" ON "kpi_definitions"("id", "organization_id");

-- CreateIndex
CREATE INDEX "kpi_results_organization_id_kpi_id_idx" ON "kpi_results"("organization_id", "kpi_id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_results_kpi_id_period_label_key" ON "kpi_results"("kpi_id", "period_label");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_results_id_organization_id_key" ON "kpi_results"("id", "organization_id");

-- CreateIndex
CREATE INDEX "quality_alert_rules_organization_id_active_idx" ON "quality_alert_rules"("organization_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "quality_alert_rules_id_organization_id_key" ON "quality_alert_rules"("id", "organization_id");

-- CreateIndex
CREATE INDEX "quality_alerts_organization_id_status_idx" ON "quality_alerts"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quality_alerts_organization_id_dedupe_key_key" ON "quality_alerts"("organization_id", "dedupe_key");

-- CreateIndex
CREATE UNIQUE INDEX "quality_alerts_id_organization_id_key" ON "quality_alerts"("id", "organization_id");

-- CreateIndex
CREATE INDEX "analytics_saved_views_organization_id_view_type_idx" ON "analytics_saved_views"("organization_id", "view_type");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_saved_views_id_organization_id_key" ON "analytics_saved_views"("id", "organization_id");

-- AddForeignKey
ALTER TABLE "quality_events" ADD CONSTRAINT "quality_events_category_id_organization_id_fkey" FOREIGN KEY ("category_id", "organization_id") REFERENCES "quality_event_categories"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_events" ADD CONSTRAINT "quality_events_subcategory_id_organization_id_fkey" FOREIGN KEY ("subcategory_id", "organization_id") REFERENCES "quality_event_subcategories"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_event_subcategories" ADD CONSTRAINT "quality_event_subcategories_category_id_organization_id_fkey" FOREIGN KEY ("category_id", "organization_id") REFERENCES "quality_event_categories"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_event_relations" ADD CONSTRAINT "quality_event_relations_event_id_organization_id_fkey" FOREIGN KEY ("event_id", "organization_id") REFERENCES "quality_events"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_results" ADD CONSTRAINT "kpi_results_kpi_id_organization_id_fkey" FOREIGN KEY ("kpi_id", "organization_id") REFERENCES "kpi_definitions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_alerts" ADD CONSTRAINT "quality_alerts_rule_id_organization_id_fkey" FOREIGN KEY ("rule_id", "organization_id") REFERENCES "quality_alert_rules"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- =====================================================================
-- TASK-011 — SQL complementario (FKs org/sitio/usuario, CHECK, RLS,
-- append-only, no-borrado, grants). Reutiliza fn_current_org,
-- fn_block_update_delete y fn_block_delete (TASK-002).
-- =====================================================================

-- FK a organización.
ALTER TABLE "quality_events"                ADD CONSTRAINT "qev_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_event_folio_counters"  ADD CONSTRAINT "qefc_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_event_categories"      ADD CONSTRAINT "qec_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_event_subcategories"   ADD CONSTRAINT "qesc_org_fkey"  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_catalog_values"        ADD CONSTRAINT "qcv_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_event_relations"       ADD CONSTRAINT "qer_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_event_history"         ADD CONSTRAINT "qeh_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "kpi_definitions"               ADD CONSTRAINT "kpd_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "kpi_folio_counters"            ADD CONSTRAINT "kfc_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "kpi_results"                   ADD CONSTRAINT "kpr_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_alert_rules"           ADD CONSTRAINT "qar_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_alerts"                ADD CONSTRAINT "qal_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "analytics_saved_views"         ADD CONSTRAINT "asv_org_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;

-- FK compuesta anti-cruce a sitio.
ALTER TABLE "quality_events"   ADD CONSTRAINT "qev_site_fkey" FOREIGN KEY ("site_id","organization_id") REFERENCES "sites"("id","organization_id") ON DELETE RESTRICT;
ALTER TABLE "kpi_definitions"  ADD CONSTRAINT "kpd_site_fkey" FOREIGN KEY ("site_id","organization_id") REFERENCES "sites"("id","organization_id") ON DELETE RESTRICT;

-- FK a usuarios (RESTRICT: los usuarios no se borran físicamente).
ALTER TABLE "quality_events"              ADD CONSTRAINT "qev_resp_fkey"    FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_events"              ADD CONSTRAINT "qev_creator_fkey" FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_event_categories"    ADD CONSTRAINT "qec_creator_fkey" FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_event_subcategories" ADD CONSTRAINT "qesc_creator_fkey" FOREIGN KEY ("created_by")         REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_catalog_values"      ADD CONSTRAINT "qcv_creator_fkey" FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_event_relations"     ADD CONSTRAINT "qer_creator_fkey" FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_event_history"       ADD CONSTRAINT "qeh_actor_fkey"   FOREIGN KEY ("actor_user_id")       REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "kpi_definitions"             ADD CONSTRAINT "kpd_resp_fkey"    FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "kpi_definitions"             ADD CONSTRAINT "kpd_creator_fkey" FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_alert_rules"         ADD CONSTRAINT "qar_creator_fkey" FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "quality_alerts"              ADD CONSTRAINT "qal_resolver_fkey" FOREIGN KEY ("resolved_by")        REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "analytics_saved_views"       ADD CONSTRAINT "asv_creator_fkey" FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;

-- CHECK de enums.
ALTER TABLE "quality_events" ADD CONSTRAINT "qev_type_check"     CHECK ("event_type" IN ('capa','audit_finding','deviation','failure','complaint','nonconforming','incident','noncompliance','observation','improvement','other'));
ALTER TABLE "quality_events" ADD CONSTRAINT "qev_severity_check" CHECK ("severity" IN ('low','medium','high','critical'));
ALTER TABLE "quality_events" ADD CONSTRAINT "qev_status_check"   CHECK ("status" IN ('open','in_progress','closed','cancelled'));
ALTER TABLE "quality_catalog_values"  ADD CONSTRAINT "qcv_kind_check"   CHECK ("kind" IN ('area','process','shift','machine','product','supplier','unit'));
ALTER TABLE "quality_event_relations" ADD CONSTRAINT "qer_type_check"   CHECK ("relation_type" IN ('capa','audit','audit_finding','task','project','document','analysis','external'));
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpd_source_check"    CHECK ("source" IN ('quality_events','capa','audits','findings','tasks','projects','documents'));
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpd_measure_check"   CHECK ("measure" IN ('count','sum','average','median','percentage','rate','proportion','avg_duration','compliance','recurrence'));
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpd_period_check"    CHECK ("period" IN ('daily','weekly','monthly','quarterly','yearly'));
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpd_dir_check"       CHECK ("desired_direction" IN ('higher','lower','target'));
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpd_status_check"    CHECK ("status" IN ('active','inactive','draft'));
ALTER TABLE "kpi_results" ADD CONSTRAINT "kpr_status_check"        CHECK ("status" IN ('on_target','warning','off_target','no_data'));
ALTER TABLE "quality_alert_rules" ADD CONSTRAINT "qar_type_check"     CHECK ("rule_type" IN ('kpi_off_target','kpi_increase','category_threshold','recurrence','missing_data','negative_trend'));
ALTER TABLE "quality_alert_rules" ADD CONSTRAINT "qar_severity_check" CHECK ("severity" IN ('info','warning','critical'));
ALTER TABLE "quality_alerts" ADD CONSTRAINT "qal_severity_check" CHECK ("severity" IN ('info','warning','critical'));
ALTER TABLE "quality_alerts" ADD CONSTRAINT "qal_status_check"   CHECK ("status" IN ('open','acknowledged','resolved'));
ALTER TABLE "analytics_saved_views" ADD CONSTRAINT "asv_type_check" CHECK ("view_type" IN ('pareto','trend','relations','statistics','events'));

-- Historial append-only.
CREATE TRIGGER trg_qeh_append BEFORE UPDATE OR DELETE ON "quality_event_history" FOR EACH ROW EXECUTE FUNCTION fn_block_update_delete();

-- No-borrado físico (baja lógica vía status/active).
CREATE TRIGGER trg_qev_nodel  BEFORE DELETE ON "quality_events"              FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_qec_nodel  BEFORE DELETE ON "quality_event_categories"    FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_qesc_nodel BEFORE DELETE ON "quality_event_subcategories" FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_qcv_nodel  BEFORE DELETE ON "quality_catalog_values"      FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_qer_nodel  BEFORE DELETE ON "quality_event_relations"     FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_kpd_nodel  BEFORE DELETE ON "kpi_definitions"             FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_qar_nodel  BEFORE DELETE ON "quality_alert_rules"         FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_qal_nodel  BEFORE DELETE ON "quality_alerts"              FOR EACH ROW EXECUTE FUNCTION fn_block_delete();

-- RLS por organización + permisos a gapsi_app.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'quality_events','quality_event_folio_counters','quality_event_categories',
    'quality_event_subcategories','quality_catalog_values','quality_event_relations',
    'quality_event_history','kpi_definitions','kpi_folio_counters','kpi_results',
    'quality_alert_rules','quality_alerts','analytics_saved_views'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;

-- Las vistas guardadas y los resultados de KPI (caché recalculable) sí pueden
-- eliminarse por la app; no llevan trigger de no-borrado.
GRANT DELETE ON "analytics_saved_views" TO gapsi_app;
GRANT DELETE ON "kpi_results" TO gapsi_app;

-- Secuencia BIGSERIAL del historial.
GRANT USAGE, SELECT ON SEQUENCE "quality_event_history_id_seq" TO gapsi_app;
