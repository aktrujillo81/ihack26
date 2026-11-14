CREATE TYPE "public"."technician_ticket_status" AS ENUM('open', 'in_progress', 'completed');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'technician';--> statement-breakpoint
CREATE TABLE "technician_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	"water_point_id" uuid NOT NULL,
	"technician_user_id" uuid NOT NULL,
	"status" "technician_ticket_status" DEFAULT 'open' NOT NULL,
	"location_text" text NOT NULL,
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"issue_summary" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "technician_tickets_latitude_range" CHECK ("technician_tickets"."latitude" >= -90 and "technician_tickets"."latitude" <= 90),
	CONSTRAINT "technician_tickets_longitude_range" CHECK ("technician_tickets"."longitude" >= -180 and "technician_tickets"."longitude" <= 180)
);
--> statement-breakpoint
ALTER TABLE "technician_tickets" ADD CONSTRAINT "technician_tickets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_tickets" ADD CONSTRAINT "technician_tickets_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_tickets" ADD CONSTRAINT "technician_tickets_water_point_id_water_points_id_fk" FOREIGN KEY ("water_point_id") REFERENCES "public"."water_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_tickets" ADD CONSTRAINT "technician_tickets_technician_user_id_users_id_fk" FOREIGN KEY ("technician_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_tickets" ADD CONSTRAINT "technician_tickets_organization_region_fk" FOREIGN KEY ("organization_id","region_id") REFERENCES "public"."regions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_tickets" ADD CONSTRAINT "technician_tickets_water_point_scope_fk" FOREIGN KEY ("organization_id","region_id","water_point_id") REFERENCES "public"."water_points"("organization_id","region_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "technician_tickets_technician_scope_idx" ON "technician_tickets" USING btree ("technician_user_id","organization_id","region_id");