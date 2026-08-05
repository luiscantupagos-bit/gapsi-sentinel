-- TASK-005 — Editor documental enriquecido.
--
-- NOTA: `prisma migrate dev --create-only` propuso además eliminar las FK
-- compuestas, las FK a organizations/users y el índice único de marcos que se
-- crearon por SQL en la migración de TASK-004 (Prisma no las conoce). Esos DROP
-- se OMITEN deliberadamente para no revertir constraints válidas. Esta migración
-- solo agrega columnas de contenido y refuerza el trigger de versión publicada.

-- Contenido del editor en `document_versions`.
ALTER TABLE "document_versions"
  ADD COLUMN "content_json" JSONB,
  ADD COLUMN "content_html" TEXT,
  ADD COLUMN "content_schema_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "page_config" JSONB,
  ADD COLUMN "content_checksum" TEXT,
  ADD COLUMN "template_key" TEXT,
  ADD COLUMN "updated_by" UUID,
  ADD COLUMN "updated_at" TIMESTAMPTZ(6);

ALTER TABLE "document_versions"
  ADD CONSTRAINT "document_versions_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT;

-- Refuerza el sellado de una versión publicada: además de label/notas, no se
-- puede reescribir su contenido. (Reemplaza la función; el trigger ya existe.)
CREATE OR REPLACE FUNCTION fn_guard_published_docversion() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'published' AND (
    NEW.label <> OLD.label
    OR NEW.change_notes IS DISTINCT FROM OLD.change_notes
    OR NEW.content_json IS DISTINCT FROM OLD.content_json
    OR NEW.content_html IS DISTINCT FROM OLD.content_html
    OR NEW.page_config IS DISTINCT FROM OLD.page_config
  ) THEN
    RAISE EXCEPTION 'No se puede reescribir el contenido de una version documental publicada (%).', OLD.id USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
