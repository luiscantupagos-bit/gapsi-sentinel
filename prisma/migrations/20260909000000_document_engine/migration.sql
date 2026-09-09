-- DOC-001 — Motor de plantillas documentales estructuradas.
--
-- Agrega (1) el contenido ESTRUCTURADO por tipo en las versiones documentales
-- (fuente de verdad de los documentos nativos estructurados; el HTML/render se
-- deriva de estos datos) y (2) el contador atómico del código automático
-- `[TIPO]-[ÁREA]-[###]`. Reutiliza fn_current_org (TASK-002) y el guard de
-- versiones publicadas (TASK-005). Sin DROP.

-- AlterTable: contenido estructurado por tipo.
ALTER TABLE "document_versions" ADD COLUMN     "structured_content" JSONB;

-- CreateTable: contador del código automático (consecutivo por org+tipo+área).
CREATE TABLE "document_code_counters" (
    "organization_id" UUID NOT NULL,
    "code_prefix" TEXT NOT NULL,
    "area_code" TEXT NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_code_counters_pkey" PRIMARY KEY ("organization_id","code_prefix","area_code")
);

-- =====================================================================
-- DOC-001 — SQL complementario (guard de publicadas, FK org, RLS, grants).
-- Reutiliza fn_current_org y el trigger trg_docversion_published existentes.
-- =====================================================================

-- Sella también el contenido ESTRUCTURADO de una versión publicada: además de
-- label/notas/contenido enriquecido, no se puede reescribir structured_content.
-- (Reemplaza la función; el trigger trg_docversion_published ya existe.)
CREATE OR REPLACE FUNCTION fn_guard_published_docversion() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'published' AND (
    NEW.label <> OLD.label
    OR NEW.change_notes IS DISTINCT FROM OLD.change_notes
    OR NEW.content_json IS DISTINCT FROM OLD.content_json
    OR NEW.content_html IS DISTINCT FROM OLD.content_html
    OR NEW.page_config IS DISTINCT FROM OLD.page_config
    OR NEW.structured_content IS DISTINCT FROM OLD.structured_content
  ) THEN
    RAISE EXCEPTION 'No se puede reescribir el contenido de una version documental publicada (%).', OLD.id USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- FK de organización del contador.
ALTER TABLE "document_code_counters" ADD CONSTRAINT "dcc_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;

-- RLS por organización + permisos a gapsi_app. El contador se reserva con
-- INSERT ... ON CONFLICT DO UPDATE, por lo que requiere INSERT y UPDATE (sin
-- DELETE ni append-only: es estado mutable, no historial).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['document_code_counters'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;
