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
    (select count(*)::int from "user") as users,
    (select count(*)::int from account) as accounts,
    (select count(*)::int from organizations) as organizations,
    (select count(*)::int from regions) as regions,
    (select count(*)::int from memberships) as memberships,
    (select count(*)::int from membership_regions) as membership_regions,
    (select count(*)::int from session) as sessions`)) as unknown as Record<string, number>[];
  return row;
}

beforeAll(resetDb);

describe("npm run db:seed", () => {
  it("is idempotent: running twice gives the same row counts", async () => {
    await runSeed();
    const first = await counts();
    expect(first).toEqual({
      users: 3,
      accounts: 3,
      organizations: 1,
      regions: 1,
      memberships: 3,
      membership_regions: 3,
      sessions: 0,
    });
    await runSeed();
    expect(await counts()).toEqual(first);
  });

  it("every seeded role can sign in, and the Org Admin has an explicit region row", async () => {
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
