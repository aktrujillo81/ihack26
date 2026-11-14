import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js, so load env files ourselves with the same
// precedence as Next.js: shell env, then .env.local, then .env.
//
// Catch: drizzle-kit's CLI runs dotenv on `.env` BEFORE this file loads, so a
// value from `.env` already looks "set" and would beat `.env.local` (this sent
// a migration to the wrong database once; see docs/ai-mistakes.md). So:
// a variable counts as coming from the shell only if it is in the process's
// original environment (/proc/self/environ on Linux, which dotenv cannot
// change). Where that is unreadable (macOS, Windows), a value equal to the one
// in `.env` is treated as dotenv's and `.env.local` overrides it.
function readEnvFile(file: string): Record<string, string> {
  try {
    return parseEnv(readFileSync(file, "utf8")) as Record<string, string>;
  } catch {
    return {}; // File missing: fine.
  }
}

function originalEnvNames(): Set<string> | null {
  try {
    const raw = readFileSync("/proc/self/environ", "utf8");
    return new Set(raw.split("\0").filter(Boolean).map((kv) => kv.slice(0, kv.indexOf("="))));
  } catch {
    return null;
  }
}

const fromShell = originalEnvNames();
const dotEnv = readEnvFile(".env");
const dotEnvLocal = readEnvFile(".env.local");
for (const [name, value] of Object.entries(dotEnvLocal)) {
  const current = process.env[name];
  const setByShell = fromShell ? fromShell.has(name) : current !== undefined && current !== dotEnv[name];
  if (!setByShell) process.env[name] = value;
}
for (const [name, value] of Object.entries(dotEnv)) {
  process.env[name] ??= value;
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./db/migrations",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
