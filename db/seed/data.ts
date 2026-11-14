/**
 * Demo data for `npm run db:seed` (AC-4: one account per role). Staff demo
 * accounts only; no caller data. Passwords come from the environment
 * (SEED_ADMIN_PASSWORD, SEED_RESPONDER_PASSWORD, SEED_VIEWER_PASSWORD).
 */
import type { Role } from "../../lib/domain/types";

export const SEED_ORGANIZATION = { name: "Demo Organization" } as const;
export const SEED_REGION = { name: "Demo Region", slug: "demo-region" } as const;

export interface SeedAccount {
  email: string;
  name: string;
  role: Role;
  passwordEnv: "SEED_ADMIN_PASSWORD" | "SEED_RESPONDER_PASSWORD" | "SEED_VIEWER_PASSWORD";
}

/** One account per role, all in the demo region (D1: one region per user; Org Admins included). */
export const SEED_ACCOUNTS: readonly SeedAccount[] = [
  { email: "admin@example.org", name: "Demo Org Admin", role: "org_admin", passwordEnv: "SEED_ADMIN_PASSWORD" },
  { email: "responder@example.org", name: "Demo Responder", role: "responder", passwordEnv: "SEED_RESPONDER_PASSWORD" },
  { email: "viewer@example.org", name: "Demo Viewer", role: "viewer", passwordEnv: "SEED_VIEWER_PASSWORD" },
  // Separate least-privilege account; it intentionally reuses the local responder demo password.
  { email: "technician@example.org", name: "Demo Technician", role: "technician", passwordEnv: "SEED_RESPONDER_PASSWORD" },
];
