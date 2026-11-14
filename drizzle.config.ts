import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js, so load env files ourselves (Node 20.12+),
// with the same precedence as Next.js: shell env, then .env.local, then .env.
// loadEnvFile never overwrites a variable that is already set.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // File missing: fine.
  }
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
