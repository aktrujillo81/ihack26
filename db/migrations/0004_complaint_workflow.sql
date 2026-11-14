-- Complaint workflow extension: explicit review/operations states, provider
-- assignment, recoverable note removal, and audited location tools.
ALTER TYPE "public"."complaint_status" ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE "public"."complaint_status" ADD VALUE IF NOT EXISTS 'denied';
ALTER TYPE "public"."complaint_status" ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE "public"."complaint_status" ADD VALUE IF NOT EXISTS 'completed';

ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "assigned_partner_id" uuid;
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "assigned_at" timestamp with time zone;
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;

ALTER TABLE "complaints"
  ADD CONSTRAINT "complaints_assigned_partner_fk"
  FOREIGN KEY ("assigned_partner_id") REFERENCES "public"."partners"("id");

DROP INDEX IF EXISTS "complaints_one_active_per_water_point_idx";
CREATE UNIQUE INDEX "complaints_one_active_per_water_point_idx"
  ON "complaints" USING btree ("water_point_id")
  WHERE "complaints"."status" in ('open', 'accepted', 'in_progress', 'passed_on');
