import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { publicMapScope } from "@/lib/config/public-map";

/**
 * The public map is cut from the spec and must stay off until a human turns it
 * on. It is on only when BOTH settings have a value, so the repo must never ship
 * a value for either. These tests guard the files in the repo. They cannot see
 * the real server's `.env`, which is outside the repo.
 */
const NAMES = ["PUBLISHED_MAP_ORGANIZATION_ID", "PUBLISHED_MAP_REGION_IDS"] as const;

describe("the public map settings are unset in the repo", () => {
  it(".env.example lists both names with no value", () => {
    const lines = readFileSync(".env.example", "utf8").split(/\r?\n/);
    for (const name of NAMES) {
      const found = lines.filter((l) => l.startsWith(`${name}=`));
      expect(found, name).toHaveLength(1);
      expect(found[0].slice(name.length + 1).trim(), name).toBe("");
    }
  });

  it("no deployment or CI config in the repo sets either one", () => {
    for (const file of ["compose.yaml", ".github/workflows/ci.yml", "package.json", "next.config.ts"]) {
      const text = readFileSync(file, "utf8");
      for (const name of NAMES) expect(text, `${file} ${name}`).not.toContain(name);
    }
  });

  it("with the names present but empty, the public map is off", () => {
    expect(publicMapScope({ PUBLISHED_MAP_ORGANIZATION_ID: "", PUBLISHED_MAP_REGION_IDS: "" })).toBeNull();
  });
});
