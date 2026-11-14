/**
 * Guards (red lines 3 and 16, spec section 5 rule 4):
 * 1. The lint rule against hardcoded user-facing strings really fires.
 * 2. No phone numbers or email addresses in source, mocks, tests, or samples.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const root = process.cwd();

// Starting a full ESLint instance can take over the 5 second default when the machine is busy.
describe("lint guard: no hardcoded user-facing strings", { timeout: 30_000 }, () => {
  const eslint = new ESLint({ cwd: root });

  async function messages(code: string, filePath: string) {
    const [result] = await eslint.lintText(code, { filePath: join(root, filePath) });
    return result.messages.filter((m) => m.ruleId === "no-restricted-syntax");
  }

  it("flags literal text, literal expressions, and literal attributes in components", async () => {
    const code = [
      'export function Bad() {',
      "  return (",
      '    <main title="Hello" aria-label="Open">',
      "      <p>Some wording</p>",
      '      <p>{"More wording"}</p>',
      "    </main>",
      "  );",
      "}",
    ].join("\n");
    expect(await messages(code, "components/Bad.tsx")).toHaveLength(4);
  });

  it("allows t() calls, expressions, and non-text attributes", async () => {
    const code = [
      'import { t } from "@/lib/i18n/strings";',
      "export function Good({ n }: { n: number }) {",
      '  return (',
      '    <main lang="en" className="container" title={t("common.loading")}>',
      '      <p>{t("list.showing", { n, total: n })}</p>',
      "    </main>",
      "  );",
      "}",
    ].join("\n");
    expect(await messages(code, "components/Good.tsx")).toHaveLength(0);
  });

  it("does not apply outside components and app", async () => {
    expect(await messages('export const x = <p>text</p>;', "lib/other.tsx")).toHaveLength(0);
  });
});

describe("pattern guard: no phone numbers or emails", () => {
  const SCAN_DIRS = ["app", "components", "lib", "tests", "scripts", "db", join("docs", "samples")];
  const EXTENSIONS = /\.(ts|tsx|js|mjs|json|md|sql|csv|txt)$/;
  const SKIP_DIRS = new Set(["node_modules", ".next", "raw"]);
  const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
  // +country-code numbers, or groups of 3-3-4 / 3-4 digits separated by space, dot or dash.
  const PHONE = /(?<![\d.])(\+\d[\d\s().-]{7,}\d|\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})(?![\d.])/;
  // Placeholder domains reserved for examples are allowed.
  const ALLOWED_EMAIL = /@(example\.(com|org|net)|users\.noreply\.github\.com)$/i;

  function files(dir: string): string[] {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return [];
    }
    return entries.flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return SKIP_DIRS.has(name) ? [] : files(full);
      return EXTENSIONS.test(name) ? [full] : [];
    });
  }

  /** Dates, timestamps and UUIDs contain digit runs that look like phone numbers. */
  function stripNonPhone(text: string): string {
    return text
      .replace(/\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?/g, "")
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "");
  }

  function findings(text: string): string[] {
    const found: string[] = [];
    for (const line of text.split("\n")) {
      const email = line.match(EMAIL);
      if (email && !ALLOWED_EMAIL.test(email[0])) found.push(`email: ${email[0]}`);
      const phone = stripNonPhone(line).match(PHONE);
      if (phone) found.push(`phone: ${phone[0]}`);
    }
    return found;
  }

  it("detects phone numbers and emails (sanity check of the patterns)", () => {
    // Built at runtime so this file itself holds no phone-like or email-like literal.
    expect(findings(`call ${["+254", "712", "345", "678"].join(" ")}`)).not.toHaveLength(0);
    expect(findings(`call ${["555", "123", "4567"].join("-")}`)).not.toHaveLength(0);
    expect(findings(`mail ${["someone", "gmail.com"].join("@")}`)).not.toHaveLength(0);
    expect(findings('import x from "@/lib/x"; "2026-11-13T14:30:00Z"; -1.2921, 36.8219')).toHaveLength(0);
    expect(findings(`mail ${["support", "example.org"].join("@")}`)).toHaveLength(0);
  });

  it("finds none in source, mocks, tests, scripts, db and sanitized samples", () => {
    const problems = SCAN_DIRS.flatMap((dir) => files(join(root, dir))).flatMap((file) =>
      findings(readFileSync(file, "utf8")).map((f) => `${relative(root, file).split(sep).join("/")}: ${f}`),
    );
    expect(problems).toEqual([]);
  });
});
