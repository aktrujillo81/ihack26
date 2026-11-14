import { describe, expect, it } from "vitest";

import { resolveTestDbTarget } from "../integration/test-db-target";

// Placeholder credentials; nothing here connects anywhere.
const PROD = "postgres://u:p@127.0.0.1:5433/wellwatch";
const DEV = "postgres://u:p@127.0.0.1:5434/wellwatch";

describe("integration test database guard", () => {
  it("refuses the production database (5433), e.g. when .env.local is missing and .env wins", () => {
    expect(() => resolveTestDbTarget({ databaseUrl: PROD })).toThrow(/Refusing to run integration tests/);
  });

  it("refuses when nothing is configured, or the URL is malformed", () => {
    expect(() => resolveTestDbTarget({})).toThrow(/need DATABASE_URL/);
    expect(() => resolveTestDbTarget({ databaseUrl: "not a url" })).toThrow(/not a valid URL/);
    expect(() => resolveTestDbTarget({ databaseUrl: "postgres://u:p@127.0.0.1/wellwatch" })).toThrow(/Refusing/);
  });

  it("uses wellwatch_test on the db:local server (5434)", () => {
    expect(resolveTestDbTarget({ databaseUrl: DEV })).toEqual({
      testUrl: "postgres://u:p@127.0.0.1:5434/wellwatch_test",
      adminUrl: "postgres://u:p@127.0.0.1:5434/postgres",
    });
  });

  it("prefers an explicit TEST_DATABASE_URL from the shell, even over a production DATABASE_URL", () => {
    const t = resolveTestDbTarget({
      shellTestDatabaseUrl: "postgres://u:p@127.0.0.1:6000/wellwatch_test",
      databaseUrl: PROD,
    });
    expect(t.testUrl).toBe("postgres://u:p@127.0.0.1:6000/wellwatch_test");
    expect(t.adminUrl).toBe("postgres://u:p@127.0.0.1:6000/postgres");
  });

  it("refuses a TEST_DATABASE_URL that names any database other than wellwatch_test", () => {
    expect(() => resolveTestDbTarget({ shellTestDatabaseUrl: "postgres://u:p@127.0.0.1:5433/wellwatch" })).toThrow(
      /must name the database "wellwatch_test"/,
    );
  });
});
