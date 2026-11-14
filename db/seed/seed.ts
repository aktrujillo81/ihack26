import "server-only";

import { hashPassword } from "better-auth/crypto";
import { and, eq, isNull, sql } from "drizzle-orm";

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/config/auth";
import { seedEnv } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { authAccount, authUser, organizations, regions, users } from "@/lib/db/schema";
import { SEED_ACCOUNTS, SEED_ORGANIZATION, SEED_REGION, type SeedAccount } from "./data";

export class SeedConfigError extends Error {}

/** Reads the three seed passwords. Throws naming the variable (never the value) if one is missing or too short. */
export function readSeedPasswords(): Record<SeedAccount["passwordEnv"], string> {
  const values = {
    SEED_ADMIN_PASSWORD: seedEnv.adminPassword,
    SEED_RESPONDER_PASSWORD: seedEnv.responderPassword,
    SEED_VIEWER_PASSWORD: seedEnv.viewerPassword,
  };
  for (const [name, value] of Object.entries(values)) {
    if (!value || value.length < MIN_PASSWORD_LENGTH || value.length > MAX_PASSWORD_LENGTH) {
      throw new SeedConfigError(
        `${name} must be set and between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`,
      );
    }
  }
  return values as Record<SeedAccount["passwordEnv"], string>;
}

/**
 * Creates the demo organization and region (D1 tables), then per role a Better
 * Auth user with a credential account, and a D1 `users` row whose auth_subject
 * is that Better Auth user id. Idempotent: existing rows are reused, an
 * existing `users` row (role, active, region) is never changed, and re-running
 * updates the stored password hashes to the current environment values. Never
 * calls sign-up.
 */
export async function runSeed(passwords = readSeedPasswords()): Promise<void> {
  const hashes = new Map<string, string>();
  for (const a of SEED_ACCOUNTS) hashes.set(a.email, await hashPassword(passwords[a.passwordEnv]));

  await getDb().transaction(async (tx) => {
    // One seed at a time.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('wellwatch_seed'))`);

    let [org] = await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(and(eq(organizations.name, SEED_ORGANIZATION.name), isNull(organizations.archivedAt)))
      .limit(1);
    org ??= (await tx.insert(organizations).values({ name: SEED_ORGANIZATION.name }).returning({ id: organizations.id }))[0];

    await tx
      .insert(regions)
      .values({ organizationId: org.id, name: SEED_REGION.name, slug: SEED_REGION.slug })
      .onConflictDoNothing({ target: [regions.organizationId, regions.slug] });
    const [region] = await tx
      .select({ id: regions.id })
      .from(regions)
      .where(and(eq(regions.organizationId, org.id), eq(regions.slug, SEED_REGION.slug)));

    for (const a of SEED_ACCOUNTS) {
      const email = a.email.toLowerCase();
      await tx
        .insert(authUser)
        .values({ name: a.name, email, emailVerified: true })
        .onConflictDoNothing({ target: authUser.email });
      const [u] = await tx.select({ id: authUser.id }).from(authUser).where(eq(authUser.email, email));

      const passwordHash = hashes.get(a.email)!;
      const [cred] = await tx
        .select({ id: authAccount.id })
        .from(authAccount)
        .where(and(eq(authAccount.userId, u.id), eq(authAccount.providerId, "credential")));
      if (cred) {
        await tx.update(authAccount).set({ password: passwordHash }).where(eq(authAccount.id, cred.id));
      } else {
        // Same shape Better Auth's sign-up writes: providerId "credential", accountId = user id.
        await tx
          .insert(authAccount)
          .values({ userId: u.id, accountId: u.id, providerId: "credential", password: passwordHash });
      }

      // The D1 staff row. auth_subject is unique, so an existing row is kept as it is.
      await tx
        .insert(users)
        .values({
          organizationId: org.id,
          regionId: region.id,
          authSubject: u.id,
          email,
          displayName: a.name,
          role: a.role,
          active: true,
        })
        .onConflictDoNothing({ target: users.authSubject });
    }
  });
}
