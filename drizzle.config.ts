import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js, so load .env ourselves (Node 20.12+).
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on variables already set in the environment.
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
