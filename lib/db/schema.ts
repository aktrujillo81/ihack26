import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const userRole = pgEnum("user_role", ["org_admin", "responder", "viewer", "technician"]);
export const technicianTicketStatus = pgEnum("technician_ticket_status", ["open", "in_progress", "completed"]);
export const waterPointType = pgEnum("water_point_type", ["well", "hand_pump", "tap", "borehole", "other", "unknown"]);
export const problemType = pgEnum("problem_type", ["no_water", "broken", "dirty", "slow", "other", "unknown"]);
export const reportChannel = pgEnum("report_channel", ["phone", "web", "other"]);
export const durationType = pgEnum("duration_type", ["today", "few_days", "week_or_more", "unknown"]);
export const verificationState = pgEnum("verification_state", ["unverified", "verified", "merged", "archived"]);
export const locationSource = pgEnum("location_source", ["landmark_only", "map_pin", "gps", "geocoded"]);
export const complaintStatus = pgEnum("complaint_status", ["open", "passed_on", "fixed"]);
/** Contracts 5.2, in priority order. One stored reason per flagged report. */
export const needsReviewReason = pgEnum("needs_review_reason", [
  "malformed_payload",
  "no_structured_data",
  "processing_error",
  "unusable_location",
  "ambiguous_match",
  "invalid_fields",
  "not_confirmed",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
});

export const regions = pgTable("regions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  unique("regions_organization_id_id_unique").on(table.organizationId, table.id),
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
  foreignKey({
    columns: [table.organizationId, table.regionId],
    foreignColumns: [regions.organizationId, regions.id],
    name: "users_organization_region_fk",
  }),
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
}, (table) => [
  foreignKey({
    columns: [table.organizationId, table.regionId],
    foreignColumns: [regions.organizationId, regions.id],
    name: "partners_organization_region_fk",
  }),
]);

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
  /** Normalized location text used by matching (contracts 5.3, D4). Null until D4 writes it. */
  locationKey: text("location_key"),
  ...timestamps,
}, (table) => [
  // Target of report_candidates' scoped foreign key.
  unique("water_points_scope_id_unique").on(table.organizationId, table.regionId, table.id),
  index("water_points_location_key_idx").on(table.organizationId, table.regionId, table.locationKey),
  foreignKey({
    columns: [table.organizationId, table.regionId],
    foreignColumns: [regions.organizationId, regions.id],
    name: "water_points_organization_region_fk",
  }),
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
  // Most severe values over the complaint's reports (contracts 5.5). Written by D5.
  problem: problemType("problem").default("unknown").notNull(),
  peopleAffected: integer("people_affected"),
  servesSchoolOrClinic: boolean("serves_school_or_clinic"),
  duration: durationType("duration").default("unknown").notNull(),
  passedOnPartnerId: uuid("passed_on_partner_id").references(() => partners.id),
  passedOnNote: text("passed_on_note"),
  fixedAt: timestamp("fixed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  unique("complaints_scope_id_unique").on(table.organizationId, table.regionId, table.id),
  foreignKey({
    columns: [table.organizationId, table.regionId],
    foreignColumns: [regions.organizationId, regions.id],
    name: "complaints_organization_region_fk",
  }),
  check("complaints_priority_score_nonnegative", sql`${table.priorityScore} >= 0`),
  check("complaints_report_count_nonnegative", sql`${table.reportCount} >= 0`),
  check("complaints_people_affected_nonnegative", sql`${table.peopleAffected} is null or ${table.peopleAffected} >= 0`),
  // At most one active complaint per water point (contracts 4.1 item 8).
  uniqueIndex("complaints_one_active_per_water_point_idx").on(table.waterPointId).where(sql`${table.status} in ('open', 'passed_on')`),
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
  needsReviewReason: needsReviewReason("needs_review_reason"),
  /** Vapi's call reference, used only to ignore repeat deliveries. Not caller data. */
  providerCallRef: text("provider_call_ref"),
  endedReason: text("ended_reason"),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  ...timestamps,
}, (table) => [
  foreignKey({
    columns: [table.organizationId, table.regionId],
    foreignColumns: [regions.organizationId, regions.id],
    name: "reports_organization_region_fk",
  }),
  check("reports_people_affected_nonnegative", sql`${table.peopleAffected} is null or ${table.peopleAffected} >= 0`),
  check("reports_needs_review_has_reason", sql`${table.needsReview} = false or ${table.needsReviewReason} is not null`),
  check("reports_ended_reason_allowed", sql`${table.endedReason} is null or ${table.endedReason} in ('customer-ended-call', 'assistant-said-end-call-phrase', 'other')`),
  // Target of report_candidates' scoped foreign key.
  unique("reports_scope_id_unique").on(table.organizationId, table.regionId, table.id),
  uniqueIndex("reports_provider_call_ref_idx").on(table.organizationId, table.providerCallRef).where(sql`${table.providerCallRef} is not null`),
]);

/**
 * Water points that fit an ambiguous report (contracts 5.3). Not history: a row
 * is removed only when its report is attached, and a merge repoints rows to the
 * survivor (4.1 item 11, D4).
 */
export const reportCandidates = pgTable("report_candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  regionId: uuid("region_id").notNull().references(() => regions.id),
  reportId: uuid("report_id").notNull(),
  waterPointId: uuid("water_point_id").notNull(),
  ...timestamps,
}, (table) => [
  foreignKey({
    columns: [table.organizationId, table.regionId],
    foreignColumns: [regions.organizationId, regions.id],
    name: "report_candidates_organization_region_fk",
  }),
  foreignKey({
    columns: [table.organizationId, table.regionId, table.reportId],
    foreignColumns: [reports.organizationId, reports.regionId, reports.id],
    name: "report_candidates_report_scope_fk",
  }),
  foreignKey({
    columns: [table.organizationId, table.regionId, table.waterPointId],
    foreignColumns: [waterPoints.organizationId, waterPoints.regionId, waterPoints.id],
    name: "report_candidates_water_point_scope_fk",
  }),
  unique("report_candidates_pair_unique").on(table.reportId, table.waterPointId),
  index("report_candidates_water_point_idx").on(table.waterPointId),
]);

export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  regionId: uuid("region_id").notNull().references(() => regions.id),
  complaintId: uuid("complaint_id").notNull().references(() => complaints.id),
  authorUserId: uuid("author_user_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  ...timestamps,
}, (table) => [
  foreignKey({
    columns: [table.organizationId, table.regionId],
    foreignColumns: [regions.organizationId, regions.id],
    name: "notes_organization_region_fk",
  }),
]);

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
}, (table) => [
  foreignKey({
    columns: [table.organizationId, table.regionId],
    foreignColumns: [regions.organizationId, regions.id],
    name: "history_events_organization_region_fk",
  }),
]);

export const configuration = pgTable("configuration", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  regionId: uuid("region_id").notNull().references(() => regions.id),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  ...timestamps,
}, (table) => [
  foreignKey({
    columns: [table.organizationId, table.regionId],
    foreignColumns: [regions.organizationId, regions.id],
    name: "configuration_organization_region_fk",
  }),
  uniqueIndex("configuration_scope_key_idx").on(table.organizationId, table.regionId, table.key),
]);

/** Field-maintenance records. A technician may create and read only their own tickets. */
export const technicianTickets = pgTable("technician_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  regionId: uuid("region_id").notNull().references(() => regions.id),
  waterPointId: uuid("water_point_id").notNull().references(() => waterPoints.id),
  complaintId: uuid("complaint_id").references(() => complaints.id),
  technicianUserId: uuid("technician_user_id").notNull().references(() => users.id),
  status: technicianTicketStatus("status").default("open").notNull(),
  locationText: text("location_text").notNull(),
  latitude: numeric("latitude", { precision: 9, scale: 6 }).notNull(),
  longitude: numeric("longitude", { precision: 9, scale: 6 }).notNull(),
  issueSummary: text("issue_summary").notNull(),
  notes: text("notes"),
  ...timestamps,
}, (table) => [
  foreignKey({ columns: [table.organizationId, table.regionId], foreignColumns: [regions.organizationId, regions.id], name: "technician_tickets_organization_region_fk" }),
  foreignKey({ columns: [table.organizationId, table.regionId, table.waterPointId], foreignColumns: [waterPoints.organizationId, waterPoints.regionId, waterPoints.id], name: "technician_tickets_water_point_scope_fk" }),
  foreignKey({ columns: [table.organizationId, table.regionId, table.complaintId], foreignColumns: [complaints.organizationId, complaints.regionId, complaints.id], name: "technician_tickets_complaint_scope_fk" }),
  index("technician_tickets_technician_scope_idx").on(table.technicianUserId, table.organizationId, table.regionId),
  check("technician_tickets_latitude_range", sql`${table.latitude} >= -90 and ${table.latitude} <= 90`),
  check("technician_tickets_longitude_range", sql`${table.longitude} >= -180 and ${table.longitude} <= 180`),
]);

// ---------------------------------------------------------------------------
// Better Auth core tables (task A1). Login identity only: email, password hash
// and sessions for STAFF. Never callers (red line 3).
//
// Hand-written to Better Auth 1.7.23's Drizzle schema (generateId "uuid"),
// with two intended differences: the tables are renamed to auth_* (`user` is a
// Postgres reserved word and too close to D1's `users`; lib/auth/server.ts sets
// the matching modelName), and timestamps are timestamptz.
//
// Organization, region, role and active live ONLY in D1's `users` row, found
// by users.auth_subject = auth_user.id. Never add them here: a signed-in user
// can edit parts of their own Better Auth user row.
// ---------------------------------------------------------------------------

const authTimestamp = (name: string) => timestamp(name, { withTimezone: true });

export const authUser = pgTable("auth_user", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: authTimestamp("created_at").defaultNow().notNull(),
  updatedAt: authTimestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/** One row per signed-in staff session. Holds the staff member's IP and user agent (not caller data). Deleted at expiry. */
export const authSession = pgTable(
  "auth_session",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expiresAt: authTimestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: authTimestamp("created_at").defaultNow().notNull(),
    updatedAt: authTimestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
  },
  (table) => [index("auth_session_user_id_idx").on(table.userId), index("auth_session_expires_at_idx").on(table.expiresAt)],
);

/** Credentials. provider_id = 'credential' holds the scrypt password hash. */
export const authAccount = pgTable(
  "auth_account",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: authTimestamp("access_token_expires_at"),
    refreshTokenExpiresAt: authTimestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: authTimestamp("created_at").defaultNow().notNull(),
    updatedAt: authTimestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("auth_account_user_id_idx").on(table.userId)],
);

/** Required by Better Auth. Unused in this build (no email verification or reset flows). */
export const authVerification = pgTable(
  "auth_verification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: authTimestamp("expires_at").notNull(),
    createdAt: authTimestamp("created_at").defaultNow().notNull(),
    updatedAt: authTimestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("auth_verification_identifier_idx").on(table.identifier)],
);

export type Organization = typeof organizations.$inferSelect;
export type Region = typeof regions.$inferSelect;
export type User = typeof users.$inferSelect;
export type Partner = typeof partners.$inferSelect;
export type WaterPoint = typeof waterPoints.$inferSelect;
export type Complaint = typeof complaints.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type ReportCandidate = typeof reportCandidates.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type HistoryEvent = typeof historyEvents.$inferSelect;
export type Configuration = typeof configuration.$inferSelect;
export type TechnicianTicket = typeof technicianTickets.$inferSelect;
