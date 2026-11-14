/**
 * Drizzle schema. See docs/contracts.md ("Tables") for the meaning of every
 * table and rule. Complaint, report, water point, partner and history tables
 * come in task D1, after the Vapi contract (S6).
 *
 * Generate a migration after editing: `npm run db:generate`
 * Apply migrations:                   `npm run db:migrate`
 *
 * No `server-only` import here: drizzle-kit and the seed script load this file
 * outside Next.js.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { ROLES } from "../domain/types";

const id = () => uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey();
// Every timestamp is timestamptz, so the server's time zone never shifts a session expiry.
const ts = (name: string) => timestamp(name, { withTimezone: true });

// ---------------------------------------------------------------------------
// Better Auth core tables (task A1). Hand-written to Better Auth 1.7.23's
// documented Drizzle schema for `generateId: "uuid"`. The only intended
// differences: timestamptz instead of timestamp. Never add role, organization
// or region fields here: users can edit their own `user` row through
// /update-user. Access lives in `memberships`.
// Staff accounts only. Callers never have a row here (red line 3).
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/** One row per signed-in staff session. Holds the staff member's IP and user agent (not caller data). */
export const session = pgTable(
  "session",
  {
    id: id(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: ts("created_at").defaultNow().notNull(),
    updatedAt: ts("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

/** Credentials. `provider_id = 'credential'` holds the password hash. */
export const account = pgTable(
  "account",
  {
    id: id(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: ts("created_at").defaultNow().notNull(),
    updatedAt: ts("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

/** Required by Better Auth. Unused in this build (no email verification or reset flows). */
export const verification = pgTable(
  "verification",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").defaultNow().notNull(),
    updatedAt: ts("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// ---------------------------------------------------------------------------
// Tenancy and access (task A1). "Remove" means setting archived_at (red line 9).
// ---------------------------------------------------------------------------

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  createdAt: ts("created_at").defaultNow().notNull(),
  archivedAt: ts("archived_at"),
});

export const regions = pgTable(
  "regions",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    createdAt: ts("created_at").defaultNow().notNull(),
    archivedAt: ts("archived_at"),
  },
  (table) => [
    unique("regions_organization_id_name_key").on(table.organizationId, table.name),
    // Target of the composite FK from membership_regions.
    unique("regions_id_organization_id_key").on(table.id, table.organizationId),
  ],
);

/** A user's role in one organization. At most one active (not archived) membership per user. */
export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    role: text("role", { enum: ROLES }).notNull(),
    createdAt: ts("created_at").defaultNow().notNull(),
    archivedAt: ts("archived_at"),
  },
  (table) => [
    check("memberships_role_check", sql`${table.role} in ('org_admin', 'responder', 'viewer')`),
    uniqueIndex("memberships_one_active_per_user").on(table.userId).where(sql`${table.archivedAt} is null`),
    // Target of the composite FK from membership_regions.
    unique("memberships_id_organization_id_key").on(table.id, table.organizationId),
    index("memberships_organization_id_idx").on(table.organizationId),
  ],
);

/**
 * The regions a membership may see. Both composite FKs share organization_id,
 * so a region from another organization cannot be assigned (enforced by the DB).
 */
export const membershipRegions = pgTable(
  "membership_regions",
  {
    membershipId: uuid("membership_id").notNull(),
    regionId: uuid("region_id").notNull(),
    organizationId: uuid("organization_id").notNull(),
  },
  (table) => [
    primaryKey({ name: "membership_regions_pkey", columns: [table.membershipId, table.regionId] }),
    foreignKey({
      name: "membership_regions_membership_fk",
      columns: [table.membershipId, table.organizationId],
      foreignColumns: [memberships.id, memberships.organizationId],
    }),
    foreignKey({
      name: "membership_regions_region_fk",
      columns: [table.regionId, table.organizationId],
      foreignColumns: [regions.id, regions.organizationId],
    }),
    index("membership_regions_region_id_idx").on(table.regionId),
  ],
);
