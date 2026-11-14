import { hashPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { authAccount, authUser, organizations, regions, users } from "@/lib/db/schema";
import type { Role } from "@/lib/domain/types";

export const BASE = "http://127.0.0.1:3162";
export const PASSWORD = "correct horse battery staple";

/** Empties every table the auth tests use. Refuses to run anywhere but the test database. */
export async function resetDb() {
  const db = getDb();
  const [{ name }] = (await db.execute(sql`select current_database() as name`)) as unknown as { name: string }[];
  if (name !== "wellwatch_test") throw new Error("resetDb only runs against wellwatch_test");
  // TRUNCATE does not fire history_events' row-level append-only trigger. Test database only.
  await db.execute(
    sql`truncate auth_session, auth_account, auth_verification, auth_user, history_events, users, regions, organizations cascade`,
  );
}

let slugCounter = 0;
export async function createOrg(name = "Org A") {
  const db = getDb();
  const [org] = await db.insert(organizations).values({ name }).returning();
  slugCounter += 1;
  const [region] = await db
    .insert(regions)
    .values({ organizationId: org.id, name: `${name} region`, slug: `region-${slugCounter}` })
    .returning();
  return { org, region };
}

let passwordHash: string | undefined;

/** A Better Auth user with a credential account (login identity only, no access). */
export async function createAuthUser(email: string, password = PASSWORD) {
  const db = getDb();
  const hash = password === PASSWORD ? (passwordHash ??= await hashPassword(PASSWORD)) : await hashPassword(password);
  const [u] = await db.insert(authUser).values({ name: "Test Staff", email, emailVerified: true }).returning();
  await db.insert(authAccount).values({ userId: u.id, accountId: u.id, providerId: "credential", password: hash });
  return u;
}

/** The D1 staff row linked to a Better Auth user. */
export async function addStaff(authUserId: string, organizationId: string, regionId: string, role: Role, email: string) {
  const [row] = await getDb()
    .insert(users)
    .values({ organizationId, regionId, authSubject: authUserId, email, displayName: "Test Staff", role, active: true })
    .returning();
  return row;
}

/** A staff member: organization, region, Better Auth user and D1 users row. */
export async function createMember(email: string, role: Role = "responder") {
  const { org, region } = await createOrg(`Org for ${email}`);
  const au = await createAuthUser(email);
  const staff = await addStaff(au.id, org.id, region.id, role, email);
  return { org, region, authUser: au, staff };
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
