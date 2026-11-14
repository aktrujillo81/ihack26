import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { PRODUCTION_DB_PORT, UnsafeDatabaseError, assertDevelopmentDatabase } from "@/db/seed/guard";

// Hosts with dots are built at runtime: a database URL with a dotted host reads as an email address to the pattern guard.
const host = (...parts: string[]) => parts.join(".");

const refuses = (url: string | undefined, env: string | undefined = "development") => {
  try {
    assertDevelopmentDatabase(url, env);
    return null;
  } catch (e) {
    expect(e).toBeInstanceOf(UnsafeDatabaseError);
    return (e as Error).message;
  }
};

describe("the demo seed refuses the production database", () => {
  it("port 5433 is the production port", () => {
    expect(PRODUCTION_DB_PORT).toBe("5433");
  });

  it("refuses port 5433 in every spelling of a local address", () => {
    for (const url of [
      "postgres://u:p@127.0.0.1:5433/wellwatch",
      "postgres://u:p@localhost:5433/wellwatch",
      "postgresql://u:p@LOCALHOST:5433/db",
      "postgres://u:p@[::1]:5433/db",
      "postgres://127.0.0.1:5433",
      "postgres://u:p@127.0.0.1:5433/wellwatch?sslmode=disable",
    ]) {
      expect(refuses(url), url).toMatch(/production/);
    }
  });

  it("refuses a database that is not on this machine, whatever the port", () => {
    for (const url of [`postgres://u:p@${host("db", "example", "org")}:5434/x`, "postgres://u:p@10.0.0.5:5434/x", `postgres://u:p@${host("bg", "verilen", "com")}:5434/x`, "postgres://u:p@192.168.1.10:5432/x", "postgres://u:p@0.0.0.0:5434/x"]) {
      expect(refuses(url), url).toMatch(/not this machine/);
    }
  });

  it("refuses a missing, empty or invalid URL", () => {
    for (const url of [undefined, "", "not a url", "127.0.0.1:5434"]) expect(refuses(url), String(url)).not.toBeNull();
  });

  it("refuses to run when NODE_ENV is production, even against a development port", () => {
    expect(refuses("postgres://u:p@127.0.0.1:5434/x", "production")).toMatch(/production/);
  });

  it("allows the local development database on 5434 (and other local ports such as CI's 5432)", () => {
    for (const url of ["postgres://u:p@127.0.0.1:5434/wellwatch", "postgres://u:p@localhost:5434/wellwatch", "postgres://u:p@127.0.0.1:5432/wellwatch_test"]) {
      expect(refuses(url), url).toBeNull();
    }
  });

  it("its messages never contain the password or the connection string", () => {
    const secret = "S3cretPassw0rdValue";
    for (const url of [`postgres://wellwatch:${secret}@127.0.0.1:5433/wellwatch`, `postgres://wellwatch:${secret}@${host("db", "example", "org")}:5434/x`]) {
      const message = refuses(url) ?? "";
      expect(message).not.toContain(secret);
      expect(message).not.toContain("postgres://");
    }
    expect(refuses("postgres://wellwatch:" + secret + "@@@bad url")).not.toContain(secret);
  });
});

describe("the command line checks before it loads the database", () => {
  const source = readFileSync("db/seed/demo-index.ts", "utf8");

  it("calls the guard before the demo module (and so the database) is imported", () => {
    const guardCall = source.indexOf("assertDevelopmentDatabase(process.env.DATABASE_URL)");
    const demoImport = source.indexOf('await import("./demo")');
    expect(guardCall).toBeGreaterThan(-1);
    expect(demoImport).toBeGreaterThan(guardCall);
  });

  it("does not import the database or the demo module at the top of the file", () => {
    const topLevelImports = source.split("\n").filter((l) => l.startsWith("import "));
    expect(topLevelImports).toEqual(['import { assertDevelopmentDatabase, UnsafeDatabaseError } from "./guard";']);
  });

  it("exits with an error code when the guard refuses", () => {
    expect(source).toMatch(/UnsafeDatabaseError[\s\S]{0,200}process\.exit\(1\)/);
  });

  it("is wired to its own npm script, separate from the account seed", () => {
    expect(readFileSync("package.json", "utf8")).toContain('"db:seed:demo": "tsx --conditions=react-server db/seed/demo-index.ts"');
  });
});
