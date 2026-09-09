-- DOC-002 — Referencias inteligentes (@) y formatos emitidos (//).
--
-- Extiende la tabla EXISTENTE `document_relations` (§4 reutilizar) con relaciones
-- derivadas del CONTENIDO de una versión: `reference` (@) e `issued_form` (//).
-- Versionadas por `source_version_id`, con borrado LÓGICO (`active`) que respeta
-- el trigger de no-borrado físico, e inmutables cuando la versión origen está
-- publicada. Reutiliza fn_current_org. No CREATE TABLE (la tabla ya existe); el
-- único DROP es re-anclar el CHECK de `relation_type` para ampliarlo (no
-- destructivo, sin pérdida de datos).

-- AlterTable: columnas DOC-002.
ALTER TABLE "document_relations" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "created_by" UUID,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "source_version_id" UUID,
ADD COLUMN     "target_version_id" UUID;

-- CreateIndex
CREATE INDEX "document_relations_organization_id_relation_type_idx" ON "document_relations"("organization_id", "relation_type");
CREATE INDEX "document_relations_source_version_id_idx" ON "document_relations"("source_version_id");
CREATE INDEX "document_relations_related_document_id_idx" ON "document_relations"("related_document_id");

-- =====================================================================
-- DOC-002 — SQL complementario (CHECK ampliado, FK de versiones, unicidad de
-- deduplicación, trigger de inmutabilidad de versión publicada).
-- =====================================================================

-- Amplía los tipos de relación permitidos (drop + re-add: PostgreSQL no permite
-- editar la expresión de un CHECK). No destructivo.
ALTER TABLE "document_relations" DROP CONSTRAINT "document_relations_type_check";
ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_type_check" CHECK ("relation_type" IN (
  'site','framework','requirement','diagnostic','document',
  'reference','issued_form','supersedes','related','evidence','generated_record','attachment_reference'
));

-- FKs compuestas anti-cruce de las versiones origen/destino (MATCH SIMPLE: no se
-- exige cuando la columna es NULL, p. ej. relaciones heredadas a nivel documento).
ALTER TABLE "document_relations"
  ADD CONSTRAINT "document_relations_source_version_fkey"
  FOREIGN KEY ("source_version_id", "organization_id")
  REFERENCES "document_versions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_relations"
  ADD CONSTRAINT "document_relations_target_version_fkey"
  FOREIGN KEY ("target_version_id", "organization_id")
  REFERENCES "document_versions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Deduplicación (§40): una sola relación ACTIVA por (versión origen, destino, tipo).
CREATE UNIQUE INDEX "document_relations_content_unique"
  ON "document_relations" ("source_version_id", "related_document_id", "relation_type")
  WHERE "source_version_id" IS NOT NULL AND "related_document_id" IS NOT NULL AND "active";

-- Inmutabilidad (§25): no se pueden crear ni modificar relaciones cuya versión
-- origen esté publicada. Solo aplica a relaciones versionadas (source_version_id
-- no nulo); las heredadas a nivel documento no se ven afectadas.
CREATE OR REPLACE FUNCTION fn_guard_published_relation() RETURNS trigger AS $$
BEGIN
  IF NEW."source_version_id" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "document_versions" v
    WHERE v."id" = NEW."source_version_id" AND v."status" = 'published'
  ) THEN
    RAISE EXCEPTION 'No se pueden modificar relaciones de una version publicada (%).', NEW."source_version_id"
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_docrel_published BEFORE INSERT OR UPDATE ON "document_relations"
  FOR EACH ROW EXECUTE FUNCTION fn_guard_published_relation();
