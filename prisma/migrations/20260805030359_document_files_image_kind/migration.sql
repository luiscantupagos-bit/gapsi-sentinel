-- TASK-005 — Permitir archivos de tipo 'image' en el editor (imágenes insertadas
-- en el contenido). Amplía el CHECK creado en la migración de TASK-004 sin
-- modificar aquella migración.

ALTER TABLE "document_files" DROP CONSTRAINT "document_files_kind_check";
ALTER TABLE "document_files"
  ADD CONSTRAINT "document_files_kind_check" CHECK ("kind" IN ('main', 'attachment', 'image'));
