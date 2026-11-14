CREATE TYPE "public"."needs_review_reason" AS ENUM('malformed_payload', 'no_structured_data', 'processing_error', 'unusable_location', 'ambiguous_match', 'invalid_fields', 'not_confirmed');--> statement-breakpoint
CREATE TABLE "report_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"water_point_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_candidates_pair_unique" UNIQUE("report_id","water_point_id")
);
--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "problem" "problem_type" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "people_affected" integer;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "serves_school_or_clinic" boolean;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "duration" "duration_type" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "needs_review_reason" "needs_review_reason";--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "provider_call_ref" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "ended_reason" text;--> statement-breakpoint
ALTER TABLE "water_points" ADD COLUMN "location_key" text;--> statement-breakpoint
-- Backfill (task D3-schema). Runs before the constraints and indexes that depend on it.
-- 1. Item 8 guard: refuse to continue if any water point already has two active
--    complaints. Nothing is merged or changed silently; a human decides first.
DO $$
DECLARE dup integer;
BEGIN
  SELECT count(*) INTO dup FROM (
    SELECT water_point_id FROM "complaints" WHERE status IN ('open', 'passed_on') GROUP BY water_point_id HAVING count(*) > 1
  ) d;
  IF dup > 0 THEN
    RAISE EXCEPTION 'Migration 0003 stopped: % water point(s) have more than one open or passed_on complaint. Resolve them first (nothing was changed).', dup;
  END IF;
END $$;--> statement-breakpoint
-- 2. Item 2: reports already flagged get a reason, so the new check cannot fail.
--    Attached reports: not_confirmed if the caller did not confirm, else invalid_fields.
--    Unattached with an unusable location: unusable_location. Any other unattached
--    flagged report: processing_error (the least specific code; contracts do not say).
UPDATE "reports" SET "needs_review_reason" = CASE
  WHEN "complaint_id" IS NOT NULL AND "caller_confirmed" IS DISTINCT FROM true THEN 'not_confirmed'::"needs_review_reason"
  WHEN "complaint_id" IS NOT NULL THEN 'invalid_fields'::"needs_review_reason"
  WHEN lower(btrim("location_text")) = 'unknown' THEN 'unusable_location'::"needs_review_reason"
  ELSE 'processing_error'::"needs_review_reason"
END
WHERE "needs_review" = true AND "needs_review_reason" IS NULL;--> statement-breakpoint
-- 3. Item 7: complaint facts = most severe values over its attached reports (contracts 5.5).
--    problem_type is declared most severe first, so min() is the most severe.
--    Complaints with no reports keep the defaults (unknown, null).
UPDATE "complaints" c SET
  "problem" = r.problem,
  "people_affected" = r.people,
  "serves_school_or_clinic" = r.school,
  "duration" = CASE r.duration_rank WHEN 3 THEN 'week_or_more' WHEN 2 THEN 'few_days' WHEN 1 THEN 'today' ELSE 'unknown' END::"duration_type"
FROM (
  SELECT "complaint_id",
    min("problem") AS problem,
    max("people_affected") AS people,
    CASE WHEN bool_or("serves_school_or_clinic") THEN true WHEN count("serves_school_or_clinic") > 0 THEN false ELSE NULL END AS school,
    max(CASE "duration" WHEN 'week_or_more' THEN 3 WHEN 'few_days' THEN 2 WHEN 'today' THEN 1 ELSE 0 END) AS duration_rank
  FROM "reports" WHERE "complaint_id" IS NOT NULL GROUP BY "complaint_id"
) r WHERE c."id" = r."complaint_id";--> statement-breakpoint
-- The scoped foreign keys below need these unique constraints first.
ALTER TABLE "reports" ADD CONSTRAINT "reports_scope_id_unique" UNIQUE("organization_id","region_id","id");--> statement-breakpoint
ALTER TABLE "water_points" ADD CONSTRAINT "water_points_scope_id_unique" UNIQUE("organization_id","region_id","id");--> statement-breakpoint
ALTER TABLE "report_candidates" ADD CONSTRAINT "report_candidates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_candidates" ADD CONSTRAINT "report_candidates_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_candidates" ADD CONSTRAINT "report_candidates_organization_region_fk" FOREIGN KEY ("organization_id","region_id") REFERENCES "public"."regions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_candidates" ADD CONSTRAINT "report_candidates_report_scope_fk" FOREIGN KEY ("organization_id","region_id","report_id") REFERENCES "public"."reports"("organization_id","region_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_candidates" ADD CONSTRAINT "report_candidates_water_point_scope_fk" FOREIGN KEY ("organization_id","region_id","water_point_id") REFERENCES "public"."water_points"("organization_id","region_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_candidates_water_point_idx" ON "report_candidates" USING btree ("water_point_id");--> statement-breakpoint
CREATE UNIQUE INDEX "complaints_one_active_per_water_point_idx" ON "complaints" USING btree ("water_point_id") WHERE "complaints"."status" in ('open', 'passed_on');--> statement-breakpoint
CREATE UNIQUE INDEX "reports_provider_call_ref_idx" ON "reports" USING btree ("organization_id","provider_call_ref") WHERE "reports"."provider_call_ref" is not null;--> statement-breakpoint
CREATE INDEX "water_points_location_key_idx" ON "water_points" USING btree ("organization_id","region_id","location_key");--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_people_affected_nonnegative" CHECK ("complaints"."people_affected" is null or "complaints"."people_affected" >= 0);--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_needs_review_has_reason" CHECK ("reports"."needs_review" = false or "reports"."needs_review_reason" is not null);--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_ended_reason_allowed" CHECK ("reports"."ended_reason" is null or "reports"."ended_reason" in ('customer-ended-call', 'assistant-said-end-call-phrase', 'other'));