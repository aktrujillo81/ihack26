import { spawnSync } from "node:child_process";

import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { POST } from "@/app/api/auth/[...all]/route";
import { runSeed } from "@/db/seed/seed";
import { getSessionFromHeaders, signInWithPassword } from "@/lib/auth/adapter";
import { getDb } from "@/lib/db";
import { cookieHeaderFrom, freshIp, resetDb, signInRequest } from "./helpers";

async function counts() {
  const [row] = (await getDb().execute(sql`select
    (select count(*)::int from auth_user) as auth_users,
    (select count(*)::int from auth_account) as auth_accounts,
    (select count(*)::int from organizations) as organizations,
    (select count(*)::int from regions) as regions,
    (select count(*)::int from users) as users,
    (select count(*)::int from auth_session) as sessions`)) as unknown as Record<string, number>[];
  return row;
}

beforeAll(resetDb);

describe("npm run db:seed", () => {
  it("is idempotent: running twice gives the same row counts", async () => {
    await runSeed();
    const first = await counts();
    expect(first).toEqual({ auth_users: 3, auth_accounts: 3, organizations: 1, regions: 1, users: 3, sessions: 0 });
    // Every staff row points at its Better Auth user.
    const [link] = (await getDb().execute(
      sql`select count(*)::int as n from users u join auth_user a on a.id::text = u.auth_subject and a.email = u.email`,
    )) as unknown as { n: number }[];
    expect(link.n).toBe(3);
    await runSeed();
    expect(await counts()).toEqual(first);
  });

  it("every seeded role can sign in with its role and the demo region (Org Admin included)", async () => {
    const accounts = [
      ["admin@example.org", process.env.SEED_ADMIN_PASSWORD!, "org_admin"],
      ["responder@example.org", process.env.SEED_RESPONDER_PASSWORD!, "responder"],
      ["viewer@example.org", process.env.SEED_VIEWER_PASSWORD!, "viewer"],
    ] as const;
    for (const [email, password, role] of accounts) {
      const res = await POST(signInRequest(email, password, freshIp()));
      expect(res.status).toBe(200);
      const s = (await getSessionFromHeaders(new Headers({ cookie: cookieHeaderFrom(res) }))) as { role: string; regionIds: string[] };
      expect(s.role).toBe(role);
      expect(s.regionIds).toHaveLength(1);
    }
    expect(await signInWithPassword("admin@example.org", process.env.SEED_ADMIN_PASSWORD, new Headers({ "cf-connecting-ip": freshIp() }))).toBe("ok");
  });

  it("the CLI exits with an error on a short password and never prints it", () => {
    const shortPassword = "short-pw-xy";
    const result = spawnSync("npx", ["tsx", "--conditions=react-server", "db/seed/index.ts"], {
      encoding: "utf8",
      env: {
        ...process.env,
        SEED_ADMIN_PASSWORD: shortPassword,
        // Unreachable on purpose: the seed must exit before connecting.
        DATABASE_URL: "postgres://nobody:nothing@127.0.0.1:1/none",
      },
      timeout: 60_000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("SEED_ADMIN_PASSWORD must be set");
    expect(result.stdout + result.stderr).not.toContain(shortPassword);
  });
});
