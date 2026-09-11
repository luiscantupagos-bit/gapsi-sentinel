-- PLATFORM-002B — logo de organización como archivo transversal (stored_files).
-- Aditivo: ADD COLUMN + FK compuesta. Sin DROP. Compatible con logo_url legacy.

ALTER TABLE "organization_profiles" ADD COLUMN "logo_file_id" UUID;

-- Integridad de tenant (§26): el logo debe pertenecer a la MISMA organización.
-- RESTRICT: los stored_files usan soft delete, por lo que nunca se borra físicamente
-- un archivo referenciado como logo.
ALTER TABLE "organization_profiles"
  ADD CONSTRAINT "orgprofile_logo_file_fkey"
  FOREIGN KEY ("logo_file_id", "organization_id")
  REFERENCES "stored_files"("id", "organization_id") ON DELETE RESTRICT;
