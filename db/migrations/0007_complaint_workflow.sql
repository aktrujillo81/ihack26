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

-- Postgres refuses to use an enum value in the transaction that added it
-- (55P04), and drizzle-kit runs every pending migration in one transaction.
-- So the index predicate compares text inside an IMMUTABLE helper and never
-- names the new enum values directly.
CREATE OR REPLACE FUNCTION "public"."complaint_status_is_active"(s "public"."complaint_status")
  RETURNS boolean
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT s::text IN ('open', 'accepted', 'in_progress', 'passed_on') $$;

DROP INDEX IF EXISTS "complaints_one_active_per_water_point_idx";
CREATE UNIQUE INDEX "complaints_one_active_per_water_point_idx"
  ON "complaints" USING btree ("water_point_id")
  WHERE "public"."complaint_status_is_active"("complaints"."status");
