import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/** Red line 16: the database URL and auth secret are server-only, never in browser code. */
const ROOT = path.resolve(__dirname, "../..");
const SKIP = new Set(["node_modules", ".next", ".git", ".pgdata", "tests", "docs"]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

const files = sourceFiles(ROOT);
const read = (f: string) => readFileSync(f, "utf8");
const isClient = (src: string) => /^\s*["']use client["']/m.test(src);

describe("secrets boundary", () => {
  it("no client component mentions BETTER_AUTH_SECRET, DATABASE_URL, the env module, the db or the auth server", () => {
    const offenders = files.filter((f) => {
      const src = read(f);
      return (
        isClient(src) &&
        /BETTER_AUTH_SECRET|DATABASE_URL|SEED_[A-Z_]*PASSWORD|lib\/config\/env|lib\/db|lib\/auth\/(server|adapter|memberships)/.test(src)
      );
    });
    expect(offenders).toEqual([]);
  });

  it("modules that hold secrets or the database are marked server-only", () => {
    for (const rel of ["lib/config/env.ts", "lib/db/index.ts", "lib/auth/server.ts", "lib/auth/adapter.ts", "lib/auth/memberships.ts"]) {
      expect(read(path.join(ROOT, rel)), rel).toMatch(/^import "server-only";/m);
    }
  });

  it("secrets are read only in lib/config/env.ts (plus env-file loaders for CLI tools)", () => {
    const allowed = new Set(["lib/config/env.ts", "drizzle.config.ts", "scripts/db-local.mjs"]);
    const offenders = files
      .map((f) => path.relative(ROOT, f))
      .filter((rel) => !allowed.has(rel) && /process\.env\.(BETTER_AUTH_SECRET|DATABASE_URL|SEED_)/.test(read(path.join(ROOT, rel))));
    expect(offenders).toEqual([]);
  });
});
