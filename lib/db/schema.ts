import {
  boolean,
  check,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const userRole = pgEnum("user_role", ["org_admin", "responder", "viewer"]);
export const waterPointType = pgEnum("water_point_type", ["well", "hand_pump", "tap", "borehole", "other", "unknown"]);
export const problemType = pgEnum("problem_type", ["no_water", "broken", "dirty", "slow", "other", "unknown"]);
export const reportChannel = pgEnum("report_channel", ["phone", "web", "other"]);
export const durationType = pgEnum("duration_type", ["today", "few_days", "week_or_more", "unknown"]);
export const verificationState = pgEnum("verification_state", ["unverified", "verified", "merged", "archived"]);
export const locationSource = pgEnum("location_source", ["landmark_only", "map_pin", "gps", "geocoded"]);
export const complaintStatus = pgEnum("complaint_status", ["open", "passed_on", "fixed"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ...timestamps,
});

export const regions = pgTable("regions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("regions_organization_slug_idx").on(table.organizationId, table.slug),
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  regionId: uuid("region_id").notNull().references(() => regions.id),
  authSubject: text("auth_subject").notNull(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: userRole("role").notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("users_auth_subject_idx").on(table.authSubject),
  uniqueIndex("users_organization_email_idx").on(table.organizationId, table.email),
]);

export const partners = pgTable("partners", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  regionId: uuid("region_id").notNull().references(() => regions.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  contact: text("contact"),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
});

export const waterPoints = pgTable("water_points", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  regionId: uuid("region_id").notNull().references(() => regions.id),
  locationText: text("location_text").notNull(),
  waterPointType: waterPointType("water_point_type").notNull(),
  verificationState: verificationState("verification_state").default("unverified").notNull(),
  locationSource: locationSource("location_source").default("landmark_only").notNull(),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
  mergedIntoId: uuid("merged_into_id"),
  needsReview: boolean("needs_review").default(false).notNull(),
  ...timestamps,
}, (table) => [
  check("water_points_latitude_range", sql`${table.latitude} is null or (${table.latitude} >= -90 and ${table.latitude} <= 90)`),
  check("water_points_longitude_range", sql`${table.longitude} is null or (${table.longitude} >= -180 and ${table.longitude} <= 180)`),
]);

export const complaints = pgTable("complaints", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  regionId: uuid("region_id").notNull().references(() => regions.id),
  waterPointId: uuid("water_point_id").notNull().references(() => waterPoints.id),
  status: complaintStatus("status").default("open").notNull(),
  priorityScore: integer("priority_score").default(0).notNull(),
  priorityReason: text("priority_reason").notNull(),
  reportCount: integer("report_count").default(0).notNull(),
  needsReview: boolean("needs_review").default(false).notNull(),
  passedOnPartnerId: uuid("passed_on_partner_id").references(() => partners.id),
  passedOnNote: text("passed_on_note"),
  fixedAt: timestamp("fixed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  check("complaints_priority_score_nonnegative", sql`${table.priorityScore} >= 0`),
  check("complaints_report_count_nonnegative", sql`${table.reportCount} >= 0`),
]);

export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  regionId: uuid("region_id").notNull().references(() => regions.id),
  complaintId: uuid("complaint_id").references(() => complaints.id),
  waterPointId: uuid("water_point_id").references(() => waterPoints.id),
  channel: reportChannel("channel").notNull(),
  locationText: text("location_text").notNull(),
  waterPointType: waterPointType("water_point_type").notNull(),
  problem: problemType("problem").notNull(),
  peopleAffected: integer("people_affected"),
  servesSchoolOrClinic: boolean("serves_school_or_clinic"),
  duration: durationType("duration").notNull(),
  callerConfirmed: boolean("caller_confirmed"),
  summary: text("summary"),
  languageSpoken: text("language_spoken"),
  transcript: text("transcript"),
  needsReview: boolean("needs_review").default(false).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  ...timestamps,
}, (table) => [
  check("reports_people_affected_nonnegative", sql`${table.peopleAffected} is null or ${table.peopleAffected} >= 0`),
]);

export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  regionId: uuid("region_id").notNull().references(() => regions.id),
  complaintId: uuid("complaint_id").notNull().references(() => complaints.id),
  authorUserId: uuid("author_user_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  ...timestamps,
});

export const historyEvents = pgTable("history_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  regionId: uuid("region_id").notNull().references(() => regions.id),
  complaintId: uuid("complaint_id").references(() => complaints.id),
  waterPointId: uuid("water_point_id").references(() => waterPoints.id),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  eventType: text("event_type").notNull(),
  beforeData: jsonb("before_data"),
  afterData: jsonb("after_data"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const configuration = pgTable("configuration", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  regionId: uuid("region_id").notNull().references(() => regions.id),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("configuration_scope_key_idx").on(table.organizationId, table.regionId, table.key),
]);

export type Organization = typeof organizations.$inferSelect;
export type Region = typeof regions.$inferSelect;
export type User = typeof users.$inferSelect;
export type Partner = typeof partners.$inferSelect;
export type WaterPoint = typeof waterPoints.$inferSelect;
export type Complaint = typeof complaints.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type HistoryEvent = typeof historyEvents.$inferSelect;
export type Configuration = typeof configuration.$inferSelect;
