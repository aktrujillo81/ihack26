import { hashPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { account, membershipRegions, memberships, organizations, regions, user } from "@/lib/db/schema";
import type { Role } from "@/lib/domain/types";

export const BASE = "http://127.0.0.1:6543";
export const PASSWORD = "correct horse battery staple";

/** Empties every table. Refuses to run anywhere but the test database. */
export async function resetDb() {
  const db = getDb();
  const [{ name }] = (await db.execute(sql`select current_database() as name`)) as unknown as { name: string }[];
  if (name !== "wellwatch_test") throw new Error("resetDb only runs against wellwatch_test");
  await db.execute(
    sql`truncate membership_regions, memberships, regions, organizations, session, account, verification, "user" cascade`,
  );
}

export async function createOrg(name = "Org A") {
  const db = getDb();
  const [org] = await db.insert(organizations).values({ name }).returning();
  const [region] = await db.insert(regions).values({ organizationId: org.id, name: `${name} region` }).returning();
  return { org, region };
}

let passwordHash: string | undefined;

export async function createUser(email: string, password = PASSWORD) {
  const db = getDb();
  const hash = password === PASSWORD ? (passwordHash ??= await hashPassword(PASSWORD)) : await hashPassword(password);
  const [u] = await db.insert(user).values({ name: "Test Staff", email, emailVerified: true }).returning();
  await db.insert(account).values({ userId: u.id, accountId: u.id, providerId: "credential", password: hash });
  return u;
}

export async function addMembership(userId: string, organizationId: string, role: Role, regionIds: string[]) {
  const db = getDb();
  const [m] = await db.insert(memberships).values({ userId, organizationId, role }).returning();
  for (const regionId of regionIds) {
    await db.insert(membershipRegions).values({ membershipId: m.id, regionId, organizationId });
  }
  return m;
}

/** A staff member with one active membership and one region. */
export async function createMember(email: string, role: Role = "responder") {
  const { org, region } = await createOrg(`Org for ${email}`);
  const u = await createUser(email);
  const m = await addMembership(u.id, org.id, role, [region.id]);
  return { org, region, user: u, membership: m };
}

let ipCounter = 1;
/** A fresh client IP per call, so rate-limit buckets never leak between tests. */
export function freshIp() {
  ipCounter += 1;
  return `203.0.113.${ipCounter % 250}`;
}

export function signInRequest(email: string, password: string, ip: string) {
  return new Request(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, "cf-connecting-ip": ip, "user-agent": "vitest" },
    body: JSON.stringify({ email, password }),
  });
}

/** Turns a response's Set-Cookie headers into a Cookie request header. */
export function cookieHeaderFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";", 1)[0])
    .filter((c) => !c.endsWith("="))
    .join("; ");
}
