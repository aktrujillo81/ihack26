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
};
