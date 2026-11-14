import "server-only";

import { hashPassword } from "better-auth/crypto";
import { and, eq, isNull, sql } from "drizzle-orm";

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/config/auth";
import { seedEnv } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { account, membershipRegions, memberships, organizations, regions, user } from "@/lib/db/schema";
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
 * Creates the demo organization, region and one account per role. Idempotent:
 * existing rows are reused, and an existing active membership is never changed
 * (only a missing one is added). Re-running updates the stored password hashes
 * to the current environment values. Never calls sign-up.
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
      .values({ organizationId: org.id, name: SEED_REGION.name })
      .onConflictDoNothing({ target: [regions.organizationId, regions.name] });
    const [region] = await tx
      .select({ id: regions.id })
      .from(regions)
      .where(and(eq(regions.organizationId, org.id), eq(regions.name, SEED_REGION.name)));

    for (const a of SEED_ACCOUNTS) {
      const email = a.email.toLowerCase();
      await tx.insert(user).values({ name: a.name, email, emailVerified: true }).onConflictDoNothing({ target: user.email });
      const [u] = await tx.select({ id: user.id }).from(user).where(eq(user.email, email));

      const passwordHash = hashes.get(a.email)!;
      const [cred] = await tx
        .select({ id: account.id })
        .from(account)
        .where(and(eq(account.userId, u.id), eq(account.providerId, "credential")));
      if (cred) {
        await tx.update(account).set({ password: passwordHash }).where(eq(account.id, cred.id));
      } else {
        // Same shape Better Auth's sign-up writes: providerId "credential", accountId = user id.
        await tx.insert(account).values({ userId: u.id, accountId: u.id, providerId: "credential", password: passwordHash });
      }

      let [membership] = await tx
        .select({ id: memberships.id, organizationId: memberships.organizationId })
        .from(memberships)
        .where(and(eq(memberships.userId, u.id), isNull(memberships.archivedAt)));
      membership ??= (
        await tx
          .insert(memberships)
          .values({ userId: u.id, organizationId: org.id, role: a.role })
          .returning({ id: memberships.id, organizationId: memberships.organizationId })
      )[0];
      if (membership.organizationId !== org.id) continue;

      await tx
        .insert(membershipRegions)
        .values({ membershipId: membership.id, regionId: region.id, organizationId: org.id })
        .onConflictDoNothing();
    }
  });
}
