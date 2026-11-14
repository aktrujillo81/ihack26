import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DEV_DB_PORT, PRODUCTION_DB_PORT, UnsafeDatabaseError, assertDevelopmentDatabase, type GuardOptions } from "@/db/seed/guard";

// Hosts with dots are built at runtime: a database URL with a dotted host reads as an email address to the pattern guard.
const host = (...parts: string[]) => parts.join(".");

/** Returns the refusal message, or null if the URL was accepted. Uses an empty environment unless told otherwise. */
const refuses = (url: string | undefined, options: GuardOptions = {}): string | null => {
  try {
    assertDevelopmentDatabase(url, { env: {}, nodeEnv: "development", ...options });
    return null;
  } catch (e) {
    expect(e).toBeInstanceOf(UnsafeDatabaseError);
    return (e as Error).message;
  }
};

const DEV = "postgres://wellwatch:pw@127.0.0.1:5434/wellwatch";

describe("the demo seed accepts only the plain development database (an allowlist)", () => {
  it("the ports", () => {
    expect(PRODUCTION_DB_PORT).toBe("5433");
    expect(DEV_DB_PORT).toBe("5434");
  });

  it("accepts the db:local database on 5434, on every local spelling", () => {
    for (const url of [DEV, "postgres://u:p@localhost:5434/x", "postgresql://u:p@LOCALHOST:5434/x", "postgres://u:p@[::1]:5434/x", "postgres://u:p@127.0.0.1:5434"]) {
      expect(refuses(url), url).toBeNull();
    }
  });

  it("refuses port 5433 in every spelling", () => {
    for (const url of ["postgres://u:p@127.0.0.1:5433/wellwatch", "postgres://u:p@localhost:5433/x", "postgresql://u:p@LOCALHOST:5433/db", "postgres://u:p@[::1]:5433/db", "postgres://x:y@127.0.0.1:5433"]) {
      expect(refuses(url), url).toMatch(/production/);
    }
  });

  it("refuses every other port by default, including 5432 and ports a tunnel to production might use", () => {
    for (const port of ["5432", "5435", "5436", "15433", "6543", "1", "65535"]) {
      expect(refuses(`postgres://u:p@127.0.0.1:${port}/x`), port).toMatch(/not allowed/);
    }
  });

  it("refuses a URL with no port, because the driver would fill in 5432 or PGPORT", () => {
    for (const url of ["postgres://u:p@127.0.0.1/x", "postgres://u:p@localhost/x", "postgres://u:p@localhost"]) {
      expect(refuses(url), url).toMatch(/no port/);
    }
  });

  it("refuses a host that is not this machine, whatever the port", () => {
    for (const url of [
      `postgres://u:p@${host("db", "example", "org")}:5434/x`,
      "postgres://u:p@10.0.0.5:5434/x",
      `postgres://u:p@${host("bg", "verilen", "com")}:5434/x`,
      "postgres://u:p@192.168.1.10:5434/x",
      "postgres://u:p@0.0.0.0:5434/x",
      "postgres://u:p@127.0.0.2:5434/x",
      "postgres://u:p@localhost.:5434/x", // trailing dot
      "postgres://u:p@[::ffff:10.0.0.5]:5434/x",
    ]) {
      expect(refuses(url), url).not.toBeNull();
    }
  });
});

describe("the bypasses the review found are closed", () => {
  it("a query string can not override the host or the port (the driver honors ?port= and ?host=)", () => {
    for (const url of [
      `${DEV}?port=5433`,
      `${DEV}?host=${host("db", "example", "org")}`,
      `${DEV}?host=/var/run/postgresql`,
      `${DEV}?hostaddr=10.0.0.5`,
      `${DEV}?options=-c%20search_path%3Dx`,
      `${DEV}?sslmode=disable`,
      `${DEV}?`,
      "postgres://u:p@127.0.0.1:5434?port=5433",
    ]) {
      expect(refuses(url), url).toMatch(/query string|fragment|unusual/);
    }
  });

  it("a fragment can not hide a second address (the driver and the URL parser read '#' differently)", () => {
    for (const url of ["postgres://u:p@127.0.0.1:5434#@prod-host:5433/db", "postgres://u:p@127.0.0.1:5434/x#y", "postgres://u:p@127.0.0.1:5434/#"]) {
      expect(refuses(url), url).toMatch(/query string|fragment|unusual/);
    }
  });

  it("odd characters and more than one at-sign are refused", () => {
    const bs = String.fromCharCode(92);
    for (const url of [
      `postgres://u:p@127.0.0.1:5434/x${bs}y`,
      "postgres://u:p@127.0.0.1:5434/x y",
      "postgres://u:p@127.0.0.1:5434/x\n",
      "postgres://u:p@h@127.0.0.1:5434/x",
      "postgres://u:p@@127.0.0.1:5434/x",
      "postgres://u:p@127.0.0.1:5434,prod-host:5433/x", // a comma lists several hosts for the driver
    ]) {
      expect(refuses(url), JSON.stringify(url)).not.toBeNull();
    }
  });

  it("the driver's own environment variables are refused (it would use them instead of the URL)", () => {
    for (const name of ["PGHOST", "PGHOSTADDR", "PGPORT", "PGSERVICE", "PGSERVICEFILE"]) {
      expect(refuses(DEV, { env: { [name]: "5433" } }), name).toMatch(new RegExp(name));
    }
    expect(refuses(DEV, { env: { PGPORT: "" } })).toBeNull(); // set but empty: the driver ignores it
  });

  it("NODE_ENV=production is refused even for a perfect URL", () => {
    expect(refuses(DEV, { nodeEnv: "production" })).toMatch(/production/);
  });

  it("the production port can never be put on the allowlist", () => {
    expect(refuses(DEV, { allowedPorts: ["5434", "5433"] })).toMatch(/can never be allowed/);
    expect(refuses("postgres://u:p@127.0.0.1:5433/x", { allowedPorts: ["5433"] })).toMatch(/can never be allowed/);
  });

  it("an allowlist can add a local port (the tests use this for CI's database) but nothing else changes", () => {
    expect(refuses("postgres://u:p@127.0.0.1:5432/x", { allowedPorts: ["5434", "5432"] })).toBeNull();
    expect(refuses("postgres://u:p@127.0.0.1:5432/x?port=5433", { allowedPorts: ["5434", "5432"] })).not.toBeNull();
  });

  it("refuses a missing, empty, invalid or non-postgres URL", () => {
    for (const url of [undefined, "", "not a url", "127.0.0.1:5434", "http://127.0.0.1:5434/x", "mysql://u:p@127.0.0.1:5434/x"]) {
      expect(refuses(url), String(url)).not.toBeNull();
    }
  });

  it("its messages never contain the password or the connection string", () => {
    const secret = "S3cretPassw0rdValue";
    for (const url of [
      `postgres://wellwatch:${secret}@127.0.0.1:5433/wellwatch`,
      `postgres://wellwatch:${secret}@${host("db", "example", "org")}:5434/x`,
      `postgres://wellwatch:${secret}@127.0.0.1:5434/x?port=5433`,
      `postgres://wellwatch:${secret}@127.0.0.1/x`,
      `postgres://wellwatch:${secret}@127.0.0.1:5432/x`,
      `postgres://wellwatch:${secret}@@127.0.0.1:5434/x`,
    ]) {
      const message = refuses(url) ?? "";
      expect(message, url).not.toContain(secret);
      expect(message, url).not.toContain("postgres://");
    }
  });
});

describe("the real command refuses, in a real process, before it connects to anything", () => {
  const run = (databaseUrl: string, extraEnv: Record<string, string> = {}) =>
    spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--conditions=react-server", "db/seed/demo-index.ts"], {
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "development", PGHOST: "", PGPORT: "", PGHOSTADDR: "", ...extraEnv },
    });

  it("port 5433, a query-string override, a remote host, and PGPORT all exit with code 1 and a refusal", () => {
    const secret = "S3cretPassw0rdValue";
    const cases: [string, string, Record<string, string>?][] = [
      ["port 5433", `postgres://wellwatch:${secret}@127.0.0.1:5433/wellwatch`],
      ["query override", `postgres://wellwatch:${secret}@127.0.0.1:5434/wellwatch?port=5433`],
      ["remote host", `postgres://wellwatch:${secret}@${host("db", "example", "org")}:5434/wellwatch`],
      ["PGPORT set", `postgres://wellwatch:${secret}@127.0.0.1:5434/wellwatch`, { PGPORT: "5433" }],
    ];
    for (const [name, url, extra] of cases) {
      const result = run(url, extra);
      expect(result.status, name).toBe(1);
      expect(result.stderr, name).toContain("Refusing to seed");
      expect(result.stdout + result.stderr, name).not.toContain(secret);
      expect(result.stdout + result.stderr, name).not.toContain("postgres://");
    }
  }, 120_000);
});

describe("the command line and the seed both check, and neither can be skipped by importing the other", () => {
  const index = readFileSync("db/seed/demo-index.ts", "utf8");
  const demo = readFileSync("db/seed/demo.ts", "utf8");

  it("the command line calls the guard before the demo module (and so the database) is imported", () => {
    const guardCall = index.indexOf("assertDevelopmentDatabase(process.env.DATABASE_URL)");
    const demoImport = index.indexOf('await import("./demo")');
    expect(guardCall).toBeGreaterThan(-1);
    expect(demoImport).toBeGreaterThan(guardCall);
    expect(index.split(/\r?\n/).filter((l) => l.startsWith("import "))).toEqual(['import { assertDevelopmentDatabase, UnsafeDatabaseError } from "./guard";']);
  });

  it("runDemoSeed checks the same DATABASE_URL itself, before it touches the database", () => {
    const check = demo.indexOf("assertDevelopmentDatabase(process.env.DATABASE_URL");
    const firstDb = demo.indexOf("getDb()");
    expect(check).toBeGreaterThan(-1);
    expect(firstDb).toBeGreaterThan(check);
  });

  it("is wired to its own npm script, separate from the account seed", () => {
    expect(readFileSync("package.json", "utf8")).toContain('"db:seed:demo": "tsx --conditions=react-server db/seed/demo-index.ts"');
  });
});
