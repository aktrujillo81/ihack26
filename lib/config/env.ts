import "server-only";

/**
 * Server-only environment variables. Never import this from browser code.
 * Names are listed in `.env.example`; values live in `.env` / `.env.local`.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const serverEnv = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  /** Shared secret Vapi sends with each server request. Optional: when unset, Vapi routes refuse every request. */
  get vapiWebhookSecret(): string | undefined {
    return process.env.VAPI_WEBHOOK_SECRET || undefined;
  },
  /** Signs session cookies. At least 32 characters. */
  get betterAuthSecret() {
    const value = required("BETTER_AUTH_SECRET");
    if (value.length < 32) throw new Error("BETTER_AUTH_SECRET must be at least 32 characters");
    return value;
  },
  /** The public origin, e.g. https://bg.verilen.com (or http://127.0.0.1:6543 locally). */
  get betterAuthUrl() {
    const value = required("BETTER_AUTH_URL");
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error("BETTER_AUTH_URL must be an absolute URL");
    }
    return url.origin;
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get isDevelopment() {
    return process.env.NODE_ENV === "development";
  },
};

/** Seed passwords (npm run db:seed only). Undefined when unset; the seed decides what to do. */
export const seedEnv = {
  get adminPassword() {
    return process.env.SEED_ADMIN_PASSWORD;
  },
  get responderPassword() {
    return process.env.SEED_RESPONDER_PASSWORD;
  },
  get viewerPassword() {
    return process.env.SEED_VIEWER_PASSWORD;
  },
};
