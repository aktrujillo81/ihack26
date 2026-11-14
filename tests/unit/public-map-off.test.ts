import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { publicMapScope } from "@/lib/config/public-map";

/**
 * The public map is cut from the spec and must stay off until a human turns it
 * on. It is on only when BOTH settings have a value, so the repo must never ship
 * a value for either. These tests guard the files in the repo. They CANNOT see
 * the real server's `.env`, `.env.local` or any host environment, which are
 * outside the repo: a human must check those before the demo.
 */
const NAMES = ["PUBLISHED_MAP_ORGANIZATION_ID", "PUBLISHED_MAP_REGION_IDS"] as const;

/** Any config-like file in the repo that could carry a deployment value. */
function configFiles(): string[] {
  const fixed = ["compose.yaml", "compose.yml", "docker-compose.yml", "Dockerfile", "vercel.json", "package.json", "next.config.ts", ".env.example"];
  const workflows = existsSync(".github/workflows") ? readdirSync(".github/workflows").map((f) => join(".github/workflows", f)) : [];
  return [...fixed, ...workflows].filter((f) => existsSync(f));
}

/** A line that assigns a non-empty value: `NAME=x`, `export NAME=x`, `NAME: x`, with or without indentation or quotes. */
const assignsValue = (text: string, name: string): boolean =>
  new RegExp(`^[ \\t]*(?:export[ \\t]+)?["']?${name}["']?[ \\t]*[=:][ \\t]*["']?[^\\s"'#]`, "m").test(text);

describe("the public map settings are unset in the repo", () => {
  it(".env.example lists both names exactly once, with no value", () => {
    const lines = readFileSync(".env.example", "utf8").split(/\r?\n/);
    for (const name of NAMES) {
      const found = lines.filter((l) => l.startsWith(`${name}=`));
      expect(found, name).toHaveLength(1);
      expect(found[0].slice(name.length + 1).trim(), name).toBe("");
    }
  });

  it("no config, deployment or CI file in the repo assigns a value to either name", () => {
    const files = configFiles();
    expect(files).toContain(".env.example");
    expect(files).toContain("compose.yaml");
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const name of NAMES) expect(assignsValue(text, name), `${file} sets ${name}`).toBe(false);
    }
  });

  it("the check itself catches the ways a value could be written", () => {
    for (const bad of ["PUBLISHED_MAP_REGION_IDS=abc", "  export PUBLISHED_MAP_REGION_IDS=abc", "PUBLISHED_MAP_REGION_IDS: abc", '      PUBLISHED_MAP_REGION_IDS: "abc"', "PUBLISHED_MAP_REGION_IDS='abc'"]) {
      expect(assignsValue(bad, "PUBLISHED_MAP_REGION_IDS"), bad).toBe(true);
    }
    for (const fine of ["PUBLISHED_MAP_REGION_IDS=", "PUBLISHED_MAP_REGION_IDS=   ", "# PUBLISHED_MAP_REGION_IDS=abc", "OTHER=abc"]) {
      expect(assignsValue(fine, "PUBLISHED_MAP_REGION_IDS"), fine).toBe(false);
    }
  });

  it("with the names present but empty, or only one set, the public map is off", () => {
    expect(publicMapScope({ PUBLISHED_MAP_ORGANIZATION_ID: "", PUBLISHED_MAP_REGION_IDS: "" })).toBeNull();
    expect(publicMapScope({ PUBLISHED_MAP_ORGANIZATION_ID: "org-demo", PUBLISHED_MAP_REGION_IDS: "" })).toBeNull();
    expect(publicMapScope({ PUBLISHED_MAP_ORGANIZATION_ID: "", PUBLISHED_MAP_REGION_IDS: "region-demo" })).toBeNull();
  });
});
