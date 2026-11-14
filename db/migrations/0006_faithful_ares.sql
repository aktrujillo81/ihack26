ALTER TABLE "complaints" ADD CONSTRAINT "complaints_scope_id_unique" UNIQUE("organization_id","region_id","id");--> statement-breakpoint
ALTER TABLE "technician_tickets" ADD CONSTRAINT "technician_tickets_complaint_scope_fk" FOREIGN KEY ("organization_id","region_id","complaint_id") REFERENCES "public"."complaints"("organization_id","region_id","id") ON DELETE no action ON UPDATE no action;
