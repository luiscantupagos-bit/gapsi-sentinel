-- DOC-003 — Programas ejecutables: ocurrencias de actividad (una por ocurrencia,
-- enlazada a una Tarea nativa). Aditivo: CREATE TABLE + índices. Sin DROP.
-- FK a organizations + RLS + grants estándar (fn_current_org, TASK-002).

-- CreateTable
CREATE TABLE "program_activity_instances" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "document_version_id" UUID NOT NULL,
    "activity_id" TEXT NOT NULL,
    "occurrence_key" TEXT NOT NULL,
    "activity_name" TEXT NOT NULL,
    "planned_start" DATE,
    "due_at" DATE,
    "responsible_user_id" UUID,
    "task_id" UUID,
    "expected_evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "program_activity_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "program_activity_instances_document_id_idx" ON "program_activity_instances"("document_id");

-- CreateIndex
CREATE INDEX "program_activity_instances_organization_id_idx" ON "program_activity_instances"("organization_id");

-- CreateIndex (idempotencia/reconciliación: una ocurrencia por versión+actividad+clave)
CREATE UNIQUE INDEX "program_activity_instances_document_version_id_activity_id__key" ON "program_activity_instances"("document_version_id", "activity_id", "occurrence_key");

-- =====================================================================
-- DOC-003 — SQL complementario (FK org, RLS, grants).
-- =====================================================================

ALTER TABLE "program_activity_instances"
  ADD CONSTRAINT "pai_org_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE RESTRICT;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['program_activity_instances'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;
