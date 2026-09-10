-- DOC-003 — Notificaciones internas transversales de C3 Sentinel + anticipación
-- por ocurrencia. Aditivo: ADD COLUMN con default + CREATE TABLE. Sin DROP.
-- FK a organizations + RLS + grants estándar (fn_current_org, TASK-002).

-- AlterTable: días de anticipación del aviso por ocurrencia (default 7).
ALTER TABLE "program_activity_instances" ADD COLUMN     "notify_before_days" INTEGER NOT NULL DEFAULT 7;

-- CreateTable: entregas de notificación (transversal por source_type/source_id).
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "notification_type" TEXT NOT NULL,
    "scheduled_for" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMPTZ(6),
    "read_at" TIMESTAMPTZ(6),

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (listado por usuario / no leídas).
CREATE INDEX "notification_deliveries_organization_id_user_id_read_at_idx" ON "notification_deliveries"("organization_id", "user_id", "read_at");

-- CreateIndex (búsqueda por origen).
CREATE INDEX "notification_deliveries_source_type_source_id_idx" ON "notification_deliveries"("source_type", "source_id");

-- CreateIndex (DEDUP a nivel DB: un aviso por org+usuario+origen+tipo+fecha programada).
CREATE UNIQUE INDEX "notification_deliveries_organization_id_user_id_source_type_key" ON "notification_deliveries"("organization_id", "user_id", "source_type", "source_id", "notification_type", "scheduled_for");

-- =====================================================================
-- DOC-003 — SQL complementario (FK org, RLS, grants).
-- =====================================================================

ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "nd_org_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE RESTRICT;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['notification_deliveries'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = fn_current_org()) WITH CHECK (organization_id = fn_current_org());', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO gapsi_app;', t);
  END LOOP;
END
$$;
