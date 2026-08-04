-- TASK-002 — SQL complementario que Prisma no expresa en schema.prisma.
--
-- Contenido:
--   1. FKs a organizations / users (columnas UUID escalares).
--   2. CHECK de enums (D5: text + CHECK) y reglas de consistencia.
--   3. Índices únicos parciales (código de sitio, marcos, resultado vigente).
--   4. Triggers de inmutabilidad de plantillas publicadas.
--   5. Triggers append-only (audit_log, historial de estados).
--   6. Bloqueo de borrado físico (diagnósticos, respuestas, evidencias, resultados).
--   7. RLS de PostgreSQL (defensa adicional por organización).
--
-- Ver docs/architecture/TASK-002-IMPLEMENTATION-NOTES.md.

-- =====================================================================
-- 1. FOREIGN KEYS a organizations / users
-- =====================================================================

-- organization_id -> organizations(id) (nullable en catálogo maestro: no fuerza en NULL)
ALTER TABLE "sites"                        ADD CONSTRAINT "sites_organization_id_fkey"                        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "assessment_frameworks"        ADD CONSTRAINT "assessment_frameworks_organization_id_fkey"        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "template_versions"            ADD CONSTRAINT "template_versions_organization_id_fkey"            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "template_sections"            ADD CONSTRAINT "template_sections_organization_id_fkey"            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "template_requirements"        ADD CONSTRAINT "template_requirements_organization_id_fkey"        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "template_questions"           ADD CONSTRAINT "template_questions_organization_id_fkey"           FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "template_answer_options"      ADD CONSTRAINT "template_answer_options_organization_id_fkey"      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "diagnostics"                  ADD CONSTRAINT "diagnostics_organization_id_fkey"                  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "diagnostic_answers"           ADD CONSTRAINT "diagnostic_answers_organization_id_fkey"           FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "evidences"                    ADD CONSTRAINT "evidences_organization_id_fkey"                    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "diagnostic_results"           ADD CONSTRAINT "diagnostic_results_organization_id_fkey"           FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "diagnostic_section_results"   ADD CONSTRAINT "diagnostic_section_results_organization_id_fkey"   FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "diagnostic_findings"          ADD CONSTRAINT "diagnostic_findings_organization_id_fkey"          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "diagnostic_state_history"     ADD CONSTRAINT "diagnostic_state_history_organization_id_fkey"     FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_log"                    ADD CONSTRAINT "audit_log_organization_id_fkey"                    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;

-- actor/usuario -> users(id) (nullable: no fuerza en NULL)
ALTER TABLE "assessment_frameworks"    ADD CONSTRAINT "assessment_frameworks_created_by_fkey"    FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "template_versions"        ADD CONSTRAINT "template_versions_created_by_fkey"        FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "diagnostics"              ADD CONSTRAINT "diagnostics_responsible_user_id_fkey"     FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "diagnostics"              ADD CONSTRAINT "diagnostics_created_by_fkey"              FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "diagnostics"              ADD CONSTRAINT "diagnostics_submitted_by_fkey"            FOREIGN KEY ("submitted_by")        REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "diagnostics"              ADD CONSTRAINT "diagnostics_reviewed_by_fkey"             FOREIGN KEY ("reviewed_by")         REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "diagnostic_answers"       ADD CONSTRAINT "diagnostic_answers_answered_by_fkey"      FOREIGN KEY ("answered_by")         REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "evidences"                ADD CONSTRAINT "evidences_created_by_fkey"                FOREIGN KEY ("created_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "evidences"                ADD CONSTRAINT "evidences_reviewed_by_fkey"               FOREIGN KEY ("reviewed_by")         REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "diagnostic_results"       ADD CONSTRAINT "diagnostic_results_computed_by_fkey"      FOREIGN KEY ("computed_by")         REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "diagnostic_results"       ADD CONSTRAINT "diagnostic_results_invalidated_by_fkey"   FOREIGN KEY ("invalidated_by")      REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "diagnostic_state_history" ADD CONSTRAINT "diagnostic_state_history_changed_by_fkey" FOREIGN KEY ("changed_by")          REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_log"                ADD CONSTRAINT "audit_log_actor_user_id_fkey"             FOREIGN KEY ("actor_user_id")       REFERENCES "users"("id") ON DELETE RESTRICT;

-- =====================================================================
-- 2. CHECK constraints (enums D5 = text + CHECK; y reglas de consistencia)
-- =====================================================================

ALTER TABLE "memberships"           ADD CONSTRAINT "memberships_role_check"        CHECK ("role" IN ('owner','admin','evaluator','viewer'));
ALTER TABLE "memberships"           ADD CONSTRAINT "memberships_status_check"      CHECK ("status" IN ('active','invited','disabled'));

ALTER TABLE "assessment_frameworks" ADD CONSTRAINT "frameworks_scope_check"        CHECK ("scope" IN ('master','organization'));
ALTER TABLE "assessment_frameworks" ADD CONSTRAINT "frameworks_scope_org_check"    CHECK (
  ("scope" = 'master'       AND "organization_id" IS NULL) OR
  ("scope" = 'organization' AND "organization_id" IS NOT NULL)
);

ALTER TABLE "template_versions"     ADD CONSTRAINT "template_versions_scope_check"  CHECK ("scope" IN ('master','organization'));
ALTER TABLE "template_versions"     ADD CONSTRAINT "template_versions_status_check" CHECK ("status" IN ('draft','published','archived'));
ALTER TABLE "template_versions"     ADD CONSTRAINT "template_versions_scope_org_check" CHECK (
  ("scope" = 'master'       AND "organization_id" IS NULL) OR
  ("scope" = 'organization' AND "organization_id" IS NOT NULL)
);
-- Una versión de organización siempre proviene de una maestra o es de autoría propia;
-- una versión maestra nunca tiene origen.
ALTER TABLE "template_versions"     ADD CONSTRAINT "template_versions_master_no_source_check" CHECK (
  "scope" = 'organization' OR "source_master_version_id" IS NULL
);

ALTER TABLE "template_questions"    ADD CONSTRAINT "template_questions_type_check"  CHECK ("question_type" IN ('yes_no','single_choice','text'));

ALTER TABLE "template_answer_options" ADD CONSTRAINT "answer_options_score_range_check" CHECK ("score_fraction" >= 0 AND "score_fraction" <= 1);

ALTER TABLE "diagnostics"           ADD CONSTRAINT "diagnostics_status_check"       CHECK ("status" IN ('draft','in_progress','submitted','reviewed','archived'));

ALTER TABLE "diagnostic_answers"    ADD CONSTRAINT "answers_status_check"           CHECK ("answer_status" IN ('pending','answered','not_applicable'));
-- Consistencia respuesta / tipo: "No aplica" no lleva opción ni texto y exige justificación.
ALTER TABLE "diagnostic_answers"    ADD CONSTRAINT "answers_not_applicable_check"   CHECK (
  "answer_status" <> 'not_applicable' OR
  ("selected_option_id" IS NULL AND "value_text" IS NULL AND "na_justification" IS NOT NULL)
);

ALTER TABLE "evidences"             ADD CONSTRAINT "evidences_kind_check"           CHECK ("kind" IN ('note','reference','file'));
ALTER TABLE "evidences"             ADD CONSTRAINT "evidences_status_check"         CHECK ("status" IN ('not_provided','provided','accepted','rejected'));
ALTER TABLE "evidences"             ADD CONSTRAINT "evidences_backend_check"        CHECK ("storage_backend" IS NULL OR "storage_backend" IN ('local','simulated','private'));

ALTER TABLE "diagnostic_results"    ADD CONSTRAINT "results_risk_check"             CHECK ("risk_level" IN ('low','moderate','high','critical'));
ALTER TABLE "diagnostic_results"    ADD CONSTRAINT "results_percentage_range_check" CHECK ("percentage" >= 0 AND "percentage" <= 100);

ALTER TABLE "diagnostic_state_history" ADD CONSTRAINT "state_history_to_check"   CHECK ("to_status"   IN ('draft','in_progress','submitted','reviewed','archived'));
ALTER TABLE "diagnostic_state_history" ADD CONSTRAINT "state_history_from_check" CHECK ("from_status" IS NULL OR "from_status" IN ('draft','in_progress','submitted','reviewed','archived'));

-- =====================================================================
-- 3. Índices únicos parciales
-- =====================================================================

-- Código de sitio único por organización (cuando existe).
CREATE UNIQUE INDEX "sites_org_code_key" ON "sites" ("organization_id", "code") WHERE "code" IS NOT NULL;

-- Código de marco: único por organización (privados) y global entre maestros.
CREATE UNIQUE INDEX "frameworks_org_code_key"    ON "assessment_frameworks" ("organization_id", "code") WHERE "scope" = 'organization';
CREATE UNIQUE INDEX "frameworks_master_code_key" ON "assessment_frameworks" ("code")                    WHERE "scope" = 'master';

-- A lo sumo un resultado VIGENTE por diagnóstico (los invalidados se conservan).
CREATE UNIQUE INDEX "diagnostic_results_current_key" ON "diagnostic_results" ("diagnostic_id") WHERE "invalidated_at" IS NULL;

-- =====================================================================
-- 4. Inmutabilidad de plantillas publicadas
-- =====================================================================

-- Contenido (secciones/requisitos/preguntas/opciones): solo editable mientras la
-- versión está en 'draft'. Todas estas tablas llevan template_version_id.
CREATE OR REPLACE FUNCTION fn_guard_frozen_content() RETURNS trigger AS $$
DECLARE
  v_version_id uuid;
  v_status text;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_version_id := OLD.template_version_id;
  ELSE
    v_version_id := NEW.template_version_id;
  END IF;

  SELECT status INTO v_status FROM template_versions WHERE id = v_version_id;

  IF v_status IS NOT NULL AND v_status <> 'draft' THEN
    RAISE EXCEPTION 'La versión de plantilla % no está en borrador (status=%); su contenido es inmutable.', v_version_id, v_status
      USING ERRCODE = 'raise_exception';
  END IF;

  IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_frozen_sections     BEFORE INSERT OR UPDATE OR DELETE ON "template_sections"       FOR EACH ROW EXECUTE FUNCTION fn_guard_frozen_content();
CREATE TRIGGER trg_frozen_requirements BEFORE INSERT OR UPDATE OR DELETE ON "template_requirements"   FOR EACH ROW EXECUTE FUNCTION fn_guard_frozen_content();
CREATE TRIGGER trg_frozen_questions    BEFORE INSERT OR UPDATE OR DELETE ON "template_questions"      FOR EACH ROW EXECUTE FUNCTION fn_guard_frozen_content();
CREATE TRIGGER trg_frozen_options      BEFORE INSERT OR UPDATE OR DELETE ON "template_answer_options" FOR EACH ROW EXECUTE FUNCTION fn_guard_frozen_content();

-- Cabecera de versión: publicada solo puede archivarse; archivada es terminal;
-- no se permite volver a draft ni alterar el contenido sellado.
CREATE OR REPLACE FUNCTION fn_guard_version_immutable() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'No se puede borrar una versión publicada/archivada (%).', OLD.id USING ERRCODE = 'raise_exception';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'archived' THEN
    RAISE EXCEPTION 'La versión % está archivada y es inmutable.', OLD.id USING ERRCODE = 'raise_exception';
  END IF;

  IF OLD.status = 'published' THEN
    IF NEW.status NOT IN ('published','archived') THEN
      RAISE EXCEPTION 'Una versión publicada no puede volver a % .', NEW.status USING ERRCODE = 'raise_exception';
    END IF;
    IF NEW.content_hash             IS DISTINCT FROM OLD.content_hash
       OR NEW.version_number        <> OLD.version_number
       OR NEW.framework_id          <> OLD.framework_id
       OR NEW.scope                 <> OLD.scope
       OR NEW.organization_id       IS DISTINCT FROM OLD.organization_id
       OR NEW.source_master_version_id IS DISTINCT FROM OLD.source_master_version_id THEN
      RAISE EXCEPTION 'No se puede alterar el contenido sellado de la versión publicada %.', OLD.id USING ERRCODE = 'raise_exception';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_version_immutable BEFORE UPDATE OR DELETE ON "template_versions" FOR EACH ROW EXECUTE FUNCTION fn_guard_version_immutable();

-- =====================================================================
-- 5. Append-only (auditoría e historial de estados)
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_block_update_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es append-only: no se permite % .', TG_TABLE_NAME, TG_OP USING ERRCODE = 'raise_exception';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_append_only         BEFORE UPDATE OR DELETE ON "audit_log"                FOR EACH ROW EXECUTE FUNCTION fn_block_update_delete();
CREATE TRIGGER trg_state_history_append_only BEFORE UPDATE OR DELETE ON "diagnostic_state_history" FOR EACH ROW EXECUTE FUNCTION fn_block_update_delete();

-- =====================================================================
-- 6. Prohibir borrado físico (usar borrado lógico / invalidación)
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_block_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Borrado físico no permitido en %; usa borrado lógico o invalidación.', TG_TABLE_NAME USING ERRCODE = 'raise_exception';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_delete_diagnostics      BEFORE DELETE ON "diagnostics"                 FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_no_delete_answers          BEFORE DELETE ON "diagnostic_answers"          FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_no_delete_evidences        BEFORE DELETE ON "evidences"                   FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_no_delete_results          BEFORE DELETE ON "diagnostic_results"          FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_no_delete_section_results  BEFORE DELETE ON "diagnostic_section_results"  FOR EACH ROW EXECUTE FUNCTION fn_block_delete();
CREATE TRIGGER trg_no_delete_findings         BEFORE DELETE ON "diagnostic_findings"         FOR EACH ROW EXECUTE FUNCTION fn_block_delete();

-- =====================================================================
-- 7. Row-Level Security (defensa adicional por organización)
-- =====================================================================
--
-- Contexto por transacción:  SELECT set_config('app.current_org', '<org-uuid>', true);
-- La aplicación debe conectarse con el rol NO propietario `gapsi_app` (ver
-- IMPLEMENTATION-NOTES). El propietario del esquema OMITE RLS (por eso las
-- migraciones y el seed funcionan como propietario). Para forzar RLS también al
-- propietario en pruebas, se usa `SET ROLE gapsi_app`.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'gapsi_app') THEN
    CREATE ROLE gapsi_app NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO gapsi_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO gapsi_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gapsi_app;

-- Helper: uuid del contexto actual (NULL si no se estableció).
CREATE OR REPLACE FUNCTION fn_current_org() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_org', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- Tablas de tenant estricto (organization_id NOT NULL): aislamiento por org.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'memberships','sites','diagnostics','diagnostic_answers','evidences',
    'diagnostic_results','diagnostic_section_results','diagnostic_findings',
    'diagnostic_state_history'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());',
      t || '_tenant_isolation', t
    );
  END LOOP;
END
$$;

-- Catálogo y contenido (organization_id NULL = maestro): la org ve lo suyo + lo maestro.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'assessment_frameworks','template_versions','template_sections',
    'template_requirements','template_questions','template_answer_options'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (organization_id = fn_current_org() OR organization_id IS NULL) WITH CHECK (organization_id = fn_current_org() OR organization_id IS NULL);',
      t || '_tenant_or_master', t
    );
  END LOOP;
END
$$;

-- audit_log: lectura/escritura acotada a la organización del contexto.
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_tenant_isolation" ON "audit_log"
  USING (organization_id = fn_current_org())
  WITH CHECK (organization_id = fn_current_org());
